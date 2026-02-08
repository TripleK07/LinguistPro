
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { AuthView } from '../types';

interface AuthScreenProps {
  view: AuthView;
  setView: (view: AuthView) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ view, setView }) => {
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
              <div className="w-10 h-10 bg-white/20 rounded-xl backdrop-blur-md flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight">Linguist Pro</span>
            </div>
            
            <h1 className="text-4xl font-extrabold leading-tight mb-6">
              Master the Art of Language with Advanced AI.
            </h1>
            <p className="text-indigo-100 text-lg">
              Bridge cultures and unlock deep meanings with our neural dictionary—designed for those who seek to understand the world.
            </p>
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
            <p className="text-sm text-indigo-200">Trusted by over 12,000 language enthusiasts.</p>
          </div>
        </div>

        {/* Form Side */}
        <div className="w-full md:w-1/2 p-8 md:p-16 flex flex-col justify-center">
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              {view !== 'forgot-password' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-slate-700">Password</label>
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
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-4"
              >
                {loading && (
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {view === 'login' ? 'Sign In' : view === 'signup' ? 'Create Account' : 'Send Reset Link'}
              </button>
            </form>

            <div className="mt-8 text-center text-sm text-slate-500">
              {view === 'login' ? (
                <p>
                  New to Linguist Pro?{' '}
                  <button onClick={() => setView('signup')} className="font-semibold text-indigo-600 hover:text-indigo-700">
                    Sign up free
                  </button>
                </p>
              ) : (
                <p>
                  Already part of our community?{' '}
                  <button onClick={() => setView('login')} className="font-semibold text-indigo-600 hover:text-indigo-700">
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
