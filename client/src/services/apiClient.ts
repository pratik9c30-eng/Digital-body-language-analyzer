import { API_BASE_URL, buildApiUrl } from '../config';
import { supabase } from '../lib/supabase';

export type ApiErrorType = 'network' | 'timeout' | 'validation' | 'server' | 'cors' | 'unknown';

export interface ApiErrorState {
  type: ApiErrorType;
  message: string;
  status?: number;
}

let hasLoggedError = false;

export async function apiRequest(input: string, init: RequestInit = {}): Promise<Response> {
  const url = buildApiUrl(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...init.headers,
      },
      signal: controller.signal,
      credentials: 'include',
    });
    return response;
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Request timed out while contacting the DBLA backend.'
      : `Unable to reach DBLA at ${API_BASE_URL}: ${error instanceof Error ? error.message : 'connection refused'}.`;

    if (!hasLoggedError) {
      console.error('API request failed', { url, error: error instanceof Error ? error.message : String(error) });
      hasLoggedError = true;
    }

    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }
}
