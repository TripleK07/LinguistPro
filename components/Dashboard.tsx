
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { lookupWord, generateSpeech, decodeBase64, decodeAudioData } from '../lib/gemini';
import { DictionaryEntry, DashboardView, Favorite } from '../types';
import { SearchSection } from './dashboard/SearchSection';
import { QuizSection } from './dashboard/QuizSection';
import { FavoritesSection } from './dashboard/FavoritesSection';
import { SupportSection } from './dashboard/SupportSection';

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

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchWord.trim()) return;
    setLoadingSearch(true);
    try {
      const data = await lookupWord(searchWord, targetLang);
      setSearchResult({ ...data, target_lang: targetLang });
    } catch (err) { console.error(err); } finally { setTimeout(() => setLoadingSearch(false), 500); }
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

  const renderResult = (data: DictionaryEntry, showBackButton = false) => {
    const entryLang = LANGUAGES.find(l => l.code === data.target_lang);
    const isFav = favorites.some(f => f.word.toLowerCase() === data.word.toLowerCase());
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {showBackButton && (
          <button onClick={() => setSelectedFavorite(null)} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-semibold text-sm transition-colors mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            Back to Favorite
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

  const navItems = [
    { id: 'search', label: 'Search', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> },
    { id: 'favorites', label: 'Favorite', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg> },
    { id: 'quiz', label: 'Quiz', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { id: 'support', label: 'Donate', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-slate-800">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 cursor-pointer transition-transform active:scale-95" onClick={() => { setCurrentTab('search'); setSelectedFavorite(null); }}>
                <img src="https://cdn-icons-png.flaticon.com/512/3898/3898082.png" alt="Logo" className="w-7 h-7" />
                <span className="font-black text-slate-900 text-lg tracking-tighter hidden xs:block">Linguist<span className="text-indigo-600">Pro</span></span>
              </div>
              <div className="flex h-full">
                {navItems.filter(item => !(isGuest && item.id === 'support')).map((item) => (
                  <button 
                    key={item.id} 
                    onClick={() => { 
                      if (isGuest && (item.id === 'favorites' || item.id === 'quiz')) {
                        setPersuasionType(item.id === 'favorites' ? 'favorites' : 'quiz');
                        return;
                      }
                      setCurrentTab(item.id as any); 
                      setSelectedFavorite(null); 
                    }} 
                    className={`relative flex items-center px-4 border-b-2 transition-all font-semibold text-sm capitalize ${currentTab === item.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                  >
                    <span className="mr-2 hidden sm:block">{item.icon}</span>
                    {item.label}
                    {item.id === 'favorites' && !isGuest && favorites.length > 0 && (
                      <span className="ml-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white shadow-md animate-in zoom-in-50 duration-300">
                        {favorites.length}
                      </span>
                    )}
                    {isGuest && (item.id === 'favorites' || item.id === 'quiz') && (
                      <svg className="ml-1.5 w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
               {isGuest ? (
                 <button 
                   onClick={() => onExitGuest?.()}
                   className="hidden sm:flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-full text-xs font-black shadow-lg shadow-indigo-100 transition-all active:scale-95 hover:bg-indigo-700"
                 >
                   Sign Up
                 </button>
               ) : (
                 <div className="hidden sm:flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 max-w-[150px] truncate">{user.email}</span>
                    <div className="w-px h-3 bg-slate-200"></div>
                    <button 
                      onClick={handleSignOut}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors group"
                      title="Sign Out"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                 </div>
               )}
               <img className="h-8 w-8 rounded-full border border-slate-200 shadow-sm ring-2 ring-indigo-50" src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} alt="User" />
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-4xl mx-auto w-full py-8 px-4">
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
  );
};

export default Dashboard;
