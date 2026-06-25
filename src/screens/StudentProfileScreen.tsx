// src/screens/StudentProfileScreen.tsx — Attendy Mobile
// Attendance rate is now computed over the school term (term_start_date →
// today), matching the web dashboard's calculation exactly.
// Denominator = total calendar days in the term, not just scanned days.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, Alert, RefreshControl, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { formatDate, formatTime, getInitials } from '../lib/utils';
import { RADIUS, FONT, SPACING } from '../lib/theme';

type Student = {
  id: string; full_name: string; class_name: string | null;
  parent_phone: string | null; employee_id: string | null;
  is_active: boolean; notes: string | null; created_at: string;
};
type Log = { id: string; scanned_at: string; status: string; scan_type: string; late_reason: string | null };

export default function StudentProfileScreen({ route }: any) {
  const { studentId } = route.params;
  const { authState } = useAuth();
  const { theme } = useTheme();
  const [student, setStudent] = useState<Student | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const c = authState?.primaryColor || '#16a34a';

  const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    present: { color: theme.success, label: 'On time' },
    late:    { color: theme.warn,    label: 'Late'    },
    excused: { color: theme.info,    label: 'Excused' },
  };

  // ── Derive term window from org settings ───────────────────────────────────
  // Mirrors the web's student profile page: use term_start_date / term_end_date
  // from settings if available, otherwise fall back to 3 months ago → today.
  const settings = authState?.settings ?? {};
  const termStart: Date = (settings as any).term_start_date
    ? new Date((settings as any).term_start_date)
    : new Date(new Date().setMonth(new Date().getMonth() - 3));
  const termEnd: Date = (settings as any).term_end_date
    ? new Date((settings as any).term_end_date)
    : new Date();

  const load = useCallback(async (refresh = false) => {
    if (!authState) return;
    if (refresh) setRefreshing(true);
    const [{ data: s }, { data: l }] = await Promise.all([
      supabase
        .from('members')
        .select('id,full_name,class_name,parent_phone,employee_id,is_active,notes,created_at')
        .eq('id', studentId)
        .eq('organisation_id', authState.orgId)
        .single(),
      // Fetch entry logs from the start of the term so the rate is accurate
      supabase
        .from('attendance_logs')
        .select('id,scanned_at,status,scan_type,late_reason')
        .eq('member_id', studentId)
        .eq('scan_type', 'entry')
        .gte('scanned_at', termStart.toISOString())
        .order('scanned_at', { ascending: false }),
    ]);
    if (s) setStudent(s);
    setLogs(l ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [studentId, authState?.orgId]);

  useEffect(() => { load(); }, [load]);

  function handleSuspend() {
    if (!student || !authState) return;
    Alert.alert(
      student.is_active ? 'Suspend Student?' : 'Reactivate Student?',
      student.is_active
        ? `${student.full_name}'s QR card will be rejected at the gate.`
        : `${student.full_name} will be able to scan in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: student.is_active ? 'Suspend' : 'Reactivate',
          style: student.is_active ? 'destructive' : 'default',
          onPress: async () => {
            await supabase
              .from('members')
              .update({ is_active: !student.is_active })
              .eq('id', student.id)
              .eq('organisation_id', authState.orgId);
            setStudent(p => p ? { ...p, is_active: !p.is_active } : null);
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c} size="large" />
      </View>
    );
  }
  if (!student) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.text }}>Student not found</Text>
      </View>
    );
  }

  // ── Attendance rate (term-based, matching web dashboard) ───────────────────
  const presentCount = logs.filter(l => l.status === 'present').length;
  const lateCount    = logs.filter(l => l.status === 'late').length;
  const excusedCount = logs.filter(l => l.status === 'excused').length;
  const attendedDays = presentCount + lateCount + excusedCount;

  // Total calendar days in the term (min 1 to avoid /0)
  const totalDays = Math.max(
    Math.ceil((termEnd.getTime() - termStart.getTime()) / (1000 * 60 * 60 * 24)),
    1,
  );
  // Absent = days in term the student wasn't scanned at all
  const absentDays = Math.max(0, totalDays - attendedDays);
  // Cap at 100% in case student was excused for days beyond the term span
  const pct = Math.min(100, Math.round((attendedDays / totalDays) * 100));

  const pctColor = pct >= 75 ? theme.success : pct >= 50 ? theme.warn : theme.danger;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={c} />}>

        {/* Profile header */}
        <View style={[styles.profileHeader, { backgroundColor: `${c}08`, borderBottomColor: theme.border }]}>
          <View style={[styles.avatar, { backgroundColor: `${c}18`, borderColor: c }]}>
            <Text style={[styles.avatarText, { color: c }]}>{getInitials(student.full_name)}</Text>
          </View>
          <Text style={[styles.name, { color: theme.text }]}>{student.full_name}</Text>
          {student.class_name && (
            <View style={[styles.classBadge, { backgroundColor: `${c}15`, borderColor: `${c}30` }]}>
              <Ionicons name="school-outline" size={11} color={c} />
              <Text style={[styles.classText, { color: c }]}>{student.class_name}</Text>
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: student.is_active ? theme.successBg : theme.dangerBg }]}>
            <Text style={{ fontSize: FONT.sm, fontWeight: '700', color: student.is_active ? theme.success : theme.danger }}>
              {student.is_active ? 'Active' : 'Suspended'}
            </Text>
          </View>
        </View>

        {/* Contact buttons */}
        {student.parent_phone && (
          <View style={styles.contactRow}>
            <TouchableOpacity
              style={[styles.contactBtn, { backgroundColor: theme.successBg, borderColor: `${theme.success}30` }]}
              onPress={() => Linking.openURL(`tel:${student.parent_phone}`)}
            >
              <Ionicons name="call-outline" size={16} color={theme.success} />
              <Text style={[styles.contactBtnText, { color: theme.success }]}>Call Parent</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactBtn, { backgroundColor: theme.successBg, borderColor: `${theme.success}30` }]}
              onPress={() => {
                const msg = encodeURIComponent(`Hello, this is regarding ${student.full_name}.`);
                Linking.openURL(`https://wa.me/${student.parent_phone!.replace(/\D/g, '')}?text=${msg}`);
              }}
            >
              <Ionicons name="logo-whatsapp" size={16} color={theme.success} />
              <Text style={[styles.contactBtnText, { color: theme.success }]}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stat chips — now includes Absent */}
        <View style={styles.statsGrid}>
          {[
            { l: 'Present',  v: presentCount,  c: theme.success },
            { l: 'Late',     v: lateCount,     c: theme.warn    },
            { l: 'Excused',  v: excusedCount,  c: theme.info    },
            { l: 'Absent',   v: absentDays,    c: absentDays > 0 ? theme.danger : theme.textMuted },
          ].map(({ l, v, c: col }) => (
            <View key={l} style={[styles.statCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
              <Text style={[styles.statValue, { color: col }]}>{v}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>{l}</Text>
            </View>
          ))}
        </View>

        {/* Attendance rate bar */}
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <View style={styles.barHeader}>
            <View>
              <Text style={[styles.barTitle, { color: theme.textSub }]}>Attendance Rate</Text>
              <Text style={[styles.barSubtitle, { color: theme.textMuted }]}>
                {formatDate(termStart.toISOString())} – {formatDate(termEnd.toISOString())}
              </Text>
            </View>
            <Text style={[styles.barPct, { color: pctColor }]}>{pct}%</Text>
          </View>
          <View style={[styles.barTrack, { backgroundColor: theme.bgCardAlt }]}>
            <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: pctColor }]} />
          </View>
          <Text style={[styles.barCaption, { color: theme.textMuted }]}>
            {attendedDays} attended of {totalDays} school days
          </Text>
          {pct < 75 && (
            <View style={styles.warningRow}>
              <Ionicons name="warning-outline" size={12} color={theme.danger} />
              <Text style={[styles.warningText, { color: theme.danger }]}>
                Below 75% — may affect exam eligibility
              </Text>
            </View>
          )}
        </View>

        {/* Details */}
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border, marginTop: 0 }]}>
          {[
            { label: 'Student ID',   value: student.employee_id },
            { label: 'Parent Phone', value: student.parent_phone },
            { label: 'Registered',   value: formatDate(student.created_at) },
            { label: 'Notes',        value: student.notes },
          ].filter(r => r.value).map(({ label, value }, i, arr) => (
            <View key={label} style={[styles.detailRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
              <Text style={[styles.detailLabel, { color: theme.textMuted }]}>{label}</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Admin actions */}
        {authState?.role === 'admin' && (
          <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border, marginTop: 0 }]}>
            <TouchableOpacity style={styles.actionRow} onPress={handleSuspend} activeOpacity={0.6}>
              <Ionicons
                name={student.is_active ? ('shield-off-outline' as any) : ('shield-checkmark-outline' as any)}
                size={18}
                color={student.is_active ? theme.warn : theme.success}
              />
              <Text style={[styles.actionText, { color: student.is_active ? theme.warn : theme.success }]}>
                {student.is_active ? 'Suspend Student' : 'Reactivate Student'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Attendance history */}
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border, marginTop: 0, marginBottom: 32 }]}>
          <Text style={[styles.historyTitle, { color: theme.text }]}>
            Attendance History ({logs.length})
          </Text>
          {logs.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: FONT.sm, color: theme.textMuted }}>No records yet</Text>
            </View>
          ) : logs.slice(0, 20).map((log, i) => {
            const cfg = STATUS_CONFIG[log.status] ?? { color: theme.textMuted, label: log.status };
            return (
              <View key={log.id} style={[styles.logRow, i < Math.min(logs.length, 20) - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                <View style={[styles.logDot, { backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}40` }]}>
                  <Ionicons name="scan-outline" size={12} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.logDate, { color: theme.text }]}>{formatDate(log.scanned_at)}</Text>
                  {log.late_reason && (
                    <Text style={[styles.logReason, { color: theme.textMuted }]}>{log.late_reason}</Text>
                  )}
                </View>
                <Text style={[styles.logTime, { color: theme.textMuted }]}>{formatTime(log.scanned_at)}</Text>
                <View style={[styles.logBadge, { backgroundColor: `${cfg.color}15` }]}>
                  <Text style={[styles.logBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
            );
          })}
          {logs.length > 20 && (
            <Text style={[styles.moreText, { color: theme.textMuted }]}>
              +{logs.length - 20} more records on web dashboard
            </Text>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  profileHeader: { alignItems: 'center', padding: SPACING.xxl, gap: 8, borderBottomWidth: 1 },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { fontSize: 24, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  classBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.md, borderWidth: 1 },
  classText: { fontSize: FONT.sm, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.md },
  contactRow: { flexDirection: 'row', gap: 10, padding: SPACING.lg },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: RADIUS.lg, paddingVertical: 10 },
  contactBtnText: { fontSize: FONT.sm, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  statCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: FONT.xs, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: RADIUS.xl, marginHorizontal: SPACING.lg, marginBottom: SPACING.md, overflow: 'hidden' },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: SPACING.md, paddingBottom: 8 },
  barTitle: { fontSize: FONT.sm, fontWeight: '600' },
  barSubtitle: { fontSize: FONT.xs, marginTop: 2 },
  barPct: { fontSize: 22, fontWeight: '800' },
  barTrack: { height: 8, marginHorizontal: SPACING.md, borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  barFill: { height: '100%', borderRadius: 4 },
  barCaption: { fontSize: FONT.xs, paddingHorizontal: SPACING.md, paddingBottom: 8 },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, paddingHorizontal: SPACING.md },
  warningText: { fontSize: FONT.xs },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: SPACING.md, paddingVertical: 11 },
  detailLabel: { fontSize: FONT.sm },
  detailValue: { fontSize: FONT.sm, fontWeight: '600', maxWidth: 200, textAlign: 'right' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 14 },
  actionText: { flex: 1, fontSize: FONT.base, fontWeight: '600' },
  historyTitle: { fontSize: FONT.base, fontWeight: '700', padding: SPACING.md, paddingBottom: 8 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, paddingHorizontal: SPACING.md },
  logDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  logDate: { fontSize: FONT.sm, fontWeight: '600' },
  logReason: { fontSize: FONT.xs, marginTop: 1 },
  logTime: { fontSize: FONT.xs, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  logBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.sm },
  logBadgeText: { fontSize: FONT.xs, fontWeight: '700' },
  moreText: { fontSize: FONT.xs, textAlign: 'center', padding: 12 },
});