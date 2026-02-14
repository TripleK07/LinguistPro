
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { lookupWord, generateSpeech, decodeBase64, decodeAudioData, transcribeAudio, getQuizWord } from '../lib/gemini';
import { DictionaryEntry, DashboardView, Favorite } from '../types';

interface DashboardProps {
  session: any;
  isGuest?: boolean;
  onExitGuest?: () => void;
}

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

const QUIZ_DURATION = 10; // 10 seconds

const Dashboard: React.FC<DashboardProps> = ({ session, isGuest, onExitGuest }) => {
  const [signingOut, setSigningOut] = useState(false);
  const [currentTab, setCurrentTab] = useState<DashboardView>('search');
  
  // Search State
  const [searchWord, setSearchWord] = useState('');
  const [targetLang, setTargetLang] = useState('Myanmar');
  const [loading, setLoading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [result, setResult] = useState<DictionaryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  
  // Quiz State
  const [quizTargetLang, setQuizTargetLang] = useState('Spanish');
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
    if (!isGuest && supabase) {
      fetchFavorites();
    }
    return () => {
      stopRecording();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
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

  const handleSelectApiKey = async () => {
    try {
      await (window as any).aistudio.openSelectKey();
      setIsQuotaExceeded(false);
      setError(null);
    } catch (err) {
      console.error("Failed to open key selector", err);
    }
  };

  // Quiz Logic
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
    return favorites.filter(f => 
      f.word.toLowerCase().includes(query) || 
      f.entry.translation.toLowerCase().includes(query)
    );
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
      console.error(err);
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

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';

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
            silenceTimeoutRef.current = window.setTimeout(() => {
              stopRecording();
            }, 1500);
          }
        } else {
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }
        }
        if (mediaRecorder.state === 'recording') {
          requestAnimationFrame(checkSilence);
        }
      };
      
      requestAnimationFrame(checkSilence);
      setTimeout(() => stopRecording(), 8000);

    } catch (err) {
      console.error("Microphone access error:", err);
      setError("Microphone access denied or not available.");
      setIsListening(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
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
          setError("Couldn't understand the word. Please try again.");
        }
        setIsTranscribing(false);
      };
    } catch (err) {
      console.error("Transcription error:", err);
      handleQuotaError(err);
      setIsTranscribing(false);
    }
  };

  const toggleVoiceSearch = () => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const getFavoritedItem = (word: string) => {
    return favorites.find(f => f.word.toLowerCase() === word.toLowerCase());
  };

  const toggleFavorite = async (entry: DictionaryEntry) => {
    if (isGuest) {
      alert("Please sign up to save favorites!");
      return;
    }
    if (!supabase) return;
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
      alert("Error updating favorites.");
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
          <button 
            onClick={() => setSelectedFavorite(null)}
            className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-semibold text-sm transition-colors mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
            Back to List
          </button>
        )}
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-4 mb-1">
                <h2 className="text-4xl font-bold text-[#1C1E21] capitalize">{data.word}</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => playPronunciation(data.word)}
                    disabled={playingAudio}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playingAudio ? 'bg-slate-100 text-indigo-600' : 'bg-[#E7F3FF] text-indigo-600 hover:bg-[#D8EAFE] active:scale-95'}`}
                  >
                    {playingAudio ? (
                      <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clipRule="evenodd" /></svg>
                    ) : (
                      <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                    )}
                  </button>
                  <button 
                    onClick={() => toggleFavorite(data)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${isFav ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-200'}`}
                  >
                    <svg className={`w-6 h-6 transition-transform ${isFav ? 'scale-110' : ''}`} fill={isFav ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>
              </div>
              <span className="text-indigo-600 font-mono font-medium">{data.phonetics}</span>
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

  const renderLockedFeature = (title: string, description: string) => (
    <div className="flex-grow flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 shadow-xl text-center max-w-2xl mx-auto px-8 animate-in zoom-in duration-300">
      <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">{title}</h2>
      <p className="text-slate-500 text-lg mb-10 leading-relaxed max-w-md">{description}</p>
      <button 
        onClick={() => onExitGuest?.()}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-12 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 text-lg"
      >
        Sign Up to Unlock
      </button>
      <p className="mt-6 text-slate-400 text-sm font-medium italic">It's free and takes 30 seconds.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col text-[#1C1E21]">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setCurrentTab('search'); setSelectedFavorite(null); }}>
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md transition-transform group-hover:scale-105 active:scale-95">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 13.4876 3.36033 14.8911 4 16.1247L3 21L7.87528 20C9.10893 20.6397 10.5124 21 12 21Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 3C12 3 15 7 15 12C15 17 12 21 12 21" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round"/>
                    <path d="M12 3C12 3 9 7 9 12C9 17 12 21 12 21" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round"/>
                  </svg>
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
                  {!isGuest && (
                    <span className={`ml-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white shadow-sm transition-opacity duration-300 ${favorites.length > 0 ? 'opacity-100' : 'opacity-0'}`}>
                      {favorites.length}
                    </span>
                  )}
                  {isGuest && <svg className="w-3 h-3 absolute top-3 right-1 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>}
                </button>
                <button onClick={() => { setCurrentTab('quiz'); setSelectedFavorite(null); }} className={`flex items-center px-4 border-b-2 transition-colors font-semibold text-sm ${currentTab === 'quiz' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-[#65676B] hover:bg-slate-50'} relative`}>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  Quiz
                  {isGuest && <svg className="w-3 h-3 absolute top-3 right-1 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                <img className="h-7 w-7 rounded-full bg-white" src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} alt="Avatar" />
                <span className="text-xs font-semibold text-slate-600 truncate max-w-[100px] hidden sm:block">{user.email}</span>
                <button onClick={handleSignOut} disabled={signingOut} className="text-slate-400 hover:text-red-500 transition-colors">
                  {isGuest ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow flex flex-col max-w-4xl mx-auto w-full py-8 px-4">
        {/* Guest Banner */}
        {isGuest && currentTab === 'search' && (
          <div className="mb-6 p-4 bg-indigo-600 text-white rounded-2xl shadow-lg flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/></svg>
              </div>
              <div>
                <p className="font-black tracking-tight text-lg">Trial Mode Active</p>
                <p className="text-indigo-100 text-xs font-medium">Create an account to save words and try the Daily Quiz!</p>
              </div>
            </div>
            <button 
              onClick={() => onExitGuest?.()}
              className="bg-white text-indigo-600 font-bold px-5 py-2 rounded-xl text-sm shadow-sm transition-transform hover:scale-105 active:scale-95"
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Quota Error Notification */}
        {isQuotaExceeded && (
          <div className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div>
                <p className="font-bold text-amber-900">API Quota Exceeded</p>
                <p className="text-amber-700 text-sm">You have reached the free tier limit. Use your own key for uninterrupted service.</p>
              </div>
            </div>
            <button 
              onClick={handleSelectApiKey}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-2.5 rounded-lg shadow-sm transition-all whitespace-nowrap active:scale-95"
            >
              Select Paid API Key
            </button>
          </div>
        )}

        {currentTab === 'search' ? (
          <>
            <section className="mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h1 className="text-2xl font-bold text-[#1C1E21] mb-2">Discover the world of words</h1>
                <p className="text-slate-500 text-sm mb-6">Enter an English word to get its meaning and translation in seconds.</p>
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-grow relative group">
                    <input
                      type="text"
                      value={searchWord}
                      onChange={(e) => setSearchWord(e.target.value)}
                      placeholder={isListening ? "Listening..." : isTranscribing ? "Processing..." : "Enter a word..."}
                      className={`w-full pl-10 pr-12 py-3 rounded-lg border border-slate-200 bg-[#F0F2F5] focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition-all text-base ${isListening || isTranscribing ? 'placeholder:text-indigo-500 font-medium bg-indigo-50/30' : ''}`}
                    />
                    <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <button
                      type="button"
                      onClick={toggleVoiceSearch}
                      disabled={loading || isTranscribing}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${isListening ? 'bg-indigo-600 text-white animate-pulse shadow-lg shadow-indigo-200' : isTranscribing ? 'bg-slate-100 text-indigo-400 animate-spin' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'}`}
                    >
                      {isTranscribing ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      ) : isListening ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                      )}
                    </button>
                  </div>
                  <div className="relative min-w-[180px]">
                    <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="appearance-none w-full pl-10 pr-10 py-3 rounded-lg border border-slate-200 bg-[#F0F2F5] hover:bg-[#E4E6E9] focus:bg-white focus:border-indigo-600 outline-none transition-all text-[#1C1E21] font-semibold cursor-pointer text-sm">
                      {LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
                    </select>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-lg">{currentLanguage?.flag}</div>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"><svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
                  </div>
                  <button type="submit" disabled={loading || isTranscribing} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold px-8 py-3 rounded-lg transition-all flex items-center justify-center gap-2 min-w-[120px]">
                    {loading ? <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : 'Look Up'}
                  </button>
                </form>
                {error && <p className={`mt-3 text-sm font-medium ${isQuotaExceeded ? 'text-amber-600' : 'text-red-500'}`}>{error}</p>}
              </div>
            </section>
            <div className="flex-grow flex flex-col gap-4">
              {!result && !loading && (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
                  <div className="w-16 h-16 bg-[#E7F3FF] text-indigo-600 rounded-full flex items-center justify-center mb-4"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
                  <p className="text-[#65676B] font-semibold">Your personal linguist is waiting</p>
                  <p className="text-slate-400 text-sm px-6">Ready to translate. Just type a word or use voice search above to start.</p>
                </div>
              )}
              {loading && <div className="space-y-4 animate-pulse"><div className="h-32 bg-white rounded-xl border border-slate-200"></div><div className="h-64 bg-white rounded-xl border border-slate-200"></div></div>}
              {result && !loading && renderResult(result)}
            </div>
          </>
        ) : currentTab === 'quiz' ? (
          isGuest ? renderLockedFeature("Premium Daily Quiz", "Challenge yourself with interactive vocabulary games to accelerate your learning. Join our community to access daily quizzes.") : (
          <div className="flex-grow flex flex-col max-w-2xl mx-auto w-full">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 flex flex-col min-h-[500px]">
              {/* Quiz Header & Timer */}
              <div className="h-1.5 w-full bg-slate-100 relative">
                <div 
                  className={`absolute left-0 top-0 h-full transition-all duration-100 ease-linear ${quizTimer < 3 ? 'bg-red-500' : 'bg-indigo-600'}`}
                  style={{ width: `${(quizStatus === 'active' ? (quizTimer / QUIZ_DURATION) * 100 : 0)}%` }}
                />
              </div>

              {/* Quiz Language Selection Bar */}
              {quizStatus === 'idle' && (
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Challenge Language</span>
                  <div className="relative min-w-[140px]">
                    <select 
                      value={quizTargetLang} 
                      onChange={(e) => setQuizTargetLang(e.target.value)}
                      className="appearance-none w-full pl-8 pr-8 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-indigo-400 outline-none transition-all text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      {LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
                    </select>
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-xs">{currentQuizLanguage?.flag}</div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
                  </div>
                </div>
              )}

              <div className={`flex-grow flex flex-col items-center justify-center p-8 text-center transition-colors duration-300 ${quizStatus === 'correct' ? 'bg-emerald-50' : quizStatus === 'wrong' || quizStatus === 'timeout' ? 'bg-red-50' : 'bg-white'}`}>
                {quizStatus === 'idle' ? (
                  <div className="animate-in zoom-in duration-300 flex flex-col items-center">
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-800 mb-2">Ready for a challenge?</h2>
                    <p className="text-slate-500 mb-8 max-w-xs">You'll get a word in <strong>{currentQuizLanguage?.name}</strong>. Translate it to English in under {QUIZ_DURATION} seconds!</p>
                    <button 
                      onClick={startNextQuizWord}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-12 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-3"
                    >
                      Start {currentQuizLanguage?.name} Quiz
                    </button>
                    {error && <p className={`mt-4 text-xs font-semibold ${isQuotaExceeded ? 'text-amber-600' : 'text-red-500'}`}>{error}</p>}
                  </div>
                ) : quizStatus === 'loading' ? (
                  <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
                    <svg className="animate-spin h-12 w-12 text-indigo-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-widest animate-pulse">Generating Random Word...</p>
                  </div>
                ) : quizStatus === 'active' ? (
                  <div className="w-full animate-in fade-in duration-300">
                    <div className="flex items-center justify-center gap-3 mb-4 text-slate-400 font-bold uppercase tracking-widest text-xs">
                      <span>{currentQuizLanguage?.flag}</span>
                      <span>{currentQuizLanguage?.name} word</span>
                    </div>
                    <h1 className="text-5xl font-black text-slate-800 mb-12 tracking-tight">{quizWord?.targetWord}</h1>
                    
                    <form onSubmit={handleQuizSubmit} className="max-w-xs mx-auto">
                      <input 
                        autoFocus
                        type="text"
                        value={quizInput}
                        onChange={(e) => setQuizInput(e.target.value)}
                        placeholder="Type English translation..."
                        className="w-full px-6 py-4 rounded-xl border-2 border-slate-200 focus:border-indigo-600 outline-none text-center text-xl font-semibold transition-all shadow-inner bg-white text-slate-800"
                      />
                      <button type="submit" className="hidden">Submit</button>
                    </form>
                    <p className="mt-8 text-indigo-600 font-black text-2xl">{Math.ceil(quizTimer)}s</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center animate-in zoom-in duration-300">
                    {quizStatus === 'correct' ? (
                      <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                        <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
                        <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                      </div>
                    )}
                    
                    <h2 className={`text-4xl font-black mb-2 ${quizStatus === 'correct' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {quizStatus === 'correct' ? 'Excellent!' : quizStatus === 'timeout' ? 'Time Up!' : 'Not Quite'}
                    </h2>
                    
                    <div className="mt-4 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm mb-8 w-full max-sm:px-4 w-full max-w-sm">
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Correct Answer</p>
                      <p className="text-3xl font-bold text-slate-800 capitalize">{quizWord?.englishTranslation}</p>
                    </div>

                    <button 
                      onClick={startNextQuizWord}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-16 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95"
                    >
                      Next Word
                    </button>
                    <button 
                      onClick={() => { setQuizStatus('idle'); setQuizHistory([]); }}
                      className="mt-4 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
                    >
                      Reset Session & Language
                    </button>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-6 text-center text-slate-400 text-sm font-medium">Test language: <span className="text-slate-600 font-bold">{currentQuizLanguage?.name} {currentQuizLanguage?.flag}</span></p>
          </div>
          )
        ) : (
          isGuest ? renderLockedFeature("Personal Word Bank", "Save difficult words and build your own custom vocabulary library. Sign up to start building your personal linguist library.") : (
          <div className="flex flex-col gap-6">
            {!selectedFavorite ? (
              <>
                <header className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div><h1 className="text-2xl font-bold text-[#1C1E21]">Your Favorites</h1><p className="text-slate-500 text-sm">Review your saved vocabulary list.</p></div>
                    <div className="bg-[#E7F3FF] text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm shadow-inner">{favorites.length} Words</div>
                  </div>
                  <div className="relative">
                    <input type="text" value={favoritesSearchQuery} onChange={(e) => setFavoritesSearchQuery(e.target.value)} placeholder="Search your favorites..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-[#F0F2F5] focus:bg-white focus:border-indigo-600 outline-none transition-all text-sm" />
                    <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                </header>
                {loadingFavorites ? <div className="space-y-3">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-white rounded-xl border border-slate-200 animate-pulse"></div>)}</div> : filteredFavorites.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
                    <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4 border border-slate-100"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg></div>
                    <p className="text-[#65676B] font-semibold">{favoritesSearchQuery ? 'No matching words' : 'No favorites yet'}</p>
                    <p className="text-slate-400 text-sm px-6 mb-6">{favoritesSearchQuery ? 'Try a different search term.' : 'Words you save will appear here for easy review.'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {filteredFavorites.map((fav) => {
                      const langInfo = LANGUAGES.find(l => l.code === fav.entry.target_lang);
                      return (
                        <div key={fav.id} onClick={() => setSelectedFavorite(fav)} className="group flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-600 hover:shadow-md cursor-pointer transition-all animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-[#F0F2F5] rounded-full flex items-center justify-center text-xl group-hover:bg-[#E7F3FF] transition-colors">{langInfo?.flag || '🌐'}</div>
                            <div><h3 className="font-bold text-[#1C1E21] capitalize text-lg group-hover:text-indigo-600 transition-colors">{fav.word}</h3><p className="text-sm text-slate-500 font-medium">{fav.entry.translation}</p></div>
                          </div>
                          <div className="flex items-center gap-4"><span className="hidden sm:inline text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{langInfo?.name}</span><div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-indigo-600 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg></div></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : <div className="animate-in fade-in slide-in-from-right-4 duration-300">{renderResult(selectedFavorite.entry, true)}</div>}
          </div>
          )
        )}
      </main>
      <footer className="py-6 text-center text-[#65676B] text-xs border-t border-slate-200 bg-white">© 2025 LinguistPro • <span className="text-indigo-600 font-semibold">Powered by TripleK</span></footer>
    </div>
  );
};

export default Dashboard;
