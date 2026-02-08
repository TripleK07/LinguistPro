
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import { AuthView } from './types';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<AuthView>('login');

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for all auth changes (LOGIN, LOGOUT, TOKEN REFRESH)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log(`Auth event: ${event}`);
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
  }, []);

  const handleTryAsGuest = () => {
    setIsGuest(true);
  };

  const handleExitGuest = () => {
    setIsGuest(false);
    setCurrentView('login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
          <p className="text-slate-500 font-medium animate-pulse text-sm">Resuming session...</p>
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
