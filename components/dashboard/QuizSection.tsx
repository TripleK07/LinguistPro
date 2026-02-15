
import React, { useState, useEffect, useRef } from 'react';
import { CustomDropdown } from '../ui/CustomDropdown';
import { getQuizQuestions } from '../../lib/gemini';

const LANGUAGES = [
  { id: 'Chinese', label: 'Chinese', countryCode: 'cn' },
  { id: 'French', label: 'French', countryCode: 'fr' },
  { id: 'German', label: 'German', countryCode: 'de' },
  { id: 'Italian', label: 'Italian', countryCode: 'it' },
  { id: 'Japanese', label: 'Japanese', countryCode: 'jp' },
  { id: 'Myanmar', label: 'Myanmar', countryCode: 'mm' },
  { id: 'Portuguese', label: 'Portuguese', countryCode: 'pt' },
  { id: 'Spanish', label: 'Spanish', countryCode: 'es' },
];

const QUIZ_CATEGORIES = ["Random", "Kitchenwares", "Sports", "Nature", "Technology", "Travel", "Emotions", "Food & Drink", "Animals", "Clothing"].map(c => ({ id: c, label: c }));
const QUIZ_LEVELS = [
  { id: 'Basic', count: 5, desc: '5 simple words' },
  { id: 'Intermediate', count: 7, desc: '7 common words' },
  { id: 'Advance', count: 10, desc: '10 complex words' },
  { id: 'Expert', count: 12, desc: '12 hardest words' }
];

const QUIZ_TIMER_MAX = 15;

export const QuizSection: React.FC = () => {
  const [quizSettings, setQuizSettings] = useState({ lang: 'Spanish', category: 'Random', level: 'Basic' });
  const [quizState, setQuizState] = useState<'setup' | 'active' | 'feedback' | 'results'>('setup');
  const [quizQuestions, setQuizQuestions] = useState<{ targetWord: string, englishTranslation: string }[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [quizInput, setQuizInput] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [quizTimer, setQuizTimer] = useState(QUIZ_TIMER_MAX);
  const [lastAnswerStatus, setLastAnswerStatus] = useState<'correct' | 'wrong' | 'timeout'>('correct');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quizTimerRef = useRef<number | null>(null);

  const levelConfig = QUIZ_LEVELS.find(l => l.id === quizSettings.level);
  const totalNeeded = levelConfig?.count || 5;
  const isLastQuestion = currentQuestionIdx + 1 >= totalNeeded;

  const resetTimer = () => {
    if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    setQuizTimer(QUIZ_TIMER_MAX);
    quizTimerRef.current = window.setInterval(() => {
      setQuizTimer(prev => {
        if (prev <= 1) {
          handleAnswer(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startQuiz = async () => {
    setLoading(true);
    setError(null);
    try {
      const questions = await getQuizQuestions(
        quizSettings.lang, 
        quizSettings.category, 
        quizSettings.level, 
        totalNeeded
      );
      setQuizQuestions(questions);
      setCorrectCount(0);
      setCurrentQuestionIdx(0);
      setQuizInput('');
      setQuizState('active');
      resetTimer();
    } catch (err: any) {
      setError(err.message || "Failed to load quiz questions.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (isTimeout = false) => {
    if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    const currentQ = quizQuestions[currentQuestionIdx];
    const isCorrect = !isTimeout && quizInput.trim().toLowerCase() === currentQ.englishTranslation.toLowerCase();
    
    if (isCorrect) setCorrectCount(prev => prev + 1);
    setLastAnswerStatus(isTimeout ? 'timeout' : (isCorrect ? 'correct' : 'wrong'));
    setQuizState('feedback');
  };

  const goToNextQuestion = () => {
    if (isLastQuestion) {
      setQuizState('results');
      return;
    }

    setCurrentQuestionIdx(prev => prev + 1);
    setQuizInput('');
    setQuizState('active');
    resetTimer();
  };

  const quitQuiz = () => {
    if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    setQuizState('setup');
    setQuizQuestions([]);
    setQuizInput('');
  };

  if (quizState === 'setup') {
    return (
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Vocabulary Master</h1>
          <p className="text-slate-500 mt-2">Choose your settings and test your knowledge.</p>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <CustomDropdown 
            label="Language"
            options={LANGUAGES}
            value={quizSettings.lang}
            onChange={(val) => setQuizSettings(p => ({...p, lang: val}))}
          />
          <CustomDropdown 
            label="Category"
            options={QUIZ_CATEGORIES}
            value={quizSettings.category}
            onChange={(val) => setQuizSettings(p => ({...p, category: val}))}
          />

          <div className="md:col-span-2 space-y-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Difficulty Level</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {QUIZ_LEVELS.map(lvl => (
                <button 
                  key={lvl.id} 
                  onClick={() => setQuizSettings(p => ({...p, level: lvl.id}))} 
                  className={`p-4 rounded-2xl border-2 transition-all text-left group ${quizSettings.level === lvl.id ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                >
                  <p className={`font-black text-sm ${quizSettings.level === lvl.id ? 'text-indigo-700' : 'text-slate-700'}`}>{lvl.id}</p>
                  <p className={`text-[10px] mt-1 font-medium ${quizSettings.level === lvl.id ? 'text-indigo-500' : 'text-slate-400'}`}>{lvl.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button 
          onClick={startQuiz} 
          disabled={loading} 
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-3xl shadow-xl shadow-indigo-100 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        >
          {loading ? <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : "Start Challenge"}
        </button>
      </div>
    );
  }

  if (quizState === 'active' || quizState === 'feedback') {
    const currentQ = quizQuestions[currentQuestionIdx];
    return (
      <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-200 text-center relative overflow-hidden min-h-[500px] flex flex-col justify-center animate-in zoom-in-95 duration-300">
        <div className="absolute top-0 left-0 h-1.5 bg-indigo-600 transition-all duration-1000 ease-linear" style={{ width: `${(quizTimer / QUIZ_TIMER_MAX) * 100}%` }}></div>
        
        <div className="mb-10 space-y-4">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
            Question {currentQuestionIdx + 1} of {totalNeeded}
          </div>
          <h2 className="text-5xl font-black text-slate-900 tracking-tight capitalize">{currentQ?.targetWord}</h2>
          <p className="text-slate-400 font-medium">Translate this to English</p>
        </div>

        {quizState === 'active' ? (
          <form onSubmit={(e) => { e.preventDefault(); handleAnswer(); }} className="max-w-md mx-auto w-full space-y-4">
            <input autoFocus value={quizInput} onChange={(e) => setQuizInput(e.target.value)} placeholder="Type answer..." className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:bg-white focus:border-indigo-600 outline-none text-center text-xl font-bold transition-all" />
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
              <p className="text-slate-500">Correct translation: <span className="font-bold text-indigo-600">"{currentQ.englishTranslation}"</span></p>
            </div>
            <div className="flex gap-3 max-w-sm mx-auto w-full">
              <button onClick={quitQuiz} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold py-4 rounded-xl transition-all">Give up</button>
              <button 
                onClick={goToNextQuestion} 
                className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-xl active:scale-95 transition-all flex items-center justify-center"
              >
                {isLastQuestion ? "See Results" : "Next Question"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
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
        Try Again
      </button>
    </div>
  );
};
