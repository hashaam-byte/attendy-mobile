// src/screens/NotificationsScreen.tsx — ATTENDY-EDU
// SMS log for admins — shows every message sent, who it went to,
// the full SMS text, delivery status. Tap any row to read the full message.
// Clear button removes all logs for the org.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, Platform, TouchableOpacity, Modal,
  Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/utils';
import { RADIUS, FONT, SPACING, SCREEN_BOTTOM_PAD } from '../lib/theme';

type NotifLog = {
  id:        string;
  sent_at:   string;
  recipient: string;
  message:   string;
  status:    string;
  channel:   string;
  member_id: string | null;
  full_name: string | null;  // stitched in separately — no join
};

export default function NotificationsScreen() {
  const { authState } = useAuth();
  const { theme }     = useTheme();
  const [logs, setLogs]             = useState<NotifLog[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [selected, setSelected]     = useState<NotifLog | null>(null);
  const [clearing, setClearing]     = useState(false);

  const c          = authState?.primaryColor || '#16a34a';
  const todayStart = new Date().toISOString().split('T')[0];

  const load = useCallback(async (refresh = false) => {
    if (!authState) return;
    if (refresh) setRefreshing(true); else setLoading(true);

    // ── Step 1: fetch logs with NO join — same fix as excuses page ──────────
    // A relational join on members fails silently under RLS and shows "—"
    // for all student names. Fetch flat then stitch manually.
    const [logsRes, todayRes, failedRes] = await Promise.all([
      supabase
        .from('notifications_log')
        .select('id,sent_at,recipient,message,status,channel,member_id')
        .eq('organisation_id', authState.orgId)
        .order('sent_at', { ascending: false })
        .limit(100),
      supabase
        .from('notifications_log')
        .select('*', { count: 'exact', head: true })
        .eq('organisation_id', authState.orgId)
        .gte('sent_at', `${todayStart}T00:00:00`),
      supabase
        .from('notifications_log')
        .select('*', { count: 'exact', head: true })
        .eq('organisation_id', authState.orgId)
        .eq('status', 'failed')
        .gte('sent_at', new Date(Date.now() - 86400000).toISOString()),
    ]);

    const rawLogs = logsRes.data ?? [];

    // ── Step 2: fetch member names separately ────────────────────────────────
    const memberIds = [...new Set(
      rawLogs.map((l: any) => l.member_id).filter(Boolean)
    )] as string[];

    let nameMap: Record<string, string> = {};
    if (memberIds.length > 0) {
      const { data: members } = await supabase
        .from('members')
        .select('id, full_name')
        .in('id', memberIds);
      for (const m of members ?? []) {
        nameMap[m.id] = m.full_name;
      }
    }

    // ── Step 3: stitch ───────────────────────────────────────────────────────
    const stitched: NotifLog[] = rawLogs.map((l: any) => ({
      ...l,
      full_name: l.member_id ? (nameMap[l.member_id] ?? null) : null,
    }));

    setLogs(stitched);
    setTodayCount(todayRes.count ?? 0);
    setFailedCount(failedRes.count ?? 0);
    setLoading(false);
    setRefreshing(false);
  }, [authState?.orgId]);

  useEffect(() => { load(); }, [load]);

  async function handleClear() {
    if (!authState) return;
    Alert.alert(
      'Clear SMS Log',
      'This will permanently delete all SMS history for your school from the database. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              // Use the clear_org_notifications RPC which runs as SECURITY DEFINER
              // (superuser) — the regular supabase client DELETE is blocked by RLS
              // on notifications_log even for admins. The RPC verifies admin role
              // via auth.uid() before deleting, so it's still secure.
              const { data, error } = await supabase
                .rpc('clear_org_notifications', { org_id: authState.orgId });

              if (error) {
                Alert.alert('Error', 'Could not clear logs: ' + error.message);
              } else {
                setLogs([]);
                setTodayCount(0);
                setFailedCount(0);
                Alert.alert('Done', `Cleared ${data ?? 0} SMS records from the database.`);
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Unknown error');
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
    
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>

      {/* Stats row */}
      <View style={[s.statsRow, { backgroundColor: theme.bgCard, borderBottomColor: theme.border }]}>
        <View style={[s.statCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          <Ionicons name="notifications-outline" size={18} color={c} />
          <Text style={[s.statVal, { color: c }]}>{todayCount}</Text>
          <Text style={[s.statLbl, { color: theme.textMuted }]}>Sent Today</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          <Ionicons name="close-circle-outline" size={18} color={failedCount > 0 ? theme.danger : theme.textMuted} />
          <Text style={[s.statVal, { color: failedCount > 0 ? theme.danger : theme.textSub }]}>{failedCount}</Text>
          <Text style={[s.statLbl, { color: theme.textMuted }]}>Failed (24h)</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          <Ionicons name="list-outline" size={18} color={theme.textSub} />
          <Text style={[s.statVal, { color: theme.text }]}>{logs.length}</Text>
          <Text style={[s.statLbl, { color: theme.textMuted }]}>Total Logged</Text>
        </View>
      </View>

      {/* Failed warning */}
      {failedCount > 0 && (
        <View style={[s.alertBar, { backgroundColor: theme.dangerBg, borderBottomColor: `${theme.danger}30` }]}>
          <Ionicons name="warning-outline" size={14} color={theme.danger} />
          <Text style={[s.alertText, { color: theme.dangerText }]}>
            {failedCount} SMS failed in the last 24 hours. Check your Termii balance.
          </Text>
        </View>
      )}

      {/* Clear button */}
      {logs.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          disabled={clearing}
          style={[s.clearBtn, { borderColor: theme.border, backgroundColor: theme.bgCard }]}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={14} color={theme.danger} />
          <Text style={[s.clearText, { color: theme.danger }]}>
            {clearing ? 'Clearing…' : 'Clear All Logs'}
          </Text>
        </TouchableOpacity>
      )}

      {/* List */}
      <FlatList
        data={logs}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={c} />}
        contentContainerStyle={{ paddingBottom: SCREEN_BOTTOM_PAD }}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: theme.border, marginLeft: 64 }} />
        )}
        renderItem={({ item }) => {
          const ok = item.status === 'sent' || item.status === 'delivered';
          const sc = ok ? theme.success : item.status === 'failed' ? theme.danger : theme.textMuted;
          return (
            <TouchableOpacity
              onPress={() => setSelected(item)}
              activeOpacity={0.7}
              style={[s.row, { backgroundColor: theme.bgCard }]}
            >
              <View style={[s.icon, { backgroundColor: `${sc}15` }]}>
                <Ionicons
                  name={item.channel === 'whatsapp' ? 'logo-whatsapp' : 'chatbubble-outline'}
                  size={16}
                  color={sc}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.rowTop}>
                  <Text style={[s.name, { color: theme.text }]}>
                    {item.full_name ?? 'Unknown Student'}
                  </Text>
                  <View style={[s.badge, { backgroundColor: `${sc}15` }]}>
                    <Text style={[s.badgeText, { color: sc }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={[s.recipient, { color: theme.textMuted }]} numberOfLines={1}>
                  {item.channel === 'whatsapp' ? '📱 ' : '💬 '}{item.recipient}
                </Text>
                {/* Show full SMS text — 3 lines max, tap to see all */}
                <Text style={[s.message, { color: theme.textSub }]} numberOfLines={3}>
                  {item.message}
                </Text>
                <View style={s.footer}>
                  <Text style={[s.time, { color: theme.textMuted }]}>
                    {formatDateTime(item.sent_at)}
                  </Text>
                  <Text style={[s.tapHint, { color: theme.textMuted }]}>
                    Tap to read full ›
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 56, gap: 12 }}>
            <Ionicons name="chatbubble-outline" size={40} color={theme.textMuted} />
            <Text style={{ fontSize: FONT.lg, fontWeight: '700', color: theme.text }}>
              No SMS sent yet
            </Text>
            <Text style={{ fontSize: FONT.sm, color: theme.textMuted, textAlign: 'center' }}>
              SMS notifications fire automatically when students scan in or are marked absent.
            </Text>
          </View>
        }
      />

      {/* Full detail modal */}
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        {selected && (
          <View style={[s.modal, { backgroundColor: theme.bg }]}>

            {/* Modal header */}
            <View style={[s.modalHeader, { borderBottomColor: theme.border, backgroundColor: theme.bgCard }]}>
              <Text style={[s.modalTitle, { color: theme.text }]}>SMS Detail</Text>
              <TouchableOpacity onPress={() => setSelected(null)} style={s.closeBtn}>
                <Ionicons name="close" size={22} color={theme.textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: 16 }}>

              {/* Status banner */}
              {(() => {
                const ok = selected.status === 'sent' || selected.status === 'delivered';
                const sc = ok ? theme.success : selected.status === 'failed' ? theme.danger : theme.textMuted;
                return (
                  <View style={[s.statusBanner, { backgroundColor: `${sc}15`, borderColor: `${sc}30` }]}>
                    <Ionicons
                      name={ok ? 'checkmark-circle-outline' : 'close-circle-outline'}
                      size={20}
                      color={sc}
                    />
                    <Text style={[s.statusBannerText, { color: sc }]}>
                      {ok ? 'Delivered successfully' : `Failed to deliver — ${selected.status}`}
                    </Text>
                  </View>
                );
              })()}

              {/* Fields */}
              <DetailRow label="Student" value={selected.full_name ?? 'Unknown'} theme={theme} />
              <DetailRow label="Sent to" value={selected.recipient} theme={theme} mono />
              <DetailRow label="Channel" value={selected.channel === 'whatsapp' ? 'WhatsApp' : 'SMS (generic)'} theme={theme} />
              <DetailRow label="Status" value={selected.status} theme={theme} />
              <DetailRow label="Time" value={formatDateTime(selected.sent_at)} theme={theme} />

              {/* Full message */}
              <View style={[s.msgBox, { backgroundColor: theme.bgCardAlt, borderColor: theme.border }]}>
                <Text style={[s.msgLabel, { color: theme.textMuted }]}>Message sent</Text>
                <Text style={[s.msgText, { color: theme.text }]} selectable>
                  {selected.message}
                </Text>
              </View>

            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

function DetailRow({
  label, value, theme, mono = false,
}: { label: string; value: string; theme: any; mono?: boolean }) {
  return (
    <View style={s.detailRow}>
      <Text style={[s.detailLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[
        s.detailValue,
        { color: theme.text },
        mono && { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: FONT.xs },
      ]}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  statsRow:         { flexDirection: 'row', gap: 8, padding: SPACING.lg, borderBottomWidth: 1 },
  statCard:         { flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: 10, alignItems: 'center', gap: 4 },
  statVal:          { fontSize: 20, fontWeight: '800' },
  statLbl:          { fontSize: FONT.xs },
  alertBar:         { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: SPACING.lg, paddingVertical: 10, borderBottomWidth: 1 },
  alertText:        { flex: 1, fontSize: FONT.sm, lineHeight: 18 },
  clearBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: SPACING.lg, marginTop: SPACING.md, marginBottom: 4, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderRadius: RADIUS.lg, alignSelf: 'flex-start' },
  clearText:        { fontSize: FONT.xs, fontWeight: '600' },
  row:              { flexDirection: 'row', gap: 12, padding: SPACING.md, paddingHorizontal: SPACING.lg },
  icon:             { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowTop:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  name:             { fontSize: FONT.sm, fontWeight: '600', flex: 1, marginRight: 8 },
  badge:            { paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.sm },
  badgeText:        { fontSize: FONT.xs, fontWeight: '700' },
  recipient:        { fontSize: FONT.xs, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 3 },
  message:          { fontSize: FONT.sm, lineHeight: 18, marginBottom: 4 },
  footer:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time:             { fontSize: FONT.xs },
  tapHint:          { fontSize: FONT.xs, fontStyle: 'italic' },
  // Modal
  modal:            { flex: 1 },
  modalHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: 14, borderBottomWidth: 1 },
  modalTitle:       { fontSize: FONT.md, fontWeight: '700' },
  closeBtn:         { padding: 4 },
  statusBanner:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: RADIUS.lg, borderWidth: 1, marginBottom: 4 },
  statusBannerText: { fontSize: FONT.sm, fontWeight: '600' },
  detailRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
  detailLabel:      { fontSize: FONT.sm, fontWeight: '600', width: 80 },
  detailValue:      { fontSize: FONT.sm, flex: 1, textAlign: 'right' },
  msgBox:           { borderRadius: RADIUS.lg, borderWidth: 1, padding: 14, gap: 8, marginTop: 8 },
  msgLabel:         { fontSize: FONT.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  msgText:          { fontSize: FONT.sm, lineHeight: 20 },
});