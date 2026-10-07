import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEnabled = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseEnabled) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}

/** للتطبيقات التجريبية بدون إعداد Supabase (وضع العرض) */
export function trySupabase(): SupabaseClient | null {
  if (!supabaseEnabled) return null;
  return getSupabase();
}
