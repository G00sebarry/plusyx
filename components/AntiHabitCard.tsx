import React, { useEffect, useState } from 'react';
import { AntiHabit } from '../types';

interface AntiHabitCardProps {
  habit: AntiHabit;
  onRelapse: (id: string) => void;
  onEdit: (habit: AntiHabit) => void;
  onDelete: (id: string) => void;
}

export const AntiHabitCard: React.FC<AntiHabitCardProps> = ({ habit, onRelapse, onEdit, onDelete }) => {
  const [now, setNow] = useState(Date.now());

  // Живой таймер: обновляется каждую секунду
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000); 
    return () => clearInterval(interval);
  }, []);

  const diff = now - habit.startDate;
  
  // Логика форматирования времени
  const getFormattedTime = () => {
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    // Если прошло больше 0 дней, показываем дни крупно, а часы мелко
    if (days > 0) {
      return { main: `${days}`, label: 'ДНЕЙ', sub: `${hours}ч ${minutes}м` };
    }
    // Если меньше дня - показываем детальный таймер 00:00:00
    return { main: `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`, label: '', sub: '' };
  };

  const timeData = getFormattedTime();

  // Расчет кольца прогресса
  // Цель по умолчанию: либо Рекорд, либо (если рекорда нет) 7 дней для красоты
  const target = habit.goal || (habit.longestStreak > 0 ? habit.longestStreak : 1000 * 60 * 60 * 24 * 7); 
  const progressPercent = Math.min(100, (diff / target) * 100);
  
  // Параметры SVG кольца
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progressPercent / 100) * circumference;

  const hasCover = !!habit.fileData;

  // Хак для цвета: превращаем "bg-red-500" в "text-red-500" для SVG
  const strokeColorClass = habit.color.replace('bg-', 'text-');

  const handleRelapseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Сбросить таймер? Это значит, что произошел срыв.')) {
        onRelapse(habit.id);
    }
  };

  return (
    <div 
        className={`relative overflow-hidden rounded-[32px] p-5 flex flex-col justify-between min-h-[220px] transition-all active:scale-[0.98] cursor-pointer ${!hasCover ? 'tg-secondary-bg border border-gray-400/5' : 'shadow-lg'}`}
        style={hasCover ? {
            backgroundImage: `url(${habit.fileData})`,
            backgroundSize: 'cover',
            backgroundPosition: `50% ${habit.coverPosition ?? 50}%`
        } : {}}
        onClick={() => onEdit(habit)}
    >
        {/* Затемнение фона (если есть картинка) */}
        {hasCover && <div className="absolute inset-0 z-0 bg-black/60 backdrop-blur-[1px]" style={{ opacity: (habit.coverIntensity ?? 60) / 100 }} />}

        {/* --- ВЕРХНЯЯ ЧАСТЬ (Заголовок) --- */}
        <div className="relative z-10 flex justify-between items-start">
            <div className="flex items-center gap-2">
                <span className="text-xl shadow-sm">{habit.emoji}</span>
                <span className={`text-sm font-black uppercase tracking-tight ${hasCover ? 'text-white' : 'tg-text'}`}>{habit.title}</span>
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(habit.id); }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-500 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        </div>

        {/* --- ЦЕНТР (Кольцо и Таймер) --- */}
        <div className="relative z-10 flex justify-center items-center py-4">
            <div className="relative w-32 h-32 flex items-center justify-center">
                {/* SVG Кольцо */}
                <svg className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-2xl">
                    {/* Серая подложка кольца */}
                    <circle cx="64" cy="64" r={radius} fill="none" stroke={hasCover ? "rgba(255,255,255,0.1)" : "rgba(128,128,128,0.1)"} strokeWidth="6" />
                    {/* Цветное кольцо прогресса */}
                    <circle 
                        cx="64" cy="64" r={radius} fill="none" 
                        stroke="currentColor"
                        strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" 
                        className={`transition-all duration-1000 ${strokeColorClass}`}
                    />
                </svg>
                
                {/* Текст внутри кольца */}
                <div className="flex flex-col items-center">
                     <span className={`text-3xl font-black ${hasCover ? 'text-white' : 'tg-text'} tracking-tighter`}>{timeData.main}</span>
                     {timeData.label && <span className={`text-[10px] font-bold uppercase tracking-widest ${hasCover ? 'text-white/60' : 'tg-hint'}`}>{timeData.label}</span>}
                     {timeData.sub && <span className={`text-[10px] font-medium mt-1 ${hasCover ? 'text-white/40' : 'tg-hint opacity-50'}`}>{timeData.sub}</span>}
                </div>
            </div>
        </div>

        {/* --- НИЖНЯЯ ЧАСТЬ (Дата и Кнопка) --- */}
        <div className="relative z-10 flex justify-between items-end">
            <div className="flex flex-col gap-0.5">
                 <span className={`text-[9px] uppercase font-bold ${hasCover ? 'text-white/40' : 'tg-hint'}`}>Начало</span>
                 <span className={`text-[10px] font-bold ${hasCover ? 'text-white/80' : 'tg-text'}`}>
                    {new Date(habit.startDate).toLocaleDateString('ru-RU', {day: 'numeric', month: 'short'})}
                 </span>
            </div>

            <button 
                onClick={handleRelapseClick}
                className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95"
            >
                Я сорвался
            </button>
            
            <div className="flex flex-col gap-0.5 items-end">
                 <span className={`text-[9px] uppercase font-bold ${hasCover ? 'text-white/40' : 'tg-hint'}`}>Рекорд</span>
                 <span className={`text-[10px] font-bold ${hasCover ? 'text-white/80' : 'tg-text'}`}>
                    {Math.floor(habit.longestStreak / (1000 * 60 * 60 * 24))} дн
                 </span>
            </div>
        </div>
    </div>
  );
};
