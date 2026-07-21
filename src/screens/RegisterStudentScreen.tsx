import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { RADIUS, FONT, SPACING } from '../lib/theme';

// Default classes shown if the school hasn't configured custom ones yet
const DEFAULT_CLASSES = [
  'Nursery 1','Nursery 2','Nursery 3',
  'Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6',
  'JSS 1','JSS 2','JSS 3',
  'SSS 1','SSS 2','SSS 3',
];

type OrgClass = { id: string; name: string; sort_order: number };

function generateStudentId(orgName: string, count: number): string {
  const words = orgName.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0]?.toUpperCase() ?? 'X';
  const last  = words.length > 1 ? words[words.length - 1][0].toUpperCase() : first;
  const seq   = String(count + 1).padStart(4, '0');
  const rand  = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `${first}${last}-${seq}-${rand}`;
}

export default function RegisterStudentScreen({ navigation }: any) {
  const { authState } = useAuth();
  const { theme, isDark } = useTheme();
  const c = authState?.primaryColor || '#16a34a';

  const [form, setForm] = useState({
    full_name: '', class_name: '', parent_phone: '', employee_id: '', notes: '',
  });
  const [loading,       setLoading]       = useState(false);
  const [studentCount,  setStudentCount]  = useState(0);
  const [error,         setError]         = useState<string | null>(null);
  const [orgClasses,    setOrgClasses]    = useState<OrgClass[]>([]);
  const [showPicker,    setShowPicker]    = useState(false);
  const [showCustom,    setShowCustom]    = useState(false);
  const [customClass,   setCustomClass]   = useState('');
  const [savingCustom,  setSavingCustom]  = useState(false);

  useEffect(() => {
    if (!authState) return;

    Promise.all([
      supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('organisation_id', authState.orgId)
        .eq('member_type', 'student')
        .eq('is_active', true),
      supabase
        .from('org_classes')
        .select('id, name, sort_order')
        .eq('organisation_id', authState.orgId)
        .eq('is_active', true)
        .order('sort_order')
        .order('name'),
    ]).then(([countRes, classRes]) => {
      const n = countRes.count ?? 0;
      setStudentCount(n);
      setForm(f => ({ ...f, employee_id: generateStudentId(authState.orgName, n) }));
      setOrgClasses(classRes.data ?? []);
    });
  }, [authState?.orgId]);

  // Displayed class list — org's custom classes if any, else defaults
  const displayClasses = orgClasses.length > 0
    ? orgClasses.map(c => c.name)
    : DEFAULT_CLASSES;

  function update(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }));
    setError(null);
  }

  async function addCustomClass() {
    if (!customClass.trim()) return;
    setSavingCustom(true);
    try {
      const { data, error: err } = await supabase
        .from('org_classes')
        .insert({
          organisation_id: authState!.orgId,
          name: customClass.trim(),
          sort_order: orgClasses.length,
          is_active: true,
        })
        .select('id, name, sort_order')
        .single();

      if (err) {
        if (err.code === '23505') {
          // Already exists — just select it
          update('class_name', customClass.trim());
        } else {
          Alert.alert('Error', err.message);
          return;
        }
      } else if (data) {
        setOrgClasses(prev => [...prev, data]);
        update('class_name', data.name);
      }
      setShowCustom(false);
      setCustomClass('');
      setShowPicker(false);
    } finally {
      setSavingCustom(false);
    }
  }

  async function handleSubmit() {
    if (!form.full_name.trim())   { setError('Full name is required.');          return; }
    if (!form.class_name)         { setError('Please select a class.');          return; }
    if (!form.parent_phone.trim()){ setError('Parent phone number is required.'); return; }
    if (!authState) return;

    setLoading(true); setError(null);

    const { count: currentCount } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('organisation_id', authState.orgId)
      .eq('member_type', 'student')
      .eq('is_active', true);

    if ((currentCount ?? 0) >= authState.maxMembers) {
      setError(`Plan limit reached (${authState.maxMembers} students). Upgrade to add more.`);
      setLoading(false);
      return;
    }

    const finalId = form.employee_id.trim()
      || generateStudentId(authState.orgName, currentCount ?? studentCount);

    const { data: member, error: insertErr } = await supabase
      .from('members')
      .insert({
        organisation_id: authState.orgId,
        full_name:       form.full_name.trim(),
        class_name:      form.class_name,
        parent_phone:    form.parent_phone.trim(),
        member_type:     'student',
        role:            'viewer',
        employee_id:     finalId,
        notes:           form.notes.trim() || null,
        is_active:       true,
      })
      .select()
      .single();

    setLoading(false);

    if (insertErr) { setError(insertErr.message); return; }

    const nextCount = (currentCount ?? studentCount) + 1;
    Alert.alert(
      'Student Registered ✓',
      `${form.full_name} added to ${form.class_name}.\n\nID: ${finalId}\n\nParent gets SMS when scanned in.`,
      [
        {
          text: 'Register Another',
          onPress: () => {
            setForm({
              full_name: '', class_name: '', parent_phone: '',
              employee_id: generateStudentId(authState.orgName, nextCount),
              notes: '',
            });
            setStudentCount(nextCount);
          },
        },
        { text: 'View Students', onPress: () => navigation.navigate('Students') },
      ]
    );
  }

  const isDisabled = !form.full_name || !form.class_name || !form.parent_phone || loading;
  const usagePct   = Math.min((studentCount / (authState?.maxMembers ?? 50)) * 100, 100);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Usage bar */}
        <View style={[s.usageBar, { backgroundColor: `${c}08`, borderColor: `${c}20` }]}>
          <Text style={[s.usageText, { color: theme.textSub }]}>
            {studentCount} / {authState?.maxMembers ?? 50} students
          </Text>
          <View style={[s.track, { backgroundColor: theme.bgCardAlt }]}>
            <View style={[s.fill, { width: `${usagePct}%` as any, backgroundColor: c }]} />
          </View>
        </View>

        <View style={[s.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>

          {/* Full name */}
          <View style={s.field}>
            <Text style={[s.label, { color: theme.textMuted }]}>FULL NAME *</Text>
            <TextInput
              style={[s.input, { backgroundColor: theme.bgInput, borderColor: theme.border, color: theme.text }]}
              value={form.full_name}
              onChangeText={t => update('full_name', t)}
              placeholder="e.g. Adaeze Okonkwo"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
            />
          </View>

          {/* Class picker */}
          <View style={s.field}>
            <Text style={[s.label, { color: theme.textMuted }]}>CLASS / GROUP *</Text>
            <TouchableOpacity
              style={[s.input, s.selectInput, { backgroundColor: theme.bgInput, borderColor: theme.border }]}
              onPress={() => setShowPicker(true)}
            >
              <Text style={[s.selectText, { color: form.class_name ? theme.text : theme.textMuted }]}>
                {form.class_name || 'Select class…'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
            </TouchableOpacity>
            {orgClasses.length === 0 && (
              <Text style={[s.hint, { color: theme.textMuted }]}>
                Showing default classes. Add custom ones in Settings → Classes.
              </Text>
            )}
          </View>

          {/* Student ID */}
          <View style={s.field}>
            <Text style={[s.label, { color: theme.textMuted }]}>STUDENT ID (auto-generated)</Text>
            <View style={s.idRow}>
              <TextInput
                style={[s.input, { flex: 1, backgroundColor: theme.bgInput, borderColor: theme.border, color: theme.text }]}
                value={form.employee_id}
                onChangeText={t => update('employee_id', t)}
                placeholder="Auto-generated"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[s.regenBtn, { borderColor: `${c}40`, backgroundColor: theme.bgInput }]}
                onPress={() => update('employee_id', generateStudentId(authState?.orgName ?? 'SC', studentCount))}
              >
                <Ionicons name="refresh-outline" size={16} color={c} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Parent phone */}
          <View style={s.field}>
            <Text style={[s.label, { color: theme.textMuted }]}>PARENT / GUARDIAN PHONE *</Text>
            <TextInput
              style={[s.input, { backgroundColor: theme.bgInput, borderColor: theme.border, color: theme.text }]}
              value={form.parent_phone}
              onChangeText={t => update('parent_phone', t)}
              placeholder="08012345678"
              placeholderTextColor={theme.textMuted}
              keyboardType="phone-pad"
            />
            <Text style={[s.hint, { color: theme.textMuted }]}>
              Parent receives SMS on arrival, late and absence alerts.
            </Text>
          </View>

          {/* Notes */}
          <View style={s.field}>
            <Text style={[s.label, { color: theme.textMuted }]}>NOTES (optional)</Text>
            <TextInput
              style={[s.input, s.textArea, { backgroundColor: theme.bgInput, borderColor: theme.border, color: theme.text }]}
              value={form.notes}
              onChangeText={t => update('notes', t)}
              placeholder="Any special notes…"
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {error && (
            <View style={[s.errorBox, { backgroundColor: theme.dangerBg, borderColor: `${theme.danger}25` }]}>
              <Ionicons name="warning-outline" size={14} color={theme.danger} />
              <Text style={[s.errorText, { color: theme.dangerText }]}>{error}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[s.submitBtn, { backgroundColor: isDisabled ? (isDark ? 'rgba(255,255,255,0.06)' : '#E5E7E5') : c }]}
          onPress={handleSubmit}
          disabled={isDisabled}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="white" size="small" />
            : <><Ionicons name="person-add-outline" size={18} color="white" /><Text style={s.submitBtnText}>Register Student</Text></>
          }
        </TouchableOpacity>

        <Text style={[s.footer, { color: theme.textMuted }]}>
          QR card is auto-generated. Print it from the web dashboard.
        </Text>
      </ScrollView>

      {/* ── Class picker modal ── */}
      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowPicker(false); setShowCustom(false); }}>
        <View style={[s.modal, { backgroundColor: theme.bg }]}>

          {/* Modal header */}
          <View style={[s.modalHeader, { borderBottomColor: theme.border, backgroundColor: theme.bgCard }]}>
            <Text style={[s.modalTitle, { color: theme.text }]}>Select Class / Group</Text>
            <TouchableOpacity onPress={() => { setShowPicker(false); setShowCustom(false); }} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={theme.textSub} />
            </TouchableOpacity>
          </View>

          {/* Custom class input */}
          {showCustom ? (
            <View style={[s.customBox, { backgroundColor: theme.bgCard, borderBottomColor: theme.border }]}>
              <Text style={[s.customLabel, { color: theme.textMuted }]}>New class name</Text>
              <View style={s.customRow}>
                <TextInput
                  autoFocus
                  style={[s.input, { flex: 1, backgroundColor: theme.bgInput, borderColor: theme.border, color: theme.text }]}
                  value={customClass}
                  onChangeText={setCustomClass}
                  placeholder="e.g. Year 10A, Level 3, CS101, Group B…"
                  placeholderTextColor={theme.textMuted}
                />
                <TouchableOpacity
                  style={[s.customAddBtn, { backgroundColor: c, opacity: savingCustom || !customClass.trim() ? 0.5 : 1 }]}
                  onPress={addCustomClass}
                  disabled={savingCustom || !customClass.trim()}
                >
                  {savingCustom
                    ? <ActivityIndicator size="small" color="white" />
                    : <Text style={s.customAddText}>Add & Select</Text>
                  }
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => { setShowCustom(false); setCustomClass(''); }}>
                <Text style={[s.cancelCustom, { color: theme.textMuted }]}>← Back to list</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.addCustomRow, { borderBottomColor: theme.border }]}
              onPress={() => setShowCustom(true)}
            >
              <View style={[s.addCustomIcon, { backgroundColor: `${c}15` }]}>
                <Ionicons name="add" size={18} color={c} />
              </View>
              <View>
                <Text style={[s.addCustomText, { color: c }]}>Add Custom Class</Text>
                <Text style={[s.addCustomSub, { color: theme.textMuted }]}>For universities, lessons, offices, etc.</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Class list */}
          <ScrollView>
            {displayClasses.map((cls) => (
              <TouchableOpacity
                key={cls}
                style={[
                  s.classOption,
                  { borderBottomColor: theme.border },
                  form.class_name === cls && { backgroundColor: `${c}10` },
                ]}
                onPress={() => { update('class_name', cls); setShowPicker(false); setShowCustom(false); }}
              >
                <Text style={[s.classOptionText, { color: form.class_name === cls ? c : theme.textSub, fontWeight: form.class_name === cls ? '700' : '400' }]}>
                  {cls}
                </Text>
                {form.class_name === cls && <Ionicons name="checkmark" size={16} color={c} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll:         { padding: SPACING.lg, paddingBottom: 40 },
  usageBar:       { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg, gap: 8 },
  usageText:      { fontSize: FONT.sm },
  track:          { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill:           { height: '100%', borderRadius: 2 },
  card:           { borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.lg, gap: 4 },
  field:          { marginBottom: SPACING.lg },
  label:          { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 1.1, marginBottom: 8 },
  input:          { borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: 12, height: 48, fontSize: FONT.base },
  selectInput:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 12 },
  selectText:     { fontSize: FONT.base },
  idRow:          { flexDirection: 'row', gap: 8 },
  regenBtn:       { width: 48, height: 48, borderRadius: RADIUS.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textArea:       { height: 80, paddingTop: 12 },
  hint:           { fontSize: FONT.xs, marginTop: 6, lineHeight: 16 },
  errorBox:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: RADIUS.md, padding: 10 },
  errorText:      { flex: 1, fontSize: FONT.sm, lineHeight: 17 },
  submitBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: RADIUS.xl, height: 52, marginBottom: SPACING.lg },
  submitBtnText:  { fontSize: FONT.md, fontWeight: '700', color: 'white' },
  footer:         { fontSize: FONT.xs, textAlign: 'center', lineHeight: 16 },
  // Modal
  modal:          { flex: 1 },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: 14, borderBottomWidth: 1 },
  modalTitle:     { fontSize: FONT.md, fontWeight: '700' },
  closeBtn:       { padding: 4 },
  addCustomRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.lg, borderBottomWidth: 1 },
  addCustomIcon:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  addCustomText:  { fontSize: FONT.sm, fontWeight: '600' },
  addCustomSub:   { fontSize: FONT.xs, marginTop: 2 },
  classOption:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  classOptionText:{ fontSize: FONT.base },
  customBox:      { padding: SPACING.lg, borderBottomWidth: 1, gap: 10 },
  customLabel:    { fontSize: FONT.xs, fontWeight: '600', letterSpacing: 0.8 },
  customRow:      { flexDirection: 'row', gap: 8 },
  customAddBtn:   { borderRadius: RADIUS.lg, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  customAddText:  { color: 'white', fontWeight: '700', fontSize: FONT.sm },
  cancelCustom:   { fontSize: FONT.xs, marginTop: 4 },
});