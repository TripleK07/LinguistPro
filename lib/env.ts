
/**
 * Safe utility to retrieve environment variables in a browser environment.
 * Prevents "process is not defined" errors and checks multiple common injection points.
 */
export const getEnv = (key: string): string => {
  const viteKey = `VITE_${key}`;

  // 1. Try localStorage (Manual fallback for Preview)
  try {
    const localValue = localStorage.getItem(`LP_CONFIG_${key}`);
    if (localValue) return localValue;
  } catch (e) {}

  // 2. Try window/global injection fallbacks
  const win = window as any;
  if (win[key]) return win[key];
  if (win[viteKey]) return win[viteKey];
  if (win._env_?.[key]) return win._env_[key];
  if (win._env_?.[viteKey]) return win._env_[viteKey];

  // 3. Try import.meta.env (Vite standard)
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv) {
      if (metaEnv[key]) return metaEnv[key];
      if (metaEnv[viteKey]) return metaEnv[viteKey];
    }
  } catch (e) {}

  // 4. Try process.env (Node/Shimmed fallback)
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env[key]) return process.env[key] as string;
      if (process.env[viteKey]) return process.env[viteKey] as string;
    }
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
