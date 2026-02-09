
/**
 * Safe utility to retrieve environment variables in a browser environment.
 * Prevents "process is not defined" errors and checks multiple common injection points.
 */
export const getEnv = (key: string): string => {
  // 1. Try localStorage (Manual fallback for Supabase/Config in Preview)
  try {
    const localValue = localStorage.getItem(`LP_CONFIG_${key}`);
    if (localValue) return localValue;
  } catch (e) {}

  try {
    // 2. Try standard process.env (Shimmed or injected by platforms)
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch (e) {}

  try {
    // 3. Try import.meta.env (Vite/ESM standard)
    const metaEnv = (import.meta as any).env;
    if (metaEnv) {
      if (metaEnv[key]) return metaEnv[key];
      // Vercel/Vite often requires VITE_ prefix for client-side exposure
      if (metaEnv[`VITE_${key}`]) return metaEnv[`VITE_${key}`];
    }
  } catch (e) {}

  try {
    // 4. Try window fallbacks (Runtime injection)
    const win = window as any;
    if (win._env_ && win._env_[key]) return win._env_[key];
    if (win.process?.env?.[key]) return win.process.env[key];
  } catch (e) {}

  return '';
};

/**
 * Utility to manually save a config value to localStorage (Preview usage)
 */
export const setLocalEnv = (key: string, value: string) => {
  try {
    localStorage.setItem(`LP_CONFIG_${key}`, value);
  } catch (e) {
    console.error("Failed to save to localStorage", e);
  }
};

/**
 * Utility to clear manually saved config
 */
export const clearLocalEnv = () => {
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('LP_CONFIG_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {}
};
