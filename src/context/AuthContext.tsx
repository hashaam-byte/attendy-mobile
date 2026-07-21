// src/context/AuthContext.tsx — Attendy Mobile
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { AuthState, DEFAULT_SETTINGS, type SchoolSettings } from '../lib/types';
import { registerForPushNotifications, unregisterPushToken } from '../lib/notification';
import { syncQueueToServer, clearLocalStore } from '../lib/OfflineStore';

// Key where we persist the full AuthState so the app opens
// logged in even with no internet connection.
const AUTH_STATE_KEY = '@attendy:auth_state_v2';

async function saveAuthStateToStorage(state: AuthState) {
  try {
    await AsyncStorage.setItem(AUTH_STATE_KEY, JSON.stringify(state));
  } catch {}
}

async function loadAuthStateFromStorage(): Promise<AuthState | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthState;
  } catch { return null; }
}

async function clearAuthStateFromStorage() {
  try { await AsyncStorage.removeItem(AUTH_STATE_KEY); } catch {}
}

interface AuthContextValue {
  authState: AuthState | null;
  loading: boolean;
  signOut: () => Promise<void>;
  setAuthState: (state: AuthState | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let initialCheckDone = false;

    async function init() {
      // ── Step 1: Load cached auth state immediately ──────────────────────
      // This makes the app open to the dashboard instantly even with no
      // internet — the user sees their org name, role, and settings right away.
      const cached = await loadAuthStateFromStorage();
      if (cached) {
        setAuthState(cached);
        setLoading(false); // show dashboard immediately from cache
      }

      // ── Step 2: Try to get a fresh session from Supabase ────────────────
      // Supabase persists the JWT in AsyncStorage, so getSession() works
      // without a network request when the token hasn't expired yet.
      // If it has expired, Supabase auto-refreshes using the refresh token
      // (this DOES need internet — if offline, we stay on the cached state).
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Refresh org data from server — updates cached state with latest
        // org settings, plan, etc. If this fails (offline), user stays on
        // the cached auth state loaded in Step 1.
        await loadUserOrgData(session.user.id);
      } else if (!cached) {
        // No session and no cache — show login screen
        setLoading(false);
      }
      // If we had a cache but no valid session, keep showing dashboard
      // but loadUserOrgData will fail gracefully and user can still scan.

      initialCheckDone = true;
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setAuthState(null);
        await clearAuthStateFromStorage();
        setLoading(false);
        return;
      }
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && initialCheckDone) {
        await loadUserOrgData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserOrgData(userId: string): Promise<boolean> {
    try {
      const { data: orgUser } = await supabase
        .from('org_users')
        .select(`
          role, organisation_id, is_active,
          organisations (
            id, name, slug, industry, plan, is_active,
            primary_color, logo_url, max_members, settings, plan_expires_at
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!orgUser) {
        setLoading(false);
        return false;
      }

      const org = Array.isArray(orgUser.organisations)
        ? orgUser.organisations[0]
        : orgUser.organisations;

      if (!org?.is_active) {
        setLoading(false);
        return false;
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Merge stored settings with defaults so callers always get a full
      // SchoolSettings object — no silent undefined reads.
      const rawSettings = (org.settings as Partial<SchoolSettings>) ?? {};
      const mergedSettings: Partial<SchoolSettings> = {
        ...DEFAULT_SETTINGS,
        ...rawSettings,
      };

      const newState: AuthState = {
        slug: org.slug,
        orgId: orgUser.organisation_id,
        orgName: org.name,
        primaryColor: org.primary_color || '#16a34a',
        logoUrl: org.logo_url,
        plan: org.plan,
        industry: org.industry,
        role: orgUser.role,
        userId,
        email: user?.email || '',
        settings: mergedSettings,
        maxMembers: org.max_members || 50,
      };

      setAuthState(newState);
      // Persist to AsyncStorage so next launch works offline
      await saveAuthStateToStorage(newState);
      setLoading(false);

      // Register push token after auth state is set — non-blocking
      // so it never delays the login flow even if permission is denied.
      registerForPushNotifications(userId, orgUser.organisation_id, orgUser.role)
        .catch((err) => console.warn('[PUSH] Registration failed silently:', err));

      return true;
    } catch (err) {
      console.error('loadUserOrgData error:', err);
      setLoading(false);
      return false;
    }
  }

  async function signOut() {
    if (authState?.userId && authState?.orgId) {
      await syncQueueToServer(authState.orgId).catch(() => {});
      await clearLocalStore(authState.orgId).catch(() => {});
      await unregisterPushToken(authState.userId, authState.orgId).catch(() => {});
    }
    // Clear the cached auth state so the app shows login on next open
    await clearAuthStateFromStorage();
    await supabase.auth.signOut();
    setAuthState(null);
  }

  return (
    <AuthContext.Provider value={{ authState, loading, signOut, setAuthState }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}