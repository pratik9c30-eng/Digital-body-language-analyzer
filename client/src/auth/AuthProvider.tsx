import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type User = { id: string; email?: string; user_metadata?: { display_name?: string } };
type Session = { user: User };

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

type StoredAccount = { id: string; email: string; password: string; displayName: string };
const ACCOUNTS_KEY = 'dbla:local-accounts';
const SESSION_KEY = 'dbla:local-session';

function readAccounts(): StoredAccount[] {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]') as StoredAccount[]; } catch { return []; }
}

function readSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null; } catch { return null; }
}

function toSession(account: StoredAccount): Session {
  return { user: { id: account.id, email: account.email, user_metadata: { display_name: account.displayName } } };
}

function localError(message: string) { return { error: message }; }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSession(readSession());
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    configError: null,
    login: async (email, password) => {
      const account = readAccounts().find((candidate) => candidate.email === email && candidate.password === password);
      if (!account) return localError('Invalid login credentials.');
      const nextSession = toSession(account);
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      return { error: null };
    },
    signup: async (email, password, displayName) => {
      const accounts = readAccounts();
      if (accounts.some((account) => account.email === email)) return localError('User already registered.');
      accounts.push({ id: crypto.randomUUID(), email, password, displayName: displayName.trim().slice(0, 80) });
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      return { error: null };
    },
    logout: async () => {
      localStorage.removeItem(SESSION_KEY);
      setSession(null);
      return { error: null };
    },
    refreshSession: async () => {
      setSession(readSession());
      return { error: null };
    },
  }), [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
