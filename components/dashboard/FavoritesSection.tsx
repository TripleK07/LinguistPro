
import React from 'react';
import { Favorite, DictionaryEntry } from '../../types';

interface FavoritesSectionProps {
  favorites: Favorite[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onSelectFavorite: (fav: Favorite) => void;
  getFlagUrl: (cc: string) => string;
  languages: any[];
}

export const FavoritesSection: React.FC<FavoritesSectionProps> = ({ 
  favorites, loading, searchQuery, setSearchQuery, onSelectFavorite, getFlagUrl, languages 
}) => {
  const filtered = favorites.filter(f => 
    f.word.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.entry.translation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800">Your Personal Favorites</h1>
        <div className="mt-4 relative">
          <input 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            type="text" 
            placeholder="Search saved words..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none transition-all" 
          />
          <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </header>
      
      <div className="grid grid-cols-1 gap-3">
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-xl border border-slate-100 animate-pulse"></div>)}</div>
        ) : filtered.length > 0 ? (
          filtered.map(fav => {
            const lang = languages.find(l => l.code === fav.entry.target_lang);
            return (
              <div key={fav.id} onClick={() => onSelectFavorite(fav)} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-600 transition-all cursor-pointer flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-indigo-50 transition-colors">
                    {lang && <img src={getFlagUrl(lang.countryCode)} className="w-6 h-4 object-cover rounded-sm shadow-sm" alt="" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors capitalize">{fav.word}</h3>
                    <p className="text-sm text-slate-400 font-medium italic">{fav.entry.translation}</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            );
          })
        ) : (
          <div className="py-20 bg-white rounded-2xl border border-dashed border-slate-200 text-center">
            <p className="text-slate-400 font-medium">Your library is currently empty.</p>
          </div>
        )}
      </div>
    </div>
  );
};
