// src/screens/ParentDashboardScreen.tsx — Attendy Mobile
// Attendance rate now uses a 90-day rolling window as the denominator
// (matching the intent of the web's term-based calculation) rather than
// counting only scanned days.  Parents now also see "Absent" explicitly.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { fetchParentAttendance } from '../lib/webApi';
import { formatDate, formatTime, getInitials } from '../lib/utils';
import { RADIUS, FONT, SPACING } from '../lib/theme';
import { registerParentPushToken, PushRegistrationResult } from '../lib/notification';

type Student = {
  id: string; full_name: string; class_name: string | null;
  organisation_id: string; parent_phone: string | null;
};
type Log = { id: string; scanned_at: string; status: string; scan_type: string; late_reason: string | null };
type OrgInfo = { name: string; primary_color: string; settings?: { term_start_date?: string; term_end_date?: string } };

export default function ParentDashboardScreen({ navigation, route }: any) {
  const { students, token } = route.params ?? {};
  const { theme, isDark, mode, setMode } = useTheme();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [logs, setLogs] = useState<Log[]>([]);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [orgSettings, setOrgSettings] = useState<{ term_start_date?: string; term_end_date?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushRegistrationResult | 'pending' | null>(null);

  const safeStudents: Student[] = Array.isArray(students) && students.length > 0 ? students : [];
  const selected = safeStudents[selectedIdx] as Student | undefined;
  const primary = org?.primary_color || '#16a34a';

  // Register push token for this parent so they receive arrival/absence pushes.
  // We register for all their children's member IDs so each student's
  // notifications go to the right parent. Result is kept in state (see
  // the notification bell in the header) instead of just logged, since a
  // standalone build has no console you can watch — this is how you find
  // out *why* registration failed instead of guessing.
  useEffect(() => {
    if (safeStudents.length === 0 || !token) return;
    setPushStatus('pending');
    (async () => {
      let lastResult: PushRegistrationResult | null = null;
      for (const student of safeStudents) {
        lastResult = await registerParentPushToken(student.id, token);
      }
      setPushStatus(lastResult);
    })();
  }, [safeStudents.map(s => s.id).join(','), token]);

  function showPushStatus() {
    if (!pushStatus || pushStatus === 'pending') {
      Alert.alert('Notifications', 'Still registering this device for notifications — try again in a moment.');
      return;
    }
    if (pushStatus.ok) {
      Alert.alert('Notifications enabled', 'This device is registered and should receive attendance alerts.');
    } else {
      Alert.alert(
        `Notifications not enabled (${pushStatus.step})`,
        pushStatus.reason
      );
    }
  }

  const fetchLogs = useCallback(async (refresh = false) => {
    if (!selected || !token) return;
    if (refresh) setRefreshing(true); else setLoading(true);

    // Server verifies the signed token and only ever returns data for a
    // studentId that was actually part of this parent's verified login —
    // replaces the old direct anon-key queries against
    // attendance_logs / organisations.
    const result = await fetchParentAttendance(token, selected.id);

    if (!result.ok) {
      if (result.expired) {
        // Session expired server-side — send them back to log in again.
        navigation.reset({ index: 0, routes: [{ name: 'ParentLogin' }] });
        return;
      }
      setLogs([]);
    } else {
      setLogs(result.logs);
      if (result.org) {
        setOrg({
          name: result.org.name,
          primary_color: result.org.primary_color ?? '#16a34a',
          settings: result.org.settings ?? {},
        });
        const s = result.org.settings as any;
        setOrgSettings({
          term_start_date: s?.term_start_date ?? undefined,
          term_end_date:   s?.term_end_date   ?? undefined,
        });
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, [selected?.id, token]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // ── Term date calculation ─────────────────────────────────────
  // Use real term dates from org settings when available.
  // Fall back to a 90-day window only if the school hasn't configured them.
  const termStart = orgSettings?.term_start_date
    ? new Date(orgSettings.term_start_date)
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const termEnd = orgSettings?.term_end_date
    ? new Date(orgSettings.term_end_date)
    : new Date();

  const today    = new Date().toISOString().split('T')[0];
  const todayLog = logs.find(l => l.scanned_at.startsWith(today));

  // Filter logs to the term window for accurate stats
  const termLogs     = logs.filter(l => {
    const d = new Date(l.scanned_at);
    return d >= termStart && d <= termEnd;
  });
  const presentCount = termLogs.filter(l => l.status === 'present').length;
  const lateCount    = termLogs.filter(l => l.status === 'late').length;
  const excusedCount = termLogs.filter(l => l.status === 'excused').length;
  const attendedDays = presentCount + lateCount + excusedCount;

  const totalDays  = Math.max(
    Math.ceil((termEnd.getTime() - termStart.getTime()) / (1000 * 60 * 60 * 24)),
    1
  );
  const absentDays = Math.max(0, totalDays - attendedDays);
  const pct        = Math.min(100, Math.round((attendedDays / totalDays) * 100));
  const pctColor   = pct >= 75 ? theme.success : pct >= 50 ? theme.warn : theme.danger;

  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    present: { label: 'On time', color: theme.success, bg: theme.successBg, icon: 'checkmark-circle-outline' },
    late:    { label: 'Late',    color: theme.warn,    bg: theme.warnBg,    icon: 'time-outline'             },
    excused: { label: 'Excused', color: theme.info,    bg: theme.infoBg,    icon: 'shield-checkmark-outline' },
  };

  // ── Empty / error state ───────────────────────────────────────
  if (safeStudents.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.textMuted} />
        <Text style={{ fontSize: FONT.lg, fontWeight: '700', color: theme.text, marginTop: 16, textAlign: 'center' }}>
          No Students Found
        </Text>
        <Text style={{ fontSize: FONT.sm, color: theme.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
          We couldn't find any students linked to this phone number. Please check with your school admin that the correct number is registered.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginTop: 28, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.lg, backgroundColor: '#16a34a' }}
        >
          <Text style={{ color: 'white', fontWeight: '700', fontSize: FONT.sm }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.header, { backgroundColor: theme.bgCard, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={20} color={theme.textSub} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{org?.name ?? 'Parent Portal'}</Text>
          <Text style={[styles.headerSub, { color: theme.textMuted }]}>Attendance Viewer</Text>
        </View>
        <TouchableOpacity onPress={showPushStatus} style={{ padding: 4, marginRight: 4 }}>
          <Ionicons
            name={pushStatus && pushStatus !== 'pending' && !pushStatus.ok ? 'notifications-off-outline' : 'notifications-outline'}
            size={20}
            color={pushStatus && pushStatus !== 'pending' && !pushStatus.ok ? theme.danger : (pushStatus && pushStatus !== 'pending' && pushStatus.ok ? primary : theme.textMuted)}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('ParentExcuse', { students: safeStudents, token, studentId: selected?.id })}
          style={{ padding: 4, marginRight: 4 }}
        >
          <Ionicons name="document-text-outline" size={20} color={theme.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')} style={{ padding: 4, marginRight: 4 }}>
          <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={20} color={theme.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => fetchLogs(true)} style={{ padding: 4 }}>
          <Ionicons name="refresh-outline" size={20} color={theme.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchLogs(true)} tintColor={primary} />}>
        {/* Child selector tabs */}
        {safeStudents.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: 8, paddingVertical: SPACING.md }}
          >
            {safeStudents.map((s: Student, i: number) => (
              <TouchableOpacity key={s.id} onPress={() => setSelectedIdx(i)}
                style={[styles.tab, { backgroundColor: selectedIdx === i ? primary : theme.bgCard, borderColor: selectedIdx === i ? primary : theme.border }]}
              >
                <Text style={[styles.tabText, { color: selectedIdx === i ? 'white' : theme.textSub }]}>
                  {s.full_name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Profile card */}
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border, margin: SPACING.lg, marginTop: students.length > 1 ? 0 : SPACING.lg }]}>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: `${primary}18`, borderColor: primary }]}>
              <Text style={[styles.avatarText, { color: primary }]}>{getInitials(selected?.full_name ?? '')}</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[styles.profileName, { color: theme.text }]}>{selected?.full_name}</Text>
              {selected?.class_name && (
                <View style={[styles.classBadge, { backgroundColor: `${primary}15`, borderColor: `${primary}30` }]}>
                  <Ionicons name="school-outline" size={11} color={primary} />
                  <Text style={[styles.classBadgeText, { color: primary }]}>{selected.class_name}</Text>
                </View>
              )}
              {todayLog ? (() => {
                const cfg = STATUS_CONFIG[todayLog.status] ?? STATUS_CONFIG.present;
                return (
                  <View style={[styles.todayBadge, { backgroundColor: cfg.bg, borderColor: `${cfg.color}50` }]}>
                    <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
                    <Text style={[styles.todayBadgeText, { color: cfg.color }]}>
                      {cfg.label} today · {formatTime(todayLog.scanned_at)}
                    </Text>
                  </View>
                );
              })() : (
                <View style={[styles.absentBadge, { backgroundColor: theme.dangerBg, borderColor: `${theme.danger}30` }]}>
                  <Ionicons name="alert-circle-outline" size={13} color={theme.danger} />
                  <Text style={[styles.absentBadgeText, { color: theme.danger }]}>Not scanned today</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Stat chips — now includes Absent */}
        <View style={styles.statsGrid}>
          {[
            { l: 'On time', v: presentCount,  c: theme.success },
            { l: 'Late',    v: lateCount,     c: theme.warn    },
            { l: 'Excused', v: excusedCount,  c: theme.info    },
            { l: 'Absent',  v: absentDays,    c: absentDays > 0 ? theme.danger : theme.textMuted },
          ].map(({ l, v, c }) => (
            <View key={l} style={[styles.statCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
              <Text style={[styles.statValue, { color: c }]}>{v}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>{l}</Text>
            </View>
          ))}
        </View>

        {/* Attendance rate bar */}
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border, margin: SPACING.lg, marginTop: 0 }]}>
          <View style={styles.barHeader}>
            <View>
              <Text style={[styles.barTitle, { color: theme.textSub }]}>Attendance rate</Text>
              <Text style={[styles.barWindowText, { color: theme.textMuted }]}>
                {orgSettings?.term_start_date
                  ? `Term: ${new Date(orgSettings.term_start_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} – ${new Date(orgSettings.term_end_date ?? new Date()).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}`
                  : 'Last 90 days (term dates not set)'
                }
              </Text>
            </View>
            <Text style={[styles.barPct, { color: pctColor }]}>
              {pct}% {pct >= 75 ? '✓ Good' : '⚠ Below 75%'}
            </Text>
          </View>
          <View style={[styles.barTrack, { backgroundColor: theme.bgCardAlt }]}>
            <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: pctColor }]} />
          </View>
          <Text style={[styles.barSub, { color: theme.textMuted }]}>
            {attendedDays} attended of {totalDays} days in term · {absentDays} absent
          </Text>
        </View>

        {/* Scan history */}
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border, margin: SPACING.lg, marginTop: 0 }]}>
          <View style={[styles.historyHeader, { borderBottomColor: theme.border }]}>
            <Ionicons name="calendar-outline" size={15} color={primary} />
            <Text style={[styles.historyTitle, { color: theme.text }]}>Scan History</Text>
            <Text style={[styles.historyCount, { color: theme.textMuted }]}>{logs.length} records</Text>
          </View>
          {loading ? (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <ActivityIndicator color={primary} />
            </View>
          ) : logs.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center', gap: 10 }}>
              <Ionicons name="calendar-outline" size={32} color={theme.textMuted} />
              <Text style={{ fontSize: FONT.sm, color: theme.textMuted }}>No attendance records yet</Text>
            </View>
          ) : logs.slice(0, 30).map((log, i) => {
            const cfg = STATUS_CONFIG[log.status] ?? { color: theme.textMuted, label: log.status, bg: theme.bgCardAlt, icon: 'help-circle-outline' };
            return (
              <View key={log.id} style={[styles.logRow, i < 29 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                <View style={[styles.logDot, { backgroundColor: cfg.bg, borderColor: `${cfg.color}50` }]}>
                  <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.logDate, { color: theme.text }]}>{formatDate(log.scanned_at)}</Text>
                  {log.late_reason && (
                    <Text style={[styles.logReason, { color: theme.textMuted }]}>{log.late_reason}</Text>
                  )}
                </View>
                <Text style={[styles.logTime, { color: theme.textMuted }]}>{formatTime(log.scanned_at)}</Text>
                <View style={[styles.logBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.logBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ padding: 24, paddingTop: 8, alignItems: 'center' }}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            For queries, contact {org?.name ?? 'your school'} directly.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingBottom: SPACING.md, borderBottomWidth: 1 },
  headerTitle: { fontSize: FONT.base, fontWeight: '700' },
  headerSub: { fontSize: FONT.xs, letterSpacing: 0.8, marginTop: 1 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1 },
  tabText: { fontSize: FONT.sm, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: RADIUS.xl, overflow: 'hidden' },
  profileRow: { flexDirection: 'row', gap: 14, padding: SPACING.lg },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FONT.xl, fontWeight: '800' },
  profileName: { fontSize: FONT.lg, fontWeight: '700' },
  classBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm, borderWidth: 1 },
  classBadgeText: { fontSize: FONT.xs, fontWeight: '600' },
  todayBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.md, borderWidth: 1 },
  todayBadgeText: { fontSize: FONT.sm, fontWeight: '600' },
  absentBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.md, borderWidth: 1 },
  absentBadgeText: { fontSize: FONT.sm, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', gap: 8, marginHorizontal: SPACING.lg, marginBottom: SPACING.md },
  statCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: FONT.xs, marginTop: 2 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: SPACING.md, paddingBottom: 8 },
  barTitle: { fontSize: FONT.sm, fontWeight: '600' },
  barWindowText: { fontSize: FONT.xs, marginTop: 2 },
  barPct: { fontSize: FONT.sm, fontWeight: '700' },
  barTrack: { height: 8, marginHorizontal: SPACING.md, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barSub: { fontSize: FONT.xs, padding: SPACING.md, paddingTop: 6 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SPACING.md, borderBottomWidth: 1 },
  historyTitle: { flex: 1, fontSize: FONT.base, fontWeight: '700' },
  historyCount: { fontSize: FONT.xs },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingHorizontal: SPACING.md },
  logDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  logDate: { fontSize: FONT.sm, fontWeight: '600' },
  logReason: { fontSize: FONT.xs, marginTop: 1 },
  logTime: { fontSize: FONT.xs, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  logBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.sm },
  logBadgeText: { fontSize: FONT.xs, fontWeight: '700' },
  footerText: { fontSize: FONT.xs, textAlign: 'center', lineHeight: 16 },
});