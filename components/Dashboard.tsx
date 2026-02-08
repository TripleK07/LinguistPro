
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { lookupWord, generateSpeech, decodeBase64, decodeAudioData } from '../lib/gemini';
import { DictionaryEntry, DashboardView, Favorite } from '../types';

interface DashboardProps {
  session: any;
}

// Ordered by alphabet as requested
const LANGUAGES = [
  { code: 'Chinese', name: 'Chinese', flag: '🇨🇳' },
  { code: 'French', name: 'French', flag: '🇫🇷' },
  { code: 'German', name: 'German', flag: '🇩🇪' },
  { code: 'Italian', name: 'Italian', flag: '🇮🇹' },
  { code: 'Japanese', name: 'Japanese', flag: '🇯🇵' },
  { code: 'Myanmar', name: 'Myanmar', flag: '🇲🇲' },
  { code: 'Portuguese', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'Spanish', name: 'Spanish', flag: '🇪🇸' },
];

const Dashboard: React.FC<DashboardProps> = ({ session }) => {
  const [signingOut, setSigningOut] = useState(false);
  const [currentTab, setCurrentTab] = useState<DashboardView>('search');
  
  // Search State
  const [searchWord, setSearchWord] = useState('');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [loading, setLoading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [result, setResult] = useState<DictionaryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Favorites State
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [favoritesSearchQuery, setFavoritesSearchQuery] = useState('');
  const [selectedFavorite, setSelectedFavorite] = useState<Favorite | null>(null);
  
  const user = session.user;
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentLanguage = LANGUAGES.find(l => l.code === targetLang);

  useEffect(() => {
    fetchFavorites();
  }, [user.id]);

  const fetchFavorites = async () => {
    setLoadingFavorites(true);
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) setFavorites(data);
    } catch (err) {
      console.error("Error fetching favorites:", err);
    } finally {
      setLoadingFavorites(false);
    }
  };

  const filteredFavorites = useMemo(() => {
    if (!favoritesSearchQuery.trim()) return favorites;
    const query = favoritesSearchQuery.toLowerCase();
    return favorites.filter(f => 
      f.word.toLowerCase().includes(query) || 
      f.entry.translation.toLowerCase().includes(query)
    );
  }, [favorites, favoritesSearchQuery]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchWord.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const data = await lookupWord(searchWord, targetLang);
      setResult({ ...data, target_lang: targetLang });
      setCurrentTab('search');
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch dictionary data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getFavoritedItem = (word: string) => {
    return favorites.find(f => f.word.toLowerCase() === word.toLowerCase());
  };

  const toggleFavorite = async (entry: DictionaryEntry) => {
    const existingFav = getFavoritedItem(entry.word);
    
    try {
      if (existingFav) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('id', existingFav.id);
        
        if (error) throw error;
        setFavorites(prev => prev.filter(f => f.id !== existingFav.id));
        if (selectedFavorite?.id === existingFav.id) setSelectedFavorite(null);
      } else {
        const payload = { 
          user_id: user.id, 
          word: entry.word.toLowerCase(), 
          entry: entry 
        };

        const { data, error } = await supabase
          .from('favorites')
          .insert([payload])
          .select()
          .single();
        
        if (error) throw error;
        if (data) setFavorites(prev => [data, ...prev]);
      }
    } catch (err) {
      console.error("Favorite toggle failed:", err);
      alert("Error updating favorites. Please check your Supabase configuration.");
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
      const base64 = await generateSpeech(word);
      const bytes = decodeBase64(base64);
      const audioBuffer = await decodeAudioData(bytes, ctx, 24000, 1);
      
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

  const renderResult = (data: DictionaryEntry, showBackButton = false) => {
    const entryLang = LANGUAGES.find(l => l.code === data.target_lang) || LANGUAGES.find(l => l.code === targetLang);
    const favoriteItem = getFavoritedItem(data.word);
    const isFav = !!favoriteItem;
    
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {showBackButton && (
          <button 
            onClick={() => setSelectedFavorite(null)}
            className="flex items-center gap-2 text-slate-500 hover:text-[#1877F2] font-semibold text-sm transition-colors mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
            Back to List
          </button>
        )}
        
        {/* Result Header Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-4 mb-1">
                <h2 className="text-4xl font-bold text-[#1C1E21] capitalize">{data.word}</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => playPronunciation(data.word)}
                    disabled={playingAudio}
                    title="Play Pronunciation"
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playingAudio ? 'bg-slate-100 text-[#1877F2]' : 'bg-[#E7F3FF] text-[#1877F2] hover:bg-[#D8EAFE] active:scale-95'}`}
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
                  <button 
                    onClick={() => toggleFavorite(data)}
                    title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${isFav ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-200'}`}
                  >
                    <svg className={`w-6 h-6 transition-transform ${isFav ? 'scale-110' : ''}`} fill={isFav ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>
              </div>
              <span className="text-[#1877F2] font-mono font-medium">{data.phonetics}</span>
            </div>
            
            <div className="bg-[#F0F2F5] px-6 py-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center min-w-[140px]">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xl">{entryLang?.flag}</span>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{entryLang?.name}</span>
              </div>
              <p className="text-2xl font-bold text-[#1C1E21]">{data.translation}</p>
            </div>
          </div>
        </div>

        {/* Grid for content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Definition</h3>
              <p className="text-[#1C1E21] text-lg leading-snug">{data.definition}</p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Examples</h3>
              <div className="space-y-4">
                {data.examples.map((ex, idx) => (
                  <div key={idx} className="group border-l-4 border-[#1877F2] pl-4 py-1">
                    <p className="text-slate-900 font-medium text-[15px] mb-1">"{ex.original}"</p>
                    <p className="text-[#1877F2] text-sm font-medium italic">"{ex.translated}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Synonyms</h3>
            <div className="flex flex-wrap gap-2">
              {data.synonyms.map((syn, idx) => (
                <span 
                  key={idx}
                  className="px-3 py-1.5 bg-[#F0F2F5] text-[#1C1E21] rounded-full text-xs font-semibold hover:bg-[#E4E6E9] transition-colors cursor-default border border-slate-100"
                >
                  {syn}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col text-[#1C1E21]">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#1877F2] rounded flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <span className="font-bold text-[#1877F2] text-xl tracking-tight hidden sm:block">LinguistPro</span>
              </div>

              <div className="flex h-full">
                <button 
                  onClick={() => { setCurrentTab('search'); setSelectedFavorite(null); }}
                  className={`flex items-center px-4 border-b-2 transition-colors font-semibold text-sm ${currentTab === 'search' ? 'border-[#1877F2] text-[#1877F2]' : 'border-transparent text-[#65676B] hover:bg-slate-50'}`}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search
                </button>
                <button 
                  onClick={() => { setCurrentTab('favorites'); setSelectedFavorite(null); }}
                  className={`flex items-center px-4 border-b-2 transition-colors font-semibold text-sm ${currentTab === 'favorites' ? 'border-[#1877F2] text-[#1877F2]' : 'border-transparent text-[#65676B] hover:bg-slate-50'}`}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Favorites
                  {favorites.length > 0 && (
                    <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                      {favorites.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                <img 
                  className="h-7 w-7 rounded-full bg-white"
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                  alt="Avatar"
                />
                <span className="text-xs font-semibold text-slate-600 truncate max-w-[100px] hidden sm:block">
                  {user.email}
                </span>
                <button 
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow flex flex-col max-w-4xl mx-auto w-full py-8 px-4">
        {currentTab === 'search' ? (
          <>
            <section className="mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h1 className="text-2xl font-bold text-[#1C1E21] mb-2">Unveiling the Soul of Language</h1>
                <p className="text-slate-500 text-sm mb-6">Enter an English word to explore its deep meanings and nuances across cultures.</p>
                
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-grow relative">
                    <input
                      type="text"
                      value={searchWord}
                      onChange={(e) => setSearchWord(e.target.value)}
                      placeholder="Enter a word..."
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 bg-[#F0F2F5] focus:bg-white focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2] outline-none transition-all text-base"
                    />
                    <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  
                  <div className="relative min-w-[180px]">
                    <select
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                      className="appearance-none w-full pl-10 pr-10 py-3 rounded-lg border border-slate-200 bg-[#F0F2F5] hover:bg-[#E4E6E9] focus:bg-white focus:border-[#1877F2] outline-none transition-all text-[#1C1E21] font-semibold cursor-pointer text-sm"
                    >
                      {LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-lg">
                      {currentLanguage?.flag}
                    </div>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-[#1877F2] hover:bg-[#166FE5] disabled:bg-slate-300 text-white font-bold px-8 py-3 rounded-lg transition-all flex items-center justify-center gap-2 min-w-[120px]"
                  >
                    {loading ? (
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : 'Look Up'}
                  </button>
                </form>
                {error && <p className="mt-3 text-red-500 text-sm font-medium">{error}</p>}
              </div>
            </section>

            <div className="flex-grow flex flex-col gap-4">
              {!result && !loading && (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
                  <div className="w-16 h-16 bg-[#E7F3FF] text-[#1877F2] rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-[#65676B] font-semibold">Your personal linguist is waiting</p>
                  <p className="text-slate-400 text-sm px-6">Every word has a story. Let's find it together.</p>
                </div>
              )}

              {loading && (
                <div className="space-y-4 animate-pulse">
                  <div className="h-32 bg-white rounded-xl border border-slate-200"></div>
                  <div className="h-64 bg-white rounded-xl border border-slate-200"></div>
                </div>
              )}

              {result && !loading && renderResult(result)}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-6">
            {!selectedFavorite ? (
              <>
                <header className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                      <h1 className="text-2xl font-bold text-[#1C1E21]">Your Favorites</h1>
                      <p className="text-slate-500 text-sm">Review your saved vocabulary list.</p>
                    </div>
                    <div className="bg-[#E7F3FF] text-[#1877F2] px-4 py-2 rounded-lg font-bold text-sm shadow-inner">
                      {favorites.length} Words
                    </div>
                  </div>

                  <div className="relative">
                    <input 
                      type="text"
                      value={favoritesSearchQuery}
                      onChange={(e) => setFavoritesSearchQuery(e.target.value)}
                      placeholder="Search your favorites..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-[#F0F2F5] focus:bg-white focus:border-[#1877F2] outline-none transition-all text-sm"
                    />
                    <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </header>

                {loadingFavorites ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-white rounded-xl border border-slate-200 animate-pulse"></div>)}
                  </div>
                ) : filteredFavorites.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
                    <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <p className="text-[#65676B] font-semibold">{favoritesSearchQuery ? 'No matching words' : 'No favorites yet'}</p>
                    <p className="text-slate-400 text-sm px-6 mb-6">
                      {favoritesSearchQuery ? 'Try a different search term.' : 'Words you save will appear here for easy review.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {filteredFavorites.map((fav) => {
                      const langInfo = LANGUAGES.find(l => l.code === fav.entry.target_lang);
                      return (
                        <div 
                          key={fav.id}
                          onClick={() => setSelectedFavorite(fav)}
                          className="group flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 hover:border-[#1877F2] hover:shadow-md cursor-pointer transition-all animate-in fade-in slide-in-from-top-1 duration-200"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-[#F0F2F5] rounded-full flex items-center justify-center text-xl group-hover:bg-[#E7F3FF] transition-colors">
                              {langInfo?.flag || '🌐'}
                            </div>
                            <div>
                              <h3 className="font-bold text-[#1C1E21] capitalize text-lg group-hover:text-[#1877F2] transition-colors">{fav.word}</h3>
                              <p className="text-sm text-slate-500 font-medium">{fav.entry.translation}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <span className="hidden sm:inline text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{langInfo?.name}</span>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-[#1877F2] transition-colors">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                {renderResult(selectedFavorite.entry, true)}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-[#65676B] text-xs border-t border-slate-200 bg-white">
        © 2025 LinguistPro AI • <span className="text-[#1877F2] font-semibold">Powered by TripleK</span>
      </footer>
    </div>
  );
};

export default Dashboard;
