import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Supabase 클라이언트는 하나만. 앱에는 공개돼도 되는 값(VITE_)만 들어간다.
let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error('VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY가 필요해요 (.env.local)');
  }
  client = createClient(url, anonKey, { auth: { persistSession: true, flowType: 'pkce' } });
  return client;
}
