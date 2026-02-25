
import React from 'react';
import { HistoryEntry, DictionaryEntry } from '../../types';

interface HistorySectionProps {
    history: HistoryEntry[];
    loading: boolean;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    onSelectHistory: (item: HistoryEntry) => void;
    onDeleteHistory: (id: string | null, deleteAll?: boolean) => void;
    getFlagUrl: (countryCode: string) => string;
    languages: { code: string; name: string; countryCode: string }[];
}

export const HistorySection: React.FC<HistorySectionProps> = ({
    history,
    loading,
    searchQuery,
    setSearchQuery,
    onSelectHistory,
    onDeleteHistory,
    getFlagUrl,
    languages
}) => {
    const filteredHistory = history.filter(item =>
        item.word.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading && history.length === 0) {
        return (
            <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-white rounded-3xl border border-slate-200"></div>
                ))}
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="py-24 flex flex-col items-center justify-center text-center opacity-40">
                <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium text-slate-500">No search history yet.</p>
                <p className="text-xs text-slate-400 mt-1">Words you look up will appear here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-slate-800">Search History</h2>
                    <button
                        onClick={() => onDeleteHistory(null, true)}
                        className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-widest flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Clear All
                    </button>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search history..."
                        className="w-full h-[54px] pl-11 pr-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none transition-all shadow-sm text-lg"
                    />
                    <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </header>

            <div className="grid gap-3">
                {filteredHistory.map((item) => {
                    const lang = languages.find(l => l.code === item.target_lang);
                    return (
                        <div
                            key={item.id}
                            className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex items-center justify-between"
                        >
                            <div
                                className="flex-grow cursor-pointer flex items-center gap-4"
                                onClick={() => onSelectHistory(item)}
                            >
                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold text-lg">
                                    {item.word.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 capitalize leading-tight">{item.word}</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {lang && <img src={getFlagUrl(lang.countryCode)} alt={lang.name} className="w-3.5 h-2.5 object-cover rounded-[1px]" />}
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang?.name}</span>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-[10px] font-medium text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteHistory(item.id);
                                }}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
