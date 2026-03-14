
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { lookupWord, generateSpeech, decodeBase64, decodeAudioData } from '../lib/gemini';
import { DictionaryEntry, DashboardView, Favorite, HistoryEntry } from '../types';
import { SearchSection } from './dashboard/SearchSection';
import { QuizSection } from './dashboard/QuizSection';
import { FavoritesSection } from './dashboard/FavoritesSection';
import { SupportSection } from './dashboard/SupportSection';
import { HistorySection } from './dashboard/HistorySection';
import Navigation from './Navigation';

interface DashboardProps {
  session: any;
  isGuest?: boolean;
  onExitGuest?: () => void;
  deferredPrompt?: boolean;
  isStandalone?: boolean;
  isIOS?: boolean;
  onInstallApp?: () => void;
}

const LANGUAGES = [
  { code: 'Chinese', name: 'Chinese', countryCode: 'cn' },
  { code: 'French', name: 'French', countryCode: 'fr' },
  { code: 'German', name: 'German', countryCode: 'de' },
  { code: 'Italian', name: 'Italian', countryCode: 'it' },
  { code: 'Japanese', name: 'Japanese', countryCode: 'jp' },
  { code: 'Myanmar', name: 'Myanmar', countryCode: 'mm' },
  { code: 'Portuguese', name: 'Portuguese', countryCode: 'pt' },
  { code: 'Spanish', name: 'Spanish', countryCode: 'es' },
];

