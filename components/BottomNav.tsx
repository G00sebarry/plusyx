
import React from 'react';
import { ViewType } from '../types';

interface BottomNavProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeView, onViewChange }) => {
  const getActiveColorClass = (view: ViewType) => {
    if (activeView !== view) return 'text-gray-400 opacity-40';
    
    switch(view) {
      case 'kanban': return 'text-[#9d73d2] dark:text-[#b18cf0] drop-shadow-[0_0_8px_rgba(157,115,210,0.5)]';
      case 'tracker': return 'text-[#4cc3a1] dark:text-[#63e2bf] drop-shadow-[0_0_8px_rgba(76,195,161,0.5)]';
      case 'calendar': return 'text-[#2481cc] dark:text-[#4da3ff] drop-shadow-[0_0_8px_rgba(36,129,204,0.5)]';
      default: return 'text-blue-500';
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 tg-secondary-bg border-t border-gray-400/10 px-4 py-2 pb-8 flex justify-around items-center z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <button 
        onClick={() => onViewChange('kanban')}
        className={`flex flex-col items-center gap-1 transition-all duration-300 flex-1 ${getActiveColorClass('kanban')}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h10"/></svg>
        <span className="text-[9px] font-black uppercase tracking-widest">Доска</span>
      </button>

      <button 
        onClick={() => onViewChange('tracker')}
        className={`flex flex-col items-center gap-1 transition-all duration-300 flex-1 ${getActiveColorClass('tracker')}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"/><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M12 2v2"/><path d="M12 18v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>
        <span className="text-[9px] font-black uppercase tracking-widest">Трекер</span>
      </button>

      <button 
        onClick={() => onViewChange('calendar')}
        className={`flex flex-col items-center gap-1 transition-all duration-300 flex-1 ${getActiveColorClass('calendar')}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
        <span className="text-[9px] font-black uppercase tracking-widest">Календарь</span>
      </button>
    </nav>
  );
};
