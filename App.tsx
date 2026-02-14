
import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from './lib/supabase';
import { getEnv, setLocalEnv, clearLocalEnv } from './lib/env';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import { AuthView } from './types';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<AuthView>('login');
  
  // Local states for manual config form
  const [manualUrl, setManualUrl] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);

  // Use the safe utility instead of direct process.env access
  const geminiApiKey = getEnv('API_KEY');
  const configMissing = !isSupabaseConfigured() || !geminiApiKey;

  const handleTryAsGuest = () => {
    setIsGuest(true);
  };

  const handleExitGuest = () => {
    setIsGuest(false);
    setCurrentView('login');
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualUrl) setLocalEnv('SUPABASE_URL', manualUrl);
    if (manualKey) setLocalEnv('SUPABASE_ANON_KEY', manualKey);
    window.location.reload(); // Reload to re-initialize supabase client with new env
  };

  const handleResetConfig = () => {
    clearLocalEnv();
    window.location.reload();
  };

  useEffect(() => {
    if (configMissing) {
      setLoading(false);
      return;
    }

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase!.auth.getSession();
        setSession(session);
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase!.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setIsGuest(false);
        setCurrentView('login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [configMissing]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
          <p className="text-slate-500 font-medium animate-pulse text-sm">Initializing Linguist Pro...</p>
        </div>
      </div>
    );
  }

  if (configMissing) {
    const isSupabaseMissing = !isSupabaseConfigured();
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-800">Setup Required</h1>
            <p className="text-slate-500 text-sm mt-2">Connect your Supabase project to get started.</p>
          </div>
          
          <div className="space-y-3 mb-8">
            <div className={`p-3 rounded-xl flex items-center justify-between border ${!geminiApiKey ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${!geminiApiKey ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                <span className="text-xs font-bold uppercase tracking-wider">Gemini API_KEY</span>
              </div>
              <span className="text-xs font-black uppercase">{geminiApiKey ? 'Linked' : 'Missing'}</span>
            </div>
            
            <div className={`p-3 rounded-xl flex items-center justify-between border ${isSupabaseMissing ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isSupabaseMissing ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                <span className="text-xs font-bold uppercase tracking-wider">Supabase Client</span>
              </div>
              <span className="text-xs font-black uppercase">{!isSupabaseMissing ? 'Linked' : 'Missing'}</span>
            </div>
          </div>

          {showManualForm ? (
            <form onSubmit={handleSaveConfig} className="space-y-4 animate-in slide-in-from-top-4 duration-300">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Supabase Project URL</label>
                <input 
                  type="text" 
                  value={manualUrl} 
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://xyz.supabase.co" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none transition-all text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Anon API Key</label>
                <input 
                  type="password" 
                  value={manualKey} 
                  onChange={(e) => setManualKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1..." 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none transition-all text-sm"
                  required
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]"
              >
                Apply Configuration
              </button>
              <button 
                type="button" 
                onClick={() => setShowManualForm(false)}
                className="w-full text-slate-400 font-bold text-xs py-2"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <button 
                onClick={() => setShowManualForm(true)}
                className="w-full bg-white border border-slate-200 hover:border-indigo-600 hover:text-indigo-600 text-slate-700 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Enter Supabase Credentials
              </button>
              
              {!isSupabaseMissing && (
                <button 
                  onClick={handleResetConfig}
                  className="w-full text-red-400 hover:text-red-500 font-bold text-[10px] uppercase tracking-widest py-2"
                >
                  Clear Current Config
                </button>
              )}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 leading-relaxed text-center italic">
              Note: This is for local preview convenience. For production, add your variables to the <b>Vercel Project Settings</b>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {(session || isGuest) ? (
        <Dashboard 
          session={session} 
          isGuest={isGuest} 
          onExitGuest={handleExitGuest}
        />
      ) : (
        <AuthScreen 
          view={currentView} 
          setView={setCurrentView} 
          onTryAsGuest={handleTryAsGuest}
        />
      )}
    </div>
  );
};

export default App;
