import React, { useState } from 'react';
import { Habit, AntiHabit } from '../types';
import { AntiHabitCard } from './AntiHabitCard';

interface HabitTrackerProps {
  habits: Habit[];
  antiHabits: AntiHabit[];
  
  onToggleHabit: (id: string, date: string, value: number | boolean) => void;
  onEditHabit: (habit: Habit) => void;
  onDeleteHabit: (id: string) => void;
  onAddHabit: () => void;
  onReorderHabits: (newHabits: Habit[]) => void;
  
  onAddAntiHabit: () => void;
  onEditAntiHabit: (habit: AntiHabit) => void;
  onDeleteAntiHabit: (id: string) => void;
  onRelapseAntiHabit: (id: string) => void;
  onReorderAntiHabits: (newHabits: AntiHabit[]) => void;
}

const WEEKDAYS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

export const HabitTracker: React.FC<HabitTrackerProps> = ({ 
  habits, antiHabits,
  onToggleHabit, onEditHabit, onDeleteHabit, onAddHabit, onReorderHabits,
  onAddAntiHabit, onEditAntiHabit, onDeleteAntiHabit, onRelapseAntiHabit, onReorderAntiHabits
}) => {
  const [activeTab, setActiveTab] = useState<'build' | 'quit'>('build');
  const [editingValue, setEditingValue] = useState<{id: string, date: string} | null>(null);
  const [tempValue, setTempValue] = useState('');
  
  // DRAG & DROP STATE
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // --- ХЕЛПЕРЫ ---
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
  
  const calculateProgress = (habit: Habit) => {
    const now = new Date();
    const goal = habit.targetValue || 1;
    let currentScore = 0;
    let maxPossibleScore = 0;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(now.getFullYear(), now.getMonth(), d);
      const dayOfWeek = date.getDay(); 
      const isScheduled = habit.frequency.days.includes(dayOfWeek);
      if (isScheduled) {
        maxPossibleScore += goal;
        const dateStr = formatDate(date);
        const val = habit.history[dateStr];
        let score = 0;
        if (habit.isMeasurable) { score = Number(val || 0); } else { score = val ? goal : 0; }
        currentScore += Math.min(score, goal);
      }
    }
    if (maxPossibleScore === 0) return 0;
    return Math.min(100, Math.round((currentScore / maxPossibleScore) * 100));
  };

  const getSlotColor = (val: number | boolean, goal: number, isMeasurable: boolean, hasCover: boolean) => {
    const baseEmpty = hasCover ? 'bg-white/10 text-white/40 border border-white/10' : 'bg-black/20 text-white/40 border border-transparent';
    if (!val || val === 0) return baseEmpty;
    if (!isMeasurable) return 'bg-green-500 text-white shadow-lg border-transparent';
    const num = Number(val);
    const percent = (num / goal) * 100;
    if (percent >= 100) return 'bg-green-500 text-white shadow-lg border-transparent';
    if (percent >= 50) return 'bg-orange-500 text-white shadow-md border-transparent';
    return 'bg-red-500 text-white shadow-sm border-transparent';
  };

  const renderSlots = (habit: Habit, hasCover: boolean) => {
    const now = new Date();
    const goal = habit.targetValue || 1;
    const daysToRender: Date[] = [];
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= lastDayOfMonth; d++) {
        const date = new Date(now.getFullYear(), now.getMonth(), d);
        const dayOfWeek = date.getDay();
        if (habit.frequency.days.includes(dayOfWeek)) { daysToRender.push(date); }
    }
    return daysToRender.map(date => {
      const ds = formatDate(date);
      const val = habit.history[ds];
      const isDone = !!val;
      const isToday = ds === formatDate(new Date());
      const bgColor = getSlotColor(val, goal, habit.isMeasurable, hasCover);
      return (
        <button key={ds} onClick={(e) => handleToggle(e, habit, ds)} className={`min-w-[56px] flex flex-col items-center gap-1 py-3 px-1 rounded-2xl transition-all active:scale-95 ${bgColor} ${isToday ? 'ring-2 ring-white/50' : ''}`}>
          <span className="text-[10px] font-black">{formatShortDate(date)}</span>
          <span className={`text-[8px] font-bold ${isDone ? 'opacity-80' : 'opacity-40'}`}>{WEEKDAYS[date.getDay()]}</span>
          <div className={`w-8 h-8 mt-1 rounded-xl flex items-center justify-center border-2 ${isDone ? 'border-white/30' : 'border-white/10'}`}>
            {habit.isMeasurable ? (<span className="text-[10px] font-black">{val || ''}</span>) : (isDone && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>)}
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
    } else { onToggleHabit(habit.id, dateStr, !habit.history[dateStr]); }
  };

  const handleSaveResult = () => {
    if (!editingValue) return;
    const val = tempValue === '' ? 0 : Number(tempValue);
    onToggleHabit(editingValue.id, editingValue.date, val || false);
    setEditingValue(null);
  };

  // --- DRAG AND DROP ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedHabitId(id);
    e.dataTransfer.setData('habitId', id);
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
  };
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedHabitId !== id) { setDropTargetId(id); }
  };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('habitId') || draggedHabitId;
    if (draggedId && draggedId !== targetId) {
        if (activeTab === 'build') {
             const newHabits = [...habits];
             const draggedIdx = newHabits.findIndex(h => h.id === draggedId);
             const targetIdx = newHabits.findIndex(h => h.id === targetId);
             if (draggedIdx > -1 && targetIdx > -1) {
                const [draggedItem] = newHabits.splice(draggedIdx, 1);
                newHabits.splice(targetIdx, 0, draggedItem);
                onReorderHabits(newHabits);
             }
        } else {
             const newHabits = [...antiHabits];
             const draggedIdx = newHabits.findIndex(h => h.id === draggedId);
             const targetIdx = newHabits.findIndex(h => h.id === targetId);
             if (draggedIdx > -1 && targetIdx > -1) {
                const [draggedItem] = newHabits.splice(draggedIdx, 1);
                newHabits.splice(targetIdx, 0, draggedItem);
                onReorderAntiHabits(newHabits);
             }
        }
    }
    setDraggedHabitId(null);
    setDropTargetId(null);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar animate-in fade-in duration-300">
      
      {/* --- 🔥 НОВАЯ ШАПКА (SEGMENTED CONTROL) --- */}
      <div className="px-5 py-2 sticky top-0 z-20 backdrop-blur-md bg-gradient-to-b from-[var(--tg-theme-bg-color)] to-transparent">
        <div className="bg-black/10 p-1.5 rounded-[20px] flex relative border border-white/5 shadow-inner">
           {/* Фон активной вкладки (анимация) */}
           <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-[16px] shadow-md transition-all duration-300 ease-out ${activeTab === 'build' ? 'left-1.5 bg-[#4cc3a1]' : 'left-[calc(50%+3px)] bg-red-500'}`} />
           
           <button 
             onClick={() => setActiveTab('build')} 
             className={`flex-1 relative z-10 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-300 ${activeTab === 'build' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
           >
             Создать
           </button>
           <button 
             onClick={() => setActiveTab('quit')} 
             className={`flex-1 relative z-10 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-300 ${activeTab === 'quit' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
           >
             Бросить
           </button>
        </div>
      </div>

      <div className="p-4 pb-24 flex-1 flex flex-col gap-4">
          
        {/* --- ВКЛАДКА "СОЗДАТЬ" --- */}
        {activeTab === 'build' && (
            habits.length === 0 ? (
                // 🔥 НОВЫЙ EMPTY STATE (ПРОДАЮЩИЙ)
                <div className="flex flex-col items-center justify-center flex-1 min-h-[50vh] text-center gap-6 animate-in zoom-in-95 duration-500">
                    <div className="w-24 h-24 bg-[#4cc3a1]/10 rounded-[32px] flex items-center justify-center text-5xl shadow-[0_0_40px_-10px_rgba(76,195,161,0.3)] animate-pulse">
                        🌱
                    </div>
                    <div className="flex flex-col gap-2 max-w-[250px]">
                        <h3 className="text-lg font-black uppercase tracking-widest tg-text">Время расти</h3>
                        <p className="text-xs tg-hint leading-relaxed">Маленькие шаги ведут к большим переменам. Заведи первую привычку прямо сейчас.</p>
                    </div>
                    <button 
                        onClick={onAddHabit}
                        className="py-4 px-8 bg-[#4cc3a1] text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-[#4cc3a1]/30 active:scale-95 transition-all"
                    >
                        Создать привычку
                    </button>
                </div>
            ) : (
                <>
                    {habits.map(habit => {
                        const progress = calculateProgress(habit);
                        const radius = 10;
                        const circ = 2 * Math.PI * radius;
                        const offset = circ - (progress / 100) * circ;
                        const isTarget = dropTargetId === habit.id;
                        const hasCover = !!habit.fileData && habit.fileData.length > 0;

                        return (
                            <div 
                            key={habit.id} 
                            draggable
                            onDragStart={(e) => handleDragStart(e, habit.id)}
                            onDragOver={(e) => handleDragOver(e, habit.id)}
                            onDrop={(e) => handleDrop(e, habit.id)}
                            onDragEnd={() => { setDraggedHabitId(null); setDropTargetId(null); }}
                            className={`relative overflow-hidden rounded-[32px] shadow-sm p-5 flex flex-col gap-4 transition-all min-h-[140px] cursor-grab active:cursor-grabbing ${isTarget ? 'scale-[1.02] ring-2 ring-blue-500' : ''} ${draggedHabitId === habit.id ? 'opacity-40' : ''} ${!hasCover ? 'tg-secondary-bg border border-gray-400/5' : ''}`}
                            style={hasCover ? {
                                backgroundImage: `url(${habit.fileData})`,
                                backgroundSize: 'cover',
                                backgroundPosition: `50% ${habit.coverPosition ?? 50}%`
                            } : {}}
                            onClick={() => onEditHabit(habit)}
                            >
                                {hasCover && <div className="absolute inset-0 z-0" style={{ backgroundColor: `rgba(0,0,0,${(habit.coverIntensity ?? 60) / 100})` }} />}

                                <div className="relative z-10 flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-2xl ${habit.color} flex items-center justify-center text-2xl shrink-0 shadow-sm border border-white/10`}>{habit.emoji || '🔥'}</div>
                                        <div className="flex flex-col">
                                            <span className={`text-sm font-black uppercase tracking-tight ${hasCover ? 'text-white drop-shadow-md' : 'tg-text'}`}>{habit.title}</span>
                                            {habit.description && (<span className={`text-[10px] line-clamp-1 italic ${hasCover ? 'text-white/70' : 'tg-hint opacity-70'}`}>{habit.description}</span>)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteHabit(habit.id); }} className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${hasCover ? 'bg-white/10 text-white/60 hover:text-white' : 'bg-red-500/5 text-red-500/30 hover:text-red-500'}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                        </button>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black ${hasCover ? 'text-white/80' : 'tg-text opacity-40'}`}>{progress}%</span>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasCover ? 'bg-white/10' : 'border border-gray-400/10 bg-black/5'}`}>
                                                <svg className="w-full h-full -rotate-90" viewBox="0 0 24 24">
                                                    <circle cx="12" cy="12" r={radius} fill="none" stroke="currentColor" strokeWidth="2.5" className={hasCover ? "text-white/10" : "text-gray-400/10"} />
                                                    <circle cx="12" cy="12" r={radius} fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="text-green-500 transition-all duration-700" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative z-10 flex gap-2.5 overflow-x-auto no-scrollbar pb-1 px-0.5">{renderSlots(habit, hasCover)}</div>
                            </div>
                        );
                    })}
                    <button onClick={onAddHabit} className="w-full py-4 rounded-2xl border border-dashed border-gray-400/20 tg-text opacity-50 text-[10px] font-black uppercase tracking-widest hover:opacity-100 hover:bg-black/5 transition-all">
                        + Создать ещё
                    </button>
                </>
            )
        )}

        {/* --- ВКЛАДКА "БРОСИТЬ" --- */}
        {activeTab === 'quit' && (
            antiHabits.length === 0 ? (
                // 🔥 НОВЫЙ EMPTY STATE (ПРОДАЮЩИЙ)
                <div className="flex flex-col items-center justify-center flex-1 min-h-[50vh] text-center gap-6 animate-in zoom-in-95 duration-500">
                    <div className="w-24 h-24 bg-red-500/10 rounded-[32px] flex items-center justify-center text-5xl shadow-[0_0_40px_-10px_rgba(239,68,68,0.3)] animate-pulse">
                        ⛔
                    </div>
                    <div className="flex flex-col gap-2 max-w-[250px]">
                        <h3 className="text-lg font-black uppercase tracking-widest tg-text">Сбрось лишнее</h3>
                        <p className="text-xs tg-hint leading-relaxed">Освободись от того, что тянет тебя назад. Мы поможем считать дни свободы.</p>
                    </div>
                    <button 
                        onClick={onAddAntiHabit}
                        className="py-4 px-8 bg-red-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-red-500/30 active:scale-95 transition-all"
                    >
                        Бросить привычку
                    </button>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-4">
                        {antiHabits.map(h => {
                            const isTarget = dropTargetId === h.id;
                            return (
                                <div
                                    key={h.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, h.id)}
                                    onDragOver={(e) => handleDragOver(e, h.id)}
                                    onDrop={(e) => handleDrop(e, h.id)}
                                    onDragEnd={() => { setDraggedHabitId(null); setDropTargetId(null); }}
                                    className={`transition-all duration-200 ${isTarget ? 'scale-105 opacity-50' : ''} ${draggedHabitId === h.id ? 'opacity-30' : ''}`}
                                >
                                    <AntiHabitCard 
                                        habit={h} 
                                        onEdit={onEditAntiHabit} 
                                        onDelete={onDeleteAntiHabit} 
                                        onRelapse={onRelapseAntiHabit}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <button onClick={onAddAntiHabit} className="w-full py-4 rounded-2xl border border-dashed border-gray-400/20 tg-text opacity-50 text-[10px] font-black uppercase tracking-widest hover:opacity-100 hover:bg-black/5 transition-all">
                        + Бросить что-то ещё
                    </button>
                </>
            )
        )}
      </div>

      {/* МОДАЛКА ВВОДА ЗНАЧЕНИЙ */}
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
