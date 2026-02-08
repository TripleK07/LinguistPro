
export type AuthView = 'login' | 'signup' | 'forgot-password';
export type DashboardView = 'search' | 'favorites' | 'quiz';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

export interface AppState {
  user: any | null;
  loading: boolean;
  view: AuthView;
}

export interface DictionaryExample {
  original: string;
  translated: string;
}

export interface DictionaryEntry {
  word: string;
  phonetics: string;
  translation: string;
  definition: string;
  examples: DictionaryExample[];
  synonyms: string[];
  target_lang?: string; // Track which language it was translated to
}

export interface Favorite {
  id: string;
  user_id: string;
  word: string;
  entry: DictionaryEntry;
  created_at: string;
}
