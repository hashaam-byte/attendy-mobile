import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { RADIUS, FONT, SPACING } from '../lib/theme';

export default function SlugEntryScreen({ navigation }: any) {
  const { theme, isDark, mode, setMode } = useTheme();
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    const s = slug.trim().toLowerCase().replace(/\s+/g, '-');
    if (!s) return;
    setLoading(true); setError(null);
    const { data: org } = await supabase
      .from('organisations')
      .select('id,name,slug,is_active,industry,primary_color,logo_url,plan_expires_at')
      .eq('slug', s)
      .single();
    if (!org) { setError('School not found. Check your school ID.'); setLoading(false); return; }
    if (!org.is_active) { setError('This school account is suspended.'); setLoading(false); return; }
    if (org.plan_expires_at && new Date(org.plan_expires_at) < new Date()) {
      setError("School subscription has expired. Contact admin."); setLoading(false); return;
    }
    navigation.navigate('Login', { slug: org.slug, orgName: org.name, primaryColor: org.primary_color || '#16a34a', logoUrl: org.logo_url, industry: org.industry });
    setLoading(false);
  }

  const MODES = [
    { m: 'light', icon: 'sunny-outline' },
    { m: 'dark',  icon: 'moon-outline'  },
    { m: 'system',icon: 'phone-portrait-outline' },
  ] as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Theme toggle top-right */}
        <View style={styles.themeRow}>
          {MODES.map(({ m, icon }) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m)}
              style={[styles.themeBtn, {
                backgroundColor: mode === m ? (isDark ? 'rgba(34,197,94,0.15)' : '#E8F5E8') : 'transparent',
                borderColor: mode === m ? (isDark ? 'rgba(34,197,94,0.4)' : '#B0D4B0') : theme.border,
              }]}
            >
              <Ionicons name={icon} size={15} color={mode === m ? theme.success : theme.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={[styles.logoRing, { borderColor: isDark ? 'rgba(34,197,94,0.2)' : '#B0D4B0' }]}>
            <View style={styles.logoInner}>
              <Ionicons name="school" size={28} color="white" />
            </View>
          </View>
          <View style={styles.wordmark}>
            <Text style={[styles.wordmarkText, { color: theme.text }]}>Attendy</Text>
            <View style={[styles.wordmarkBadge, { backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : '#DCFCE7', borderColor: isDark ? 'rgba(34,197,94,0.3)' : '#86efac' }]}>
              <Text style={[styles.wordmarkBadgeText, { color: theme.success }]}>EDU</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.headline, { color: theme.text }]}>Welcome back</Text>
        <Text style={[styles.sub, { color: theme.textSub }]}>Enter your School ID to continue</Text>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border, shadowColor: theme.shadow }]}>
          {/* Top accent line */}
          <View style={[styles.accentLine, { backgroundColor: '#16a34a' }]} />

          <View style={styles.cardInner}>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>SCHOOL ID</Text>
            <View style={[styles.inputWrap, {
              backgroundColor: theme.bgInput,
              borderColor: error ? theme.danger : theme.border,
            }]}>
              <Ionicons name="search-outline" size={17} color={theme.textMuted} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={slug}
                onChangeText={t => { setSlug(t); setError(null); }}
                placeholder="e.g. greenfield-academy"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleContinue}
              />
            </View>
            <Text style={[styles.hint, { color: theme.textMuted }]}>Provided by your school admin</Text>

            {error && (
              <View style={[styles.errorBox, { backgroundColor: theme.dangerBg, borderColor: `${theme.danger}30` }]}>
                <Ionicons name="alert-circle-outline" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.dangerText }]}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: !slug.trim() || loading ? (isDark ? 'rgba(255,255,255,0.05)' : '#E5E7E5') : '#16a34a' }]}
              onPress={handleContinue}
              disabled={!slug.trim() || loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color="white" size="small" />
                : <>
                    <Text style={[styles.btnText, { color: !slug.trim() ? theme.textMuted : 'white' }]}>Continue</Text>
                    <Ionicons name="arrow-forward" size={16} color={!slug.trim() ? theme.textMuted : 'white'} />
                  </>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divRow}>
          <View style={[styles.divLine, { backgroundColor: theme.border }]} />
          <Text style={[styles.divText, { color: theme.textMuted }]}>OR</Text>
          <View style={[styles.divLine, { backgroundColor: theme.border }]} />
        </View>

        {/* Parent portal */}
        <TouchableOpacity
          style={[styles.parentBtn, { backgroundColor: theme.bgCard, borderColor: theme.border }]}
          onPress={() => navigation.navigate('ParentLogin')}
          activeOpacity={0.7}
        >
          <View style={[styles.parentIcon, { backgroundColor: isDark ? 'rgba(96,165,250,0.12)' : '#DBEAFE' }]}>
            <Ionicons name="phone-portrait-outline" size={16} color={theme.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.parentBtnLabel, { color: theme.text }]}>Parent / Guardian Portal</Text>
            <Text style={[styles.parentBtnSub, { color: theme.textMuted }]}>View your child's attendance by phone number</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
        </TouchableOpacity>

        {/* Trust chips */}
        <View style={styles.trustRow}>
          {['🔒 Secure', '⚡ Fast', '🇳🇬 Nigerian Schools'].map(t => (
            <View key={t} style={[styles.trustChip, { backgroundColor: theme.bgCardAlt, borderColor: theme.border }]}>
              <Text style={[styles.trustChipText, { color: theme.textMuted }]}>{t}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: SPACING.xl, paddingTop: 64, alignItems: 'center' },
  themeRow: { flexDirection: 'row', gap: 6, alignSelf: 'flex-end', marginBottom: SPACING.xxxl },
  themeBtn: { width: 34, height: 34, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  logoArea: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  logoRing: { width: 60, height: 60, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  logoInner: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmarkText: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  wordmarkBadge: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  wordmarkBadgeText: { fontSize: FONT.xs, fontWeight: '800', letterSpacing: 1 },
  headline: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6, textAlign: 'center' },
  sub: { fontSize: FONT.base, textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  card: { width: '100%', maxWidth: 400, borderRadius: RADIUS.xxl, borderWidth: 1, overflow: 'hidden', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 20, elevation: 8, marginBottom: 24 },
  accentLine: { height: 3 },
  cardInner: { padding: SPACING.xl },
  fieldLabel: { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: RADIUS.lg, paddingHorizontal: 14, height: 50, marginBottom: 6 },
  input: { flex: 1, fontSize: FONT.base, letterSpacing: 0.2 },
  hint: { fontSize: FONT.xs, marginBottom: 16 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: RADIUS.md, padding: 10, marginBottom: 14 },
  errorText: { flex: 1, fontSize: FONT.sm, lineHeight: 18 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: RADIUS.lg },
  btnText: { fontSize: FONT.md, fontWeight: '700' },
  divRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', maxWidth: 400, marginBottom: 16 },
  divLine: { flex: 1, height: 1 },
  divText: { fontSize: FONT.xs, fontWeight: '700' },
  parentBtn: { width: '100%', maxWidth: 400, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: 28 },
  parentIcon: { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  parentBtnLabel: { fontSize: FONT.base, fontWeight: '600' },
  parentBtnSub: { fontSize: FONT.xs, marginTop: 1 },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  trustChip: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5 },
  trustChipText: { fontSize: FONT.xs, fontWeight: '500' },
});
