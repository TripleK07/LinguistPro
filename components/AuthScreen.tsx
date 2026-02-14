
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { AuthView } from '../types';

interface AuthScreenProps {
  view: AuthView;
  setView: (view: AuthView) => void;
  onTryAsGuest: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ view, setView, onTryAsGuest }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (view === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (view === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess('Check your email for the confirmation link!');
      } else if (view === 'forgot-password') {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setSuccess('Password reset link sent to your email.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
      <div className="w-full max-w-[1100px] flex flex-col md:flex-row bg-white rounded-3xl shadow-2xl overflow-hidden min-h-[600px]">
        
        {/* Visual Side (Hidden on Mobile) */}
        <div className="hidden md:flex md:w-1/2 bg-indigo-600 p-12 text-white flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-indigo-500 rounded-full blur-3xl opacity-50"></div>
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-indigo-700 rounded-full blur-3xl opacity-50"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-violet-400 rounded-2xl shadow-xl flex items-center justify-center relative">
                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 13.4876 3.36033 14.8911 4 16.1247L3 21L7.87528 20C9.10893 20.6397 10.5124 21 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 3C12 3 15 7 15 12C15 17 12 21 12 21" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round"/>
                  <path d="M12 3C12 3 9 7 9 12C9 17 12 21 12 21" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round"/>
                  <path d="M3.5 12H20.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round"/>
                </svg>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
                   <svg className="w-3 h-3 text-indigo-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/></svg>
                </div>
              </div>
              <span className="text-2xl font-black tracking-tighter">Linguist<span className="text-indigo-200">Pro</span></span>
            </div>
            
            <h1 className="text-4xl font-extrabold leading-tight mb-6">
              Unlock the Secrets of Global Communication.
            </h1>
            <p className="text-indigo-100 text-lg mb-8">
              Linguist Pro is your intelligent companion for language mastery. Explore deep definitions, perfect your pronunciation, and save words to your personal library.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                </div>
                <span className="font-medium">8+ Global Languages Supported</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                </div>
                <span className="font-medium">High-Quality Audio Pronunciations</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                </div>
                <span className="font-medium">Personal Vocabulary Favorites</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-auto">
            <div className="flex -space-x-3 mb-4">
              {[1, 2, 3, 4].map(i => (
                <img 
                  key={i} 
                  className="w-10 h-10 rounded-full border-2 border-indigo-600" 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=user${i}`} 
                  alt="Avatar" 
                />
              ))}
              <div className="w-10 h-10 rounded-full border-2 border-indigo-600 bg-indigo-500 flex items-center justify-center text-xs font-bold">
                +12k
              </div>
            </div>
            <p className="text-sm text-indigo-200">Join over 12,000 language learners today.</p>
          </div>
        </div>

        {/* Form Side */}
        <div className="w-full md:w-1/2 p-8 md:p-16 flex flex-col justify-center bg-white">
          <div className="max-w-sm mx-auto w-full">
            <div className="mb-10 text-center md:text-left">
              <h2 className="text-3xl font-bold text-slate-800 mb-2">
                {view === 'login' ? 'Welcome Back' : view === 'signup' ? 'Start Your Journey' : 'Reset Password'}
              </h2>
              <p className="text-slate-500">
                {view === 'login' 
                  ? 'Sign in to continue your linguistic discovery' 
                  : view === 'signup' 
                    ? 'Create an account to save your favorite words' 
                    : 'We will send you a reset link'}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all placeholder:text-slate-400 text-slate-700"
                />
              </div>

              {view !== 'forgot-password' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-slate-600">Password</label>
                    {view === 'login' && (
                      <button 
                        type="button"
                        onClick={() => setView('forgot-password')}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all placeholder:text-slate-400 text-slate-700"
                  />
                </div>
              )}

              <div className="pt-2 space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:bg-indigo-300 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                >
                  {loading && (
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {view === 'login' ? 'Sign In' : view === 'signup' ? 'Create Account' : 'Send Reset Link'}
                </button>

                {view === 'login' && (
                  <button
                    type="button"
                    onClick={onTryAsGuest}
                    className="w-full bg-white border-2 border-slate-100 hover:border-indigo-200 hover:bg-slate-50 text-slate-700 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    Try as Guest
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                )}
              </div>
            </form>

            <div className="mt-8 text-center text-sm text-slate-500">
              {view === 'login' ? (
                <p>
                  New to Linguist Pro?{' '}
                  <button onClick={() => setView('signup')} className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
                    Sign up free
                  </button>
                </p>
              ) : (
                <p>
                  Already part of our community?{' '}
                  <button onClick={() => setView('login')} className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
                    Log in
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
