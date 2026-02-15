
import React, { useState, useRef, useEffect, useMemo } from 'react';
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

const QUIZ_DURATION = 10;

// Helper to get flag URL
const getFlagUrl = (countryCode: string) => `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;

const Dashboard: React.FC<DashboardProps> = ({ session, isGuest, onExitGuest, deferredPrompt, isStandalone, isIOS, onInstallApp }) => {
  const [signingOut, setSigningOut] = useState(false);
  const [currentTab, setCurrentTab] = useState<DashboardView>('search');
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  
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
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  
  // Quiz State
  const [quizTargetLang, setQuizTargetLang] = useState('Spanish');
  const [isQuizLangMenuOpen, setIsQuizLangMenuOpen] = useState(false);
  const quizLangMenuRef = useRef<HTMLDivElement>(null);

  const [quizWord, setQuizWord] = useState<{ targetWord: string, englishTranslation: string } | null>(null);
  const [quizInput, setQuizInput] = useState('');
  const [quizTimer, setQuizTimer] = useState(QUIZ_DURATION);
  const [quizStatus, setQuizStatus] = useState<'idle' | 'active' | 'correct' | 'wrong' | 'timeout' | 'loading'>('idle');
  const [quizHistory, setQuizHistory] = useState<string[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  // Favorites State
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [favoritesSearchQuery, setFavoritesSearchQuery] = useState('');
  const [selectedFavorite, setSelectedFavorite] = useState<Favorite | null>(null);
  
  const user = session?.user || { id: 'guest', email: 'Guest User' };
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceTimeoutRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const currentLanguage = LANGUAGES.find(l => l.code === targetLang);
  const currentQuizLanguage = LANGUAGES.find(l => l.code === quizTargetLang);

  useEffect(() => {
    const handleGuideRequest = () => setShowIOSGuide(true);
    window.addEventListener('show-pwa-guide', handleGuideRequest);
    
    // Close menus on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
      if (quizLangMenuRef.current && !quizLangMenuRef.current.contains(event.target as Node)) {
        setIsQuizLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    if (!isGuest && supabase) {
      fetchFavorites();
    }
    return () => {
      stopRecording();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      window.removeEventListener('show-pwa-guide', handleGuideRequest);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [user.id, isGuest]);

  const fetchFavorites = async () => {
    if (!supabase) return;
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

  const handleQuotaError = (err: any) => {
    if (err.message?.includes('429') || err.status === 429) {
      setIsQuotaExceeded(true);
      setError("Free API quota exceeded. Please select your own API key to continue.");
    } else {
      setError(err.message || "An unexpected error occurred. Please try again.");
    }
  };

  const startNextQuizWord = async () => {
    if (isGuest) return;
    setQuizStatus('loading');
    setQuizInput('');
    setQuizTimer(QUIZ_DURATION);
    setError(null);
    
    try {
      const wordData = await getQuizWord(quizTargetLang, quizHistory);
      setQuizWord(wordData);
      setQuizHistory(prev => [...prev.slice(-10), wordData.targetWord]);
      setQuizStatus('active');
      
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      
      timerIntervalRef.current = window.setInterval(() => {
        setQuizTimer(prev => {
          if (prev <= 0.1) {
            handleQuizEnd('timeout');
            return 0;
          }
          return prev - 0.1;
        });
      }, 100);
    } catch (err) {
      console.error("Quiz generation failed", err);
      handleQuotaError(err);
      setQuizStatus('idle');
    }
  };

  const handleQuizSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (quizStatus !== 'active') return;
    const isCorrect = quizInput.trim().toLowerCase() === quizWord?.englishTranslation.toLowerCase();
    handleQuizEnd(isCorrect ? 'correct' : 'wrong');
  };

  const handleQuizEnd = (status: 'correct' | 'wrong' | 'timeout') => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setQuizStatus(status);
  };

  const filteredFavorites = useMemo(() => {
    if (!favoritesSearchQuery.trim()) return favorites;
    const query = favoritesSearchQuery.toLowerCase();
    return favorites.filter(f => f.word.toLowerCase().includes(query) || f.entry.translation.toLowerCase().includes(query));
  }, [favorites, favoritesSearchQuery]);

  const handleSignOut = async () => {
    if (isGuest) {
      onExitGuest?.();
      return;
    }
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
  };

  const performSearch = async (word: string, lang: string) => {
    if (!word.trim()) return;
    setLoading(true);
    setError(null);
    setIsQuotaExceeded(false);
    try {
      const data = await lookupWord(word, lang);
      setResult({ ...data, target_lang: lang });
      setCurrentTab('search');
    } catch (err: any) {
      handleQuotaError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchWord, targetLang);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 1000) { 
          processVoiceInput(audioBlob, mimeType);
        } else {
          setIsListening(false);
        }
      };
      setIsListening(true);
      setError(null);
      mediaRecorder.start();
      const checkSilence = () => {
        if (!isListening && !mediaRecorderRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        if (average < 10) { 
          if (!silenceTimeoutRef.current) {
            silenceTimeoutRef.current = window.setTimeout(() => stopRecording(), 1500);
          }
        } else {
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }
        }
        if (mediaRecorder.state === 'recording') requestAnimationFrame(checkSilence);
      };
      requestAnimationFrame(checkSilence);
      setTimeout(() => stopRecording(), 8000);
    } catch (err) {
      setError("Microphone access denied or not available.");
      setIsListening(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsListening(false);
  };

  const processVoiceInput = async (blob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const transcribedWord = await transcribeAudio(base64, mimeType);
        if (transcribedWord) {
          setSearchWord(transcribedWord);
          performSearch(transcribedWord, targetLang);
        } else {
          setError("Couldn't understand the word.");
        }
        setIsTranscribing(false);
      };
    } catch (err) {
      handleQuotaError(err);
      setIsTranscribing(false);
    }
  };

  const toggleVoiceSearch = () => isListening ? stopRecording() : startRecording();
  const getFavoritedItem = (word: string) => favorites.find(f => f.word.toLowerCase() === word.toLowerCase());

  const toggleFavorite = async (entry: DictionaryEntry) => {
    if (isGuest) { alert("Please sign up to save favorites!"); return; }
    if (!supabase) return;
    const existingFav = getFavoritedItem(entry.word);
    try {
      if (existingFav) {
        const { error } = await supabase.from('favorites').delete().eq('id', existingFav.id);
        if (error) throw error;
        setFavorites(prev => prev.filter(f => f.id !== existingFav.id));
        if (selectedFavorite?.id === existingFav.id) setSelectedFavorite(null);
      } else {
        const payload = { user_id: user.id, word: entry.word.toLowerCase(), entry: entry };
        const { data, error } = await supabase.from('favorites').insert([payload]).select().single();
        if (error) throw error;
        if (data) setFavorites(prev => [data, ...prev]);
      }
    } catch (err) { alert("Error updating favorites."); }
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
      handleQuotaError(err);
      setPlayingAudio(false);
    }
  };

  const renderResult = (data: DictionaryEntry, showBackButton = false) => {
    const entryLang = LANGUAGES.find(l => l.code === data.target_lang) || LANGUAGES.find(l => l.code === targetLang);
    const isFav = !!getFavoritedItem(data.word);
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
                <h2 className="text-4xl font-bold text-[#1C1E21] capitalize">{data.word}</h2>
                <div className="flex gap-2">
                  <button onClick={() => playPronunciation(data.word)} disabled={playingAudio} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playingAudio ? 'bg-slate-100 text-indigo-600' : 'bg-[#E7F3FF] text-indigo-600 hover:bg-[#D8EAFE] active:scale-95'}`}>
                    {playingAudio ? <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clipRule="evenodd" /></svg> : <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>}
                  </button>
                  <button onClick={() => toggleFavorite(data)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${isFav ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-200'}`}>
                    <svg className={`w-6 h-6 ${isFav ? 'scale-110' : ''}`} fill={isFav ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  </button>
                </div>
              </div>
              <span className="text-indigo-600 font-mono font-medium">{data.phonetics}</span>
            </div>
            <div className="bg-[#F0F2F5] px-6 py-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center min-w-[140px]">
              <div className="flex items-center gap-2 mb-0.5">
                {entryLang && (
                  <img 
                    src={getFlagUrl(entryLang.countryCode)} 
                    alt={entryLang.name} 
                    className="w-5 h-3.5 object-cover rounded-sm shadow-sm" 
                  />
                )}
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{entryLang?.name}</span>
              </div>
              <p className="text-2xl font-bold text-[#1C1E21]">{data.translation}</p>
            </div>
          </div>
        </div>
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
                  <div key={idx} className="group border-l-4 border-indigo-600 pl-4 py-1">
                    <p className="text-slate-900 font-medium text-[15px] mb-1">"{ex.original}"</p>
                    <p className="text-indigo-600 text-sm font-medium italic">"{ex.translated}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Synonyms</h3>
            <div className="flex flex-wrap gap-2">
              {data.synonyms.map((syn, idx) => (
                <span key={idx} className="px-3 py-1.5 bg-[#F0F2F5] text-[#1C1E21] rounded-full text-xs font-semibold hover:bg-[#E4E6E9] transition-colors cursor-default border border-slate-100">{syn}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col text-[#1C1E21]">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setCurrentTab('search'); setSelectedFavorite(null); }}>
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md transition-transform group-hover:scale-105 active:scale-95 overflow-hidden">
                   <img src="https://cdn-icons-png.flaticon.com/512/3898/3898082.png" alt="Logo" className="w-5 h-5" />
                </div>
                <span className="font-black text-[#1C1E21] text-lg tracking-tighter hidden sm:block">Linguist<span className="text-indigo-600">Pro</span></span>
              </div>
              <div className="flex h-full">
                <button onClick={() => { setCurrentTab('search'); setSelectedFavorite(null); }} className={`flex items-center px-4 border-b-2 transition-colors font-semibold text-sm ${currentTab === 'search' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-[#65676B] hover:bg-slate-50'}`}>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>Search
                </button>
                <button onClick={() => { setCurrentTab('favorites'); setSelectedFavorite(null); }} className={`flex items-center px-4 border-b-2 transition-colors font-semibold text-sm ${currentTab === 'favorites' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-[#65676B] hover:bg-slate-50'} relative`}>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  Favorites
                  {!isGuest && <span className={`ml-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white shadow-sm transition-opacity duration-300 ${favorites.length > 0 ? 'opacity-100' : 'opacity-0'}`}>{favorites.length}</span>}
                </button>
                <button onClick={() => { setCurrentTab('quiz'); setSelectedFavorite(null); }} className={`flex items-center px-4 border-b-2 transition-colors font-semibold text-sm ${currentTab === 'quiz' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-[#65676B] hover:bg-slate-50'} relative`}>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>Quiz
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isStandalone && (
                <button onClick={onInstallApp} className="hidden sm:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-full text-xs font-black transition-all shadow-md active:scale-95">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Install App
                </button>
              )}
              <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                <img className="h-7 w-7 rounded-full bg-white" src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} alt="Avatar" />
                <span className="text-xs font-semibold text-slate-600 truncate max-w-[100px] hidden sm:block">{user.email}</span>
                <button onClick={handleSignOut} disabled={signingOut} className="text-slate-400 hover:text-red-500 transition-colors">
                  {isGuest ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}
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
                <h1 className="text-2xl font-bold text-[#1C1E21] mb-2">Discover the world of words</h1>
                <p className="text-slate-500 text-sm mb-6">Enter an English word to get its meaning and translation in seconds.</p>
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-grow relative group">
                    <input type="text" value={searchWord} onChange={(e) => setSearchWord(e.target.value)} placeholder={isListening ? "Listening..." : isTranscribing ? "Processing..." : "Enter a word..."} className={`w-full pl-10 pr-12 py-3 rounded-lg border border-slate-200 bg-[#F0F2F5] focus:bg-white focus:border-indigo-600 outline-none transition-all text-base ${isListening || isTranscribing ? 'placeholder:text-indigo-500 font-medium bg-indigo-50/30' : ''}`} />
                    <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <button type="button" onClick={toggleVoiceSearch} disabled={loading || isTranscribing} className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${isListening ? 'bg-indigo-600 text-white animate-pulse' : 'text-slate-400 hover:text-indigo-600'}`}>
                      {isTranscribing ? <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
                    </button>
                  </div>
                  
                  {/* Custom Language Dropdown (Search) */}
                  <div className="relative min-w-[200px]" ref={langMenuRef}>
                    <button 
                      type="button" 
                      onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 bg-[#F0F2F5] hover:bg-[#E4E6E9] focus:bg-white focus:border-indigo-600 transition-all outline-none"
                    >
                      <div className="flex items-center gap-2">
                        {currentLanguage && (
                          <img 
                            src={getFlagUrl(currentLanguage.countryCode)} 
                            alt={currentLanguage.name} 
                            className="w-5 h-3.5 object-cover rounded-sm" 
                          />
                        )}
                        <span className="font-semibold text-[#1C1E21] text-sm">{currentLanguage?.name}</span>
                      </div>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${isLangMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>

                    {isLangMenuOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-[60] animate-in slide-in-from-top-2 duration-200">
                        <div className="max-h-60 overflow-y-auto">
                          {LANGUAGES.map(lang => (
                            <button
                              key={lang.code}
                              type="button"
                              onClick={() => {
                                setTargetLang(lang.code);
                                setIsLangMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-slate-50 transition-colors ${targetLang === lang.code ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700'}`}
                            >
                              <img src={getFlagUrl(lang.countryCode)} alt={lang.name} className="w-5 h-3.5 object-cover rounded-sm" />
                              {lang.name}
                              {targetLang === lang.code && <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button type="submit" disabled={loading || isTranscribing} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold px-8 py-3 rounded-lg transition-all min-w-[120px]">
                    {loading ? "..." : "Look Up"}
                  </button>
                </form>
              </div>
            </section>
            <div className="flex-grow flex flex-col gap-4">
              {!result && !loading && (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
                  <div className="w-16 h-16 bg-[#E7F3FF] text-indigo-600 rounded-full flex items-center justify-center mb-4"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
                  <p className="text-[#65676B] font-semibold">Your personal linguist is waiting</p>
                </div>
              )}
              {loading && <div className="space-y-4 animate-pulse"><div className="h-32 bg-white rounded-xl border border-slate-200"></div><div className="h-64 bg-white rounded-xl border border-slate-200"></div></div>}
              {result && !loading && renderResult(result)}
            </div>
          </>
        ) : currentTab === 'quiz' ? (
          <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            <header className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h1 className="text-2xl font-bold text-[#1C1E21] mb-2">Vocabulary Quiz</h1>
              <p className="text-slate-500 text-sm mb-6">Test your knowledge. Translate the word shown to English.</p>
              
              <div className="flex flex-col sm:flex-row items-end gap-4">
                <div className="flex-grow">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Quiz Language</label>
                  {/* Custom Language Dropdown (Quiz) */}
                  <div className="relative" ref={quizLangMenuRef}>
                    <button 
                      type="button" 
                      onClick={() => setIsQuizLangMenuOpen(!isQuizLangMenuOpen)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 bg-[#F0F2F5] hover:bg-[#E4E6E9] focus:bg-white focus:border-indigo-600 transition-all outline-none"
                    >
                      <div className="flex items-center gap-2">
                        {currentQuizLanguage && (
                          <img 
                            src={getFlagUrl(currentQuizLanguage.countryCode)} 
                            alt={currentQuizLanguage.name} 
                            className="w-5 h-3.5 object-cover rounded-sm" 
                          />
                        )}
                        <span className="font-semibold text-[#1C1E21] text-sm">{currentQuizLanguage?.name}</span>
                      </div>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${isQuizLangMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>

                    {isQuizLangMenuOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-[60] animate-in slide-in-from-top-2 duration-200">
                        <div className="max-h-60 overflow-y-auto">
                          {LANGUAGES.map(lang => (
                            <button
                              key={lang.code}
                              type="button"
                              onClick={() => {
                                setQuizTargetLang(lang.code);
                                setIsQuizLangMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-slate-50 transition-colors ${quizTargetLang === lang.code ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700'}`}
                            >
                              <img src={getFlagUrl(lang.countryCode)} alt={lang.name} className="w-5 h-3.5 object-cover rounded-sm" />
                              {lang.name}
                              {quizTargetLang === lang.code && <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <button 
                  onClick={startNextQuizWord} 
                  disabled={quizStatus === 'loading' || quizStatus === 'active'}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold h-[46px] px-8 rounded-lg transition-all shadow-md"
                >
                  Start Quiz
                </button>
              </div>
            </header>

            <div className="bg-white p-8 rounded-2xl border-2 border-slate-200 shadow-lg min-h-[400px] flex flex-col items-center justify-center text-center relative overflow-hidden">
              {quizStatus === 'active' && (
                <div className="absolute top-0 left-0 h-1.5 bg-indigo-600 transition-all duration-100 ease-linear" style={{ width: `${(quizTimer / QUIZ_DURATION) * 100}%` }}></div>
              )}

              {quizStatus === 'idle' && (
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Ready to test?</h2>
                  <p className="text-slate-500 max-w-xs mx-auto">Click Start Quiz to get a random word from your selected language.</p>
                </div>
              )}

              {quizStatus === 'loading' && (
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
                  <p className="text-indigo-600 font-bold animate-pulse">Generating Challenge...</p>
                </div>
              )}

              {quizStatus === 'active' && quizWord && (
                <div className="w-full max-w-sm space-y-8">
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                      <img src={getFlagUrl(currentQuizLanguage?.countryCode || 'us')} className="w-4 h-3 object-cover rounded-[2px]" />
                      Translate to English
                    </div>
                    <h2 className="text-5xl font-black text-slate-900 capitalize tracking-tight">{quizWord.targetWord}</h2>
                  </div>
                  
                  <form onSubmit={handleQuizSubmit} className="space-y-4">
                    <input 
                      autoFocus
                      type="text" 
                      value={quizInput}
                      onChange={(e) => setQuizInput(e.target.value)}
                      placeholder="Type your answer..." 
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-200 focus:bg-white focus:border-indigo-600 outline-none text-center text-xl font-bold transition-all"
                    />
                    <button 
                      type="submit"
                      className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-2xl transition-all shadow-xl active:scale-[0.98]"
                    >
                      Check Answer
                    </button>
                  </form>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{Math.ceil(quizTimer)} seconds left</p>
                </div>
              )}

              {(quizStatus === 'correct' || quizStatus === 'wrong' || quizStatus === 'timeout') && quizWord && (
                <div className="space-y-6 animate-in zoom-in-95 duration-300">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto ${quizStatus === 'correct' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    {quizStatus === 'correct' ? (
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                    )}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">
                      {quizStatus === 'correct' ? 'Perfect!' : quizStatus === 'timeout' ? 'Time up!' : 'Not quite!'}
                    </h2>
                    <p className="text-slate-500 mt-1">
                      The translation for <span className="font-bold text-slate-800">"{quizWord.targetWord}"</span> is <span className="font-bold text-indigo-600">"{quizWord.englishTranslation}"</span>
                    </p>
                  </div>
                  <button onClick={startNextQuizWord} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-10 py-4 rounded-2xl shadow-lg transition-all active:scale-95">
                    Next Challenge
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {!selectedFavorite ? (
              <>
                <header className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div><h1 className="text-2xl font-bold text-[#1C1E21]">Your Favorites</h1><p className="text-slate-500 text-sm">Review your saved vocabulary.</p></div>
                  </div>
                  <div className="relative">
                    <input type="text" value={favoritesSearchQuery} onChange={(e) => setFavoritesSearchQuery(e.target.value)} placeholder="Search favorites..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-[#F0F2F5] focus:bg-white focus:border-indigo-600 outline-none transition-all text-sm" />
                    <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                </header>
                {loadingFavorites ? <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-white rounded-xl border border-slate-200 animate-pulse"></div>)}</div> : (
                  <div className="grid grid-cols-1 gap-2">
                    {filteredFavorites.length > 0 ? filteredFavorites.map((fav) => {
                      const langInfo = LANGUAGES.find(l => l.code === fav.entry.target_lang);
                      return (
                        <div key={fav.id} onClick={() => setSelectedFavorite(fav)} className="group flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-600 cursor-pointer transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-[#F0F2F5] rounded-full flex items-center justify-center group-hover:bg-[#E7F3FF] transition-colors">
                              {langInfo && (
                                <img 
                                  src={getFlagUrl(langInfo.countryCode)} 
                                  alt={langInfo.name} 
                                  className="w-6 h-4 object-cover rounded-sm" 
                                />
                              )}
                            </div>
                            <div><h3 className="font-bold text-[#1C1E21] capitalize text-lg group-hover:text-indigo-600 transition-colors">{fav.word}</h3><p className="text-sm text-slate-500 font-medium">{fav.entry.translation}</p></div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="py-20 bg-white rounded-xl border border-slate-200 border-dashed text-center">
                        <p className="text-slate-400 font-medium">No favorites found matching your search.</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : <div className="animate-in fade-in slide-in-from-right-4 duration-300">{renderResult(selectedFavorite.entry, true)}</div>}
          </div>
        )}
      </main>
      <footer className="py-6 text-center text-[#65676B] text-xs border-t border-slate-200 bg-white">© 2025 LinguistPro • <span className="text-indigo-600 font-semibold">Powered by TripleK</span></footer>
    </div>
  );
};

export default Dashboard;
