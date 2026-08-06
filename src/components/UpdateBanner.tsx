// src/components/UpdateBanner.tsx — ATTENDY-MOBILE
// Deliberately NOT silent. expo-updates can auto-check-and-apply on its
// own with zero UI (the default behavior), but that was explicitly not
// wanted here — this component checks manually, shows a visible banner,
// and only downloads/applies when the person taps "Update now". Checks
// again whenever the app comes back to the foreground, so someone who
// dismissed it once will still see it after the next update ships.

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, AppState, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, FONT, SPACING } from '../lib/theme';

type Status = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

export default function UpdateBanner() {
  const { theme, isDark } = useTheme();
  const [status, setStatus] = useState<Status>('idle');
  const [dismissed, setDismissed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);

  async function check() {
    // Updates.isEnabled is false in Expo Go / dev client / local dev
    // builds — there's nothing to check for in those environments.
    if (!Updates.isEnabled) return;
    setStatus('checking');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        setStatus('available');
        setDismissed(false); // a genuinely new update un-dismisses the banner
      } else {
        setStatus('idle');
      }
    } catch (err: any) {
      // Fails quietly (e.g. offline) — this is a background check, not
      // something that should interrupt anyone.
      setStatus('idle');
    }
  }

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        check();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  async function handleUpdateNow() {
    setStatus('downloading');
    setErrorMsg(null);
    try {
      await Updates.fetchUpdateAsync();
      setStatus('ready');
      // Small delay so "Ready — restarting…" is actually visible before
      // the app reloads out from under the person.
      setTimeout(() => Updates.reloadAsync(), 600);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message ?? 'Could not download the update. Check your connection and try again.');
    }
  }

  if (status === 'idle' || status === 'checking' || dismissed) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.bgCard,
          borderColor: theme.border,
          shadowColor: isDark ? '#000' : theme.shadow,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${theme.info}18` }]}>
        {status === 'downloading' || status === 'ready' ? (
          <ActivityIndicator size="small" color={theme.info} />
        ) : (
          <Ionicons name="cloud-download-outline" size={18} color={theme.info} />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: theme.text }]}>
          {status === 'available' && 'Update available'}
          {status === 'downloading' && 'Downloading update…'}
          {status === 'ready' && 'Ready — restarting…'}
          {status === 'error' && 'Update failed'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={2}>
          {status === 'available' && 'A new version of Attendy is ready to install.'}
          {status === 'downloading' && 'This will only take a moment.'}
          {status === 'ready' && 'The app will restart automatically.'}
          {status === 'error' && (errorMsg ?? 'Please try again.')}
        </Text>
      </View>

      {status === 'available' && (
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => setDismissed(true)} style={styles.laterBtn}>
            <Text style={[styles.laterText, { color: theme.textMuted }]}>Later</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleUpdateNow} style={[styles.updateBtn, { backgroundColor: theme.info }]}>
            <Text style={styles.updateText}>Update</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'error' && (
        <TouchableOpacity onPress={handleUpdateNow} style={[styles.updateBtn, { backgroundColor: theme.danger }]}>
          <Text style={styles.updateText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 40,
    left: SPACING.lg,
    right: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 999,
  },
  iconWrap: {
    width: 34, height: 34, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: FONT.base, fontWeight: '700' },
  subtitle: { fontSize: FONT.xs, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  laterBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  laterText: { fontSize: FONT.xs, fontWeight: '600' },
  updateBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md },
  updateText: { color: 'white', fontSize: FONT.xs, fontWeight: '700' },
});