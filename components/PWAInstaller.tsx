
import React, { useState, useEffect, useCallback } from 'react';

const PWAInstaller: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTooltip, setShowIOSTooltip] = useState(false);

  const handleManualTrigger = useCallback(() => {
    if (isIOS) {
      setShowIOSTooltip(true);
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
    } else {
      // Fallback if no prompt is available but user wants to know how
      setShowIOSTooltip(true); 
    }
  }, [isIOS, deferredPrompt]);

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    // Listen for the native install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    // Listen for custom trigger from header
    const handleCustomTrigger = () => {
      handleManualTrigger();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('trigger-pwa-install', handleCustomTrigger);

    // If it's iOS and not standalone, show the install button
    if (isIOSDevice && !isStandalone) {
      setIsVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('trigger-pwa-install', handleCustomTrigger);
    };
  }, [handleManualTrigger]);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSTooltip(true);
      return;
    }

    if (!deferredPrompt) {
      // If we don't have the prompt (e.g. on some browsers), show the general guide
      setShowIOSTooltip(true);
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  if (!isVisible && !showIOSTooltip) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[100] animate-in slide-in-from-bottom-10 duration-500">
      <div className="relative">
        {isVisible && (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl shadow-2xl shadow-indigo-200 transition-all active:scale-95 group border border-indigo-400/30"
          >
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 leading-none mb-1 text-white">Get the app</p>
              <p className="text-sm font-black leading-none text-white">Install Pro</p>
            </div>
          </button>
        )}

        {showIOSTooltip && (
          <div className="absolute bottom-full left-0 mb-4 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-slate-800">How to Install</h3>
              <button onClick={() => setShowIOSTooltip(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start gap-4 text-sm text-slate-600">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 text-indigo-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                </div>
                <p>1. Tap the <b>Share</b> or <b>Menu</b> icon in your browser.</p>
              </div>
              
              <div className="flex items-start gap-4 text-sm text-slate-600">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 text-indigo-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p>2. Select <b>'Add to Home Screen'</b> or <b>'Install App'</b>.</p>
              </div>
            </div>
            
            <div className="mt-5 pt-4 border-t border-slate-50">
              <button 
                onClick={() => setShowIOSTooltip(false)}
                className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-indigo-100"
              >
                Got it
              </button>
            </div>
            
            <div className="absolute -bottom-2 left-8 w-4 h-4 bg-white border-r border-b border-slate-100 rotate-45"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PWAInstaller;
