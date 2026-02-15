
export type AuthView = 'login' | 'signup' | 'forgot-password';
export type DashboardView = 'search' | 'favorites' | 'quiz' | 'support';

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
  target_lang?: string; 
}

export interface Favorite {
  id: string;
  user_id: string;
  word: string;
  entry: DictionaryEntry;
  created_at: string;
}

export interface QuizSettings {
  lang: string;
  category: string;
  level: string;
}