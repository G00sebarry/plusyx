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

export const HabitTracker: React.FC<HabitTrackerProps> = ({ 
  habits, antiHabits,
  onToggleHabit, onEditHabit, onDeleteHabit, onAddHabit, onReorderHabits,
  onAddAntiHabit, onEditAntiHabit, onDeleteAntiHabit, onRelapseAntiHabit, onReorderAntiHabits
}) => {
  const [activeTab, setActiveTab] = useState<'build' | 'quit'>('build');
  const [editingValue, setEditingValue] = useState<{id: string, date: string} | null>(null);
  const [tempValue, setTempValue] = useState('');
  
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
                        const radius = 10;
                        const circ = 2 * Math.PI * radius;
                        const offset = circ - (progress / 100) * circ;
                        const isTarget = dropTargetId === habit.id;
                        const hasCover = !!habit.fileData;
                        const isAtomic = !!habit.identity || !!habit.triggerEvent;

                        return (
                            <div 
                            key={habit.id} 
                            draggable
                            onDragStart={(e) => handleDragStart(e, habit.id)}
                            onDragOver={(e) => handleDragOver(e, habit.id)}
                            onDrop={(e) => handleDrop(e, habit.id)}
                            onDragEnd={() => { setDraggedHabitId(null); setDropTargetId(null); }}
                            className={`relative overflow-hidden rounded-[32px] shadow-sm p-5 flex flex-col gap-4 transition-all min-h-[140px] cursor-grab active:cursor-grabbing ${isTarget ? 'scale-[1.02] ring-2 ring-blue-500' : ''} ${draggedHabitId === habit.id ? 'opacity-40' : ''} ${!hasCover ? 'tg-secondary-bg border border-gray-400/5' : ''}`}
                            style={hasCover ? { backgroundImage: `url(${habit.fileData})`, backgroundSize: 'cover', backgroundPosition: `50% ${habit.coverPosition ?? 50}%` } : {}}
                            onClick={() => onEditHabit(habit)}
                            >
                                {hasCover && <div className="absolute inset-0 z-0" style={{ backgroundColor: `rgba(0,0,0,${(habit.coverIntensity ?? 60) / 100})` }} />}
                                
                                {isAtomic && !hasCover && <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 z-0 pointer-events-none" />}

                                <div className="relative z-10 flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-2xl ${habit.color} flex items-center justify-center text-2xl shrink-0 shadow-sm border border-white/10 relative`}>
                                            {habit.emoji || '🔥'}
                                            {isAtomic && <span className="absolute -top-1 -right-1 text-[10px]">⚡️</span>}
                                        </div>
                                        <div className="flex flex-col">
                                            {habit.identity && <div className="self-start px-2 py-0.5 rounded-md bg-white/20 backdrop-blur-sm text-[8px] font-black uppercase tracking-widest text-white mb-1 shadow-sm border border-white/10 w-fit">{habit.identity}</div>}
                                            <span className={`text-sm font-black uppercase tracking-tight ${hasCover ? 'text-white drop-shadow-md' : 'tg-text'}`}>{habit.title}</span>
                                            {habit.triggerEvent ? (
                                                <div className="flex items-center gap-1 mt-0.5"><span className="text-[10px]">🔗</span><span className={`text-[10px] italic ${hasCover ? 'text-white/80' : 'tg-hint'}`}>{habit.triggerEvent}</span></div>
                                            ) : (habit.description && <span className={`text-[10px] line-clamp-1 italic ${hasCover ? 'text-white/70' : 'tg-hint opacity-70'}`}>{habit.description}</span>)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteHabit(habit.id); }} className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${hasCover ? 'bg-white/10 text-white/60 hover:text-white' : 'bg-red-500/5 text-red-500/30 hover:text-red-500'}`}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black ${hasCover ? 'text-white/80' : 'tg-text opacity-40'}`}>{progress}%</span>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasCover ? 'bg-white/10' : 'border border-gray-400/10 bg-black/5'}`}>
                                                <svg className="w-full h-full -rotate-90" viewBox="0 0 24 24"><circle cx="12" cy="12" r={radius} fill="none" stroke="currentColor" strokeWidth="2.5" className={hasCover ? "text-white/10" : "text-gray-400/10"} /><circle cx="12" cy="12" r={radius} fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="text-green-500 transition-all duration-700" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative z-10 flex overflow-x-auto no-scrollbar pb-2 pt-2 px-1 items-center">
                                    {renderSlots(habit, hasCover)}
                                </div>
                            </div>
                        );
                    })}
                    <button onClick={onAddHabit} className="w-full py-4 rounded-2xl border border-dashed border-gray-400/20 tg-text opacity-50 text-[10px] font-black uppercase tracking-widest hover:opacity-100">+ Создать ещё</button>
                </>
            )
        )}
        {activeTab === 'quit' && (
            <div className="grid grid-cols-1 gap-4">
                {antiHabits.length === 0 && <div className="text-center py-20 opacity-50">Здесь пусто. Добавь вредную привычку.</div>}
                {antiHabits.map(h => (
                    <div key={h.id} draggable onDragStart={(e) => handleDragStart(e, h.id)} onDragOver={(e) => handleDragOver(e, h.id)} onDrop={(e) => handleDrop(e, h.id)} onDragEnd={() => { setDraggedHabitId(null); setDropTargetId(null); }}>
                        <AntiHabitCard habit={h} onEdit={onEditAntiHabit} onDelete={onDeleteAntiHabit} onRelapse={onRelapseAntiHabit} />
                    </div>
                ))}
                {antiHabits.length > 0 && <button onClick={onAddAntiHabit} className="w-full py-4 rounded-2xl border border-dashed border-gray-400/20 tg-text opacity-50 text-[10px] font-black uppercase tracking-widest hover:opacity-100">+ Бросить ещё</button>}
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
