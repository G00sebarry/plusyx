import React, { useState, useEffect, useRef } from 'react';
import { Habit, AntiHabit } from '../types';
import { AntiHabitCard } from './AntiHabitCard';

interface HabitTrackerProps {
  habits: Habit[];
  antiHabits: AntiHabit[];
  onToggleHabit: (id: string, date: string, value: number | boolean | 'mini' | 'freeze') => void;
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
const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export const HabitTracker: React.FC<HabitTrackerProps> = ({ 
  habits, antiHabits,
  onToggleHabit, onEditHabit, onDeleteHabit, onAddHabit, onReorderHabits,
  onAddAntiHabit, onEditAntiHabit, onDeleteAntiHabit, onRelapseAntiHabit, onReorderAntiHabits
}) => {
  const [activeTab, setActiveTab] = useState<'build' | 'quit'>('build');
  const [editingValue, setEditingValue] = useState<{id: string, date: string} | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [expandedHeatmaps, setExpandedHeatmaps] = useState<Set<string>>(new Set());
  
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, habitId: string, date: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const toggleHeatmap = (habitId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedHeatmaps(prev => {
      const next = new Set(prev);
      if (next.has(habitId)) next.delete(habitId);
      else next.add(habitId);
      return next;
    });
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
      if (habit.frequency.days.includes(dayOfWeek)) {
        const val = habit.history[formatDate(date)];
        if (val === 'freeze') continue;
        
        maxPossibleScore += goal;
        let score = 0;
        if (val === 'mini') score = goal * 0.5;
        else if (habit.isMeasurable && typeof val === 'number') score = val;
        else if (val === true) score = goal;
        
        currentScore += Math.min(score, goal);
      }
    }
    if (maxPossibleScore <= 0) return 0;
    return Math.min(100, Math.round((currentScore / maxPossibleScore) * 100));
  };

  const calculateStreak = (habit: Habit): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    const checkDate = new Date(today);
    
    for (let i = 0; i < 365; i++) {
      const dayOfWeek = checkDate.getDay();
      
      if (!habit.frequency.days.includes(dayOfWeek)) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      
      const ds = formatDate(checkDate);
      const val = habit.history[ds];
      
      if (val === 'freeze') {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      
      if (val === true || val === 'mini' || (typeof val === 'number' && val > 0)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        if (i === 0 && formatDate(checkDate) === formatDate(today)) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        break;
      }
    }
    return streak;
  };

  const getSlotStyle = (val: number | boolean | 'mini' | 'freeze' | undefined, goal: number, isMeasurable: boolean, hasCover: boolean) => {
    const emptyStyle = hasCover 
        ? 'bg-white/10 border border-white/10 text-white/40' 
        : 'bg-black/20 border border-transparent text-white/30';

    if (!val) return { className: emptyStyle, type: 'empty' };

    if (val === 'freeze') {
        return { 
            className: 'bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.3)]',
            type: 'freeze'
        };
    }

    if (val === 'mini') {
        return {
            className: 'bg-yellow-500/10 border-2 border-yellow-500 text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.2)]',
            type: 'mini'
        };
    }

    let isFull = true;
    if (isMeasurable && typeof val === 'number') {
        const percent = (val / goal) * 100;
        if (percent < 100) isFull = false;
    }

    if (!isFull) {
         return {
            className: 'bg-orange-500/10 border-2 border-orange-500 text-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.2)]',
            type: 'mini'
         };
    }

    return {
        className: 'bg-green-500 text-white border border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.5)]',
        type: 'full'
    };
  };

  const renderMiniHeatmap = (habit: Habit, hasCover: boolean) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    const goal = habit.targetValue || 1;
    
