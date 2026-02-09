
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { getEnv } from './env';

export const SUPABASE_URL = getEnv('SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');

// Only initialize if we have the required parameters to avoid the 'supabaseUrl is required' error
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
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
