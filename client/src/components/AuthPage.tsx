import { useState, type FormEvent } from 'react';
import { ArrowRight, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

function readableError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'Email or password is incorrect.';
  if (/user already registered/i.test(message)) return 'An account with this email already exists.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email before logging in.';
  return message;
}

export function AuthPage() {
  const { login, signup, configError } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setMessage('');
    if (mode === 'signup' && displayName.trim().length < 2) { setError('Enter a display name with at least 2 characters.'); return; }
    if (!email.includes('@')) { setError('Enter a valid email address.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setBusy(true);
    const result = mode === 'login' ? await login(email.trim(), password) : await signup(email.trim(), password, displayName);
    setBusy(false);
    if (result.error) setError(readableError(result.error));
    else if (mode === 'signup') setMessage('Account created. Check your email if confirmation is enabled, then log in.');
  };

  return <div className="app-shell auth-shell"><section className="auth-panel"><div className="auth-mark"><LockKeyhole size={22} /></div><div className="eyebrow">DIGITAL BODY LANGUAGE ANALYZER</div><h1>{mode === 'login' ? 'Welcome back.' : 'Create your profile.'}</h1><p>Protect your behavioral baseline with secure Supabase authentication.</p>{configError && <div className="auth-error" role="alert">{configError}</div>}<form onSubmit={submit}>{mode === 'signup' && <label><span><UserRound size={14} /> Display name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" disabled={Boolean(configError)} /></label>}<label><span><Mail size={14} /> Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" disabled={Boolean(configError)} required /></label><label><span><LockKeyhole size={14} /> Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} disabled={Boolean(configError)} required /></label>{error && <div className="auth-error" role="alert">{error}</div>}{message && <div className="auth-message" role="status">{message}</div>}<button className="calibration-cta" disabled={busy || Boolean(configError)}><span>{busy ? 'Working...' : mode === 'login' ? 'Log in' : 'Create account'}</span><ArrowRight size={16} /></button></form><button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }}>{mode === 'login' ? 'Need an account? Sign up' : 'Already registered? Log in'}</button></section></div>;
}
