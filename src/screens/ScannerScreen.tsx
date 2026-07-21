import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  Vibration, ActivityIndicator, AppState, AppStateStatus,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import {
  syncMembersToLocal, findMemberByQR, checkLocalLedger,
  markScannedLocally, queueScan, syncQueueToServer,
  getQueueCount, getLastSyncTime, getLocalMemberCount,
  purgeOldLedgers, clearLocalStore,
  type QueuedScan,
} from '../lib/OfflineStore';
import { formatTime, getCutoffDisplay } from '../lib/utils';
import { RADIUS, FONT, SPACING } from '../lib/theme';

type ScanMode = 'entry' | 'exit';
type ResultType = 'success'|'late'|'exit'|'duplicate'|'unknown'|'suspended'|'error';
type ScanResult = {
  type: ResultType; name: string; className?: string;
  time: string; message?: string;
};

const RESULT_META = {
  success:   { icon: 'checkmark-circle', label: '✓ On Time' },
  late:      { icon: 'time',             label: 'Late Arrival' },
  exit:      { icon: 'log-out',          label: '✓ Exit Recorded' },
  duplicate: { icon: 'alert-circle',     label: 'Already Scanned' },
  suspended: { icon: 'shield-off',       label: '⚠ Suspended' },
  error:     { icon: 'close-circle',     label: 'Error' },
  unknown:   { icon: 'help-circle',      label: 'Not Found' },
};

