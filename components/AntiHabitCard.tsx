import React, { useEffect, useState } from 'react';
import { AntiHabit } from '../types';

interface AntiHabitCardProps {
  habit: AntiHabit;
  onRelapse: (id: string) => void;
  onEdit: (habit: AntiHabit) => void;
  onDelete: (id: string) => void;
}

// 🔥 ЭТАПЫ (УРОВНИ СЛОЖНОСТИ)
const MILESTONES = [
  { val: 1000 * 60 * 60 * 24, label: '24 часа' },
  { val: 1000 * 60 * 60 * 24 * 3, label: '3 дня' },
  { val: 1000 * 60 * 60 * 24 * 7, label: '7 дней' },
  { val: 1000 * 60 * 60 * 24 * 14, label: '14 дней' },
  { val: 1000 * 60 * 60 * 24 * 30, label: '30 дней' },
  { val: 1000 * 60 * 60 * 24 * 90, label: '3 мес' },
  { val: 1000 * 60 * 60 * 24 * 180, label: '6 мес' },
  { val: 1000 * 60 * 60 * 24 * 365, label: '1 год' },
  { val: 1000 * 60 * 60 * 24 * 365 * 3, label: '3 года' },
  { val: 1000 * 60 * 60 * 24 * 365 * 5, label: '5 лет' },
  { val: 1000 * 60 * 60 * 24 * 365 * 10, label: '10 лет' },
];

