import React, { useState } from 'react';
import { Habit } from '../types';

interface HabitTrackerProps {
  habits: Habit[];
  onToggleHabit: (id: string, date: string, value: number | boolean) => void;
  onEditHabit: (habit: Habit) => void;
  onDeleteHabit: (id: string) => void;
  onAddHabit: () => void;
  onReorderHabits: (newHabits: Habit[]) => void;
}

const COLOR_MAP: Record<string, string> = {
  'slate': 'bg-slate-500', 'red': 'bg-red-500', 'orange': 'bg-orange-500', 
  'green': 'bg-green-500', 'blue': 'bg-blue-500', 'purple': 'bg-purple-500', 'pink': 'bg-pink-500',
};

const WEEKDAYS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

export const HabitTracker: React.FC<HabitTrackerProps> = ({ 
  habits, 
  onToggleHabit, 
  onEditHabit, 
  onDeleteHabit, 
  onAddHabit,
  onReorderHabits
}) => {
  const [editingValue, setEditingValue] = useState<{id: string, date: string} | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatShortDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}.${month}`;
  };

  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };

  const calculateProgress = (habit: Habit) => {
    const f = habit.frequency;
    const now = new Date();
    const goal = habit.goalValue || 1;
    let currentScore = 0;
    let maxPossibleScore = 0;

    const getVal = (dateStr: string) => {
      const v = habit.history[dateStr];
      if (habit.isMeasurable) return Number(v || 0);
      return v ? goal : 0;
    };

    if (f.type === 'specific-dates') {
      const dates = f.specificDates || [];
      if (dates.length === 0) return 0;
      maxPossibleScore = dates.length * goal;
      dates.forEach(d => currentScore += Math.min(getVal(d), habit.targetType === 'at-least' ? Infinity : goal));
    
    } else if (f.type === 'quota-week' || f.type === 'quota-month') {
      const targetCount = f.quotaCount || 1;
      let doneTimes = 0;
      Object.keys(habit.history).forEach(dStr => {
        const d = new Date(dStr);
        const isThisPeriod = f.type === 'quota-week' 
          ? (d >= getStartOfWeek(now)) 
          : (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear());
        
        if (isThisPeriod) {
          const val = getVal(dStr);
          if (habit.isMeasurable) {
             if (habit.targetType === 'at-least' ? val >= goal : val <= goal && val > 0) doneTimes++;
          } else if (val > 0) doneTimes++;
        }
      });
      return Math.min(100, Math.round((doneTimes / targetCount) * 100));
      
    } else {
      // --- ИСПРАВЛЕННАЯ ЛОГИКА ТУТ ---
      // Считаем общее количество запланированных дней во ВСЕМ месяце
      const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      
      for (let d = 1; d <= monthDays; d++) {
        const date = new Date(now.getFullYear(), now.getMonth(), d);
        let scheduled = false;
        
        if (f.type === 'daily') scheduled = true;
        else if (f.type === 'even-days') scheduled = d % 2 === 0;
        else if (f.type === 'odd-days') scheduled = d % 2 !== 0;
        else if (f.type === 'presets') {
          const day = date.getDay();
          scheduled = f.preset === 'mon-wed-fri' ? [1,3,5].includes(day) : [2,4,6].includes(day);
        }
        
        if (scheduled) {
          // Всегда добавляем к Максимуму, даже если день в будущем
          maxPossibleScore += goal;
          
          // Добавляем к текущему, если выполнено
          // Ограничиваем значение целью (goal), чтобы перевыполнение за один день не искажало общий %
          const val = getVal(formatDate(date));
          currentScore += Math.min(val, goal); 
        }
      }
    }

    if (maxPossibleScore === 0) return 0;
    return Math.min(100, Math.round((currentScore / maxPossibleScore) * 100));
  };

  const getSlotColor = (val: number | boolean, goal: number, isMeasurable: boolean, targetType: string) => {
    if (!val || val === 0) return 'bg-black/20 text-white/40';
    if (!isMeasurable) return 'bg-green-500 text-white shadow-lg';
    
    const num = Number(val);
    const percent = (num / goal) * 100;
    
    if (targetType === 'at-least') {
      if (percent >= 100) return 'bg-green-500 text-white shadow-lg';
      if (percent >= 50) return 'bg-orange-500 text-white shadow-md';
      return 'bg-red-500 text-white shadow-sm';
    } else {
      if (num <= goal) return 'bg-green-500 text-white shadow-lg';
      return 'bg-red-500 text-white shadow-sm';
    }
  };

  const renderSlots = (habit: Habit) => {
    const f = habit.frequency;
    const now = new Date();
    const goal = habit.goalValue || 1;
    
    let daysToRender: Date[] = [];

    if (f.type === 'specific-dates') {
      daysToRender = (f.specificDates || []).sort().map(d => new Date(d));
    } else if (f.type === 'quota-week' || f.type === 'quota-month') {
        const historyEntries = Object.entries(habit.history).filter(([d, v]) => {
            const date = new Date(d);
            if (f.type === 'quota-week') return date >= getStartOfWeek(now);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).sort((a,b) => a[0].localeCompare(b[0]));

        const count = Math.max(f.quotaCount || 1, historyEntries.length);
        return Array.from({ length: count }).map((_, i) => {
            const entry = historyEntries[i];
            const dStr = entry ? entry[0] : formatDate(now);
            const val = entry ? entry[1] : 0;
            const isDone = !!entry;
            const bgColor = getSlotColor(val, goal, habit.isMeasurable, habit.targetType);

            return (
                <button key={i} onClick={(e) => handleToggle(e, habit, dStr)} className={`min-w-[60px] h-[70px] flex flex-col items-center justify-center rounded-2xl transition-all active:scale-95 ${bgColor}`}>
                    <span className="text-[9px] font-black uppercase mb-1">{isDone ? formatShortDate(new Date(dStr)) : `Цель ${i+1}`}</span>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center border-2 ${isDone ? 'border-white/30' : 'border-black/10'}`}>
                        {habit.isMeasurable ? <span className="text-[10px] font-black">{isDone ? val : ''}</span> : (isDone && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>)}
                    </div>
                    {isDone && <span className="text-[7px] font-black mt-1 opacity-60">{WEEKDAYS[new Date(dStr).getDay()]}</span>}
                </button>
            );
        });
    } else {
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        
        for (let d = 1; d <= lastDayOfMonth; d++) {
            const date = new Date(now.getFullYear(), now.getMonth(), d);
            let scheduled = false;
            
            if (f.type === 'daily') {
                scheduled = true; 
            } else if (f.type === 'even-days') scheduled = d % 2 === 0;
            else if (f.type === 'odd-days') scheduled = d % 2 !== 0;
            else if (f.type === 'presets') {
                const dayOfWeek = date.getDay();
                scheduled = f.preset === 'mon-wed-fri' ? [1,3,5].includes(dayOfWeek) : [2,4,6].includes(dayOfWeek);
            }
            
            if (scheduled) daysToRender.push(date);
        }
    }

    return daysToRender.map(date => {
      const ds = formatDate(date);
      const val = habit.history[ds];
      const isDone = !!val;
      const isToday = ds === formatDate(new Date());
      const bgColor = getSlotColor(val, goal, habit.isMeasurable, habit.targetType);

      return (
        <button key={ds} onClick={(e) => handleToggle(e, habit, ds)} className={`min-w-[56px] flex flex-col items-center gap-1 py-3 px-1 rounded-2xl transition-all active:scale-95 ${bgColor} ${isToday ? 'ring-2 ring-white/50' : ''}`}>
          <span className="text-[10px] font-black">{formatShortDate(date)}</span>
          <span className={`text-[8px] font-bold ${isDone ? 'opacity-80' : 'opacity-40'}`}>{WEEKDAYS[date.getDay()]}</span>
          <div className={`w-8 h-8 mt-1 rounded-xl flex items-center justify-center border-2 ${isDone ? 'border-white/30' : 'border-black/10'}`}>
            {habit.isMeasurable ? <span className="text-[10px] font-black">{val || ''}</span> : (isDone && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>)}
          </div>
        </button>
      );
    });
  };

  const handleToggle = (e: React.MouseEvent, habit: Habit, dateStr: string) => {
    e.stopPropagation();
    if (habit.isMeasurable) {
      const current = habit.history[dateStr] || 0;
      setEditingValue({ id: habit.id, date: dateStr });
      setTempValue(current.toString());
    } else {
      onToggleHabit(habit.id, dateStr, !habit.history[dateStr]);
    }
  };

  const handleSaveResult = () => {
    if (!editingValue) return;
    const val = tempValue === '' ? 0 : Number(tempValue);
    onToggleHabit(editingValue.id, editingValue.date, val || false);
    setEditingValue(null);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedHabitId(id);
    e.dataTransfer.setData('habitId', id);
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedHabitId !== id) {
      setDropTargetId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('habitId') || draggedHabitId;
    if (draggedId && draggedId !== targetId) {
      const newHabits = [...habits];
      const draggedIdx = newHabits.findIndex(h => h.id === draggedId);
      const targetIdx = newHabits.findIndex(h => h.id === targetId);
      
      const [draggedItem] = newHabits.splice(draggedIdx, 1);
      newHabits.splice(targetIdx, 0, draggedItem);
      onReorderHabits(newHabits);
    }
    setDraggedHabitId(null);
    setDropTargetId(null);
  };

  return (
    <div className="p-4 flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-[11px] font-black tg-hint uppercase tracking-[0.2em]">Трекер привычек</h2>
        <button onClick={onAddHabit} className="text-[11px] font-black text-blue-500 uppercase tracking-widest">+ Добавить</button>
      </div>

      <div className="flex flex-col gap-4">
        {habits.map(habit => {
          const progress = calculateProgress(habit);
          const radius = 10;
          const circ = 2 * Math.PI * radius;
          const offset = circ - (progress / 100) * circ;
          const hasCover = !!habit.fileData;
          const isTarget = dropTargetId === habit.id;

          return (
            <div 
              key={habit.id} 
              draggable
              onDragStart={(e) => handleDragStart(e, habit.id)}
              onDragOver={(e) => handleDragOver(e, habit.id)}
              onDrop={(e) => handleDrop(e, habit.id)}
              onDragEnd={() => { setDraggedHabitId(null); setDropTargetId(null); }}
              className={`relative overflow-hidden tg-secondary-bg rounded-[32px] border border-gray-400/5 shadow-sm p-5 flex flex-col gap-4 transition-all min-h-[140px] cursor-grab active:cursor-grabbing ${isTarget ? 'scale-[1.02] border-blue-500/50' : ''} ${draggedHabitId === habit.id ? 'opacity-40' : ''}`} 
              onClick={() => onEditHabit(habit)}
            >
                {hasCover && (
                  <>
                    <img 
                      src={habit.fileData} 
                      className="absolute inset-0 w-full h-full object-cover z-0" 
                      style={{ objectPosition: `50% ${habit.coverPosition ?? 50}%` }}
                    />
                    <div className="absolute inset-0 z-[1]" style={{ backgroundColor: `rgba(0,0,0,${(habit.coverIntensity ?? 60) / 100})` }} />
                  </>
                )}

                <div className="relative z-10 flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${COLOR_MAP[habit.color]}`} />
                        <span className={`text-xs font-black uppercase tracking-tight ${hasCover ? 'text-white' : 'tg-text'}`}>{habit.name}</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDeleteHabit(habit.id); }}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${hasCover ? 'bg-white/10 text-white/40 hover:text-white' : 'bg-red-500/5 text-red-500/30 hover:text-red-500'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                        
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black ${hasCover ? 'text-white/60' : 'tg-text opacity-40'}`}>{progress}%</span>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${hasCover ? 'bg-white/5' : 'border border-gray-400/10'}`}>
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r={radius} fill="none" stroke="currentColor" strokeWidth="2.5" className={hasCover ? "text-white/10" : "text-gray-400/10"} />
                                    <circle cx="12" cy="12" r={radius} fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="text-green-500 transition-all duration-700" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="relative z-10 flex gap-2.5 overflow-x-auto no-scrollbar pb-1 px-0.5">{renderSlots(habit)}</div>
            </div>
          );
        })}
      </div>

      {editingValue && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6" onClick={(e) => e.stopPropagation()}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingValue(null)} />
            <div className="relative w-full max-w-xs tg-secondary-bg rounded-[40px] p-8 shadow-2xl flex flex-col gap-6 border border-gray-400/10">
                <div className="text-center">
                    <h3 className="text-xs font-black tg-text uppercase mb-1">Результат</h3>
                    <p className="text-[10px] tg-hint font-bold">{formatShortDate(new Date(editingValue.date))} ({WEEKDAYS[new Date(editingValue.date).getDay()]})</p>
                </div>
                <input type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} className="w-full p-5 rounded-3xl bg-black/10 tg-text text-center text-4xl font-black outline-none border-2 border-transparent focus:border-blue-500 transition-all" autoFocus />
                <div className="flex flex-col gap-2">
                    <button onClick={handleSaveResult} className="w-full py-5 bg-blue-500 text-white rounded-3xl font-black uppercase text-[10px] tracking-widest active:scale-95">Сохранить</button>
                    <div className="flex gap-2">
                        <button onClick={() => { onToggleHabit(editingValue.id, editingValue.date, false); setEditingValue(null); }} className="flex-1 py-4 bg-red-500/10 text-red-500 rounded-2xl font-black uppercase text-[9px] tracking-widest active:scale-95">Сбросить</button>
                        <button onClick={() => setEditingValue(null)} className="flex-1 py-4 tg-hint font-black uppercase text-[9px] tracking-widest active:scale-95">Отмена</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
