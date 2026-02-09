
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { getEnv } from './env';

export const SUPABASE_URL = getEnv('SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');

// Verify URL looks valid before creating client to prevent initialization crashes
const isValidUrl = (url: string) => url && url.startsWith('http');

export const supabase = (isValidUrl(SUPABASE_URL) && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    })
  : null;

/**
 * Helper to check if Supabase is properly configured
 */
export const isSupabaseConfigured = () => {
  return !!(supabase && SUPABASE_URL && SUPABASE_ANON_KEY);
};
