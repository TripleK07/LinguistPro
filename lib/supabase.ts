
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Note: In a production environment, these should be handled via environment variables.
const SUPABASE_URL = (window as any)._env_?.SUPABASE_URL || 'https://lvitbtvdggdnutcfqepl.supabase.co';
const SUPABASE_ANON_KEY = (window as any)._env_?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aXRidHZkZ2dkbnV0Y2ZxZXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MzA3NTYsImV4cCI6MjA4NjEwNjc1Nn0.TVU4HpBIEV4VLdtrG5J2-nMzBfYdQhRysMiPkIf3QHs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});

/**
 * Helper to check if Supabase is properly configured
 */
export const isSupabaseConfigured = () => {
  return SUPABASE_URL !== 'https://lvitbtvdggdnutcfqepl.supabase.co' && SUPABASE_ANON_KEY !== 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aXRidHZkZ2dkbnV0Y2ZxZXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MzA3NTYsImV4cCI6MjA4NjEwNjc1Nn0.TVU4HpBIEV4VLdtrG5J2-nMzBfYdQhRysMiPkIf3QHs';
};
