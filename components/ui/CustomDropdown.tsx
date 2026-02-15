
import React, { useState, useRef, useEffect } from 'react';

interface DropdownOption {
  id: string;
  label: string;
  countryCode?: string;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  icon?: React.ReactNode;
}

const getFlagUrl = (countryCode: string) => `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;

export const CustomDropdown: React.FC<CustomDropdownProps> = ({ options, value, onChange, label, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.id === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-1.5 w-full" ref={containerRef}>
      {label && <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 h-[54px] rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all outline-none focus:ring-2 focus:ring-indigo-100 text-left"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {selectedOption.countryCode && (
              <img src={getFlagUrl(selectedOption.countryCode)} className="w-5 h-3.5 object-cover rounded-sm shadow-sm flex-shrink-0" alt="" />
            )}
            {icon && !selectedOption.countryCode && <span className="text-slate-400 flex-shrink-0">{icon}</span>}
            <span className="font-bold text-slate-700 text-sm truncate">{selectedOption.label}</span>
          </div>
          <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] py-2 max-h-64 overflow-y-auto animate-in slide-in-from-top-2 duration-200 scrollbar-hide">
            {options.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-slate-50 ${value === option.id ? 'text-indigo-600 bg-indigo-50 font-bold' : 'text-slate-600'}`}
              >
                {option.countryCode && (
                  <img src={getFlagUrl(option.countryCode)} className="w-5 h-3.5 object-cover rounded-sm shadow-sm" alt="" />
                )}
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
