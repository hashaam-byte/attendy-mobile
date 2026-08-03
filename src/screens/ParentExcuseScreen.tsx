// src/screens/ParentExcuseScreen.tsx — ATTENDY-MOBILE
// Lets a logged-in parent submit an excuse/absence explanation for one
// of their children, without leaving the app. Uses the same verified
// session token from ParentLoginScreen — calls submitParentExcuse()
// (already built in lib/webApi.ts), which hits the cookie/token-
// authenticated /api/portal/excuse route on the web app. No direct
// Supabase writes from the client.

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '../context/ThemeContext';
import { submitParentExcuse, ParentStudent } from '../lib/webApi';
import { RADIUS, FONT, SPACING } from '../lib/theme';

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplay(d: Date | null): string {
  if (!d) return 'Select a date';
  return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ParentExcuseScreen({ navigation, route }: any) {
  const { students, token, studentId }: { students: ParentStudent[]; token: string; studentId?: string } = route.params ?? {};
  const { theme, isDark } = useTheme();

  const safeStudents: ParentStudent[] = Array.isArray(students) ? students : [];
  const [selectedId, setSelectedId] = useState<string>(studentId ?? safeStudents[0]?.id ?? '');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const c = '#16a34a';

  function onPickDate(event: DateTimePickerEvent, picked?: Date) {
    // Android's picker is a dialog that closes itself; iOS's inline
    // spinner stays open until the person taps Done — this handles both.
    if (Platform.OS === 'android') setActivePicker(null);
    if (event.type === 'dismissed' || !picked) return;
    if (activePicker === 'start') setStartDate(picked);
    else if (activePicker === 'end') setEndDate(picked);
    setError(null);
  }

  async function handleSubmit() {
    setError(null);
    if (!selectedId) { setError('Select a child'); return; }
    if (!startDate || !endDate) { setError('Select both dates'); return; }
    if (endDate < startDate) { setError('End date must be after start date'); return; }
    if (reason.trim().length < 3) { setError('Enter a reason'); return; }

    setLoading(true);
    const result = await submitParentExcuse(token, {
      studentId: selectedId, startDate: toISODate(startDate), endDate: toISODate(endDate), reason: reason.trim(),
    });
    setLoading(false);

    if (!result.ok) {
      if (result.expired) {
        navigation.reset({ index: 0, routes: [{ name: 'ParentLogin' }] });
        return;
      }
      setError(result.error);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.bg }]}>
        <View style={[styles.successIcon, { backgroundColor: `${c}18` }]}>
          <Ionicons name="checkmark-circle" size={48} color={c} />
        </View>
        <Text style={[styles.successTitle, { color: theme.text }]}>Excuse submitted</Text>
        <Text style={[styles.successBody, { color: theme.textMuted }]}>
          The school will review your request. You'll see the status update once they respond.
        </Text>
        <TouchableOpacity style={[styles.btn, { backgroundColor: c, marginTop: SPACING.xl }]} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Back to dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Ionicons name="chevron-back" size={20} color={theme.textMuted} />
          <Text style={[styles.backText, { color: theme.textMuted }]}>Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: theme.text }]}>Submit an excuse</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>Let the school know about an upcoming or recent absence.</Text>

        {safeStudents.length > 1 && (
          <>
            <Text style={[styles.label, { color: theme.textMuted }]}>CHILD</Text>
            <View style={styles.chipRow}>
              {safeStudents.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSelectedId(s.id)}
                  style={[
                    styles.chip,
                    { borderColor: selectedId === s.id ? c : theme.border, backgroundColor: selectedId === s.id ? `${c}15` : theme.bgCard },
                  ]}
                >
                  <Text style={{ color: selectedId === s.id ? c : theme.text, fontSize: FONT.sm, fontWeight: '600' }}>{s.full_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={[styles.label, { color: theme.textMuted, marginTop: 14 }]}>FROM</Text>
        <TouchableOpacity
          style={[styles.inputWrap, { backgroundColor: theme.bgInput, borderColor: theme.border }]}
          onPress={() => setActivePicker('start')}
        >
          <Ionicons name="calendar-outline" size={16} color={theme.textMuted} />
          <Text style={[styles.input, { color: startDate ? theme.text : theme.textMuted }]}>{formatDisplay(startDate)}</Text>
        </TouchableOpacity>

        <Text style={[styles.label, { color: theme.textMuted, marginTop: 14 }]}>TO</Text>
        <TouchableOpacity
          style={[styles.inputWrap, { backgroundColor: theme.bgInput, borderColor: theme.border }]}
          onPress={() => setActivePicker('end')}
        >
          <Ionicons name="calendar-outline" size={16} color={theme.textMuted} />
          <Text style={[styles.input, { color: endDate ? theme.text : theme.textMuted }]}>{formatDisplay(endDate)}</Text>
        </TouchableOpacity>

        {activePicker && (
          <DateTimePicker
            value={(activePicker === 'start' ? startDate : endDate) ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={onPickDate}
            minimumDate={activePicker === 'end' && startDate ? startDate : undefined}
            themeVariant={isDark ? 'dark' : 'light'}
            accentColor={c}
          />
        )}
        {Platform.OS === 'ios' && activePicker && (
          <TouchableOpacity onPress={() => setActivePicker(null)} style={{ alignSelf: 'flex-end', paddingVertical: 8 }}>
            <Text style={{ color: c, fontWeight: '700', fontSize: FONT.sm }}>Done</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.label, { color: theme.textMuted, marginTop: 14 }]}>REASON</Text>
        <View style={[styles.inputWrap, styles.textAreaWrap, { backgroundColor: theme.bgInput, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, styles.textArea, { color: theme.text }]} value={reason} onChangeText={setReason}
            placeholder="e.g. Medical appointment, family emergency…" placeholderTextColor={theme.textMuted}
            multiline numberOfLines={4} textAlignVertical="top"
          />
        </View>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: theme.dangerBg, borderColor: `${theme.danger}25` }]}>
            <Ionicons name="alert-circle-outline" size={14} color={theme.danger} />
            <Text style={[styles.errorText, { color: theme.dangerText }]}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: loading ? (isDark ? 'rgba(255,255,255,0.06)' : '#E5E7E5') : c, marginTop: SPACING.lg }]}
          onPress={handleSubmit} disabled={loading} activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.btnText}>Submit excuse</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: SPACING.xl, paddingTop: SPACING.xxl, flexGrow: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  backText: { fontSize: FONT.sm, marginLeft: 2 },
  title: { fontSize: FONT.xxl, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: FONT.sm, marginBottom: SPACING.xl, lineHeight: 20 },
  label: { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1.5 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md,
    borderWidth: 1.5, paddingHorizontal: 14, height: 48, gap: 10,
  },
  textAreaWrap: { height: 100, alignItems: 'flex-start', paddingTop: 12 },
  input: { flex: 1, fontSize: FONT.md },
  textArea: { height: '100%' },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12,
    borderRadius: RADIUS.md, borderWidth: 1, marginTop: SPACING.md,
  },
  errorText: { fontSize: FONT.sm, flex: 1 },
  btn: {
    height: 52, borderRadius: RADIUS.md, alignItems: 'center',
    justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  btnText: { color: 'white', fontSize: FONT.md, fontWeight: '700' },
  successIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  successTitle: { fontSize: FONT.xl, fontWeight: '700', marginBottom: 8 },
  successBody: { fontSize: FONT.sm, textAlign: 'center', lineHeight: 20, paddingHorizontal: SPACING.xl },
});