    const weeks: (Date | null)[][] = [];
    let currentWeek: (Date | null)[] = [];
    
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push(null);
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      currentWeek.push(date);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }

    const getHeatmapColor = (date: Date | null) => {
      if (!date) return 'bg-transparent';
      const ds = formatDate(date);
      const val = habit.history[ds];
      const isScheduled = habit.frequency.days.includes(date.getDay());
      
      if (!isScheduled) return hasCover ? 'bg-white/5' : 'bg-gray-500/10';
      if (!val) return hasCover ? 'bg-white/20' : 'bg-gray-500/30';
      
      if (val === 'freeze') return 'bg-cyan-400 shadow-[0_0_6px_cyan]';
      if (val === 'mini') return 'bg-yellow-500 shadow-[0_0_4px_yellow]';
      if (val === true) return 'bg-green-500 shadow-[0_0_6px_lime]';
      if (typeof val === 'number') {
        return val >= goal ? 'bg-green-500 shadow-[0_0_6px_lime]' : 'bg-orange-500 shadow-[0_0_4px_orange]';
      }
      return hasCover ? 'bg-white/20' : 'bg-gray-500/30';
    };

    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

    return (
      <div className={`mt-2 p-3 rounded-2xl ${hasCover ? 'bg-black/40 backdrop-blur-sm' : 'bg-black/10'} border border-white/10`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[9px] font-black uppercase tracking-wider ${hasCover ? 'text-white/70' : 'tg-hint'}`}>
            {monthNames[month]} {year}
          </span>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-sm bg-green-500" />
              <span className={`text-[7px] ${hasCover ? 'text-white/50' : 'tg-hint'}`}>✓</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-sm bg-yellow-500" />
              <span className={`text-[7px] ${hasCover ? 'text-white/50' : 'tg-hint'}`}>Mini</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-sm bg-cyan-400" />
              <span className={`text-[7px] ${hasCover ? 'text-white/50' : 'tg-hint'}`}>❄️</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {WEEKDAYS_SHORT.map(day => (
            <div key={day} className={`text-[7px] text-center font-bold ${hasCover ? 'text-white/40' : 'tg-hint opacity-50'}`}>
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid gap-0.5">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-0.5">
              {week.map((date, di) => {
                const isToday = date && formatDate(date) === formatDate(new Date());
                return (
                  <div 
                    key={di}
                    className={`
                      aspect-square rounded-[3px] transition-all flex items-center justify-center
                      ${getHeatmapColor(date)}
                      ${isToday ? 'ring-1 ring-white scale-110' : ''}
                    `}
                  >
                    {date && (
                      <span className={`text-[6px] font-bold ${hasCover ? 'text-white/60' : 'text-white/80'}`}>
                        {date.getDate()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSlots = (habit: Habit, hasCover: boolean) => {
    const now = new Date();
    const goal = habit.targetValue || 1;
    const daysToRender: Date[] = [];
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    for (let d = 1; d <= lastDayOfMonth; d++) {
        const date = new Date(now.getFullYear(), now.getMonth(), d);
        if (habit.frequency.days.includes(date.getDay())) { daysToRender.push(date); }
    }

    return daysToRender.map((date, index) => {
      const ds = formatDate(date);
      const val = habit.history[ds];
      const { className, type } = getSlotStyle(val, goal, habit.isMeasurable, hasCover);
      const isToday = ds === formatDate(new Date());

      let showBridge = false;
      let bridgeColor = '';

      if (index < daysToRender.length - 1) {
          const nextDate = daysToRender[index + 1];
          const nextDs = formatDate(nextDate);
          const nextVal = habit.history[nextDs];
          
          const diffTime = Math.abs(nextDate.getTime() - date.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

          if (diffDays === 1 && val && nextVal) {
              showBridge = true;
              if (val === 'freeze' || nextVal === 'freeze') bridgeColor = 'bg-cyan-400 shadow-[0_0_10px_cyan]';
              else if (val === 'mini' || nextVal === 'mini') bridgeColor = 'bg-yellow-500/50 shadow-[0_0_5px_yellow]';
              else bridgeColor = 'bg-green-500 shadow-[0_0_10px_lime]';
          }
      }

      return (
        <div key={ds} className="flex items-center">
            <button 
                onClick={(e) => handleToggle(e, habit, ds)}
                onContextMenu={(e) => handleLongPress(e, habit, ds)}
                className={`
                    min-w-[50px] h-[70px] flex flex-col items-center justify-between py-2 px-1 rounded-2xl transition-all relative z-10
                    ${className} ${isToday ? 'ring-2 ring-white scale-105 z-20' : ''}
                `}
            >
                <div className="flex flex-col items-center gap-1 w-full h-full">
                    <span className="text-[10px] font-black">{formatShortDate(date)}</span>
                    <span className="text-[8px] font-bold opacity-60">{WEEKDAYS[date.getDay()]}</span>
                    
                    <div className="flex-1 flex items-center justify-center">
                        {val === 'freeze' && <span className="text-lg drop-shadow-md">❄️</span>}
                        {val === 'mini' && <div className="w-2 h-2 rounded-full bg-current opacity-80" />} 
                        {habit.isMeasurable && typeof val === 'number' && val > 0 && (
                            <span className="text-[9px] font-black">{val}</span>
                        )}
                        {type === 'full' && !habit.isMeasurable && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="drop-shadow-sm"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                    </div>
                </div>
            </button>
            
            {showBridge && (
                <div className={`h-[4px] w-[10px] -mx-1 z-0 relative rounded-full ${bridgeColor} animate-pulse`} />
            )}
            {!showBridge && <div className="w-1.5" />}
        </div>
      );
    });
  };

  const handleToggle = (e: React.MouseEvent, habit: Habit, dateStr: string) => {
    e.stopPropagation();
    if (habit.isMeasurable) {
      const current = habit.history[dateStr];
      const val = typeof current === 'number' ? current : 0;
      setEditingValue({ id: habit.id, date: dateStr });
      setTempValue(val.toString());
    } else { 
      const current = habit.history[dateStr];
      const newValue = current ? false : true;
      onToggleHabit(habit.id, dateStr, newValue); 
    }
  };

  const handleLongPress = (e: React.MouseEvent, habit: Habit, dateStr: string) => {
      e.preventDefault(); e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, habitId: habit.id, date: dateStr });
  };

  const handleSaveResult = () => {
    if (!editingValue) return;
    const val = tempValue === '' ? 0 : Number(tempValue);
    onToggleHabit(editingValue.id, editingValue.date, val || false);
    setEditingValue(null);
  };

  const setStatus = (status: 'mini' | 'freeze' | 'full' | 'reset') => {
      if (!contextMenu) return;
      let val: number | boolean | 'mini' | 'freeze' = false;
      if (status === 'full') val = true;
      if (status === 'mini') val = 'mini';
      if (status === 'freeze') val = 'freeze';
      onToggleHabit(contextMenu.habitId, contextMenu.date, val);
      setContextMenu(null);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => { setDraggedHabitId(id); e.dataTransfer.setData('habitId', id); };
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); if (draggedHabitId !== id) setDropTargetId(id); };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('habitId') || draggedHabitId;
    if (draggedId && draggedId !== targetId) {
        if (activeTab === 'build') {
             const newHabits = [...habits];
             const dIdx = newHabits.findIndex(h => h.id === draggedId);
             const tIdx = newHabits.findIndex(h => h.id === targetId);
             if (dIdx > -1 && tIdx > -1) {
                const [item] = newHabits.splice(dIdx, 1);
                newHabits.splice(tIdx, 0, item);
                onReorderHabits(newHabits);
             }
        } else {
             const newHabits = [...antiHabits];
             const dIdx = newHabits.findIndex(h => h.id === draggedId);
             const tIdx = newHabits.findIndex(h => h.id === targetId);
             if (dIdx > -1 && tIdx > -1) {
                const [item] = newHabits.splice(dIdx, 1);
                newHabits.splice(tIdx, 0, item);
                onReorderAntiHabits(newHabits);
             }
        }
    }
    setDraggedHabitId(null); setDropTargetId(null);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar animate-in fade-in duration-300 relative pb-20">
      
      <div className="px-5 py-2 sticky top-0 z-30 backdrop-blur-md bg-gradient-to-b from-[var(--tg-theme-bg-color)] to-transparent">
        <div className="bg-black/10 p-1.5 rounded-[20px] flex relative border border-white/5 shadow-inner">
           <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-[16px] shadow-md transition-all duration-300 ease-out ${activeTab === 'build' ? 'left-1.5 bg-[#4cc3a1]' : 'left-[calc(50%+3px)] bg-red-500'}`} />
           <button onClick={() => setActiveTab('build')} className={`flex-1 relative z-10 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${activeTab === 'build' ? 'text-white' : 'text-gray-400'}`}>Создать</button>
           <button onClick={() => setActiveTab('quit')} className={`flex-1 relative z-10 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${activeTab === 'quit' ? 'text-white' : 'text-gray-400'}`}>Бросить</button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {activeTab === 'build' && (
            habits.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-6">
                    <div className="w-24 h-24 bg-[#4cc3a1]/10 rounded-[32px] flex items-center justify-center text-5xl animate-pulse">🌱</div>
                    <div className="flex flex-col gap-2 max-w-[250px]"><h3 className="text-lg font-black uppercase tg-text">Время расти</h3><p className="text-xs tg-hint">Маленькие шаги ведут к большим переменам.</p></div>
                    <button onClick={onAddHabit} className="py-4 px-8 bg-[#4cc3a1] text-white rounded-2xl font-black uppercase text-xs">Создать</button>
                </div>
            ) : (
                <>
                    {habits.map(habit => {
                        const progress = calculateProgress(habit);
                        const streak = calculateStreak(habit);
                        const radius = 16;
                        const circ = 2 * Math.PI * radius;
                        const offset = circ - (progress / 100) * circ;
                        const isTarget = dropTargetId === habit.id;
                        const hasCover = !!habit.fileData;
                        const isAtomic = !!habit.identity || !!habit.triggerEvent;
                        const isExpanded = expandedHeatmaps.has(habit.id);

                        return (
                            <div 
                            key={habit.id} 
                            draggable
                            onDragStart={(e) => handleDragStart(e, habit.id)}
                            onDragOver={(e) => handleDragOver(e, habit.id)}
                            onDrop={(e) => handleDrop(e, habit.id)}
                            onDragEnd={() => { setDraggedHabitId(null); setDropTargetId(null); }}
                            className={`relative overflow-hidden rounded-[28px] shadow-sm p-4 flex flex-col gap-3 transition-all min-h-[120px] cursor-grab active:cursor-grabbing ${isTarget ? 'scale-[1.02] ring-2 ring-blue-500' : ''} ${draggedHabitId === habit.id ? 'opacity-40' : ''} ${!hasCover ? 'tg-secondary-bg border border-gray-400/5' : ''}`}
                            style={hasCover ? { backgroundImage: `url(${habit.fileData})`, backgroundSize: 'cover', backgroundPosition: `50% ${habit.coverPosition ?? 50}%` } : {}}
                            onClick={() => onEditHabit(habit)}
                            >
                                {hasCover && <div className="absolute inset-0 z-0" style={{ backgroundColor: `rgba(0,0,0,${(habit.coverIntensity ?? 60) / 100})` }} />}
                                
                                {isAtomic && !hasCover && <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 z-0 pointer-events-none" />}

                                {/* HEADER */}
                                <div className="relative z-10 flex justify-between items-start">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-10 h-10 rounded-xl ${habit.color} flex items-center justify-center text-xl shrink-0 shadow-sm border border-white/10 relative`}>
                                            {habit.emoji || '🔥'}
                                            {isAtomic && <span className="absolute -top-1 -right-1 text-[8px]">⚡️</span>}
                                        </div>
                                        <div className="flex flex-col">
                                            {habit.identity && <div className="self-start px-1.5 py-0.5 rounded-md bg-white/20 backdrop-blur-sm text-[7px] font-black uppercase tracking-widest text-white mb-0.5 shadow-sm border border-white/10 w-fit">{habit.identity}</div>}
                                            <span className={`text-xs font-black uppercase tracking-tight ${hasCover ? 'text-white drop-shadow-md' : 'tg-text'}`}>{habit.title}</span>
                                            {habit.triggerEvent ? (
                                                <div className="flex items-center gap-1 mt-0.5"><span className="text-[8px]">🔗</span><span className={`text-[9px] italic ${hasCover ? 'text-white/80' : 'tg-hint'}`}>{habit.triggerEvent}</span></div>
                                            ) : (habit.description && <span className={`text-[9px] line-clamp-1 italic ${hasCover ? 'text-white/70' : 'tg-hint opacity-70'}`}>{habit.description}</span>)}
                                        </div>
                                    </div>
                                    
                                    {/* STREAK + PROGRESS CIRCLE */}
                                    <div className="flex items-center gap-2">
                                        {streak > 0 && (
                                            <div className={`flex items-center gap-0.5 ${hasCover ? 'text-orange-300' : 'text-orange-500'}`}>
                                                <span className="text-xs">🔥</span>
                                                <span className="text-[10px] font-black">{streak}</span>
                                            </div>
                                        )}
                                        
                                        {/* КРУГ С ПРОЦЕНТАМИ ВНУТРИ */}
                                        <div className="relative w-10 h-10">
                                            <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
                                                <circle cx="20" cy="20" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className={hasCover ? "text-white/10" : "text-gray-400/10"} />
                                                <circle cx="20" cy="20" r={radius} fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="text-green-500 transition-all duration-700" />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className={`text-[9px] font-black ${hasCover ? 'text-white' : 'tg-text'}`}>{progress}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* SLOTS */}
                                <div className="relative z-10 flex overflow-x-auto no-scrollbar pb-1 pt-1 px-1 items-center">
                                    {renderSlots(habit, hasCover)}
                                </div>

                                {/* FOOTER: HEATMAP TOGGLE + DELETE */}
                                <div className="relative z-10 flex items-center justify-between">
                                    <button 
                                      onClick={(e) => toggleHeatmap(habit.id, e)}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[8px] font-bold uppercase tracking-wider ${hasCover ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-black/5 tg-hint hover:bg-black/10'}`}
                                    >
                                      <span className="text-xs">{isExpanded ? '▲' : '📅'}</span>
                                      <span>{isExpanded ? 'Скрыть' : 'Месяц'}</span>
                                    </button>
                                    
                                    {/* КОРЗИНА В УГЛУ */}
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); onDeleteHabit(habit.id); }} 
                                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${hasCover ? 'bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20' : 'bg-red-500/5 text-red-500/30 hover:text-red-500 hover:bg-red-500/10'}`}
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                                      </svg>
                                    </button>
                                </div>

                                {/* MINI HEATMAP */}
                                {isExpanded && (
                                  <div className="relative z-10 animate-in slide-in-from-top-2 duration-300">
                                    {renderMiniHeatmap(habit, hasCover)}
                                  </div>
                                )}
                            </div>
                        );
                    })}
                    <button onClick={onAddHabit} className="w-full py-4 rounded-2xl border border-dashed border-gray-400/20 tg-text opacity-50 text-[10px] font-black uppercase tracking-widest hover:opacity-100">+ Создать ещё</button>
                </>
            )
        )}
        {activeTab === 'quit' && (
            <div className="grid grid-cols-1 gap-4">
    {antiHabits.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-6">
            <div className="w-24 h-24 bg-red-500/10 rounded-[32px] flex items-center justify-center text-5xl animate-pulse">🚫</div>
            <div className="flex flex-col gap-2 max-w-[250px]">
                <h3 className="text-lg font-black uppercase tg-text">Без иллюзий</h3>
                <p className="text-xs tg-hint">Этот счётчик не для мотивации. Это доказательство.</p>
            </div>
            <button onClick={onAddAntiHabit} className="py-4 px-8 bg-red-500 text-white rounded-2xl font-black uppercase text-xs">Бросить</button>
        </div>
    ) : (
        <>
            {antiHabits.map(h => (
                <div key={h.id} draggable onDragStart={(e) => handleDragStart(e, h.id)} onDragOver={(e) => handleDragOver(e, h.id)} onDrop={(e) => handleDrop(e, h.id)} onDragEnd={() => { setDraggedHabitId(null); setDropTargetId(null); }}>
                    <AntiHabitCard habit={h} onEdit={onEditAntiHabit} onDelete={onDeleteAntiHabit} onRelapse={onRelapseAntiHabit} />
                </div>
            ))}
            <button onClick={onAddAntiHabit} className="w-full py-4 rounded-2xl border border-dashed border-gray-400/20 tg-text opacity-50 text-[10px] font-black uppercase tracking-widest hover:opacity-100">+ Бросить ещё</button>
        </>
    )}
</div>

        )}
      </div>

      {contextMenu && (
        <div ref={menuRef} className="fixed z-[500] w-40 bg-[#1c1c1e] rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" style={{ top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 170) }}>
            <button onClick={() => setStatus('full')} className="p-3 text-left hover:bg-white/5 flex items-center gap-2 text-[10px] font-bold text-white"><div className="w-3 h-3 rounded-full bg-green-500" /> Выполнено</button>
            <button onClick={() => setStatus('mini')} className="p-3 text-left hover:bg-white/5 flex items-center gap-2 text-[10px] font-bold text-white"><div className="w-3 h-3 rounded-full border-2 border-yellow-500" /> Мини-версия</button>
            <button onClick={() => setStatus('freeze')} className="p-3 text-left hover:bg-white/5 flex items-center gap-2 text-[10px] font-bold text-white"><span className="text-sm">❄️</span> Заморозка</button>
            <div className="h-[1px] bg-white/10 mx-2" />
            <button onClick={() => setStatus('reset')} className="p-3 text-left hover:bg-white/5 flex items-center gap-2 text-[10px] font-bold text-red-500">Сбросить</button>
        </div>
      )}

      {editingValue && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6" onClick={(e) => e.stopPropagation()}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingValue(null)} />
            <div className="relative w-full max-w-xs bg-[#1c1c1e] rounded-[40px] p-8 shadow-2xl flex flex-col gap-6 border border-white/10">
                <div className="text-center"><h3 className="text-xs font-black text-white uppercase mb-1">Результат</h3><p className="text-[10px] text-gray-400 font-bold">{formatShortDate(new Date(editingValue.date))}</p></div>
                <input type="number" value={tempValue} onChange={e => setTempValue(e.target.value)} className="w-full p-5 rounded-3xl bg-black/20 text-white text-center text-4xl font-black outline-none border-2 border-transparent focus:border-blue-500" autoFocus />
                <div className="flex flex-col gap-2">
                    <button onClick={handleSaveResult} className="w-full py-5 bg-blue-500 text-white rounded-3xl font-black uppercase text-[10px] tracking-widest active:scale-95">Сохранить</button>
                    <div className="flex gap-2"><button onClick={() => { onToggleHabit(editingValue.id, editingValue.date, false); setEditingValue(null); }} className="flex-1 py-4 bg-red-500/10 text-red-500 rounded-2xl font-black uppercase text-[9px] tracking-widest">Сбросить</button><button onClick={() => setEditingValue(null)} className="flex-1 py-4 text-gray-500 font-black uppercase text-[9px] tracking-widest">Отмена</button></div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
