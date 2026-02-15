
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { lookupWord, generateSpeech, decodeBase64, decodeAudioData, transcribeAudio, getQuizWord } from '../lib/gemini';
import { DictionaryEntry, DashboardView, Favorite } from '../types';

interface DashboardProps {
  session: any;
  isGuest?: boolean;
  onExitGuest?: () => void;
  deferredPrompt?: any;
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

const QUIZ_CATEGORIES = ["Random", "Kitchenwares", "Sports", "Nature", "Technology", "Travel", "Emotions", "Food & Drink", "Animals", "Clothing"];
const QUIZ_LEVELS = [
  { id: 'Basic', count: 5, desc: '5 simple words' },
  { id: 'Intermediate', count: 7, desc: '5-7 common words' },
  { id: 'Advance', count: 10, desc: '7-10 complex words' },
  { id: 'Expert', count: 12, desc: '10-12 hardest words' }
];

const QUIZ_TIMER_MAX = 15;

const getFlagUrl = (countryCode: string) => `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;

const Dashboard: React.FC<DashboardProps> = ({ session, isGuest, onExitGuest, isStandalone, isIOS, onInstallApp }) => {
  const [signingOut, setSigningOut] = useState(false);
  const [currentTab, setCurrentTab] = useState<DashboardView>('search');
  
  // PWA Prompt State
  const [promptInstall, setPromptInstall] = useState<any>(null);

  // Search State
  const [searchWord, setSearchWord] = useState('');
  const [targetLang, setTargetLang] = useState('Myanmar');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [result, setResult] = useState<DictionaryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Quiz System State
  const [quizSettings, setQuizSettings] = useState({ lang: 'Spanish', category: 'Random', level: 'Basic' });
  const [isQuizLangMenuOpen, setIsQuizLangMenuOpen] = useState(false);
  const [isQuizCatMenuOpen, setIsQuizCatMenuOpen] = useState(false);
  const quizLangMenuRef = useRef<HTMLDivElement>(null);
  const quizCatMenuRef = useRef<HTMLDivElement>(null);
  
  const [quizState, setQuizState] = useState<'setup' | 'active' | 'feedback' | 'results'>('setup');
  const [quizQuestions, setQuizQuestions] = useState<{ targetWord: string, englishTranslation: string }[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [quizInput, setQuizInput] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [quizTimer, setQuizTimer] = useState(QUIZ_TIMER_MAX);
  const [lastAnswerStatus, setLastAnswerStatus] = useState<'correct' | 'wrong' | 'timeout'>('correct');
  const [isFetchingNext, setIsFetchingNext] = useState(false);
  const quizTimerRef = useRef<number | null>(null);

  // Favorites State
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [favoritesSearchQuery, setFavoritesSearchQuery] = useState('');
  const [selectedFavorite, setSelectedFavorite] = useState<Favorite | null>(null);
  
  const user = session?.user || { id: 'guest', email: 'Guest User' };
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const currentLanguage = LANGUAGES.find(l => l.code === targetLang);
  const currentQuizLanguage = LANGUAGES.find(l => l.code === quizSettings.lang);

  useEffect(() => {
    // PWA Handler
    const pwaHandler = (e: any) => {
      e.preventDefault();
      setPromptInstall(e);
    };
    window.addEventListener("beforeinstallprompt", pwaHandler);

    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) setIsLangMenuOpen(false);
      if (quizLangMenuRef.current && !quizLangMenuRef.current.contains(event.target as Node)) setIsQuizLangMenuOpen(false);
      if (quizCatMenuRef.current && !quizCatMenuRef.current.contains(event.target as Node)) setIsQuizCatMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    if (!isGuest && supabase) fetchFavorites();

    return () => {
      window.removeEventListener("beforeinstallprompt", pwaHandler);
      document.removeEventListener('mousedown', handleClickOutside);
      if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    };
  }, [user.id, isGuest]);

  const handleInstallClick = useCallback(() => {
    if (onInstallApp) {
      onInstallApp();
      return;
    }
    if (!promptInstall) return;
    promptInstall.prompt();
    promptInstall.userChoice.then((choice: any) => {
      if (choice.outcome === 'accepted') setPromptInstall(null);
    });
  }, [promptInstall, onInstallApp]);

  const fetchFavorites = async () => {
    if (!supabase) return;
    setLoadingFavorites(true);
    try {
      const { data, error } = await supabase.from('favorites').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setFavorites(data);
    } catch (err) { console.error(err); } finally { setLoadingFavorites(false); }
  };

  // --- Quiz Engine ---
  const startQuiz = async () => {
    setLoading(true);
    setQuizState('setup');
    setCorrectCount(0);
    setCurrentQuestionIdx(0);
    setQuizQuestions([]);
    setError(null);

    try {
      const firstWord = await getQuizWord(quizSettings.lang, quizSettings.category, quizSettings.level, []);
      setQuizQuestions([firstWord]);
      setQuizState('active');
      resetTimer();
    } catch (err: any) {
      setError(err.message || "Failed to start quiz.");
    } finally {
      setLoading(false);
    }
  };

  const resetTimer = () => {
    if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    setQuizTimer(QUIZ_TIMER_MAX);
    quizTimerRef.current = window.setInterval(() => {
      setQuizTimer(prev => {
        if (prev <= 1) {
          handleAnswer(true); // Timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAnswer = (isTimeout = false) => {
    if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    const currentQ = quizQuestions[currentQuestionIdx];
    const isCorrect = !isTimeout && quizInput.trim().toLowerCase() === currentQ.englishTranslation.toLowerCase();
    
    if (isCorrect) setCorrectCount(prev => prev + 1);
    setLastAnswerStatus(isTimeout ? 'timeout' : (isCorrect ? 'correct' : 'wrong'));
    setQuizState('feedback');
  };

  const goToNextQuestion = async () => {
    const levelConfig = QUIZ_LEVELS.find(l => l.id === quizSettings.level);
    const totalNeeded = levelConfig?.count || 5;

    if (currentQuestionIdx + 1 >= totalNeeded) {
      setQuizState('results');
      return;
    }

    setIsFetchingNext(true);
    setError(null);
    try {
      const exclude = quizQuestions.map(q => q.targetWord);
      const nextWord = await getQuizWord(quizSettings.lang, quizSettings.category, quizSettings.level, exclude);
      setQuizQuestions(prev => [...prev, nextWord]);
      setCurrentQuestionIdx(prev => prev + 1);
      setQuizInput('');
      setQuizState('active');
      resetTimer();
    } catch (err) {
      setError("Failed to fetch next word. Please try again.");
    } finally {
      setIsFetchingNext(false);
    }
  };

  const quitQuiz = () => {
    if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    setQuizState('setup');
    setQuizQuestions([]);
    setQuizInput('');
  };

  const performSearch = async (word: string, lang: string) => {
    if (!word.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await lookupWord(word, lang);
      setResult({ ...data, target_lang: lang });
      setCurrentTab('search');
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const playPronunciation = async (word: string) => {
    if (playingAudio) return;
    setPlayingAudio(true);
    try {
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const ctx = audioContextRef.current;
      const base64 = await generateSpeech(word);
      const bytes = decodeBase64(base64);
      const audioBuffer = await decodeAudioData(bytes, ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setPlayingAudio(false);
      source.start();
    } catch (err) { setPlayingAudio(false); }
  };

  const renderResult = (data: DictionaryEntry, showBackButton = false) => {
    const entryLang = LANGUAGES.find(l => l.code === data.target_lang);
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {showBackButton && (
          <button onClick={() => setSelectedFavorite(null)} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-semibold text-sm transition-colors mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            Back to List
          </button>
        )}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-4 mb-1">
                <h2 className="text-4xl font-bold text-slate-800 capitalize">{data.word}</h2>
                <button onClick={() => playPronunciation(data.word)} disabled={playingAudio} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playingAudio ? 'bg-slate-100 text-indigo-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 active:scale-95'}`}>
                  {playingAudio ? <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" /></svg> : <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>}
                </button>
              </div>
              <span className="text-indigo-600 font-mono font-medium">{data.phonetics}</span>
            </div>
            <div className="bg-slate-50 px-6 py-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center min-w-[140px]">
              <div className="flex items-center gap-2 mb-0.5">
                {entryLang && <img src={getFlagUrl(entryLang.countryCode)} alt={entryLang.name} className="w-5 h-3.5 object-cover rounded-sm" />}
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{entryLang?.name}</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{data.translation}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Definition</h3>
              <p className="text-slate-700 text-lg leading-snug">{data.definition}</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Examples</h3>
              <div className="space-y-4">
                {data.examples.map((ex, idx) => (
                  <div key={idx} className="border-l-4 border-indigo-600 pl-4 py-1">
                    <p className="text-slate-900 font-medium text-[15px] mb-1">"{ex.original}"</p>
                    <p className="text-indigo-600 text-sm font-medium italic">"{ex.translated}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Synonyms</h3>
            <div className="flex flex-wrap gap-2">
              {data.synonyms.map((syn, idx) => (
                <span key={idx} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold">{syn}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const navItems = [
    { id: 'search', label: 'Search' },
    { id: 'favorites', label: 'Favorites' },
    { id: 'quiz', label: 'Quiz' }
  ];

  const levelConfig = QUIZ_LEVELS.find(l => l.id === quizSettings.level);
  const totalNeeded = levelConfig?.count || 5;
  const isLastQuestion = currentQuestionIdx + 1 >= totalNeeded;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-slate-800">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setCurrentTab('search'); setSelectedFavorite(null); }}>
                <img src="https://cdn-icons-png.flaticon.com/512/3898/3898082.png" alt="Logo" className="w-7 h-7" />
                <span className="font-black text-slate-900 text-lg tracking-tighter hidden xs:block">Linguist<span className="text-indigo-600">Pro</span></span>
              </div>
              <div className="flex h-full">
                {navItems.map((item) => (
                  <button key={item.id} onClick={() => { setCurrentTab(item.id as any); setSelectedFavorite(null); }} className={`relative flex items-center px-4 border-b-2 transition-all font-semibold text-sm capitalize ${currentTab === item.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                    {item.label}
                    {item.id === 'favorites' && !isGuest && favorites.length > 0 && (
                      <span className="ml-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
                        {favorites.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
               {(promptInstall || isStandalone === false) && (
                 <button onClick={handleInstallClick} className="hidden sm:flex items-center gap-2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-xs font-black shadow-md hover:bg-indigo-700 transition-all active:scale-95">
                   Install App
                 </button>
               )}
               <img className="h-8 w-8 rounded-full border border-slate-200 shadow-sm" src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} alt="User" />
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-4xl mx-auto w-full py-8 px-4">
        {currentTab === 'search' && (
          <div className="space-y-6">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
               <h1 className="text-2xl font-bold text-slate-800 mb-2">Discover New Words</h1>
               <form onSubmit={(e) => { e.preventDefault(); performSearch(searchWord, targetLang); }} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-grow relative">
                    <input type="text" value={searchWord} onChange={(e) => setSearchWord(e.target.value)} placeholder="Type a word..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none transition-all" />
                    <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  
                  {/* Custom Lang Dropdown */}
                  <div className="relative min-w-[180px]" ref={langMenuRef}>
                    <button type="button" onClick={() => setIsLangMenuOpen(!isLangMenuOpen)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all outline-none focus:ring-2 focus:ring-indigo-200">
                      <div className="flex items-center gap-2">
                        {currentLanguage && <img src={getFlagUrl(currentLanguage.countryCode)} className="w-5 h-3.5 object-cover rounded-sm shadow-sm" />}
                        <span className="font-semibold text-sm">{currentLanguage?.name}</span>
                      </div>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${isLangMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    {isLangMenuOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-2 animate-in slide-in-from-top-2 duration-200">
                        {LANGUAGES.map(lang => (
                          <button key={lang.code} type="button" onClick={() => { setTargetLang(lang.code); setIsLangMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 ${targetLang === lang.code ? 'text-indigo-600 bg-indigo-50 font-bold' : 'text-slate-600'}`}>
                            <img src={getFlagUrl(lang.countryCode)} className="w-5 h-3.5 object-cover rounded-sm shadow-sm" />
                            {lang.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-indigo-100 active:scale-95 disabled:bg-slate-300 transition-all flex items-center justify-center">
                    {loading ? <svg className="animate-spin h-5 w-5 mr-2 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : "Look Up"}
                  </button>
               </form>
            </header>
            {result && !loading && renderResult(result)}
            {loading && <div className="space-y-4 animate-pulse"><div className="h-32 bg-white rounded-2xl border border-slate-200"></div><div className="h-48 bg-white rounded-2xl border border-slate-200"></div></div>}
          </div>
        )}

        {currentTab === 'quiz' && (
          <div className="space-y-6">
            {quizState === 'setup' && (
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 animate-in fade-in zoom-in-95 duration-300">
                <div className="text-center mb-8">
                   <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                     <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                   </div>
                   <h1 className="text-3xl font-black text-slate-800 tracking-tight">Vocabulary Master</h1>
                   <p className="text-slate-500 mt-2">Configure your challenge and sharpen your skills.</p>
                </div>

                {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium animate-in slide-in-from-top-2">{error}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* Quiz Lang Selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Language</label>
                    <div className="relative" ref={quizLangMenuRef}>
                      <button type="button" onClick={() => setIsQuizLangMenuOpen(!isQuizLangMenuOpen)} className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all outline-none">
                        <div className="flex items-center gap-3">
                          {currentQuizLanguage && <img src={getFlagUrl(currentQuizLanguage.countryCode)} className="w-6 h-4 object-cover rounded-sm shadow-sm" />}
                          <span className="font-bold text-slate-700">{currentQuizLanguage?.name}</span>
                        </div>
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${isQuizLangMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      {isQuizLangMenuOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 py-2 max-h-64 overflow-y-auto animate-in slide-in-from-top-2">
                          {LANGUAGES.map(lang => (
                            <button key={lang.code} type="button" onClick={() => { setQuizSettings(p => ({...p, lang: lang.code})); setIsQuizLangMenuOpen(false); }} className={`w-full flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50 ${quizSettings.lang === lang.code ? 'text-indigo-600 bg-indigo-50 font-bold' : 'text-slate-600'}`}>
                              <img src={getFlagUrl(lang.countryCode)} className="w-5 h-3.5 object-cover rounded-sm shadow-sm" />
                              {lang.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Category Selection - Custom Dropdown */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Category</label>
                    <div className="relative" ref={quizCatMenuRef}>
                      <button type="button" onClick={() => setIsQuizCatMenuOpen(!isQuizCatMenuOpen)} className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all outline-none">
                        <span className="font-bold text-slate-700">{quizSettings.category}</span>
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${isQuizCatMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      {isQuizCatMenuOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 py-2 max-h-64 overflow-y-auto animate-in slide-in-from-top-2">
                          {QUIZ_CATEGORIES.map(cat => (
                            <button key={cat} type="button" onClick={() => { setQuizSettings(p => ({...p, category: cat})); setIsQuizCatMenuOpen(false); }} className={`w-full flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50 ${quizSettings.category === cat ? 'text-indigo-600 bg-indigo-50 font-bold' : 'text-slate-600'}`}>
                              {cat}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Level Selection */}
                  <div className="md:col-span-2 space-y-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Difficulty Level</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {QUIZ_LEVELS.map(lvl => (
                        <button key={lvl.id} onClick={() => setQuizSettings(p => ({...p, level: lvl.id}))} className={`p-4 rounded-2xl border-2 transition-all text-left group ${quizSettings.level === lvl.id ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-slate-100 hover:border-slate-200 bg-white'}`}>
                          <p className={`font-black text-sm ${quizSettings.level === lvl.id ? 'text-indigo-700' : 'text-slate-700'}`}>{lvl.id}</p>
                          <p className={`text-[10px] mt-1 font-medium ${quizSettings.level === lvl.id ? 'text-indigo-500' : 'text-slate-400'}`}>{lvl.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button onClick={startQuiz} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                  {loading ? <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : "Start Challenge"}
                </button>
              </div>
            )}

            {(quizState === 'active' || quizState === 'feedback') && quizQuestions[currentQuestionIdx] && (
              <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-200 text-center relative overflow-hidden min-h-[500px] flex flex-col justify-center animate-in zoom-in-95 duration-300">
                <div className="absolute top-0 left-0 h-1.5 bg-indigo-600 transition-all duration-1000 ease-linear" style={{ width: `${(quizTimer / QUIZ_TIMER_MAX) * 100}%` }}></div>
                
                <div className="mb-10 space-y-4">
                  <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Question {currentQuestionIdx + 1} of {totalNeeded}
                  </div>
                  <h2 className="text-5xl font-black text-slate-900 tracking-tight capitalize">{quizQuestions[currentQuestionIdx].targetWord}</h2>
                  <p className="text-slate-400 font-medium">Translate this to English</p>
                </div>

                {quizState === 'active' ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleAnswer(); }} className="max-w-md mx-auto w-full space-y-4">
                    <input autoFocus value={quizInput} onChange={(e) => setQuizInput(e.target.value)} placeholder="Type answer here..." className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:bg-white focus:border-indigo-600 outline-none text-center text-xl font-bold transition-all" />
                    <div className="flex gap-3">
                       <button type="button" onClick={quitQuiz} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold py-4 rounded-xl transition-all">Give up</button>
                       <button type="submit" className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all">Check Answer</button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-8 animate-in zoom-in-95 duration-300">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${lastAnswerStatus === 'correct' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {lastAnswerStatus === 'correct' ? <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg> : <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6M6 6l12 12" /></svg>}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                        {lastAnswerStatus === 'correct' ? 'Brilliant!' : lastAnswerStatus === 'timeout' ? 'Time up!' : 'Incorrect!'}
                      </h3>
                      <p className="text-slate-500">Correct translation: <span className="font-bold text-indigo-600">"{quizQuestions[currentQuestionIdx].englishTranslation}"</span></p>
                    </div>
                    {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
                    <div className="flex gap-3 max-w-sm mx-auto w-full">
                       <button onClick={quitQuiz} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold py-4 rounded-xl transition-all">Give up</button>
                       <button onClick={goToNextQuestion} disabled={isFetchingNext} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-xl active:scale-95 transition-all flex items-center justify-center">
                         {isFetchingNext ? <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : (isLastQuestion ? "See Results" : "Next Question")}
                       </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {quizState === 'results' && (
              <div className="bg-white p-12 rounded-3xl shadow-xl border border-slate-200 text-center animate-in zoom-in-95 duration-500">
                 <div className="w-24 h-24 bg-indigo-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-3">
                   <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 </div>
                 <h1 className="text-4xl font-black text-slate-900 tracking-tight">Challenge Over!</h1>
                 <div className="my-10 grid grid-cols-2 gap-4 max-w-md mx-auto">
                   <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Accuracy</p>
                      <p className="text-3xl font-black text-indigo-600">
                        {Math.round((correctCount / quizQuestions.length) * 100)}%
                      </p>
                   </div>
                   <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Final Score</p>
                      <p className="text-3xl font-black text-slate-800">{correctCount}/{quizQuestions.length}</p>
                   </div>
                 </div>
                 <button onClick={quitQuiz} className="w-full max-w-sm bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-lg transition-all active:scale-95">
                   New Challenge
                 </button>
              </div>
            )}
          </div>
        )}

        {currentTab === 'favorites' && (
          <div className="space-y-6">
            <header className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
               <h1 className="text-2xl font-bold text-slate-800">Favorite Words</h1>
               <div className="mt-4 relative">
                  <input value={favoritesSearchQuery} onChange={(e) => setFavoritesSearchQuery(e.target.value)} type="text" placeholder="Filter favorites..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none transition-all" />
                  <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
               </div>
            </header>
            
            <div className="grid grid-cols-1 gap-3">
              {loadingFavorites ? <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-xl border border-slate-100 animate-pulse"></div>)}</div> : (
                favorites.map(fav => (
                  <div key={fav.id} onClick={() => setSelectedFavorite(fav)} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-600 transition-all cursor-pointer flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-lg shadow-sm group-hover:bg-indigo-50 transition-colors">
                          <img src={getFlagUrl(LANGUAGES.find(l => l.code === fav.entry.target_lang)?.countryCode || 'us')} className="w-6 h-4 object-cover rounded-sm shadow-sm" />
                       </div>
                       <div>
                         <h3 className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors capitalize">{fav.word}</h3>
                         <p className="text-sm text-slate-400 font-medium italic">{fav.entry.translation}</p>
                       </div>
                    </div>
                    <svg className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                  </div>
                ))
              )}
              {!loadingFavorites && favorites.length === 0 && (
                <div className="py-20 bg-white rounded-2xl border border-dashed border-slate-200 text-center">
                  <p className="text-slate-400 font-medium">Your library is currently empty.</p>
                </div>
              )}
            </div>
            {selectedFavorite && (
              <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#F8FAFC] rounded-3xl p-6 relative shadow-2xl scrollbar-hide">
                   <button onClick={() => setSelectedFavorite(null)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-white rounded-full shadow-sm z-10">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                   </button>
                   {renderResult(selectedFavorite.entry)}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-8 text-center bg-white border-t border-slate-200">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic tracking-[0.2em]">© 2025 LinguistPro • Powered by TripleK</p>
      </footer>
    </div>
  );
};

export default Dashboard;