export const AntiHabitCard: React.FC<AntiHabitCardProps> = ({ habit, onRelapse, onEdit, onDelete }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000); 
    return () => clearInterval(interval);
  }, []);

  const diff = now - habit.startDate;
  
  // Форматирование времени (Таймер)
  const getFormattedTime = () => {
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    if (days > 0) {
      return { main: `${days}`, label: 'ДНЕЙ', sub: `${hours}ч ${minutes}м` };
    }
    return { main: `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`, label: '', sub: '' };
  };

  const timeData = getFormattedTime();

  // Логика целей
  const nextMilestone = MILESTONES.find(m => m.val > diff) || MILESTONES[MILESTONES.length - 1];
  const progressPercent = Math.min(100, (diff / nextMilestone.val) * 100);
  
  // Рекорд
  const currentRecord = Math.max(habit.longestStreak, diff);

  // Номер попытки
  const attemptNumber = (habit.history?.length || 0) + 1;

  // Визуал круга
  const radius = 60; 
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progressPercent / 100) * circumference;

  const hasCover = !!habit.fileData;
  const strokeColorClass = habit.color.replace('bg-', 'text-');

  // Умная дата
  const formatDateSmart = (timestamp: number) => {
      const d = new Date(timestamp);
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
      if (d.getFullYear() !== now.getFullYear()) { options.year = 'numeric'; }
      return d.toLocaleDateString('ru-RU', options);
  };

  const handleRelapseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Сбросить таймер? Это значит, что произошел срыв.')) {
        onRelapse(habit.id);
    }
  };

  // Форматирование длительности для рекорда
  const formatDuration = (ms: number) => {
      const d = Math.floor(ms / (1000 * 60 * 60 * 24));
      if (d > 0) return `${d} дн`;
      const h = Math.floor(ms / (1000 * 60 * 60));
      return `${h} час`;
  };

  return (
    <div 
        className={`relative overflow-hidden rounded-[32px] p-5 flex flex-col justify-between min-h-[240px] transition-all active:scale-[0.98] cursor-pointer ${!hasCover ? 'tg-secondary-bg border border-gray-400/5' : 'shadow-lg'} ${hasCover ? 'cover-preserve' : ''}`}
        style={hasCover ? {
            backgroundImage: `url(${habit.fileData})`,
            backgroundSize: 'cover',
            backgroundPosition: `50% ${habit.coverPosition ?? 50}%`
        } : {}}
        onClick={() => onEdit(habit)}
    >
        {/* Overlay */}
        {hasCover && <div className="absolute inset-0 z-0 bg-black/60 backdrop-blur-[1px]" style={{ opacity: (habit.coverIntensity ?? 60) / 100 }} />}

        {/* --- HEADER --- */}
        <div className="relative z-10 flex justify-between items-start">
            <div className="flex items-center gap-2">
                <span className="text-xl shadow-sm">{habit.emoji}</span>
                <span className={`text-sm font-black uppercase tracking-tight ${hasCover ? 'text-white' : 'tg-text'}`}>{habit.title}</span>
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(habit.id); }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-500 transition-colors z-20"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        </div>

        {/* --- CENTER CIRCLE --- */}
        <div className="relative z-10 flex justify-center items-center py-2 flex-1">
            <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-2xl" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r={radius} fill="none" stroke={hasCover ? "rgba(255,255,255,0.1)" : "rgba(128,128,128,0.1)"} strokeWidth="6" />
                    <circle 
                        cx="80" cy="80" r={radius} fill="none" 
                        stroke="currentColor"
                        strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" 
                        className={`transition-all duration-1000 ${strokeColorClass}`}
                    />
                </svg>
                
                <div className="flex flex-col items-center">
                     <span className={`text-3xl font-black ${hasCover ? 'text-white' : 'tg-text'} tracking-tighter`}>{timeData.main}</span>
                     {timeData.label && <span className={`text-[10px] font-bold uppercase tracking-widest ${hasCover ? 'text-white/60' : 'tg-hint'}`}>{timeData.label}</span>}
                     {timeData.sub && <span className={`text-[10px] font-medium mt-1 ${hasCover ? 'text-white/40' : 'tg-hint opacity-50'}`}>{timeData.sub}</span>}
                </div>
            </div>
        </div>

        {/* --- STATS COLUMN (RIGHT SIDE) --- */}
        {/* Распределяем равномерно по высоте: top-14 (отступ от хедера) и bottom-5 (от низа) */}
        <div className="absolute right-5 top-14 bottom-5 z-10 flex flex-col justify-between items-end pointer-events-none">
             {/* Попытка (Верх) */}
             <div className="flex flex-col items-end leading-none">
                <span className={`text-[8px] uppercase font-bold ${hasCover ? 'text-white/40' : 'tg-hint'}`}>Попытка</span>
                <span className={`text-[10px] font-bold ${hasCover ? 'text-white/90' : 'tg-text'}`}>#{attemptNumber}</span>
             </div>
             
             {/* Цель (Середина - выровняется сама благодаря justify-between) */}
             <div className="flex flex-col items-end leading-none">
                <span className={`text-[8px] uppercase font-bold ${hasCover ? 'text-blue-200' : 'text-blue-500'}`}>Цель</span>
                <span className={`text-[10px] font-bold ${hasCover ? 'text-white' : 'tg-text'}`}>{nextMilestone.label}</span>
             </div>

             {/* Рекорд (Низ) */}
             <div className="flex flex-col items-end leading-none">
                <span className={`text-[8px] uppercase font-bold ${hasCover ? 'text-yellow-200' : 'text-orange-500'}`}>Рекорд</span>
                <span className={`text-[10px] font-bold ${hasCover ? 'text-white' : 'tg-text'}`}>{formatDuration(currentRecord)}</span>
             </div>
        </div>

        {/* --- FOOTER (LEFT & CENTER BUTTON) --- */}
        <div className="relative z-10 w-full h-8"> 
            {/* Дата (Слева внизу) */}
            <div className="absolute left-0 bottom-0 flex flex-col gap-0.5">
                 <span className={`text-[8px] uppercase font-bold ${hasCover ? 'text-white/40' : 'tg-hint'}`}>Начало</span>
                 <span className={`text-[10px] font-bold ${hasCover ? 'text-white/80' : 'tg-text'}`}>
                    {formatDateSmart(habit.startDate)}
                 </span>
            </div>

            {/* Кнопка срыва (По центру низа) */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-0">
                <button 
                    onClick={handleRelapseClick}
                    className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95 whitespace-nowrap"
                >
                    Я сорвался
                </button>
            </div>
        </div>
    </div>
  );
};