const getFlagUrl = (countryCode: string) => `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;

const Dashboard: React.FC<DashboardProps> = ({ session, isGuest, onExitGuest, isStandalone, onInstallApp }) => {
  const [currentTab, setCurrentTab] = useState<DashboardView>('search');
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [selectedFavorite, setSelectedFavorite] = useState<Favorite | null>(null);
  const [favSearchQuery, setFavSearchQuery] = useState('');
  const [persuasionType, setPersuasionType] = useState<'favorites' | 'quiz' | null>(null);

  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryEntry | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Search local state
  const [searchWord, setSearchWord] = useState('');
  const [targetLang, setTargetLang] = useState('Myanmar');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchResult, setSearchResult] = useState<DictionaryEntry | null>(null);
  const [playingAudio, setPlayingAudio] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const user = session?.user || { id: 'guest', email: 'Guest User' };

  const fetchFavorites = useCallback(async () => {
    if (!supabase || isGuest) return;
    setLoadingFavorites(true);
    try {
      const { data, error } = await supabase.from('favorites').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setFavorites(data);
    } catch (err) { console.error(err); } finally { setLoadingFavorites(false); }
  }, [user.id, isGuest]);

  const fetchHistory = useCallback(async () => {
    if (isGuest) {
      const localData = localStorage.getItem('linguistpro_history');
      if (localData) {
        setHistory(JSON.parse(localData));
      }
      return;
    }
    if (!supabase) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('histories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      if (data) setHistory(data);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [user.id, isGuest]);

  useEffect(() => {
    fetchFavorites();
    fetchHistory();
  }, [fetchFavorites, fetchHistory]);

  const toggleFavorite = async (entry: DictionaryEntry) => {
    if (isGuest) {
      setPersuasionType('favorites');
      return;
    }
    if (!supabase) return;
    const existing = favorites.find(f => f.word.toLowerCase() === entry.word.toLowerCase());
    try {
      if (existing) {
        await supabase.from('favorites').delete().eq('id', existing.id);
        setFavorites(prev => prev.filter(f => f.id !== existing.id));
      } else {
        const { data } = await supabase.from('favorites').insert([{ user_id: user.id, word: entry.word.toLowerCase(), entry }]).select().single();
        if (data) setFavorites(prev => [data, ...prev]);
      }
    } catch (err) { console.error(err); }
  };

  const saveToHistory = async (word: string, lang: string, entry: DictionaryEntry) => {
    const newEntry: Partial<HistoryEntry> = {
      user_id: user.id,
      word: word.toLowerCase(),
      target_lang: lang,
      entry,
      created_at: new Date().toISOString()
    };

    if (isGuest) {
      const updatedHistory = [
        { ...newEntry, id: Math.random().toString(36).substr(2, 9) } as HistoryEntry,
        ...history.filter(h => h.word !== word.toLowerCase())
      ].slice(0, 30);
      setHistory(updatedHistory);
      localStorage.setItem('linguistpro_history', JSON.stringify(updatedHistory));
      return;
    }

    if (!supabase) return;

    try {
      // First, delete if already exists to keep it at the top
      await supabase.from('histories').delete().eq('user_id', user.id).eq('word', word.toLowerCase());

      const { data } = await supabase.from('histories').insert([newEntry]).select().single();

      if (data) {
        const updatedHistory = [data, ...history.filter(h => h.word !== word.toLowerCase())].slice(0, 30);
        setHistory(updatedHistory);

        // Cleanup old entries (more than 30) - simple approach: delete anything older than the 30th item
        const { data: allHistory } = await supabase.from('histories').select('id').eq('user_id', user.id).order('created_at', { ascending: false });
        if (allHistory && allHistory.length > 30) {
          const idsToDelete = allHistory.slice(30).map(h => h.id);
          await supabase.from('histories').delete().in('id', idsToDelete);
        }
      }
    } catch (err) {
      console.error("Error saving history:", err);
    }
  };

  const deleteHistory = async (id: string | null, deleteAll = false) => {
    if (isGuest) {
      let updatedHistory = deleteAll ? [] : history.filter(h => h.id !== id);
      setHistory(updatedHistory);
      localStorage.setItem('linguistpro_history', JSON.stringify(updatedHistory));
      return;
    }

    if (!supabase) return;

    try {
      if (deleteAll) {
        await supabase.from('histories').delete().eq('user_id', user.id);
        setHistory([]);
      } else if (id) {
        await supabase.from('histories').delete().eq('id', id);
        setHistory(prev => prev.filter(h => h.id !== id));
      }
    } catch (err) {
      console.error("Error deleting history:", err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchWord.trim()) return;
    setLoadingSearch(true);
    try {
      const data = await lookupWord(searchWord, targetLang);
      const entry = { ...data, target_lang: targetLang };
      setSearchResult(entry);
      saveToHistory(data.word, targetLang, entry);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const playPronunciation = async (word: string) => {
    if (playingAudio) return;
    setPlayingAudio(true);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const base64 = await generateSpeech(word);
      const audioBuffer = await decodeAudioData(decodeBase64(base64), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setPlayingAudio(false);
      source.start();
    } catch (err) {
      console.error("Audio playback error:", err);
      setPlayingAudio(false);
    }
  };

  const handleSignOut = async () => {
    if (isGuest) {
      onExitGuest?.();
    } else {
      await supabase?.auth.signOut();
    }
  };

  const handleTabChange = (tab: DashboardView) => {
    if (isGuest && (tab === 'favorites' || tab === 'quiz')) {
      setPersuasionType(tab === 'favorites' ? 'favorites' : 'quiz');
      return;
    }
    setCurrentTab(tab);
    setSelectedFavorite(null);
    setSelectedHistory(null);
  };

  const renderResult = (data: DictionaryEntry, showBackButton = false) => {
    const entryLang = LANGUAGES.find(l => l.code === data.target_lang);
    const isFav = favorites.some(f => f.word.toLowerCase() === data.word.toLowerCase());
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {showBackButton && (
          <button onClick={() => { setSelectedFavorite(null); setSelectedHistory(null); }} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-semibold text-sm transition-colors mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            Back to {selectedFavorite ? 'Favorite' : 'History'}
          </button>
        )}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-4 mb-1">
                <h2 className="text-4xl font-bold text-slate-800 capitalize">{data.word}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => playPronunciation(data.word)}
                    disabled={playingAudio}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playingAudio ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 active:scale-95'}`}
                  >
                    {playingAudio ? (
                      <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  <button onClick={() => toggleFavorite(data)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isFav ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 active:scale-95'}`}>
                    <svg className="w-5 h-5" fill={isFav ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  </button>
                </div>
              </div>
              <span className="text-indigo-600 font-mono font-medium">{data.phonetics}</span>
            </div>
            <div className="bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center min-w-[140px]">
              <div className="flex items-center gap-2 mb-0.5">
                {entryLang && <img src={getFlagUrl(entryLang.countryCode)} alt={entryLang.name} className="w-5 h-3.5 object-cover rounded-sm shadow-sm" />}
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{entryLang?.name}</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{data.translation}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Definition</h3>
              <p className="text-slate-700 text-lg leading-snug">{data.definition}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Examples</h3>
              <div className="space-y-4">
                {data.examples.map((ex, idx) => (
                  <div key={idx} className="border-l-4 border-indigo-600 pl-4 py-1 transition-all hover:bg-slate-50 rounded-r-2xl">
                    <p className="text-slate-900 font-medium text-[15px] mb-1">"{ex.original}"</p>
                    <p className="text-indigo-600 text-sm font-medium italic">"{ex.translated}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-fit">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Synonyms</h3>
            <div className="flex flex-wrap gap-2">
              {data.synonyms.map((syn, idx) => (
                <span key={idx} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-default">{syn}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-slate-800">
      <Navigation
        currentTab={currentTab}
        setCurrentTab={handleTabChange}
        isGuest={isGuest}
        favoritesCount={favorites.length}
        onExitGuest={onExitGuest}
        onSignOut={handleSignOut}
        userEmail={user.email}
      />

      <div className="flex-1 flex flex-col md:ml-64 transition-all duration-300">
        <main className={`flex-grow max-w-4xl mx-auto w-full py-8 px-4 ${'md:pb-8 pb-32'}`}>
          {currentTab === 'search' && (
            <SearchSection
              searchWord={searchWord}
              setSearchWord={setSearchWord}
              targetLang={targetLang}
              setTargetLang={setTargetLang}
              loading={loadingSearch}
              onSearch={handleSearch}
              result={searchResult}
              renderResult={renderResult}
              isGuest={isGuest}
              onExitGuest={onExitGuest}
            />
          )}

          {currentTab === 'quiz' && <QuizSection />}

          {currentTab === 'history' && (
            <HistorySection
              history={history}
              loading={loadingHistory}
              searchQuery={historySearchQuery}
              setSearchQuery={setHistorySearchQuery}
              onSelectHistory={setSelectedHistory}
              onDeleteHistory={deleteHistory}
              getFlagUrl={getFlagUrl}
              languages={LANGUAGES}
            />
          )}

          {currentTab === 'favorites' && (
            <FavoritesSection
              favorites={favorites}
              loading={loadingFavorites}
              searchQuery={favSearchQuery}
              setSearchQuery={setFavSearchQuery}
              onSelectFavorite={setSelectedFavorite}
              getFlagUrl={getFlagUrl}
              languages={LANGUAGES}
            />
          )}

          {currentTab === 'support' && <SupportSection />}

          {selectedFavorite && currentTab === 'favorites' && (
            <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#F8FAFC] rounded-3xl p-6 relative shadow-2xl scrollbar-hide">
                <button onClick={() => setSelectedFavorite(null)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-white rounded-full shadow-md z-10 transition-transform active:scale-90">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                {renderResult(selectedFavorite.entry, true)}
              </div>
            </div>
          )}

          {selectedHistory && currentTab === 'history' && (
            <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#F8FAFC] rounded-3xl p-6 relative shadow-2xl scrollbar-hide">
                <button onClick={() => setSelectedHistory(null)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-white rounded-full shadow-md z-10 transition-transform active:scale-90">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                {renderResult(selectedHistory.entry, true)}
              </div>
            </div>
          )}

          {/* Persuasion Modal for Guest */}
          {persuasionType && (
            <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-10 text-center animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                  {persuasionType === 'favorites' ? (
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  ) : (
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  )}
                </div>

                <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">
                  {persuasionType === 'favorites' ? 'Personal Word Bank' : 'Premium Daily Quiz'}
                </h2>

                <p className="text-slate-500 mb-10 leading-relaxed font-medium">
                  {persuasionType === 'favorites'
                    ? 'Save difficult words and build your own custom vocabulary library. Sign up to start building your personal linguist library.'
                    : 'Challenge yourself with interactive vocabulary games to accelerate your learning. Join our community to access daily quizzes.'}
                </p>

                <div className="space-y-4">
                  <button
                    onClick={() => onExitGuest?.()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-3xl shadow-xl shadow-indigo-100 transition-all active:scale-95"
                  >
                    Sign up to unlock
                  </button>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">It's free and takes 30 seconds.</p>
                  </div>
                  <button
                    onClick={() => setPersuasionType(null)}
                    className="w-full text-slate-400 font-bold text-sm py-4 hover:text-slate-600 transition-colors"
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="py-8 text-center bg-white border-t border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic tracking-[0.2em] animate-pulse">© 2025 LinguistPro • Powered by TripleK</p>
        </footer>
      </div>
    </div>
  );
};

export default Dashboard;
