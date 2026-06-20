import React from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  ViewStyle, TextStyle, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, FONT } from '../lib/theme';

// ─── Card ────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { theme } = useTheme();
  return (
    <View style={[{ backgroundColor: theme.bgCard, borderWidth: 1, borderColor: theme.border, borderRadius: RADIUS.xl }, style]}>
      {children}
    </View>
  );
}

// ─── Section header ──────────────────────────────────────────
export function SectionLabel({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <Text style={{
      fontSize: FONT.xs, fontWeight: '700', letterSpacing: 1.2,
      color: theme.textMuted, textTransform: 'uppercase',
      paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.sm,
    }}>
      {title}
    </Text>
  );
}

// ─── Stat card ───────────────────────────────────────────────
export function StatCard({
  label, value, color, icon, bg,
}: {
  label: string; value: string | number; color: string; icon: string; bg: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
      <View style={[styles.statIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─── Row item (settings / action lists) ──────────────────────
export function RowItem({
  icon, iconColor, iconBg, label, sublabel, onPress, rightEl, danger,
}: {
  icon: string; iconColor: string; iconBg: string;
  label: string; sublabel?: string;
  onPress?: () => void; rightEl?: React.ReactNode; danger?: boolean;
}) {
  const { theme } = useTheme();
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      style={[styles.rowItem, { borderBottomColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowLabel, { color: danger ? theme.danger : theme.text }]}>{label}</Text>
        {sublabel ? <Text style={[styles.rowSub, { color: theme.textMuted }]}>{sublabel}</Text> : null}
      </View>
      {rightEl ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={theme.textMuted} /> : null)}
    </Wrap>
  );
}

// ─── Badge ───────────────────────────────────────────────────
export function Badge({
  label, color, bg,
}: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Progress bar ─────────────────────────────────────────────
export function ProgressBar({ pct, color, trackColor }: { pct: number; color: string; trackColor: string }) {
  return (
    <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
      <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: color }]} />
    </View>
  );
}

// ─── Empty state ─────────────────────────────────────────────
export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.bgCardAlt, borderColor: theme.border }]}>
        <Ionicons name={icon as any} size={32} color={theme.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

// ─── Search input ─────────────────────────────────────────────
export function SearchInput({
  value, onChangeText, placeholder,
}: { value: string; onChangeText: (t: string) => void; placeholder: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.searchWrap, { backgroundColor: theme.bgInput, borderColor: theme.border }]}>
      <Ionicons name="search-outline" size={16} color={theme.textMuted} />
      <TextInput
        style={[styles.searchInput, { color: theme.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={16} color={theme.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Primary button ───────────────────────────────────────────
export function PrimaryButton({
  label, onPress, loading, disabled, color, icon,
}: {
  label: string; onPress: () => void; loading?: boolean;
  disabled?: boolean; color: string; icon?: string;
}) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, { backgroundColor: isDisabled ? 'rgba(128,128,128,0.15)' : color }]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon as any} size={18} color="white" />}
          <Text style={[styles.primaryBtnText, { color: isDisabled ? 'rgba(255,255,255,0.3)' : 'white' }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Divider ──────────────────────────────────────────────────
export function Divider() {
  const { theme } = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.border }} />;
}

// ─── Screen wrapper ───────────────────────────────────────────
export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { theme } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: theme.bg }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    flex: 1, borderWidth: 1, borderRadius: RADIUS.lg,
    padding: SPACING.md, alignItems: 'flex-start', gap: 6,
  },
  statIconWrap: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  statValue: { fontSize: FONT.xxl, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: FONT.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  rowItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
  },
  rowIcon: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: FONT.base, fontWeight: '600' },
  rowSub: { fontSize: FONT.sm, marginTop: 2 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { fontSize: FONT.xs, fontWeight: '700' },

  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  emptyWrap: { alignItems: 'center', padding: 48, gap: 12 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: RADIUS.xl,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginBottom: 4,
  },
  emptyTitle: { fontSize: FONT.lg, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: FONT.sm, textAlign: 'center', lineHeight: 20, maxWidth: 240 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md, height: 44,
  },
  searchInput: { flex: 1, fontSize: FONT.base },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: RADIUS.xl, height: 52,
  },
  primaryBtnText: { fontSize: FONT.md, fontWeight: '700' },
});
