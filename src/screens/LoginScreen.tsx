import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AuthState } from '../lib/types';
import { RADIUS, FONT, SPACING } from '../lib/theme';

export default function LoginScreen({ navigation, route }: any) {
  const { slug, orgName, primaryColor, industry } = route.params;
  const { setAuthState } = useAuth();
  const { theme, isDark, mode, setMode } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = primaryColor || '#16a34a';

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true); setError(null);
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
      });
      if (authErr) { setError('Invalid credentials. Check your email and password.'); setLoading(false); return; }
      const { data: orgUser } = await supabase
        .from('org_users')
        .select('role,organisation_id,is_active,organisations(id,name,slug,industry,plan,is_active,primary_color,logo_url,max_members,settings,plan_expires_at)')
        .eq('user_id', data.user.id).eq('is_active', true).single();
      if (!orgUser) { await supabase.auth.signOut(); setError('Account not linked to any school.'); setLoading(false); return; }
      const org: any = Array.isArray(orgUser.organisations) ? orgUser.organisations[0] : orgUser.organisations;
      if (org?.slug !== slug) { await supabase.auth.signOut(); setError('This account belongs to a different school.'); setLoading(false); return; }
      if (!org?.is_active) { await supabase.auth.signOut(); setError('School account is suspended.'); setLoading(false); return; }
      setAuthState({
        slug: org.slug, orgId: orgUser.organisation_id, orgName: org.name,
        primaryColor: org.primary_color || '#16a34a', logoUrl: org.logo_url,
        plan: org.plan, industry: org.industry, role: orgUser.role,
        userId: data.user.id, email: data.user.email || '',
        settings: (org.settings as any) || {}, maxMembers: org.max_members || 50,
      } as AuthState);
    } catch { setError('Connection error. Try again.'); setLoading(false); }
  }

  const MODES = [
    { m: 'light', icon: 'sunny-outline' },
    { m: 'dark',  icon: 'moon-outline' },
    { m: 'system',icon: 'phone-portrait-outline' },
  ] as const;
  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={theme.textSub} />
            <Text style={[styles.backText, { color: theme.textSub }]}>Change school</Text>
          </TouchableOpacity>
          <View style={styles.themeRow}>
            {MODES.map(({ m, icon }) => (
              <TouchableOpacity key={m} onPress={() => setMode(m)}
                style={[styles.themeBtn, {
                  backgroundColor: mode === m ? (isDark ? 'rgba(34,197,94,0.15)' : '#E8F5E8') : 'transparent',
                  borderColor: mode === m ? c + '60' : theme.border,
                }]}>
                <Ionicons name={icon} size={14} color={mode === m ? c : theme.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* School pill */}
        <View style={[styles.schoolPill, { backgroundColor: isDark ? `${c}15` : `${c}10`, borderColor: `${c}30` }]}>
          <View style={[styles.schoolDot, { backgroundColor: c }]} />
          <Text style={[styles.schoolPillText, { color: c }]}>{orgName}</Text>
          <Text style={[styles.schoolPillSlug, { color: theme.textMuted }]}>· {slug}</Text>
        </View>

        <Text style={[styles.headline, { color: theme.text }]}>Staff Login</Text>
        <Text style={[styles.sub, { color: theme.textSub }]}>
          {industry === 'education' ? 'For Admin, Teacher & Gateman accounts' : 'Enter your credentials to continue'}
        </Text>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <View style={[styles.accentBar, { backgroundColor: c }]} />
          <View style={styles.cardInner}>

            {/* Email */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textMuted }]}>EMAIL ADDRESS</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.bgInput, borderColor: theme.border }]}>
                <Ionicons name="mail-outline" size={16} color={theme.textMuted} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={email} onChangeText={t => { setEmail(t); setError(null); }}
                  placeholder={`admin@${slug}.ng`} placeholderTextColor={theme.textMuted}
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textMuted }]}>PASSWORD</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.bgInput, borderColor: theme.border }]}>
                <Ionicons name="lock-closed-outline" size={16} color={theme.textMuted} />
                <TextInput
                  style={[styles.input, { color: theme.text, flex: 1 }]}
                  value={password} onChangeText={t => { setPassword(t); setError(null); }}
                  placeholder="••••••••" placeholderTextColor={theme.textMuted}
                  secureTextEntry={!showPw} returnKeyType="go" onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPw(v => !v)} style={{ paddingLeft: 4 }}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={16} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {error && (
              <View style={[styles.errorBox, { backgroundColor: theme.dangerBg, borderColor: `${theme.danger}25` }]}>
                <Ionicons name="alert-circle-outline" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.dangerText }]}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: canSubmit ? c : (isDark ? 'rgba(255,255,255,0.06)' : '#E5E7E5') }]}
              onPress={handleLogin} disabled={!canSubmit} activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="white" size="small" /> : (
                <>
                  <Text style={[styles.btnText, { color: canSubmit ? 'white' : theme.textMuted }]}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={16} color={canSubmit ? 'white' : theme.textMuted} />
                </>
              )}
            </TouchableOpacity>

            {/* Role info */}
            <View style={[styles.roleBox, { backgroundColor: isDark ? `${c}08` : `${c}08`, borderColor: `${c}20` }]}>
              <Ionicons name="information-circle-outline" size={14} color={theme.textMuted} />
              <Text style={[styles.roleText, { color: theme.textMuted }]}>
                For <Text style={{ color: c, fontWeight: '700' }}>Admin</Text>, <Text style={{ color: c, fontWeight: '700' }}>Teacher</Text> & <Text style={{ color: c, fontWeight: '700' }}>Gateman</Text> roles
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('ParentLogin')} style={styles.parentLink}>
          <Text style={[styles.parentLinkText, { color: theme.textMuted }]}>
            Parent? <Text style={{ color: c, fontWeight: '700' }}>Use Parent Portal →</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: SPACING.xl, paddingTop: 56 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xxl },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontSize: FONT.sm, fontWeight: '500' },
  themeRow: { flexDirection: 'row', gap: 4 },
  themeBtn: { width: 30, height: 30, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  schoolPill: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 20 },
  schoolDot: { width: 7, height: 7, borderRadius: 4 },
  schoolPillText: { fontSize: FONT.sm, fontWeight: '700' },
  schoolPillSlug: { fontSize: FONT.sm },
  headline: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 5 },
  sub: { fontSize: FONT.base, lineHeight: 20, marginBottom: 24 },
  card: { borderWidth: 1, borderRadius: RADIUS.xxl, overflow: 'hidden', marginBottom: 24 },
  accentBar: { height: 3 },
  cardInner: { padding: SPACING.xl, gap: 4 },
  field: { marginBottom: 14 },
  label: { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 1.1, marginBottom: 7 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: RADIUS.lg, paddingHorizontal: 14, height: 50 },
  input: { flex: 1, fontSize: FONT.base },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: RADIUS.md, padding: 10, marginBottom: 10 },
  errorText: { flex: 1, fontSize: FONT.sm, lineHeight: 17 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: RADIUS.lg, marginTop: 6 },
  btnText: { fontSize: FONT.md, fontWeight: '700' },
  roleBox: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: RADIUS.md, padding: 10, marginTop: 8 },
  roleText: { flex: 1, fontSize: FONT.sm, lineHeight: 18 },
  parentLink: { alignItems: 'center', marginTop: 8 },
  parentLinkText: { fontSize: FONT.sm },
});