// Sync interval — refresh local member list every 5 minutes while online
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export default function ScannerScreen() {
  const { authState } = useAuth();
  const { theme, isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode,        setMode]        = useState<ScanMode>('entry');
  const [processing,  setProcessing]  = useState(false);
  const [result,      setResult]      = useState<ScanResult | null>(null);
  const [counts,      setCounts]      = useState({ entry: 0, exit: 0 });
  const [recent,      setRecent]      = useState<{name:string;status:string;time:string;mode:ScanMode}[]>([]);
  const [isOnline,    setIsOnline]    = useState(true);
  const [queueCount,  setQueueCount]  = useState(0);
  const [cachedCount, setCachedCount] = useState(0);
  const [lastSync,    setLastSync]    = useState<string | null>(null);
  const [syncing,     setSyncing]     = useState(false);

  const lastRef     = useRef('');
  const lastTimeRef = useRef(0);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const c  = authState?.primaryColor || '#16a34a';
  const mc = mode === 'entry' ? c : theme.purple;

  // ── Network monitoring ─────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online && authState) {
        // Back online — sync queue then refresh member list
        syncQueueToServer(authState.orgId).then(({ uploaded }) => {
          if (uploaded > 0) setQueueCount(0);
          return doSync();
        }).catch(console.warn);
      }
    });
    return () => unsub();
  }, [authState?.orgId]);

  // ── Initial sync + periodic refresh ───────────────────────
  useEffect(() => {
    if (!authState) return;
    purgeOldLedgers(authState.orgId);
    doSync();

    // Refresh every 5 minutes while app is open
    syncTimer.current = setInterval(() => {
      if (isOnline) doSync();
    }, SYNC_INTERVAL_MS);

    // Refresh on app foreground
    const appSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && isOnline && authState) doSync();
    });

    getQueueCount(authState.orgId).then(setQueueCount);
    getLocalMemberCount(authState.orgId).then(setCachedCount);
    getLastSyncTime(authState.orgId).then(setLastSync);

    return () => {
      if (syncTimer.current) clearInterval(syncTimer.current);
      appSub.remove();
    };
  }, [authState?.orgId]);

  async function doSync() {
    if (!authState || syncing) return;
    setSyncing(true);
    try {
      const { memberCount } = await syncMembersToLocal(authState.orgId);
      setCachedCount(memberCount);
      setLastSync(new Date().toISOString());
    } catch (e) {
      console.warn('[Scanner] Sync failed:', e);
    } finally {
      setSyncing(false);
    }
  }

  function getResultColors(type: ResultType) {
    switch (type) {
      case 'success':   return { color: theme.success,  bg: theme.successBg };
      case 'late':      return { color: theme.warn,     bg: theme.warnBg };
      case 'exit':      return { color: theme.purple,   bg: theme.purpleBg };
      case 'duplicate': return { color: theme.info,     bg: theme.infoBg };
      case 'suspended': return { color: theme.warn,     bg: theme.warnBg };
      default:          return { color: theme.danger,   bg: theme.dangerBg };
    }
  }

  function clearResult() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setResult(null), 5000);
  }

  const handleScan = useCallback(async (data: string) => {
    if (processing || !authState) return;
    const now = Date.now();
    if (data === lastRef.current && now - lastTimeRef.current < 3000) return;
    lastRef.current = data;
    lastTimeRef.current = now;
    if (timerRef.current) clearTimeout(timerRef.current);
    setProcessing(true);
    setResult(null);

    try {
      // ── 1. Look up member in LOCAL encrypted store first ─────────────
      // This works perfectly offline. Online we fall back to Supabase
      // only if local store is empty (first launch with no sync yet).
      let member = await findMemberByQR(authState.orgId, data);

      if (!member && isOnline) {
        // Local store empty or member not found — try server directly
        const { data: serverMember } = await supabase
          .from('members')
          .select('id, qr_code, full_name, class_name, parent_phone, is_active')
          .eq('qr_code', data)
          .eq('organisation_id', authState.orgId)
          .maybeSingle();
        member = serverMember;
      }

      if (!member) {
        Vibration.vibrate(400);
        setResult({ type: 'unknown', name: 'Not Found', time: new Date().toLocaleTimeString(), message: 'QR not registered in this school.' });
        setProcessing(false); clearResult(); return;
      }

      if (!member.is_active) {
        Vibration.vibrate([100, 100, 100]);
        setResult({ type: 'suspended', name: member.full_name, className: member.class_name ?? undefined, time: new Date().toLocaleTimeString(), message: 'Student is suspended.' });
        setProcessing(false); clearResult(); return;
      }

      // ── 2. Check local ledger for duplicate (works offline) ──────────
      const localLedger = await checkLocalLedger(authState.orgId, member.id, mode);
      if (localLedger) {
        Vibration.vibrate(200);
        setResult({
          type: 'duplicate', name: member.full_name, className: member.class_name ?? undefined,
          time: new Date().toLocaleTimeString(),
          message: `Already ${mode === 'exit' ? 'exited' : 'scanned'} at ${formatTime(localLedger.scanned_at)}`,
        });
        setProcessing(false); clearResult(); return;
      }

      // ── 3. Server duplicate check (online only, catches other devices) ─
      if (isOnline) {
        const todayStart = new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase
          .from('attendance_logs')
          .select('id, scanned_at')
          .eq('member_id', member.id)
          .eq('organisation_id', authState.orgId)
          .eq('scan_type', mode)
          .gte('scanned_at', `${todayStart}T00:00:00`)
          .limit(1);

        if (existing && existing.length > 0) {
          // Update local ledger so we don't hit server again
          await markScannedLocally(authState.orgId, member.id, mode, {
            scanned_at: existing[0].scanned_at, status: 'present', mode,
          });
          Vibration.vibrate(200);
          setResult({
            type: 'duplicate', name: member.full_name, className: member.class_name ?? undefined,
            time: new Date().toLocaleTimeString(),
            message: `Already ${mode === 'exit' ? 'exited' : 'scanned'} at ${formatTime(existing[0].scanned_at)}`,
          });
          setProcessing(false); clearResult(); return;
        }
      }

      // ── 4. Determine status ──────────────────────────────────────────
      let status: 'present' | 'late' | 'early_exit' = mode === 'exit' ? 'early_exit' : 'present';
      if (mode === 'entry') {
        const st    = (authState.settings.start_time as string) || '07:30';
        const grace = (authState.settings.grace_period_minutes as number) ?? 15;
        const [sh, sm] = st.split(':').map(Number);
        const cut   = new Date(); cut.setHours(sh, sm + grace, 0, 0);
        if (new Date() > cut) status = 'late';
      }

      const scannedAt = new Date().toISOString();

      // ── 5. Write to local ledger immediately (offline-safe) ──────────
      await markScannedLocally(authState.orgId, member.id, mode, {
        scanned_at: scannedAt, status, mode,
      });

      // ── 6. Upload to Supabase or queue for later ─────────────────────
      const scanRecord: QueuedScan = {
        id:              `${member.id}:${mode}:${Date.now()}`,
        organisation_id: authState.orgId,
        member_id:       member.id,
        scan_type:       mode,
        status,
        late_reason:     null,
        scanned_at:      scannedAt,
        queued_at:       scannedAt,
      };

      if (isOnline) {
        const { error: insErr } = await supabase.from('attendance_logs').insert({
          organisation_id: scanRecord.organisation_id,
          member_id:       scanRecord.member_id,
          scan_type:       scanRecord.scan_type,
          status:          scanRecord.status,
          late_reason:     scanRecord.late_reason,
          device_id:       'mobile-app',
          scanned_at:      scanRecord.scanned_at,
        });

        if (insErr) {
          // Upload failed — queue it
          await queueScan(scanRecord);
          const q = await getQueueCount(authState.orgId);
          setQueueCount(q);
        } else if (mode === 'entry') {
          // Send SMS notification — fire and forget
          const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://attendy-edu.vercel.app';
          fetch(`${WEB_URL}/api/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type:      'arrival',
              member_id: member.id,
              org_id:    authState.orgId,
              is_late:   status === 'late',
            }),
          }).catch(() => {});
        }
      } else {
        // Offline — queue for later
        await queueScan(scanRecord);
        const q = await getQueueCount(authState.orgId);
        setQueueCount(q);
      }

      // ── 7. Update UI ─────────────────────────────────────────────────
      const t  = new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
      const rt: ResultType = mode === 'exit' ? 'exit' : status === 'present' ? 'success' : 'late';
      Vibration.vibrate(rt === 'success' ? [50] : rt === 'late' ? [100, 50, 100] : rt === 'exit' ? [50, 50, 50] : [200, 100, 200]);
      setCounts(p => ({ ...p, [mode]: p[mode] + 1 }));
      setResult({ type: rt, name: member.full_name, className: member.class_name ?? undefined, time: t });
      setRecent(p => [{ name: member.full_name, status: mode === 'exit' ? 'exit' : status, time: t, mode }, ...p.slice(0, 3)]);
      clearResult();

    } catch (e) {
      console.error('[Scanner] handleScan error:', e);
      setResult({ type: 'error', name: 'Error', time: new Date().toLocaleTimeString(), message: 'Something went wrong.' });
      clearResult();
    } finally {
      setProcessing(false);
    }
  }, [processing, authState, mode, isOnline]);

  const cutoff = authState ? getCutoffDisplay(authState.settings) : '8:15 AM';

  // Format last sync time
  const lastSyncLabel = (() => {
    if (!lastSync) return 'Not synced yet';
    const d = new Date(lastSync);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  })();

  if (!permission) return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={c} />
    </View>
  );

  if (!permission.granted) return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
      <View style={[s.permIcon, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
        <Ionicons name="camera-outline" size={36} color={theme.textMuted} />
      </View>
      <Text style={[s.permTitle, { color: theme.text }]}>Camera Access Required</Text>
      <Text style={[s.permSub, { color: theme.textSub }]}>Attendy needs camera access to scan QR codes at the gate.</Text>
      <TouchableOpacity style={[s.permBtn, { backgroundColor: c }]} onPress={requestPermission}>
        <Text style={s.permBtnText}>Grant Camera Access</Text>
      </TouchableOpacity>
    </View>
  );

  const rc = result ? getResultColors(result.type) : null;
  const ri = result ? RESULT_META[result.type] : null;

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>

      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: theme.bgCard, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[s.headerOrg, { color: theme.text }]}>{authState?.orgName}</Text>
          <Text style={[s.headerMode, { color: mc }]}>{mode === 'entry' ? '↑ ENTRY MODE' : '↓ EXIT MODE'}</Text>
        </View>
        <View style={s.headerRight}>
          <View style={s.counters}>
            <View style={[s.counterChip, { backgroundColor: theme.successBg }]}>
              <Text style={[s.counterText, { color: theme.success }]}>↑ {counts.entry}</Text>
            </View>
            <View style={[s.counterChip, { backgroundColor: theme.purpleBg }]}>
              <Text style={[s.counterText, { color: theme.purple }]}>↓ {counts.exit}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Offline / Sync status bar ── */}
      <View style={[s.statusBar, {
        backgroundColor: !isOnline ? '#78350f' : theme.bgCard,
        borderBottomColor: theme.border,
      }]}>
        <View style={s.statusLeft}>
          <View style={[s.dot, { backgroundColor: isOnline ? theme.success : '#f59e0b' }]} />
          <Text style={[s.statusText, { color: !isOnline ? '#fef3c7' : theme.textMuted }]}>
            {!isOnline ? '📡 Offline — scans saved locally' : `Synced ${lastSyncLabel}`}
          </Text>
          {syncing && <ActivityIndicator size="small" color={theme.textMuted} style={{ marginLeft: 6 }} />}
        </View>
        <View style={s.statusRight}>
          {queueCount > 0 && (
            <View style={[s.queueBadge, { backgroundColor: '#92400e' }]}>
              <Text style={[s.queueText, { color: '#fef3c7' }]}>{queueCount} queued</Text>
            </View>
          )}
          <Text style={[s.cacheText, { color: theme.textMuted }]}>
            {cachedCount} students cached
          </Text>
        </View>
      </View>

      {/* ── Mode toggle ── */}
      <View style={[s.modeRow, { backgroundColor: theme.bgCard, borderBottomColor: theme.border }]}>
        {(['entry', 'exit'] as ScanMode[]).map(m => (
          <TouchableOpacity
            key={m}
            onPress={() => { setMode(m); setResult(null); }}
            style={[s.modeBtn, {
              backgroundColor: mode === m ? (m === 'entry' ? `${c}18` : theme.purpleBg) : 'transparent',
              borderColor: mode === m ? (m === 'entry' ? `${c}50` : theme.purpleBg) : theme.border,
            }]}
            activeOpacity={0.7}
          >
            <Ionicons name={m === 'entry' ? 'enter-outline' : 'exit-outline'} size={16} color={mode === m ? (m === 'entry' ? c : theme.purple) : theme.textMuted} />
            <Text style={[s.modeBtnText, { color: mode === m ? (m === 'entry' ? c : theme.purple) : theme.textMuted }]}>
              {m.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Camera ── */}
      <View style={s.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={processing ? undefined : ({ data }) => handleScan(data)}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        {(['tl', 'tr', 'bl', 'br'] as const).map(pos => (
          <View key={pos} style={[s.corner, s[`c_${pos}`], { borderColor: mc }]} />
        ))}
        {!processing && <View style={[s.scanLine, { backgroundColor: mc, shadowColor: mc }]} />}
        {processing && (
          <View style={[s.procOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.7)' }]}>
            <View style={[s.procCircle, { borderColor: mc, backgroundColor: `${mc}15` }]}>
              <ActivityIndicator size="large" color={mc} />
            </View>
            <Text style={[s.procText, { color: mc }]}>PROCESSING…</Text>
          </View>
        )}
        <View style={[s.cameraInfo, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)' }]}>
          <View style={[s.dot, { backgroundColor: processing ? theme.warn : mc }]} />
          <Text style={[s.statusText, { color: processing ? theme.warn : mc }]}>
            {processing ? 'Processing…' : mode === 'entry' ? `Entry · Late after ${cutoff}` : 'Exit mode active'}
          </Text>
        </View>
      </View>

      {/* ── Result card ── */}
      {result && rc && ri && (
        <View style={[s.resultCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <View style={[s.resultLeft, { backgroundColor: rc.bg, borderColor: `${rc.color}30` }]}>
            <Ionicons name={ri.icon as any} size={26} color={rc.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.resultLabel, { color: rc.color }]}>{ri.label}</Text>
            <Text style={[s.resultName, { color: theme.text }]}>{result.name}</Text>
            {result.className && <Text style={[s.resultClass, { color: theme.textSub }]}>{result.className}</Text>}
            {result.message && <Text style={[s.resultMsg, { color: theme.textMuted }]}>{result.message}</Text>}
            {!isOnline && <Text style={[s.resultMsg, { color: '#fbbf24' }]}>⚡ Saved offline — will sync when online</Text>}
          </View>
          <Text style={[s.resultTime, { color: rc.color }]}>{result.time}</Text>
        </View>
      )}

      {/* ── Recent scans ── */}
      {recent.length > 0 && !result && (
        <View style={[s.recentWrap, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          {recent.map((sc, i) => {
            const col = sc.mode === 'exit' ? theme.purple : sc.status === 'present' ? theme.success : theme.warn;
            return (
              <View key={i} style={[s.recentRow, i < recent.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                <View style={[s.dot, { backgroundColor: col }]} />
                <Text style={[s.recentName, { color: theme.text }]}>{sc.name}</Text>
                <Text style={[s.recentStatus, { color: col }]}>{sc.mode === 'exit' ? 'Exit' : sc.status === 'present' ? 'On time' : 'Late'}</Text>
                <Text style={[s.recentTime, { color: theme.textMuted }]}>{sc.time}</Text>
              </View>
            );
          })}
        </View>
      )}

      <Text style={[s.footer, { color: theme.textMuted }]}>
        {counts.entry + counts.exit} scans this session
      </Text>
    </View>
  );
}

const C = 22;
const s = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1 },
  headerOrg:    { fontSize: FONT.base, fontWeight: '700' },
  headerMode:   { fontSize: FONT.xs, fontWeight: '800', letterSpacing: 1, marginTop: 2 },
  headerRight:  { alignItems: 'flex-end', gap: 4 },
  counters:     { flexDirection: 'row', gap: 6 },
  counterChip:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full },
  counterText:  { fontSize: FONT.sm, fontWeight: '700' },
  statusBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: 8, borderBottomWidth: 1 },
  statusLeft:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText:   { fontSize: FONT.xs, fontWeight: '500' },
  dot:          { width: 7, height: 7, borderRadius: 4 },
  queueBadge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  queueText:    { fontSize: FONT.xs, fontWeight: '700' },
  cacheText:    { fontSize: FONT.xs },
  modeRow:      { flexDirection: 'row', gap: 8, padding: 10, borderBottomWidth: 1 },
  modeBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: RADIUS.lg, borderWidth: 1.5 },
  modeBtnText:  { fontSize: FONT.sm, fontWeight: '800', letterSpacing: 0.5 },
  cameraWrap:   { flex: 1, overflow: 'hidden', position: 'relative' },
  corner:       { position: 'absolute', width: C, height: C, borderWidth: 2.5 },
  c_tl:         { top: 14, left: 14, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  c_tr:         { top: 14, right: 14, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  c_bl:         { bottom: 50, left: 14, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  c_br:         { bottom: 50, right: 14, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  scanLine:     { position: 'absolute', top: '45%', left: 16, right: 16, height: 2, borderRadius: 1, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6, elevation: 4 },
  procOverlay:  { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 12 },
  procCircle:   { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  procText:     { fontSize: FONT.sm, fontWeight: '800', letterSpacing: 1.5 },
  cameraInfo:   { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  resultCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, margin: 10, borderWidth: 1, borderRadius: RADIUS.xl, padding: 14 },
  resultLeft:   { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  resultLabel:  { fontSize: FONT.xs, fontWeight: '800', letterSpacing: 0.5 },
  resultName:   { fontSize: FONT.lg, fontWeight: '800', marginTop: 2 },
  resultClass:  { fontSize: FONT.sm, marginTop: 1 },
  resultMsg:    { fontSize: FONT.sm, marginTop: 2 },
  resultTime:   { fontSize: FONT.md, fontWeight: '800' },
  recentWrap:   { borderWidth: 1, borderRadius: RADIUS.lg, marginHorizontal: 10, overflow: 'hidden' },
  recentRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingHorizontal: 14 },
  recentName:   { flex: 1, fontSize: FONT.sm, fontWeight: '600' },
  recentStatus: { fontSize: FONT.xs, fontWeight: '700' },
  recentTime:   { fontSize: FONT.xs, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  footer:       { textAlign: 'center', fontSize: FONT.xs, padding: 8 },
  permIcon:     { width: 80, height: 80, borderRadius: RADIUS.xl, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  permTitle:    { fontSize: FONT.xl, fontWeight: '800', textAlign: 'center' },
  permSub:      { fontSize: FONT.base, textAlign: 'center', lineHeight: 22, maxWidth: 280 },
  permBtn:      { paddingHorizontal: 24, paddingVertical: 14, borderRadius: RADIUS.xl },
  permBtnText:  { color: 'white', fontWeight: '700', fontSize: FONT.md },
});