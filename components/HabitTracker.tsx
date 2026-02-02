import React, { useState, useEffect, useRef } from 'react';
import { Habit, AntiHabit } from '../types';
import { AntiHabitCard } from './AntiHabitCard';

interface HabitTrackerProps {
  habits: Habit[];
  antiHabits: AntiHabit[];
  onToggleHabit: (id: string, date: string, value: boolean | 'mini' | 'freeze') => void;
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
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                     'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Функции расчёта метрик
const calculateCurrentStreak = (habit: Habit): number => {
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
    if (val === true || val === 'mini') {
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

const calculateBestStreak = (habit: Habit): number => {
  let maxStreak = 0;
  let currentStreak = 0;
  const today = new Date();
  const startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  
  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (!habit.frequency.days.includes(dayOfWeek)) continue;
    
    const ds = formatDate(d);
    const val = habit.history[ds];
    
    if (val === 'freeze') continue;
    
    if (val === true || val === 'mini') {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  return maxStreak;
};

const calculateTotalDays = (habit: Habit): number => {
  let total = 0;
  Object.values(habit.history).forEach(val => {
    if (val === true || val === 'mini') total++;
  });
  return total;
};

const calculateWeekdayStats = (habit: Habit) => {
  const stats: { [key: number]: { total: number; completed: number } } = {};
  
  habit.frequency.days.forEach(day => {
    stats[day] = { total: 0, completed: 0 };
  });
  
  const today = new Date();
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
  
  for (let d = new Date(threeMonthsAgo); d <= today; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (!habit.frequency.days.includes(dayOfWeek)) continue;
    
    const ds = formatDate(d);
    const val = habit.history[ds];
    
    if (val !== 'freeze') {
      stats[dayOfWeek].total++;
      if (val === true) stats[dayOfWeek].completed++;
      else if (val === 'mini') stats[dayOfWeek].completed += 0.5;
    }
  }
  
  return stats;
};

export const HabitTracker: React.FC<HabitTrackerProps> = ({ 
  habits, antiHabits,
  onToggleHabit, onEditHabit, onDeleteHabit, onAddHabit, onReorderHabits,
  onAddAntiHabit, onEditAntiHabit, onDeleteAntiHabit, onRelapseAntiHabit, onReorderAntiHabits
}) => {
  const [activeTab, setActiveTab] = useState<'build' | 'quit'>('build');
  const [expandedHabits, setExpandedHabits] = useState<Set<string>>(new Set());
  const [statsTab, setStatsTab] = useState<{ [habitId: string]: 'calendar' | 'charts' | 'badges' }>({});
  const [calendarMonth, setCalendarMonth] = useState<{ [habitId: string]: { year: number; month: number } }>({});
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

  const formatShortDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}.${month}`;
  };

  const toggleExpanded = (habitId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedHabits(prev => {
      const next = new Set(prev);
      if (next.has(habitId)) {
        next.delete(habitId);
      } else {
        next.add(habitId);
        if (!statsTab[habitId]) {
          setStatsTab(prev => ({ ...prev, [habitId]: 'calendar' }));
        }
        if (!calendarMonth[habitId]) {
          const now = new Date();
          setCalendarMonth(prev => ({ ...prev, [habitId]: { year: now.getFullYear(), month: now.getMonth() } }));
        }
      }
      return next;
    });
  };

  const changeStatsTab = (habitId: string, tab: 'calendar' | 'charts' | 'badges', e: React.MouseEvent) => {
    e.stopPropagation();
    setStatsTab(prev => ({ ...prev, [habitId]: tab }));
  };

  const changeCalendarMonth = (habitId: string, direction: 1 | -1) => {
    setCalendarMonth(prev => {
      const current = prev[habitId] || { year: new Date().getFullYear(), month: new Date().getMonth() };
      let newMonth = current.month + direction;
      let newYear = current.year;
      
      if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      } else if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      }
      
      return { ...prev, [habitId]: { year: newYear, month: newMonth } };
    });
  };

  const calculateProgress = (habit: Habit) => {
    const now = new Date();
    let completed = 0;
    let total = 0;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(now.getFullYear(), now.getMonth(), d);
      const dayOfWeek = date.getDay();
      if (habit.frequency.days.includes(dayOfWeek)) {
        const val = habit.history[formatDate(date)];
        if (val === 'freeze') continue;
        total++;
        if (val === true) completed++;
        else if (val === 'mini') completed += 0.5;
      }
    }
    if (total <= 0) return 0;
    return Math.round((completed / total) * 100);
  };

  const getSlotStyle = (val: boolean | 'mini' | 'freeze' | undefined, hasCover: boolean) => {
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

    return {
      className: 'bg-green-500 text-white border border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.5)]',
      type: 'full'
    };
  };

  const handleToggle = (e: React.MouseEvent, habit: Habit, dateStr: string) => {
    e.stopPropagation();
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    
    const current = habit.history[dateStr];
    let newValue: boolean | 'mini' | 'freeze';
    
    if (current === true) {
      newValue = 'mini';
    } else if (current === 'mini') {
      newValue = 'freeze';
    } else if (current === 'freeze') {
      newValue = false;
    } else {
      newValue = true;
    }
    
    onToggleHabit(habit.id, dateStr, newValue);
  };

  const handleLongPress = (e: React.MouseEvent, habit: Habit, dateStr: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, habitId: habit.id, date: dateStr });
  };

  const setStatus = (status: 'mini' | 'freeze' | 'full' | 'reset') => {
    if (!contextMenu) return;
    let val: boolean | 'mini' | 'freeze' = false;
    if (status === 'full') val = true;
    if (status === 'mini') val = 'mini';
    if (status === 'freeze') val = 'freeze';
    onToggleHabit(contextMenu.habitId, contextMenu.date, val);
    setContextMenu(null);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedHabitId(id);
    e.dataTransfer.setData('habitId', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedHabitId !== id) setDropTargetId(id);
  };

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
    setDraggedHabitId(null);
    setDropTargetId(null);
  };

  // Рендер календаря
  const renderCalendarTab = (habit: Habit, hasCover: boolean) => {
    const habitMonth = calendarMonth[habit.id] || { year: new Date().getFullYear(), month: new Date().getMonth() };
    const { year, month } = habitMonth;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
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
      return hasCover ? 'bg-white/20' : 'bg-gray-500/30';
    };

    const currentStreak = calculateCurrentStreak(habit);
    const monthProgress = calculateProgress(habit);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={(e) => { e.stopPropagation(); changeCalendarMonth(habit.id, -1); }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${hasCover ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-black/10 tg-text hover:bg-black/20'}`}
          >
            ←
          </button>
          <span className={`text-xs font-black uppercase ${hasCover ? 'text-white' : 'tg-text'}`}>
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); changeCalendarMonth(habit.id, 1); }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${hasCover ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-black/10 tg-text hover:bg-black/20'}`}
          >
            →
          </button>
        </div>

        <div className="space-y-1">
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

        <div className={`grid grid-cols-2 gap-2 pt-2 border-t ${hasCover ? 'border-white/10' : 'border-black/10'}`}>
          <div className={`p-2 rounded-lg ${hasCover ? 'bg-white/5' : 'bg-black/5'}`}>
            <div className="text-[8px] font-bold uppercase tracking-wide mb-1" style={{ color: hasCover ? 'rgba(255,255,255,0.5)' : 'var(--tg-theme-hint-color)' }}>
              Серия
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px]">🔥</span>
              <span className={`text-sm font-black ${hasCover ? 'text-white' : 'tg-text'}`}>{currentStreak}</span>
            </div>
          </div>
          <div className={`p-2 rounded-lg ${hasCover ? 'bg-white/5' : 'bg-black/5'}`}>
            <div className="text-[8px] font-bold uppercase tracking-wide mb-1" style={{ color: hasCover ? 'rgba(255,255,255,0.5)' : 'var(--tg-theme-hint-color)' }}>
              Выполнено
            </div>
            <div className={`text-sm font-black ${hasCover ? 'text-white' : 'tg-text'}`}>
              {monthProgress}%
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Рендер графиков
  const renderChartsTab = (habit: Habit, hasCover: boolean) => {
    const weekdayStats = calculateWeekdayStats(habit);
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

    return (
      <div className="space-y-4">
        <div>
          <div className={`text-[9px] font-black uppercase tracking-wide mb-3 ${hasCover ? 'text-white/70' : 'tg-hint'}`}>
            📊 По дням недели
          </div>
          <div className="space-y-2">
            {habit.frequency.days.sort().map(day => {
              const stat = weekdayStats[day];
              const percentage = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
              
              return (
                <div key={day} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className={`text-[10px] font-bold ${hasCover ? 'text-white/80' : 'tg-text'}`}>
                      {dayNames[day]}
                    </span>
                    <span className={`text-[9px] font-black ${hasCover ? 'text-white' : 'tg-text'}`}>
                      {percentage}%
                    </span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${hasCover ? 'bg-white/10' : 'bg-black/10'}`}>
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Рендер бейджей
  const renderBadgesTab = (habit: Habit, hasCover: boolean) => {
    const currentStreak = calculateCurrentStreak(habit);
    const bestStreak = calculateBestStreak(habit);
    const totalDays = calculateTotalDays(habit);
    
    const badges = [
      { id: 'fire', emoji: '🔥', title: 'Огонёк', requirement: 7, unlocked: bestStreak >= 7 },
      { id: 'star', emoji: '⭐', title: 'Суперзвезда', requirement: 30, unlocked: bestStreak >= 30 },
      { id: 'diamond', emoji: '💎', title: 'Алмаз', requirement: 100, unlocked: bestStreak >= 100 },
      { id: 'perfect', emoji: '📅', title: 'Идеальный месяц', requirement: 100, unlocked: calculateProgress(habit) === 100 },
    ];

    return (
      <div className="space-y-4">
        <div>
          <div className={`text-[9px] font-black uppercase tracking-wide mb-3 ${hasCover ? 'text-white/70' : 'tg-hint'}`}>
            🏆 Твои достижения
          </div>
          <div className="grid grid-cols-2 gap-2">
            {badges.map(badge => (
              <div
                key={badge.id}
                className={`p-3 rounded-xl transition-all ${
                  badge.unlocked
                    ? hasCover
                      ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30'
                      : 'bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20'
                    : hasCover
                    ? 'bg-white/5 border border-white/10'
                    : 'bg-black/5 border border-black/10'
                }`}
              >
                <div className="text-center">
                  <div className={`text-2xl mb-1 ${!badge.unlocked && 'grayscale opacity-30'}`}>
                    {badge.emoji}
                  </div>
                  <div className={`text-[9px] font-bold ${hasCover ? 'text-white' : 'tg-text'} ${!badge.unlocked && 'opacity-50'}`}>
                    {badge.title}
                  </div>
                  <div className={`text-[7px] mt-0.5 ${hasCover ? 'text-white/50' : 'tg-hint'}`}>
                    {badge.unlocked ? '✓ Разблокирован' : `${badge.requirement} дней`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`grid grid-cols-3 gap-2 pt-3 border-t ${hasCover ? 'border-white/10' : 'border-black/10'}`}>
          <div className={`text-center p-2 rounded-lg ${hasCover ? 'bg-white/5' : 'bg-black/5'}`}>
            <div className={`text-lg font-black ${hasCover ? 'text-white' : 'tg-text'}`}>{currentStreak}</div>
            <div className={`text-[7px] uppercase ${hasCover ? 'text-white/50' : 'tg-hint'}`}>Серия</div>
          </div>
          <div className={`text-center p-2 rounded-lg ${hasCover ? 'bg-white/5' : 'bg-black/5'}`}>
            <div className={`text-lg font-black ${hasCover ? 'text-white' : 'tg-text'}`}>{bestStreak}</div>
            <div className={`text-[7px] uppercase ${hasCover ? 'text-white/50' : 'tg-hint'}`}>Рекорд</div>
          </div>
          <div className={`text-center p-2 rounded-lg ${hasCover ? 'bg-white/5' : 'bg-black/5'}`}>
            <div className={`text-lg font-black ${hasCover ? 'text-white' : 'tg-text'}`}>{totalDays}</div>
            <div className={`text-[7px] uppercase ${hasCover ? 'text-white/50' : 'tg-hint'}`}>Всего</div>
          </div>
        </div>
      </div>
    );
  };

  const renderSlots = (habit: Habit, hasCover: boolean) => {
    const now = new Date();
    const daysToRender: Date[] = [];
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    for (let d = 1; d <= lastDayOfMonth; d++) {
      const date = new Date(now.getFullYear(), now.getMonth(), d);
      if (habit.frequency.days.includes(date.getDay())) {
        daysToRender.push(date);
      }
    }

    return daysToRender.map((date, index) => {
      const ds = formatDate(date);
      const val = habit.history[ds] as boolean | 'mini' | 'freeze' | undefined;
      const { className, type } = getSlotStyle(val, hasCover);
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
                {type === 'full' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="drop-shadow-sm">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
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
              <div className="flex flex-col gap-2 max-w-[250px]">
                <h3 className="text-lg font-black uppercase tg-text">Время расти</h3>
                <p className="text-xs tg-hint">Маленькие шаги ведут к большим переменам.</p>
              </div>
              <button onClick={onAddHabit} className="py-4 px-8 bg-[#4cc3a1] text-white rounded-2xl font-black uppercase text-xs">Создать</button>
            </div>
          ) : (
            <>
              {habits.map(habit => {
                const progress = calculateProgress(habit);
                const streak = calculateCurrentStreak(habit);
                const radius = 16;
                const circ = 2 * Math.PI * radius;
                const offset = circ - (progress / 100) * circ;
                const isTarget = dropTargetId === habit.id;
                const hasCover = !!habit.fileData;
                const isAtomic = !!habit.identity || !!habit.triggerEvent;
                const isExpanded = expandedHabits.has(habit.id);
                const currentStatsTab = statsTab[habit.id] || 'calendar';

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
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[8px]">🔗</span>
                              <span className={`text-[9px] italic ${hasCover ? 'text-white/80' : 'tg-hint'}`}>{habit.triggerEvent}</span>
                            </div>
                          ) : (habit.description && <span className={`text-[9px] line-clamp-1 italic ${hasCover ? 'text-white/70' : 'tg-hint opacity-70'}`}>{habit.description}</span>)}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {streak > 0 && (
                          <div className={`flex items-center gap-0.5 ${hasCover ? 'text-orange-300' : 'text-orange-500'}`}>
                            <span className="text-xs">🔥</span>
                            <span className="text-[10px] font-black">{streak}</span>
                          </div>
                        )}
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
                    
                    <div className="relative z-10 flex overflow-x-auto no-scrollbar pb-1 pt-1 px-1 items-center">
                      {renderSlots(habit, hasCover)}
                    </div>

                    <div className="relative z-10 flex items-center justify-between">
                      <button 
                        onClick={(e) => toggleExpanded(habit.id, e)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[8px] font-bold uppercase tracking-wider ${hasCover ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-black/5 tg-hint hover:bg-black/10'}`}
                      >
                        <span className="text-xs">{isExpanded ? '▲' : '📊'}</span>
                        <span>{isExpanded ? 'Скрыть' : 'Статистика'}</span>
                      </button>
                      
                      <div className="flex items-center gap-2">
                        {habit.reminderEnabled && habit.reminderTime && (
                          <div 
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg ${hasCover ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-500/10 text-blue-500'}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-[10px]">🔔</span>
                            <span className="text-[9px] font-bold">{habit.reminderTime}</span>
                          </div>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDeleteHabit(habit.id); }} 
                          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${hasCover ? 'bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20' : 'bg-red-500/5 text-red-500/30 hover:text-red-500 hover:bg-red-500/10'}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="relative z-10 animate-in slide-in-from-top-2 duration-300">
                        <div className={`p-3 rounded-2xl ${hasCover ? 'bg-black/40 backdrop-blur-sm' : 'bg-black/10'} border border-white/10`}>
                          
                          {/* Табы-пиллы */}
                          <div className="flex gap-2 mb-4">
                            <button
                              onClick={(e) => changeStatsTab(habit.id, 'calendar', e)}
                              className={`flex-1 py-2 px-3 rounded-xl text-[9px] font-bold uppercase tracking-wide transition-all ${
                                currentStatsTab === 'calendar'
                                  ? hasCover
                                    ? 'bg-white text-black'
                                    : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                                  : hasCover
                                  ? 'bg-white/10 text-white/50'
                                  : 'bg-black/10 text-gray-400'
                              }`}
                            >
                              📅 Календарь
                            </button>
                            <button
                              onClick={(e) => changeStatsTab(habit.id, 'charts', e)}
                              className={`flex-1 py-2 px-3 rounded-xl text-[9px] font-bold uppercase tracking-wide transition-all ${
                                currentStatsTab === 'charts'
                                  ? hasCover
                                    ? 'bg-white text-black'
                                    : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                                  : hasCover
                                  ? 'bg-white/10 text-white/50'
                                  : 'bg-black/10 text-gray-400'
                              }`}
                            >
                              📈
                            </button>
                            <button
                              onClick={(e) => changeStatsTab(habit.id, 'badges', e)}
                              className={`flex-1 py-2 px-3 rounded-xl text-[9px] font-bold uppercase tracking-wide transition-all ${
                                currentStatsTab === 'badges'
                                  ? hasCover
                                    ? 'bg-white text-black'
                                    : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                                  : hasCover
                                  ? 'bg-white/10 text-white/50'
                                  : 'bg-black/10 text-gray-400'
                              }`}
                            >
                              🏆
                            </button>
                          </div>

                          {/* Контент вкладок */}
                          <div>
                            {currentStatsTab === 'calendar' && renderCalendarTab(habit, hasCover)}
                            {currentStatsTab === 'charts' && renderChartsTab(habit, hasCover)}
                            {currentStatsTab === 'badges' && renderBadgesTab(habit, hasCover)}
                          </div>
                        </div>
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
                  <div 
                    key={h.id} 
                    draggable 
                    onDragStart={(e) => handleDragStart(e, h.id)} 
                    onDragOver={(e) => handleDragOver(e, h.id)} 
                    onDrop={(e) => handleDrop(e, h.id)} 
                    onDragEnd={() => { setDraggedHabitId(null); setDropTargetId(null); }}
                  >
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
        <div 
          ref={menuRef} 
          className="fixed z-[500] w-40 bg-[#1c1c1e] rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" 
          style={{ top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 170) }}
        >
          <button onClick={() => setStatus('full')} className="p-3 text-left hover:bg-white/5 flex items-center gap-2 text-[10px] font-bold text-white">
            <div className="w-3 h-3 rounded-full bg-green-500" /> Выполнено
          </button>
          <button onClick={() => setStatus('mini')} className="p-3 text-left hover:bg-white/5 flex items-center gap-2 text-[10px] font-bold text-white">
            <div className="w-3 h-3 rounded-full border-2 border-yellow-500" /> Мини-версия
          </button>
          <button onClick={() => setStatus('freeze')} className="p-3 text-left hover:bg-white/5 flex items-center gap-2 text-[10px] font-bold text-white">
            <span className="text-sm">❄️</span> Заморозка
          </button>
          <div className="h-[1px] bg-white/10 mx-2" />
          <button onClick={() => setStatus('reset')} className="p-3 text-left hover:bg-white/5 flex items-center gap-2 text-[10px] font-bold text-red-500">
            Сбросить
          </button>
        </div>
      )}
    </div>
  );
};