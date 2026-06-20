import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { AuthState } from '../lib/types';

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
    // Check existing session on app start
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await loadUserOrgData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setAuthState(null);
        setLoading(false);
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

      setAuthState({
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
        settings: (org.settings as Record<string, unknown>) || {},
        maxMembers: org.max_members || 50,
      });
      setLoading(false);
      return true;
    } catch (err) {
      console.error('loadUserOrgData error:', err);
      setLoading(false);
      return false;
    }
  }

  async function signOut() {
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
