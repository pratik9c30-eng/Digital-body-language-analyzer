import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const missing = [!url && 'VITE_SUPABASE_URL', !publishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY'].filter(Boolean) as string[];

export const supabaseConfigError = missing.length
  ? `Missing Supabase configuration: ${missing.join(', ')}. Add them to client/.env and restart Vite.`
  : null;

export const supabase = url && publishableKey ? createClient(url, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
