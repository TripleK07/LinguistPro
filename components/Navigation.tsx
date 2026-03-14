
import React, { useState, useEffect } from 'react';
import { DashboardView } from '../types';

interface NavigationProps {
    currentTab: DashboardView;
    setCurrentTab: (tab: DashboardView) => void;
    isGuest?: boolean;
    favoritesCount: number;
    onExitGuest?: () => void;
    onSignOut: () => void;
    userEmail?: string;
}

const Navigation: React.FC<NavigationProps> = ({
    currentTab,
    setCurrentTab,
    isGuest,
    favoritesCount,
    onExitGuest,
    onSignOut,
    userEmail
}) => {
    const [isOthersOpen, setIsOthersOpen] = useState(false);

    const navItems = [
        { id: 'search', label: 'Search', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> },
        { id: 'history', label: 'History', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { id: 'favorites', label: 'Favorite', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg> },
        { id: 'quiz', label: 'Quiz', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { id: 'support', label: 'Donate', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
    ];

    const mobileMainItems = navItems.filter(item => ['search', 'history', 'favorites'].includes(item.id));
    const mobileOtherItems = navItems.filter(item => ['quiz', 'support'].includes(item.id));

    // Close "Others" menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setIsOthersOpen(false);
        if (isOthersOpen) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [isOthersOpen]);

    return (
        <>
            {/* Desktop Sidebar Navigation */}
            <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-white/80 backdrop-blur-xl border-r border-slate-200 z-[60] shadow-xl overflow-hidden">
                <div className="p-6">
                    <div
                        className="flex items-center gap-3 cursor-pointer transition-all hover:scale-105 active:scale-95"
                        onClick={() => setCurrentTab('search')}
                    >
                        <img src="https://cdn-icons-png.flaticon.com/512/3898/3898082.png" alt="Logo" className="w-8 h-8" />
                        <span className="font-extrabold text-slate-900 text-xl tracking-tighter">
                            Linguist<span className="text-indigo-600">Pro</span>
                        </span>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    {navItems.filter(item => !(isGuest && item.id === 'support')).map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setCurrentTab(item.id as DashboardView)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 font-bold text-sm ${currentTab === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 translate-x-1' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                        >
                            <span className={`transition-transform duration-300 ${currentTab === item.id ? 'scale-110' : ''}`}>
                                {item.icon}
                            </span>
                            <span className="flex-1 text-left">{item.label}</span>
                            {item.id === 'favorites' && !isGuest && favoritesCount > 0 && (
                                <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-black ${currentTab === item.id ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'}`}>
                                    {favoritesCount}
                                </span>
                            )}
                            {isGuest && (item.id === 'favorites' || item.id === 'quiz') && (
                                <svg className={`w-3.5 h-3.5 ${currentTab === item.id ? 'text-indigo-200' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    {isGuest ? (
                        <button
                            onClick={onExitGuest}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-2xl text-xs font-black shadow-lg shadow-indigo-100 transition-all active:scale-95 hover:bg-indigo-700 hover:shadow-indigo-200"
                        >
                            Sign Up Now
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                    {userEmail?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Account</p>
                                    <p className="text-[11px] font-bold text-slate-700 truncate">{userEmail}</p>
                                </div>
                            </div>
                            <button
                                onClick={onSignOut}
                                className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-100 hover:bg-red-50 p-3 rounded-2xl text-xs font-bold transition-all active:scale-95"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span>Sign Out</span>
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* Mobile Navigation */}
            <div className="md:hidden">
                {/* Mobile Top Bar */}
                <nav className="bg-white border-b border-slate-200 sticky top-0 z-[60] shadow-sm px-4">
                    <div className="flex justify-between items-center h-14">
                        <div
                            className="flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
                            onClick={() => setCurrentTab('search')}
                        >
                            <img src="https://cdn-icons-png.flaticon.com/512/3898/3898082.png" alt="Logo" className="w-6 h-6" />
                            <span className="font-black text-slate-900 text-base tracking-tighter">
                                Linguist<span className="text-indigo-600">Pro</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            {isGuest ? (
                                <button
                                    onClick={onExitGuest}
                                    className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black shadow-lg shadow-indigo-100 transition-all active:scale-95 hover:bg-indigo-700"
                                >
                                    Sign Up
                                </button>
                            ) : (
                                <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-xl border border-slate-100">
                                    <span className="text-[9px] font-bold text-slate-400 max-w-[80px] truncate">{userEmail}</span>
                                    <div className="w-px h-2.5 bg-slate-200"></div>
                                    <button
                                        onClick={onSignOut}
                                        className="p-0.5 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </nav>

                {/* Mobile Bottom Bar (iOS Modern Look) */}
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] z-[70]">
                    <div className="bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-[32px] p-2 flex items-center justify-between relative overflow-visible">
                        {mobileMainItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setCurrentTab(item.id as DashboardView)}
                                className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-2xl transition-all duration-300 relative ${currentTab === item.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <div className={`transition-transform duration-300 ${currentTab === item.id ? 'scale-110 -translate-y-0.5' : ''}`}>
                                    {item.icon}
                                </div>
                                <span className="text-[9px] font-bold mt-0.5 uppercase tracking-tighter transition-opacity duration-300">
                                    {item.label}
                                </span>
                                {item.id === 'favorites' && !isGuest && favoritesCount > 0 && (
                                    <span className="absolute top-1 right-1/4 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white shadow-md border border-white">
                                        {favoritesCount}
                                    </span>
                                )}
                                {isGuest && item.id === 'favorites' && (
                                    <svg className="absolute top-1 right-1/4 w-2.5 h-2.5 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                )}
                                {currentTab === item.id && (
                                    <div className="absolute -bottom-1 w-1 h-1 bg-indigo-600 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.6)] animate-in fade-in zoom-in duration-300" />
                                )}
                            </button>
                        ))}

                        {/* Others Menu Trigger */}
                        <div className="relative flex-1">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsOthersOpen(!isOthersOpen);
                                }}
                                className={`flex flex-col items-center justify-center w-full py-1.5 rounded-2xl transition-all duration-300 ${isOthersOpen || ['quiz', 'support'].includes(currentTab) ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <div className={`transition-transform duration-300 ${isOthersOpen ? 'rotate-90 scale-110' : ''}`}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16m-7 6h7" />
                                    </svg>
                                </div>
                                <span className="text-[9px] font-bold mt-0.5 uppercase tracking-tighter">Others</span>
                                {!isOthersOpen && ['quiz', 'support'].includes(currentTab) && (
                                    <div className="absolute -bottom-1 w-1 h-1 bg-indigo-600 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.6)]" />
                                )}
                            </button>

                            {/* Others Dropdown Menu */}
                            {isOthersOpen && (
                                <div
                                    className="absolute bottom-[120%] right-0 w-40 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl p-2 animate-in slide-in-from-bottom-4 fade-in duration-300 z-[80]"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="space-y-1">
                                        {mobileOtherItems.filter(item => !(isGuest && item.id === 'support')).map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => {
                                                    setCurrentTab(item.id as DashboardView);
                                                    setIsOthersOpen(false);
                                                }}
                                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${currentTab === item.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {item.icon}
                                                    <span className="text-xs font-bold">{item.label === 'support' ? 'Donate' : item.label}</span>
                                                </div>
                                                {isGuest && item.id === 'quiz' && (
                                                    <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Navigation;
