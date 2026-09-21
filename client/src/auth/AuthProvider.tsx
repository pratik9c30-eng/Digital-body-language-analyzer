import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigError } from '../lib/supabase';

type AuthResult = { error: string | null };
type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configError: string | null;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (email: string, password: string, displayName: string) => Promise<AuthResult>;
  logout: () => Promise<AuthResult>;
  refreshSession: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function authError(error: unknown) {
  return error instanceof Error ? error.message : 'Supabase authentication failed.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setLoading(false); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    configError: supabaseConfigError,
    login: async (email, password) => {
      if (!supabase) return { error: supabaseConfigError };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? authError(error) : null };
    },
    signup: async (email, password, displayName) => {
      if (!supabase) return { error: supabaseConfigError };
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName.trim().slice(0, 80) } } });
      return { error: error ? authError(error) : null };
    },
    logout: async () => {
      if (!supabase) return { error: supabaseConfigError };
      const { error } = await supabase.auth.signOut();
      return { error: error ? authError(error) : null };
    },
    refreshSession: async () => {
      if (!supabase) return { error: supabaseConfigError };
      const { error } = await supabase.auth.refreshSession();
      return { error: error ? authError(error) : null };
    },
  }), [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
