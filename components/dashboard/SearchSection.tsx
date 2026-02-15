
import React from 'react';
import { CustomDropdown } from '../ui/CustomDropdown';
import { DictionaryEntry } from '../../types';

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

interface SearchSectionProps {
  searchWord: string;
  setSearchWord: (val: string) => void;
  targetLang: string;
  setTargetLang: (val: string) => void;
  loading: boolean;
  onSearch: (e: React.FormEvent) => void;
  result: DictionaryEntry | null;
  renderResult: (data: DictionaryEntry) => React.ReactNode;
  isGuest?: boolean;
  onExitGuest?: () => void;
}

export const SearchSection: React.FC<SearchSectionProps> = ({ 
  searchWord, setSearchWord, targetLang, setTargetLang, loading, onSearch, result, renderResult, isGuest, onExitGuest
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {isGuest && (
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-indigo-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <p className="text-white font-black text-sm leading-none">Trial Mode Active</p>
              <p className="text-indigo-100 text-[10px] mt-1 font-medium italic">Basic search features are enabled for your preview.</p>
            </div>
          </div>
          <button 
            onClick={onExitGuest}
            className="bg-white text-indigo-600 px-6 py-2 rounded-xl text-xs font-black hover:bg-indigo-50 transition-all active:scale-95 shadow-sm"
          >
            Create Full Account
          </button>
        </div>
      )}

      <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Discover New Words</h1>
        <form onSubmit={onSearch} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-[2] w-full relative">
            <input 
              type="text" 
              value={searchWord} 
              onChange={(e) => setSearchWord(e.target.value)} 
              placeholder="Type a word..." 
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none transition-all" 
            />
            <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <div className="flex-[1.5] w-full sm:min-w-[190px]">
            <CustomDropdown 
              options={LANGUAGES}
              value={targetLang}
              onChange={setTargetLang}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-indigo-100 active:scale-95 disabled:bg-slate-300 transition-all flex items-center justify-center h-[46px] whitespace-nowrap min-w-max"
          >
            {loading ? <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : "Look Up"}
          </button>
        </form>
      </header>

      {result && !loading && renderResult(result)}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-32 bg-white rounded-2xl border border-slate-200"></div>
          <div className="h-48 bg-white rounded-2xl border border-slate-200"></div>
        </div>
      )}
      {!result && !loading && (
        <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
           <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
           <p className="font-medium text-slate-500">Ready to expand your vocabulary?</p>
        </div>
      )}
    </div>
  );
};
