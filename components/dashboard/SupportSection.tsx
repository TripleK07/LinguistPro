
import React from 'react';

export const SupportSection: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 p-8 md:p-12 text-center overflow-hidden relative">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-amber-50 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
        
        <div className="relative z-10">
          <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Donate to Support</h1>
          
          <div className="space-y-6 text-slate-600 leading-relaxed font-medium text-lg">
            <p>
              Hi! I'm the solo developer behind Linguist Pro. I'm committed to keeping this tool <span className="text-indigo-600 font-bold">100% free</span> for everyone.
            </p>
            <p className="text-base text-slate-500">
              Maintaining high-performance AI lookups and premium voice synthesis requires significant server resources. As a one-man team, these costs can be challenging as our community grows.
            </p>
            <p className="text-base text-slate-500">
              If Linguist Pro has been helpful to you, a small donation would go a long way in helping me keep the servers running and the app improving.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            <a 
              href="https://buymeacoffee.com/triplek" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 w-full bg-[#FFDD00] hover:bg-[#FFCC00] text-black font-black py-5 rounded-3xl shadow-xl shadow-yellow-100 transition-all active:scale-95 group"
            >
              <img src="https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg" alt="BMC Logo" className="w-6 h-6" />
              <span>Support me on Buy Me a Coffee</span>
            </a>
            
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Your contribution keeps this project alive!</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Server Costing</h3>
            <p className="text-xs text-slate-500 mt-1">Donations directly cover the server and AI inference costs that power your lookups.</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">One-Man Effort</h3>
            <p className="text-xs text-slate-500 mt-1">Your generosity helps me dedicate more time to adding new features and languages.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
