
import React, { useState, useEffect, useCallback } from 'react';

const PWAInstaller: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [platformInfo, setPlatformInfo] = useState<{
    isIOS: boolean;
    isMacSafari: boolean;
    isDesktopChrome: boolean;
  }>({
    isIOS: false,
    isMacSafari: false,
    isDesktopChrome: false,
  });

  const detectPlatform = useCallback(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isMac = /macintosh/.test(ua);
    const isSafari = /safari/.test(ua) && !/chrome/.test(ua);
    const isChrome = /chrome/.test(ua);
    
    setPlatformInfo({
      isIOS,
      isMacSafari: isMac && isSafari,
      isDesktopChrome: !isIOS && isChrome && !isMac,
    });
  }, []);

  const handleManualTrigger = useCallback(() => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
    } else {
      setShowGuide(true);
    }
  }, [deferredPrompt]);

  useEffect(() => {
    detectPlatform();

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    const handleCustomTrigger = () => {
      handleManualTrigger();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('trigger-pwa-install', handleCustomTrigger);

    // Default visible if not standalone to allow manual guide access
    setIsVisible(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('trigger-pwa-install', handleCustomTrigger);
    };
  }, [handleManualTrigger, detectPlatform]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } else {
      setShowGuide(true);
    }
  };

  if (!isVisible && !showGuide) return null;

  const renderGuideContent = () => {
    if (platformInfo.isIOS) {
      return (
        <>
          <div className="flex items-start gap-4 text-sm text-slate-600">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 text-indigo-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            </div>
            <p>1. Tap the <b>Share</b> icon in the Safari toolbar.</p>
          </div>
          <div className="flex items-start gap-4 text-sm text-slate-600">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 text-indigo-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p>2. Scroll down and select <b>'Add to Home Screen'</b>.</p>
          </div>
        </>
      );
    }

    if (platformInfo.isMacSafari) {
      return (
        <>
          <div className="flex items-start gap-4 text-sm text-slate-600">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 text-indigo-600 font-bold">⌘</div>
            <p>1. Go to the <b>File</b> menu in the menu bar.</p>
          </div>
          <div className="flex items-start gap-4 text-sm text-slate-600">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 text-indigo-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </div>
            <p>2. Choose <b>'Add to Dock'</b> to use as a native app.</p>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="flex items-start gap-4 text-sm text-slate-600">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 text-indigo-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <p>1. Look for the <b>Install</b> icon in your browser's address bar.</p>
        </div>
        <div className="flex items-start gap-4 text-sm text-slate-600">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 text-indigo-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
          </div>
          <p>2. Click <b>Install</b> to launch Linguist Pro from your desktop.</p>
        </div>
      </>
    );
  };

  return (
    <div className="fixed bottom-6 left-6 z-[100] animate-in slide-in-from-bottom-10 duration-500 print:hidden">
      <div className="relative">
        {isVisible && !showGuide && (
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
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 leading-none mb-1 text-white">App Experience</p>
              <p className="text-sm font-black leading-none text-white">Install App</p>
            </div>
          </button>
        )}

        {showGuide && (
          <div className="absolute bottom-full left-0 mb-4 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-slate-800">Install Guide</h3>
              <button onClick={() => setShowGuide(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {renderGuideContent()}
            </div>
            
            <div className="mt-5 pt-4 border-t border-slate-50">
              <button 
                onClick={() => setShowGuide(false)}
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
