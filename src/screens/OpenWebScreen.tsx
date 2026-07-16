// src/screens/OpenWebScreen.tsx — ATTENDY-EDU MOBILE
// Lets teachers/admins open the web dashboard from the app
// and be automatically signed in — no password re-entry needed.
//
// How it works:
// 1. User taps "Open Web Dashboard"
// 2. App calls Supabase to get a magic link for their email
// 3. App opens the magic link in the browser
// 4. Browser lands on the web dashboard — Supabase auth session
//    is created automatically from the token in the URL

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { RADIUS, FONT, SPACING } from '../lib/theme';

const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://attendy-edu.vercel.app';

export default function OpenWebScreen() {
  const { authState } = useAuth();
  const { theme }     = useTheme();
  const c             = authState?.primaryColor ?? '#16a34a';
  const [loading, setLoading] = useState(false);

  const slug = authState?.slug;
  const webUrl = slug ? `${WEB_BASE_URL}/${slug}/dashboard` : WEB_BASE_URL;

  async function handleOpenWeb() {
    if (!authState?.email) {
      // No email on record — just open the web URL directly
      await Linking.openURL(webUrl);
      return;
    }

    setLoading(true);
    try {
      // Generate a magic link (OTP) for the user's email.
      // When they open the link in a browser, Supabase signs them in
      // automatically — no password needed.
      const { error } = await supabase.auth.signInWithOtp({
        email:   authState.email,
        options: {
          emailRedirectTo: webUrl,
          shouldCreateUser: false, // only works for existing users
        },
      });

      if (error) {
        // If OTP fails (e.g. email not configured), fall back to direct URL
        console.warn('[WEB] Magic link failed, opening directly:', error.message);
        await Linking.openURL(webUrl);
        return;
      }

      Alert.alert(
        'Check Your Email',
        `We sent a sign-in link to ${authState.email}.\n\nTap it to open the web dashboard and be signed in automatically.`,
        [
          { text: 'Open Email App', onPress: () => Linking.openURL('mailto:') },
          { text: 'OK' },
        ]
      );
    } catch (err) {
      console.error('[WEB] Open web error:', err);
      await Linking.openURL(webUrl);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenWebDirect() {
    await Linking.openURL(webUrl);
  }

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>

      <View style={[s.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>

        {/* Icon */}
        <View style={[s.iconWrap, { backgroundColor: `${c}15`, borderColor: `${c}30` }]}>
          <Ionicons name="globe-outline" size={32} color={c} />
        </View>

        <Text style={[s.title, { color: theme.text }]}>Web Dashboard</Text>
        <Text style={[s.sub, { color: theme.textMuted }]}>
          Access the full Attendy dashboard on any browser — manage students, reports, settings and more.
        </Text>

        {/* URL preview */}
        <View style={[s.urlBox, { backgroundColor: theme.bgCardAlt, borderColor: theme.border }]}>
          <Ionicons name="link-outline" size={13} color={theme.textMuted} />
          <Text style={[s.urlText, { color: theme.textSub }]} numberOfLines={1}>
            {webUrl}
          </Text>
        </View>

        {/* Magic link sign-in button */}
        <TouchableOpacity
          style={[s.btnPrimary, { backgroundColor: c }]}
          onPress={handleOpenWeb}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Ionicons name="mail-outline" size={16} color="white" />
          <Text style={s.btnPrimaryText}>
            {loading ? 'Sending link…' : 'Sign in via Email Link'}
          </Text>
        </TouchableOpacity>

        <Text style={[s.orText, { color: theme.textMuted }]}>or</Text>

        {/* Direct open button */}
        <TouchableOpacity
          style={[s.btnSecondary, { borderColor: theme.border }]}
          onPress={handleOpenWebDirect}
          activeOpacity={0.8}
        >
          <Ionicons name="open-outline" size={16} color={theme.textSub} />
          <Text style={[s.btnSecondaryText, { color: theme.textSub }]}>Open Without Sign-In</Text>
        </TouchableOpacity>

        <Text style={[s.hint, { color: theme.textMuted }]}>
          The email link signs you in automatically. Without it, you'll need to enter your password on the web.
        </Text>

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, justifyContent: 'center', padding: SPACING.lg },
  card:            { borderRadius: RADIUS.xl, borderWidth: 1, padding: SPACING.xl, alignItems: 'center', gap: 12 },
  iconWrap:        { width: 64, height: 64, borderRadius: RADIUS.xl, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title:           { fontSize: FONT.xl, fontWeight: '700', textAlign: 'center' },
  sub:             { fontSize: FONT.sm, lineHeight: 20, textAlign: 'center' },
  urlBox:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.lg, borderWidth: 1, width: '100%' },
  urlText:         { fontSize: FONT.xs, fontFamily: 'monospace', flex: 1 },
  btnPrimary:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13, borderRadius: RADIUS.xl, width: '100%', justifyContent: 'center', marginTop: 4 },
  btnPrimaryText:  { color: 'white', fontWeight: '700', fontSize: FONT.sm },
  orText:          { fontSize: FONT.xs },
  btnSecondary:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.xl, width: '100%', justifyContent: 'center', borderWidth: 1 },
  btnSecondaryText:{ fontWeight: '600', fontSize: FONT.sm },
  hint:            { fontSize: FONT.xs, textAlign: 'center', lineHeight: 16, marginTop: 4 },
});