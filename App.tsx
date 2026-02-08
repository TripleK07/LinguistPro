
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import { AuthView } from './types';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<AuthView>('login');

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {session ? (
        <Dashboard session={session} />
      ) : (
        <AuthScreen 
          view={currentView} 
          setView={setCurrentView} 
        />
      )}
    </div>
  );
};

export default App;
