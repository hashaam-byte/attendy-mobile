import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { formatTime, getCutoffDisplay } from '../lib/utils';
import { RADIUS, FONT, SPACING } from '../lib/theme';

type Scan = { id: string; scanned_at: string; status: string; members: { full_name: string; class_name: string | null } | null };

export default function DashboardScreen({ navigation }: any) {
  const { authState } = useAuth();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total: 0, present: 0, late: 0, excused: 0 });
  const [scans, setScans] = useState<Scan[]>([]);
  const c = authState?.primaryColor || '#16a34a';
  const today = new Date().toISOString().split('T')[0];

  const fetch = useCallback(async (refresh = false) => {
    if (!authState) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    const [{ count: tot }, { count: pre }, { count: lat }, { count: exc }, { data: sc }] = await Promise.all([
      supabase.from('members').select('*', { count: 'exact', head: true }).eq('organisation_id', authState.orgId).eq('member_type', 'student').eq('is_active', true),
      supabase.from('attendance_logs').select('*', { count: 'exact', head: true }).eq('organisation_id', authState.orgId).eq('scan_type', 'entry').eq('status', 'present').gte('scanned_at', `${today}T00:00:00`),
      supabase.from('attendance_logs').select('*', { count: 'exact', head: true }).eq('organisation_id', authState.orgId).eq('scan_type', 'entry').eq('status', 'late').gte('scanned_at', `${today}T00:00:00`),
      supabase.from('attendance_logs').select('*', { count: 'exact', head: true }).eq('organisation_id', authState.orgId).eq('scan_type', 'entry').eq('status', 'excused').gte('scanned_at', `${today}T00:00:00`),
      supabase.from('attendance_logs').select('id,scanned_at,status,members(full_name,class_name)').eq('organisation_id', authState.orgId).eq('scan_type', 'entry').gte('scanned_at', `${today}T00:00:00`).order('scanned_at', { ascending: false }).limit(6),
    ]);
    setStats({ total: tot ?? 0, present: pre ?? 0, late: lat ?? 0, excused: exc ?? 0 });
    setScans((sc ?? []).map((s: any) => ({ ...s, members: Array.isArray(s.members) ? s.members[0] ?? null : s.members })));
    setLoading(false); setRefreshing(false);
  }, [authState?.orgId, today]);

  useEffect(() => { fetch(); }, [fetch]);

  const attended = stats.present + stats.late + stats.excused;
  const absent = Math.max(0, stats.total - attended);
  const pct = stats.total > 0 ? Math.round((attended / stats.total) * 100) : 0;
  const cutoff = authState ? getCutoffDisplay(authState.settings) : '8:15 AM';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={c} />
    </View>
  );

  const STAT_CARDS = [
    { label: 'Students', value: stats.total,   color: theme.info,    bg: theme.infoBg,    icon: 'people-outline' },
    { label: 'Present',  value: attended,       color: theme.success, bg: theme.successBg, icon: 'checkmark-circle-outline' },
    { label: 'Absent',   value: absent,         color: absent > 0 ? theme.danger : theme.textMuted, bg: absent > 0 ? theme.dangerBg : theme.bgCardAlt, icon: 'person-remove-outline' },
    { label: 'Late',     value: stats.late,     color: theme.warn,    bg: theme.warnBg,    icon: 'time-outline' },
  ];

  const ACTIONS = authState?.role === 'admin' ? [
    { icon: 'person-remove-outline', label: 'Absent Today',      sub: `${absent} not yet scanned`,  color: theme.danger,   bg: theme.dangerBg,   screen: 'Absent' },
    { icon: 'people-outline',        label: 'Students',           sub: `${stats.total} enrolled`,    color: theme.info,     bg: theme.infoBg,     screen: 'Students' },
    { icon: 'bar-chart-outline',     label: 'Reports',            sub: 'Charts & CSV export',        color: theme.purple,   bg: theme.purpleBg,   screen: 'Reports' },
    { icon: 'megaphone-outline',     label: 'School Notices',     sub: 'Announcements',              color: theme.warn,     bg: theme.warnBg,     screen: 'Notices' },
    { icon: 'chatbubble-outline',    label: 'SMS Log',            sub: 'Parent notifications',       color: theme.success,  bg: theme.successBg,  screen: 'Notifications' },
  ] : [
    { icon: 'person-remove-outline', label: 'Absent Today',      sub: `${absent} not yet scanned`,  color: theme.danger,   bg: theme.dangerBg,   screen: 'Absent' },
    { icon: 'megaphone-outline',     label: 'School Notices',     sub: 'View announcements',         color: theme.warn,     bg: theme.warnBg,     screen: 'Notices' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetch(true)} tintColor={c} />}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.bgCard, borderBottomColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: theme.textMuted }]}>{greeting} 👋</Text>
            <Text style={[styles.orgName, { color: theme.text }]}>{authState?.orgName}</Text>
            <Text style={[styles.dateText, { color: theme.textSub }]}>
              {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.scanFab, { backgroundColor: c }]}
            onPress={() => navigation.navigate('Scanner')}
          >
            <Ionicons name="qr-code-outline" size={20} color="white" />
            <Text style={styles.scanFabText}>Scan</Text>
          </TouchableOpacity>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {STAT_CARDS.map(({ label, value, color, bg, icon }) => (
            <View key={label} style={[styles.statCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
              <View style={[styles.statIcon, { backgroundColor: bg }]}>
                <Ionicons name={icon as any} size={18} color={color} />
              </View>
              <Text style={[styles.statValue, { color }]}>{value}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Attendance bar */}
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Today's Attendance</Text>
            <Text style={[styles.pctText, { color: pct >= 75 ? theme.success : theme.danger }]}>{pct}%</Text>
          </View>
          <View style={[styles.barTrack, { backgroundColor: theme.bgCardAlt }]}>
            <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: pct >= 75 ? c : theme.danger }]} />
          </View>
          <View style={styles.barLegend}>
            {[
              { label: `${attended} present`, color: theme.success },
              { label: `${stats.late} late · after ${cutoff}`, color: theme.warn },
              { label: `${absent} absent`, color: theme.danger },
            ].map(({ label, color }) => (
              <Text key={label} style={[styles.legendText, { color }]}>{label}</Text>
            ))}
          </View>
        </View>

        {/* Quick actions */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>QUICK ACTIONS</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          {ACTIONS.map(({ icon, label, sub, color, bg, screen }, i) => (
            <TouchableOpacity
              key={label}
              style={[styles.actionRow, i < ACTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
              onPress={() => navigation.navigate(screen)}
              activeOpacity={0.6}
            >
              <View style={[styles.actionIcon, { backgroundColor: bg }]}>
                <Ionicons name={icon as any} size={18} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionLabel, { color: theme.text }]}>{label}</Text>
                <Text style={[styles.actionSub, { color: theme.textMuted }]}>{sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent scans */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>RECENT SCANS</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border, marginBottom: 32 }]}>
          {scans.length === 0 ? (
            <View style={styles.emptyScans}>
              <Ionicons name="scan-outline" size={28} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No scans today yet</Text>
            </View>
          ) : scans.map((s, i) => {
            const sc = s.status === 'present' ? theme.success : s.status === 'late' ? theme.warn : s.status === 'excused' ? theme.info : theme.textMuted;
            const scBg = s.status === 'present' ? theme.successBg : s.status === 'late' ? theme.warnBg : s.status === 'excused' ? theme.infoBg : theme.bgCardAlt;
            return (
              <View key={s.id} style={[styles.scanRow, i < scans.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                <View style={[styles.scanDot, { backgroundColor: sc }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.scanName, { color: theme.text }]}>{s.members?.full_name ?? '—'}</Text>
                  <Text style={[styles.scanClass, { color: theme.textMuted }]}>{s.members?.class_name ?? '—'}</Text>
                </View>
                <View style={[styles.scanBadge, { backgroundColor: scBg }]}>
                  <Text style={[styles.scanBadgeText, { color: sc }]}>
                    {s.status === 'present' ? 'On time' : s.status}
                  </Text>
                </View>
                <Text style={[styles.scanTime, { color: theme.textMuted }]}>{formatTime(s.scanned_at)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.lg, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  greeting: { fontSize: FONT.sm, marginBottom: 2 },
  orgName: { fontSize: FONT.lg, fontWeight: '800', letterSpacing: -0.3 },
  dateText: { fontSize: FONT.sm, marginTop: 2 },
  scanFab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.lg },
  scanFabText: { color: 'white', fontWeight: '700', fontSize: FONT.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: SPACING.lg, paddingBottom: 0 },
  statCard: { flexBasis: '47%', flex: 1, borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.md, gap: 5 },
  statIcon: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: FONT.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderWidth: 1, borderRadius: RADIUS.xl, marginHorizontal: SPACING.lg, marginTop: SPACING.md, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, paddingBottom: 8 },
  cardTitle: { fontSize: FONT.base, fontWeight: '700' },
  pctText: { fontSize: FONT.md, fontWeight: '800' },
  barTrack: { height: 8, marginHorizontal: SPACING.md, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  barFill: { height: '100%', borderRadius: 4 },
  barLegend: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  legendText: { fontSize: 10, fontWeight: '600' },
  sectionLabel: { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 1.2, paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.sm },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, paddingHorizontal: SPACING.lg },
  actionIcon: { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: FONT.base, fontWeight: '600' },
  actionSub: { fontSize: FONT.xs, marginTop: 1 },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, paddingHorizontal: SPACING.md },
  scanDot: { width: 8, height: 8, borderRadius: 4 },
  scanName: { fontSize: FONT.sm, fontWeight: '600' },
  scanClass: { fontSize: FONT.xs, marginTop: 1 },
  scanBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  scanBadgeText: { fontSize: FONT.xs, fontWeight: '700' },
  scanTime: { fontSize: FONT.xs, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', minWidth: 48, textAlign: 'right' },
  emptyScans: { padding: 32, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: FONT.sm },
});
