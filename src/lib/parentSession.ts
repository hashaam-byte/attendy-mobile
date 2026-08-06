// src/lib/parentSession.ts — ATTENDY-MOBILE
// Previously the parent's session token only ever existed in React
// Navigation params — in-memory state that's wiped the instant the app
// is closed. That's why closing the app always logged parents out: it
// wasn't a deliberate timeout, the token was simply never saved
// anywhere. This persists it to AsyncStorage so the app can restore the
// session on next launch instead.
//
// The token itself is a signed, server-verified JWT-like value (see
// attendy's src/lib/parent-session.ts) — storing it locally doesn't
// weaken anything server-side; the server still independently checks
// its signature and expiry (now 60 days) on every request.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'attendy_parent_session';

export interface StoredParentSession {
  token: string;
  phone: string;
  students: Array<{
    id: string;
    full_name: string;
    class_name: string | null;
    organisation_id: string;
    parent_phone: string | null;
  }>;
  savedAt: number;
}

export async function saveParentSession(session: Omit<StoredParentSession, 'savedAt'>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...session, savedAt: Date.now() }));
  } catch (err) {
    console.warn('[PARENT SESSION] Failed to save:', err);
  }
}

export async function loadParentSession(): Promise<StoredParentSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredParentSession;
  } catch {
    return null;
  }
}

export async function clearParentSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (err) {
    console.warn('[PARENT SESSION] Failed to clear:', err);
  }
}