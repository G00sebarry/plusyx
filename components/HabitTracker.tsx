import React, { useState, useEffect, useRef } from 'react';
import { Habit, AntiHabit } from '../types';
import { AntiHabitCard } from './AntiHabitCard';

interface HabitTrackerProps {
  habits: Habit[];
  antiHabits: AntiHabit[];
  onToggleHabit: (id: string, date: string, value: boolean | 'mini' | 'freeze') => void;
  onEditHabit: (habit: Habit) => void;
  onDeleteHabit: (id: string) => void;
  onArchiveHabit: (id: string) => void;
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

// Проверяет запланирован ли день: по дню недели ИЛИ по кастомной дате
const isDateScheduled = (habit: Habit, date: Date): boolean => {
  if (habit.frequency.days.includes(date.getDay())) return true;
  if (habit.frequency.customDates && habit.frequency.customDates.length > 0) {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return habit.frequency.customDates.includes(dateStr);
  }
  return false;
};

// Типы достижений
interface Achievement {
  id: string;
  emoji: string;
  name: string;
  description: string;
  type: 'streak' | 'count';
  requirement: number;
  unlocked: boolean;
  progress: number;
}

export const HabitTracker: React.FC<HabitTrackerProps> = ({ 
  habits, antiHabits,
  onToggleHabit, onEditHabit, onDeleteHabit, onArchiveHabit, onAddHabit, onReorderHabits,
  onAddAntiHabit, onEditAntiHabit, onDeleteAntiHabit, onRelapseAntiHabit, onReorderAntiHabits
}) => {
  const [activeTab, setActiveTab] = useState<'build' | 'quit'>('build');
  const [expandedHabits, setExpandedHabits] = useState<Set<string>>(new Set());
  const [statsTab, setStatsTab] = useState<{[key: string]: 'calendar' | 'charts' | 'achievements'}>({});
  const [chartPeriod, setChartPeriod] = useState<{[key: string]: 'week' | 'month' | 'year'}>({});
  const [selectedAchievement, setSelectedAchievement] = useState<{habitId: string, achievement: Achievement} | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, habitId: string, date: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef<number | null>(null);
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [freezeWarnings, setFreezeWarnings] = useState<Set<string>>(new Set());
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('dismissedFreezeWarnings');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [calendarMonth, setCalendarMonth] = useState<{[key: string]: {year: number, month: number}}>({});
  const [chartHover, setChartHover] = useState<{ habitId: string; pointIndex: number } | null>(null);
  const [growthInfoHabitId, setGrowthInfoHabitId] = useState<string | null>(null);
  // 💤 Меню выбора при тапе на 🗑️: id привычки + позиция меню
  const [deleteMenu, setDeleteMenu] = useState<{ habitId: string; x: number; y: number } | null>(null);
  // 💤 Подтверждение отправки в спячку
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Восстановление скролла после ререндера
  useEffect(() => {
    if (savedScrollRef.current !== null && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollRef.current;
      savedScrollRef.current = null;
    }
  });

  const saveScrollPosition = () => {
    if (scrollContainerRef.current) {
      savedScrollRef.current = scrollContainerRef.current.scrollTop;
    }
  };

  // Проверка на 3 заморозки подряд
  useEffect(() => {
    const newWarnings = new Set<string>();
    habits.forEach(habit => {
      if (hasThreeConsecutiveFreezes(habit)) {
        newWarnings.add(habit.id);
      }
    });
    setFreezeWarnings(newWarnings);
  }, [habits]);

  // Авто-скролл к сегодняшнему дню на мобилке (только при смене таба, не при каждом обновлении)
  const initialScrollDone = useRef(false);
  useEffect(() => {
    initialScrollDone.current = false;
  }, [activeTab]);
  
  useEffect(() => {
    if (initialScrollDone.current) return;
    const timer = setTimeout(() => {
      const todaySlots = document.querySelectorAll('[data-today="true"]');
      todaySlots.forEach(el => {
        el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      });
      initialScrollDone.current = true;
    }, 300);
    return () => clearTimeout(timer);
  }, [habits, activeTab]);

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

  // День релевантен если запланирован ИЛИ уже есть отметка в истории
  const isDateRelevant = (habit: Habit, date: Date): boolean => {
    if (isDateScheduled(habit, date)) return true;
    return habit.history[formatDate(date)] !== undefined;
  };

  const toggleExpanded = (habitId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedHabits(prev => {
      const next = new Set(prev);
      if (next.has(habitId)) {
        next.delete(habitId);
        // Сбросить таб при закрытии
        setStatsTab(prev => {
          const newTabs = {...prev};
          delete newTabs[habitId];
          return newTabs;
        });
      } else {
        next.add(habitId);
        // Установить календарь по умолчанию
        setStatsTab(prev => ({...prev, [habitId]: 'calendar'}));
      }
      return next;
    });
  };

  const setHabitStatsTab = (habitId: string, tab: 'calendar' | 'charts' | 'achievements') => {
    setStatsTab(prev => ({...prev, [habitId]: tab}));
  };

  const setHabitChartPeriod = (habitId: string, period: 'week' | 'month' | 'year') => {
    setChartPeriod(prev => ({...prev, [habitId]: period}));
  };

  const dismissFreezeWarning = (habitId: string) => {
    const newDismissed = new Set(dismissedWarnings);
    newDismissed.add(habitId);
    setDismissedWarnings(newDismissed);
    localStorage.setItem('dismissedFreezeWarnings', JSON.stringify([...newDismissed]));
  };

  const changeCalendarMonth = (habitId: string, direction: 'prev' | 'next') => {
    const current = calendarMonth[habitId] || { year: new Date().getFullYear(), month: new Date().getMonth() };
    let newMonth = current.month + (direction === 'next' ? 1 : -1);
    let newYear = current.year;
    
    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    } else if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }
    
    setCalendarMonth(prev => ({...prev, [habitId]: {year: newYear, month: newMonth}}));
  };

  // =====================================================
  // УТИЛИТЫ ДЛЯ РАСЧЁТОВ
  // =====================================================

  const isCompleted = (value: any) => value === true || value === 'mini';

  // Проверка на 3 заморозки подряд
  const hasThreeConsecutiveFreezes = (habit: Habit): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let freezeCount = 0;

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      
      if (!isDateRelevant(habit, checkDate)) continue;
      
      const ds = formatDate(checkDate);
      const val = habit.history[ds];
      
      if (val === 'freeze') {
        freezeCount++;
        if (freezeCount >= 3) return true;
      } else if (val !== undefined) {
        freezeCount = 0;
      }
    }
    return false;
  };

  // Текущая серия (до сегодня)
  const getCurrentStreak = (habit: Habit): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 💤 Серия не может быть длиннее текущего цикла (после пробуждения)
    const effectiveStart = getEffectiveStartDate(habit);
    let streak = 0;
    const checkDate = new Date(today);
    
    for (let i = 0; i < 365; i++) {
      // 💤 Если ушли левее начала цикла — стоп
      if (effectiveStart && checkDate < effectiveStart) break;
      
      if (!isDateRelevant(habit, checkDate)) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      const ds = formatDate(checkDate);
      const val = habit.history[ds];
      
      // Заморозка прерывает серию
      if (val === 'freeze') break;
      
      if (isCompleted(val)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // Если сегодня не выполнено, пропускаем один день
        if (i === 0 && formatDate(checkDate) === formatDate(today)) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        break;
      }
    }
    return streak;
  };

  // Лучшая серия в ТЕКУЩЕМ цикле (после последнего пробуждения)
  // Личный рекорд за всё время хранится в habit.allTimeBestStreak отдельно.
  const getBestStreak = (habit: Habit): number => {
    // 💤 Считаем только ключи из текущего цикла
    const sortedDates = getCurrentCycleHistoryKeys(habit).sort();
    let maxStreak = 0;
    let currentStreak = 0;
    let prevDate: Date | null = null;

    for (const dateStr of sortedDates) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      date.setHours(0, 0, 0, 0);
      
      if (!isDateRelevant(habit, date)) continue;
      
      const val = habit.history[dateStr];
      
      // Заморозка прерывает серию
      if (val === 'freeze') {
        currentStreak = 0;
        prevDate = null;
        continue;
      }
      
      if (isCompleted(val)) {
        // Проверяем непрерывность
        if (prevDate) {
          let isConsecutive = true;
          const checkDate = new Date(prevDate);
          checkDate.setDate(checkDate.getDate() + 1);
          
          while (checkDate < date) {
            if (isDateRelevant(habit, checkDate)) {
              isConsecutive = false;
              break;
            }
            checkDate.setDate(checkDate.getDate() + 1);
          }
          
          if (!isConsecutive) {
            currentStreak = 1;
          } else {
            currentStreak++;
          }
        } else {
          currentStreak = 1;
        }
        
        maxStreak = Math.max(maxStreak, currentStreak);
        prevDate = date;
      } else {
        currentStreak = 0;
        prevDate = null;
      }
    }
    
    return maxStreak;
  };

  // 💤 Личный рекорд за всё время: max между сохранённым в БД и текущим циклом
  const getAllTimeBestStreak = (habit: Habit): number => {
    return Math.max(habit.allTimeBestStreak || 0, getBestStreak(habit));
  };

  // Общее количество выполнений
  const getTotalCompletions = (habit: Habit): number => {
    let count = 0;
    for (const dateStr in habit.history) {
      const val = habit.history[dateStr];
      if (isCompleted(val)) count++;
    }
    return count;
  };

  // Процент выполнения за период (скользящий)
  const getCompletionRate = (habit: Habit, days: number): { completed: number, frozen: number, missed: number, total: number, percentage: number } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 💤 Не считаем дни до пробуждения
    const effectiveStart = getEffectiveStartDate(habit);
    let completed = 0;
    let frozen = 0;
    let missed = 0;
    let total = 0;
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // 💤 Дни до начала цикла не считаются
      if (effectiveStart && date < effectiveStart) break;
      
      if (!isDateRelevant(habit, date)) continue;
      
      const key = formatDate(date);
      const val = habit.history[key];
      
      if (val === 'freeze') {
        frozen++;
        // Заморозка не учитывается в total
      } else {
        total++;
        if (isCompleted(val)) {
          completed++;
        } else {
          missed++;
        }
      }
    }
    
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, frozen, missed, total, percentage };
  };

  // Процент заморозок за год
  const getFreezePercentage = (habit: Habit): number => {
    const stats = getCompletionRate(habit, 365);
    const totalScheduled = stats.completed + stats.frozen + stats.missed;
    if (totalScheduled === 0) return 0;
    return Math.round((stats.frozen / totalScheduled) * 100);
  };

  // Проверка на 3 идеальных месяца подряд
  const hasThreePerfectMonths = (habit: Habit): boolean => {
    const today = new Date();
    let perfectMonths = 0;

    for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
      const checkDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
      const year = checkDate.getFullYear();
      const month = checkDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      let scheduledDays = 0;
      let completedDays = 0;
      
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        
        if (isDateRelevant(habit, date)) {
          scheduledDays++;
          const val = habit.history[formatDate(date)];
          if (val === 'freeze') continue; // Заморозка не учитывается
          if (isCompleted(val)) completedDays++;
        }
      }
      
      if (scheduledDays > 0 && completedDays === scheduledDays) {
        perfectMonths++;
      } else {
        break;
      }
    }
    
    return perfectMonths >= 3;
  };

  // Статистика за текущий месяц
  const getThisMonthStats = (habit: Habit) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let scheduledDays = 0;
    let completedFull = 0; // только true (✅)
    let completedMini = 0; // только mini (🔸)
    let frozen = 0;        // freeze (❄️)
    let missed = 0;        // не отмечено
    
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      
      if (isDateRelevant(habit, date)) {
        scheduledDays++;
        const ds = formatDate(date);
        const val = habit.history[ds];
        
        if (val === true) completedFull++;
        else if (val === 'mini') completedMini++;
        else if (val === 'freeze') frozen++;
        else missed++;
      }
    }
    
    return { scheduledDays, completedFull, completedMini, frozen, missed };
  };

  // =====================================================
  // 📈 РОСТ (1% better every day — Atomic Habits / James Clear)
  // =====================================================

  /**
   * 💤 Возвращает эффективную дату начала отсчёта для метрик.
   * Если у привычки есть reactivatedAt (пробудилась после спячки) — используем её.
   * Иначе — дату первой отметки в истории.
   * Возвращает null, если истории нет вообще.
   */
  const getEffectiveStartDate = (habit: Habit): Date | null => {
    // Если есть reactivatedAt — это новая точка отсчёта
    if (habit.reactivatedAt) {
      const d = new Date(habit.reactivatedAt);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    // Иначе берём самую раннюю отметку
    const historyKeys = Object.keys(habit.history).sort();
    if (historyKeys.length === 0) return null;
    const [sy, sm, sd] = historyKeys[0].split('-').map(Number);
    const d = new Date(sy, sm - 1, sd);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  /**
   * 💤 Возвращает только те ключи истории, которые входят в текущий цикл
   * (т.е. >= effectiveStartDate). Используется в getBestStreak и getTotalCompletions.
   */
  const getCurrentCycleHistoryKeys = (habit: Habit): string[] => {
    const start = getEffectiveStartDate(habit);
    if (!start) return [];
    return Object.keys(habit.history).filter(ds => {
      const [y, m, d] = ds.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      date.setHours(0, 0, 0, 0);
      return date >= start;
    });
  };

  /**
   * Считает множитель роста привычки от первой отметки (или пробуждения) до сегодня.
   * Логика:
   *   Запланированный день: ✅ ×1.01 | 🔸 ×1.005 | ❄️ ×1.00 | пропуск ×0.99
   *   Незапланированный день: ✅ ×1.01 (бонус!) | 🔸 ×1.005 | прочее ×1.00 (не штрафуем)
   */
  const calculateGrowth = (habit: Habit): { growth: number; daysSinceStart: number; hasStarted: boolean } => {
    // 💤 Точка отсчёта: reactivatedAt либо первая отметка
    const startDate = getEffectiveStartDate(habit);
    if (!startDate) {
      return { growth: 1, daysSinceStart: 0, hasStarted: false };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let growth = 1;
    let dayCount = 0;
    const cursor = new Date(startDate);

    while (cursor <= today) {
      dayCount++;
      const ds = formatDate(cursor);
      const val = habit.history[ds];
      const scheduled = isDateScheduled(habit, cursor);

      if (scheduled) {
        if (val === true) growth *= 1.01;
        else if (val === 'mini') growth *= 1.005;
        else if (val === 'freeze') growth *= 1.00;
        else growth *= 0.99;
      } else {
        if (val === true) growth *= 1.01;
        else if (val === 'mini') growth *= 1.005;
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return { growth, daysSinceStart: dayCount, hasStarted: true };
  };

  /**
   * Тренд роста за последние N дней (для цвета числа в шапке)
   */
  const getRecentGrowthTrend = (habit: Habit, days: number): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let trend = 1;

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const ds = formatDate(date);
      const val = habit.history[ds];
      const scheduled = isDateScheduled(habit, date);

      if (scheduled) {
        if (val === true) trend *= 1.01;
        else if (val === 'mini') trend *= 1.005;
        else if (val === 'freeze') trend *= 1.00;
        else trend *= 0.99;
      } else {
        if (val === true) trend *= 1.01;
        else if (val === 'mini') trend *= 1.005;
      }
    }

    return trend;
  };

  /** CSS-класс цвета по тренду */
  const getGrowthColor = (trend: number, hasCover: boolean): string => {
    if (trend > 1.01) return hasCover ? 'text-green-300' : 'text-green-500';
    if (trend < 0.99) return hasCover ? 'text-red-300' : 'text-red-500';
    return hasCover ? 'text-yellow-300' : 'text-yellow-500';
  };

  /** Форматирование множителя: ×1.42, ×2.5, ×37 */
  const formatGrowth = (growth: number): string => {
    if (growth >= 10) return `×${growth.toFixed(0)}`;
    if (growth >= 2) return `×${growth.toFixed(1)}`;
    return `×${growth.toFixed(2)}`;
  };

  /** Форматирование процента: +42%, -22% */
  const formatGrowthPercent = (growth: number): string => {
    const percent = Math.round((growth - 1) * 100);
    if (percent > 0) return `+${percent}%`;
    return `${percent}%`;
  };

  /**
   * Точки графика роста за период (week=7, month=30, year=365)
   */
  const getGrowthChartData = (
    habit: Habit,
    periodDays: number
  ): Array<{ day: number; date: string; growth: number; value: 'done' | 'mini' | 'freeze' | 'missed' | 'bonus' | 'empty' }> => {
    // 💤 Точка отсчёта учитывает reactivatedAt
    const startDate = getEffectiveStartDate(habit);
    if (!startDate) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const windowDays = Math.min(periodDays, totalDays);

    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - windowDays + 1);
    if (windowStart < startDate) windowStart.setTime(startDate.getTime());

    // Прогон до windowStart, чтобы получить накопленный growth
    let growth = 1;
    let dayCount = 0;
    const cursor = new Date(startDate);
    while (cursor < windowStart) {
      dayCount++;
      const ds = formatDate(cursor);
      const val = habit.history[ds];
      const scheduled = isDateScheduled(habit, cursor);
      if (scheduled) {
        if (val === true) growth *= 1.01;
        else if (val === 'mini') growth *= 1.005;
        else if (val !== 'freeze') growth *= 0.99;
      } else {
        if (val === true) growth *= 1.01;
        else if (val === 'mini') growth *= 1.005;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    // Точки графика
    const points: Array<{ day: number; date: string; growth: number; value: 'done' | 'mini' | 'freeze' | 'missed' | 'bonus' | 'empty' }> = [];
    while (cursor <= today) {
      dayCount++;
      const ds = formatDate(cursor);
      const val = habit.history[ds];
      const scheduled = isDateScheduled(habit, cursor);
      let pointType: 'done' | 'mini' | 'freeze' | 'missed' | 'bonus' | 'empty' = 'empty';

      if (scheduled) {
        if (val === true) { growth *= 1.01; pointType = 'done'; }
        else if (val === 'mini') { growth *= 1.005; pointType = 'mini'; }
        else if (val === 'freeze') { pointType = 'freeze'; }
        else { growth *= 0.99; pointType = 'missed'; }
      } else {
        if (val === true) { growth *= 1.01; pointType = 'bonus'; }
        else if (val === 'mini') { growth *= 1.005; pointType = 'bonus'; }
      }

      points.push({ day: dayCount, date: ds, growth, value: pointType });
      cursor.setDate(cursor.getDate() + 1);
    }

    return points;
  };

  // Склонение слова "день"
  const getDaysWord = (days: number) => {
    if (days % 10 === 1 && days % 100 !== 11) return 'день';
    if ([2,3,4].includes(days % 10) && ![12,13,14].includes(days % 100)) return 'дня';
    return 'дней';
  };

  // Получить достижения за серии
  const getAchievements = (habit: Habit): Achievement[] => {
    const bestStreak = getBestStreak(habit);

    const achievements: Achievement[] = [
      // За серии
      {
        id: 'spark',
        emoji: '🔥',
        name: 'Искра',
        description: 'Первая неделя позади! Привычка начинает формироваться.',
        type: 'streak',
        requirement: 7,
        unlocked: bestStreak >= 7,
        progress: Math.min(bestStreak, 7)
      },
      {
        id: 'momentum',
        emoji: '⚡',
        name: 'Разгон',
        description: 'Две недели подряд! Ты набираешь обороты.',
        type: 'streak',
        requirement: 14,
        unlocked: bestStreak >= 14,
        progress: Math.min(bestStreak, 14)
      },
      {
        id: 'star',
        emoji: '🌟',
        name: 'Звезда',
        description: 'Целый месяц! Привычка укореняется, ты светишься!',
        type: 'streak',
        requirement: 30,
        unlocked: bestStreak >= 30,
        progress: Math.min(bestStreak, 30)
      },
      {
        id: 'invincible',
        emoji: '🔱',
        name: 'Непобедимый',
        description: 'Серия 50+ дней! Остановить тебя невозможно.',
        type: 'streak',
        requirement: 50,
        unlocked: bestStreak >= 50,
        progress: Math.min(bestStreak, 50)
      },
      {
        id: 'champion',
        emoji: '👑',
        name: 'Чемпион',
        description: '100 дней! Ты на вершине мастерства!',
        type: 'streak',
        requirement: 100,
        unlocked: bestStreak >= 100,
        progress: Math.min(bestStreak, 100)
      },
      {
        id: 'legend',
        emoji: '💎',
        name: 'Легенда',
        description: 'Целый год! Это уже легенда!',
        type: 'streak',
        requirement: 365,
        unlocked: bestStreak >= 365,
        progress: Math.min(bestStreak, 365)
      }
    ];

    return achievements;
  };

  // Месячные челленджи
  const getMonthChallenges = (habit: Habit) => {
    const stats = getThisMonthStats(habit);
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysUntilReset = Math.ceil((lastDayOfMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return {
      challenges: [
        {
          id: 'flawless',
          emoji: '🎖️',
          name: 'Безупречный',
          description: 'Все запланированные дни выполнены полностью!',
          unlocked: stats.scheduledDays > 0 && stats.completedFull === stats.scheduledDays,
          progress: stats.completedFull,
          requirement: stats.scheduledDays,
          detail: `${stats.completedFull}/${stats.scheduledDays} дней`
        },
        {
          id: 'full-power',
          emoji: '💪',
          name: 'Полная отдача',
          description: 'Меньше 2 мини-действий! Ты идёшь по максимуму.',
          unlocked: stats.completedMini < 2,
          progress: stats.completedMini,
          requirement: 2,
          detail: stats.completedMini === 0 
            ? '0 мини!' 
            : stats.completedMini === 1 
              ? '1 мини' 
              : `${stats.completedMini} мини (лимит: <2)`
        },
        {
          id: 'resilient',
          emoji: '🧊',
          name: 'Стойкий',
          description: 'Меньше 2 заморозок! Ты не сдаёшься.',
          unlocked: stats.frozen < 2,
          progress: stats.frozen,
          requirement: 2,
          detail: stats.frozen === 0 
            ? '0 заморозок!' 
            : stats.frozen === 1 
              ? '1 заморозка' 
              : `${stats.frozen} заморозок (лимит: <2)`
        }
      ],
      daysUntilReset
    };
  };

  // =====================================================
  // ОТРИСОВКА
  // =====================================================

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

    // ВАЖНО: не вычисляем newValue здесь — habit это пропс который при быстрых тапах
    // может быть stale. Шлём команду 'cycle', App.tsx вычислит следующее значение
    // из актуальной истории привычки внутри функционального setState.
    saveScrollPosition();
    onToggleHabit(habit.id, dateStr, 'cycle' as any);
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
    saveScrollPosition();
    onToggleHabit(contextMenu.habitId, contextMenu.date, val);
    setContextMenu(null);
  };

  // Drag & Drop
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

  // Рендер календаря месяца
  const renderMonthCalendar = (habit: Habit, hasCover: boolean) => {
    const habitId = habit.id;
    const currentMonthData = calendarMonth[habitId] || { year: new Date().getFullYear(), month: new Date().getMonth() };
    const year = currentMonthData.year;
    const month = currentMonthData.month;
    
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
      const isScheduled = isDateRelevant(habit, date);
      
      if (!isScheduled) return hasCover ? 'bg-white/5' : 'bg-gray-500/10';
      if (!val) return hasCover ? 'bg-white/20' : 'bg-gray-500/30';
      
      if (val === 'freeze') return 'bg-cyan-400 shadow-[0_0_6px_cyan]';
      if (val === 'mini') return 'bg-yellow-500 shadow-[0_0_4px_yellow]';
      if (val === true) return 'bg-green-500 shadow-[0_0_6px_lime]';
      return hasCover ? 'bg-white/20' : 'bg-gray-500/30';
    };

    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

    // Считаем статистику для выбранного месяца
    let completed = 0;
    let frozen = 0;
    let missed = 0;
    let total = 0;
    
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      
      if (isDateRelevant(habit, date)) {
        const ds = formatDate(date);
        const val = habit.history[ds];
        
        if (val === 'freeze') {
          frozen++;
        } else {
          total++;
          if (isCompleted(val)) {
            completed++;
          } else {
            missed++;
          }
        }
      }
    }
    
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const currentStreak = getCurrentStreak(habit);
    const bestStreak = getBestStreak(habit);

    const today = new Date();
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
    const canGoNext = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());

    return (
      <div className={`mt-2 p-3 md:p-4 rounded-2xl ${hasCover ? 'bg-black/40 backdrop-blur-sm' : 'bg-black/10'} border border-white/10`}>
        {/* Навигация по месяцам */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={(e) => { e.stopPropagation(); changeCalendarMonth(habitId, 'prev'); }}
            className={`p-1.5 rounded-lg transition-all ${hasCover ? 'text-white/60 hover:bg-white/10' : 'tg-hint hover:bg-black/10'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          
          <span className={`text-[10px] md:text-xs font-black uppercase tracking-wider ${hasCover ? 'text-white/70' : 'tg-hint'}`}>
            {monthNames[month]} {year}
          </span>
          
          <button
            onClick={(e) => { e.stopPropagation(); changeCalendarMonth(habitId, 'next'); }}
            disabled={!canGoNext}
            className={`p-1.5 rounded-lg transition-all ${
              canGoNext 
                ? `${hasCover ? 'text-white/60 hover:bg-white/10' : 'tg-hint hover:bg-black/10'}` 
                : 'opacity-30 cursor-not-allowed'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 mb-2">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-sm bg-green-500" />
            <span className={`text-[7px] md:text-[8px] ${hasCover ? 'text-white/50' : 'tg-hint'}`}>✓</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-sm bg-yellow-500" />
            <span className={`text-[7px] md:text-[8px] ${hasCover ? 'text-white/50' : 'tg-hint'}`}>Mini</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-sm bg-cyan-400" />
            <span className={`text-[7px] md:text-[8px] ${hasCover ? 'text-white/50' : 'tg-hint'}`}>❄️</span>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-0.5 md:gap-1 mb-1">
          {WEEKDAYS_SHORT.map(day => (
            <div key={day} className={`text-[7px] md:text-[8px] text-center font-bold ${hasCover ? 'text-white/40' : 'tg-hint opacity-50'}`}>
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid gap-0.5 md:gap-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-0.5 md:gap-1">
              {week.map((date, di) => {
                const isToday = date && formatDate(date) === formatDate(new Date()) && isCurrentMonth;
                return (
                  <div 
                    key={di}
                    className={`
                      aspect-square rounded-[3px] md:rounded-[4px] transition-all flex items-center justify-center
                      ${getHeatmapColor(date)}
                      ${isToday ? 'ring-1 ring-white scale-110' : ''}
                    `}
                  >
                    {date && (
                      <span className={`text-[6px] md:text-[8px] font-bold ${hasCover ? 'text-white/60' : 'text-white/80'}`}>
                        {date.getDate()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Краткая статистика */}
        <div className={`mt-3 pt-3 border-t ${hasCover ? 'border-white/10' : 'border-black/10'} grid grid-cols-2 gap-2 md:gap-4`}>
          <div className="text-center">
            <div className={`text-[10px] md:text-xs font-black ${hasCover ? 'text-white' : 'tg-text'}`}>{percentage}%</div>
            <div className={`text-[7px] md:text-[8px] ${hasCover ? 'text-white/50' : 'tg-hint'}`}>Выполнено</div>
          </div>
          <div className="text-center">
            <div className={`text-[10px] md:text-xs font-black ${hasCover ? 'text-white' : 'tg-text'}`}>{currentStreak}д</div>
            <div className={`text-[7px] md:text-[8px] ${hasCover ? 'text-white/50' : 'tg-hint'}`}>Серия</div>
          </div>
        </div>
      </div>
    );
  };

  // 📈 Рендер графика РОСТА (трейдерский стиль)
  const renderCircularChart = (habit: Habit, hasCover: boolean) => {
    const habitId = habit.id;
    const period = chartPeriod[habitId] || 'month';
    const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const points = getGrowthChartData(habit, periodDays);

    const growthData = calculateGrowth(habit);
    const currentStreak = getCurrentStreak(habit);
    const bestStreak = getBestStreak(habit);

    const periodLabels = { week: 'Неделя', month: 'Месяц', year: 'Год' };

    // Если данных мало — заглушка
    if (points.length < 2) {
      return (
        <div className={`mt-2 p-6 rounded-2xl ${hasCover ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/80'} border border-white/10`}>
          <div className="flex gap-1 mb-4 bg-black/40 p-1 rounded-xl">
            {(['week', 'month', 'year'] as const).map(p => (
              <button
                key={p}
                onClick={(e) => { e.stopPropagation(); setHabitChartPeriod(habitId, p); }}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                  period === p
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
          <div className="text-center py-8">
            <span className="text-4xl block mb-2">📈</span>
            <p className="text-xs text-white/60">
              Отметь хотя бы 2 дня, чтобы увидеть график роста
            </p>
          </div>
        </div>
      );
    }

    // Геометрия графика
    const W = 320;
    const H = 180;
    const padL = 38;
    const padR = 46;
    const padT = 12;
    const padB = 24;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Шкала Y
    const growths = points.map(p => p.growth);
    let minG = Math.min(...growths, 1);
    let maxG = Math.max(...growths, 1);
    const range = maxG - minG;
    minG = Math.max(0.001, minG - range * 0.1);
    maxG = maxG + range * 0.1;
    if (maxG - minG < 0.05) { minG = minG - 0.025; maxG = maxG + 0.025; }

    const yScale = (g: number) => padT + plotH - ((g - minG) / (maxG - minG)) * plotH;
    const xScale = (i: number) => padL + (i / Math.max(1, points.length - 1)) * plotW;

    // Сегменты линии (зелёный = рост, красный = падение)
    const segments: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = [];
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const goingUp = curr.growth >= prev.growth;
      segments.push({
        x1: xScale(i - 1),
        y1: yScale(prev.growth),
        x2: xScale(i),
        y2: yScale(curr.growth),
        color: goingUp ? '#22c55e' : '#ef4444'
      });
    }

    // Сетка по Y
    const gridLines: Array<{ y: number; label: string; labelRight: string }> = [];
    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const value = minG + (maxG - minG) * (i / gridSteps);
      const y = yScale(value);
      gridLines.push({
        y,
        label: value >= 10 ? `×${value.toFixed(0)}` : `×${value.toFixed(2)}`,
        labelRight: `${Math.round((value - 1) * 100) >= 0 ? '+' : ''}${Math.round((value - 1) * 100)}%`
      });
    }

    // Заливка под линией
    const pathPoints = points.map((p, i) => `${xScale(i)},${yScale(p.growth)}`).join(' L ');
    const areaPath = `M ${xScale(0)},${yScale(minG)} L ${pathPoints} L ${xScale(points.length - 1)},${yScale(minG)} Z`;

    // X-лейблы (начало, середина, конец)
    const xLabels = [
      { i: 0, label: points[0].date.slice(5).replace('-', '.') },
      { i: Math.floor(points.length / 2), label: points[Math.floor(points.length / 2)].date.slice(5).replace('-', '.') },
      { i: points.length - 1, label: points[points.length - 1].date.slice(5).replace('-', '.') }
    ];

    // Маркеры
    const markers = points.map((p, i) => ({
      x: xScale(i),
      y: yScale(p.growth),
      type: p.value,
      data: p,
      index: i
    }));

    const hoveredPoint = chartHover && chartHover.habitId === habitId ? markers[chartHover.pointIndex] : null;

    const handleChartInteract = (clientX: number, target: SVGSVGElement) => {
      const rect = target.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * W;
      let closestIdx = 0;
      let minDist = Infinity;
      markers.forEach((m, idx) => {
        const d = Math.abs(m.x - x);
        if (d < minDist) { minDist = d; closestIdx = idx; }
      });
      setChartHover({ habitId, pointIndex: closestIdx });
    };

    return (
      <div className={`mt-2 p-4 rounded-2xl ${hasCover ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/80'} border border-white/10`}>
        {/* Переключатель периода */}
        <div className="flex gap-1 mb-4 bg-black/40 p-1 rounded-xl">
          {(['week', 'month', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={(e) => { e.stopPropagation(); setHabitChartPeriod(habitId, p); setChartHover(null); }}
              className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                period === p
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {/* Шапка графика — текущий рост */}
        <div className="flex items-baseline justify-between mb-3 px-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white tracking-tight">{formatGrowth(growthData.growth)}</span>
            <span className={`text-xs font-bold ${growthData.growth >= 1 ? 'text-green-400' : 'text-red-400'}`}>
              {formatGrowthPercent(growthData.growth)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-white/40 font-mono">
            <span>день</span>
            <span className="text-white/80 font-bold">{growthData.daysSinceStart}</span>
          </div>
        </div>

        {/* SVG-график */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ touchAction: 'none' }}
          onMouseLeave={() => setChartHover(null)}
          onClick={(e) => handleChartInteract(e.clientX, e.currentTarget)}
          onTouchStart={(e) => { if (e.touches[0]) handleChartInteract(e.touches[0].clientX, e.currentTarget); }}
          onTouchMove={(e) => { if (e.touches[0]) handleChartInteract(e.touches[0].clientX, e.currentTarget); }}
        >
          <defs>
            <linearGradient id={`grad-${habitId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Сетка */}
          {gridLines.map((line, i) => (
            <g key={i}>
              <line
                x1={padL}
                x2={W - padR}
                y1={line.y}
                y2={line.y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              <text
                x={padL - 4}
                y={line.y + 3}
                fill="rgba(255,255,255,0.4)"
                fontSize="8"
                fontFamily="monospace"
                textAnchor="end"
              >
                {line.label}
              </text>
              <text
                x={W - padR + 4}
                y={line.y + 3}
                fill="rgba(255,255,255,0.4)"
                fontSize="8"
                fontFamily="monospace"
                textAnchor="start"
              >
                {line.labelRight}
              </text>
            </g>
          ))}

          {/* Линия ×1.00 */}
          {minG < 1 && maxG > 1 && (
            <line
              x1={padL}
              x2={W - padR}
              y1={yScale(1)}
              y2={yScale(1)}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1"
              strokeDasharray="3 2"
            />
          )}

          {/* Заливка */}
          <path d={areaPath} fill={`url(#grad-${habitId})`} />

          {/* Сегменты */}
          {segments.map((seg, i) => (
            <line
              key={i}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke={seg.color}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          ))}

          {/* Маркеры */}
          {markers.map((m, i) => {
            if (m.type === 'empty') return null;
            let fill = 'transparent';
            let r = 1.5;
            if (m.type === 'done' || m.type === 'bonus') { fill = '#22c55e'; r = 2.2; }
            else if (m.type === 'mini') { fill = '#eab308'; r = 2; }
            else if (m.type === 'freeze') { fill = '#22d3ee'; r = 2; }
            else if (m.type === 'missed') { fill = '#ef4444'; r = 2.2; }
            return <circle key={i} cx={m.x} cy={m.y} r={r} fill={fill} stroke="black" strokeWidth="0.5" />;
          })}

          {/* X-лейблы */}
          {xLabels.map((xl, i) => (
            <text
              key={i}
              x={xScale(xl.i)}
              y={H - 6}
              fill="rgba(255,255,255,0.35)"
              fontSize="8"
              fontFamily="monospace"
              textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
            >
              {xl.label}
            </text>
          ))}

          {/* Crosshair */}
          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                x2={hoveredPoint.x}
                y1={padT}
                y2={padT + plotH}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="4"
                fill="white"
                stroke="#22c55e"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Тултип */}
        {hoveredPoint ? (
          <div className="mt-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10 flex items-center justify-between text-[10px]">
            <span className="text-white/60 font-mono">
              {(() => {
                const [, m, d] = hoveredPoint.data.date.split('-');
                const monthNames = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
                return `${parseInt(d)} ${monthNames[parseInt(m) - 1]}`;
              })()}
            </span>
            <span className="text-white font-black font-mono">
              {formatGrowth(hoveredPoint.data.growth)}
            </span>
            <span className={`font-bold font-mono ${hoveredPoint.data.growth >= 1 ? 'text-green-400' : 'text-red-400'}`}>
              {formatGrowthPercent(hoveredPoint.data.growth)}
            </span>
            <span className="text-white/40 font-mono">
              день {hoveredPoint.data.day}
            </span>
          </div>
        ) : (
          <div className="mt-2 text-center">
            <span className="text-[8px] text-white/30 uppercase tracking-wider">Коснись графика, чтобы увидеть детали</span>
          </div>
        )}

        {/* Серии */}
        <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className="text-lg font-black text-orange-300 flex items-center justify-center gap-1">
              🔥 {currentStreak}
            </div>
            <div className="text-[7px] font-bold uppercase tracking-wider text-white/40">Текущая серия</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-black text-yellow-300 flex items-center justify-center gap-1">
              ⭐ {bestStreak}
            </div>
            <div className="text-[7px] font-bold uppercase tracking-wider text-white/40">Лучшая серия</div>
          </div>
        </div>
      </div>
    );
  };

  // Рендер достижений
  const renderAchievements = (habit: Habit, hasCover: boolean) => {
    const achievements = getAchievements(habit);
    const monthlyChallenges = getMonthChallenges(habit);

    return (
      <div className={`mt-2 p-4 rounded-2xl ${hasCover ? 'bg-black/40 backdrop-blur-sm' : 'bg-black/10'} border border-white/10 space-y-4`}>
        {/* За серии */}
        <div>
          <h4 className={`text-[9px] font-black uppercase tracking-wider mb-3 ${hasCover ? 'text-white/70' : 'tg-hint'}`}>
            За серии
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {achievements.map(achievement => (
              <button
                key={achievement.id}
                onClick={() => setSelectedAchievement({habitId: habit.id, achievement})}
                className={`
                  relative p-3 rounded-xl flex flex-col items-center gap-1.5 transition-all
                  ${achievement.unlocked 
                    ? `bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 shadow-lg` 
                    : `${hasCover ? 'bg-white/5 border border-white/10' : 'bg-black/5 border border-black/10'}`
                  }
                `}
              >
                <span className={`text-2xl ${achievement.unlocked ? '' : 'grayscale opacity-40'}`}>
                  {achievement.emoji}
                </span>
                <span className={`text-[7px] font-bold text-center ${achievement.unlocked ? 'text-white' : `${hasCover ? 'text-white/40' : 'tg-hint'}`}`}>
                  {achievement.name}
                </span>
                {!achievement.unlocked && (
                  <div className={`absolute top-1 right-1 text-[10px] ${hasCover ? 'text-white/30' : 'text-gray-400/50'}`}>
                    🔒
                  </div>
                )}
                {!achievement.unlocked && (
                  <div className="w-full mt-1">
                    <div className={`h-1 rounded-full ${hasCover ? 'bg-white/10' : 'bg-black/10'} overflow-hidden`}>
                      <div 
                        className="h-full bg-yellow-500 rounded-full transition-all duration-700"
                        style={{width: `${(achievement.progress / achievement.requirement) * 100}%`}}
                      />
                    </div>
                    <span className={`text-[6px] ${hasCover ? 'text-white/40' : 'tg-hint'} block text-center mt-0.5`}>
                      {achievement.progress}/{achievement.requirement}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Тонкая светящаяся линия */}
        <div className="relative h-px my-4">
          <div className={`absolute inset-0 bg-gradient-to-r ${
            hasCover 
              ? 'from-transparent via-white/20 to-transparent' 
              : 'from-transparent via-gray-400/30 to-transparent'
          } shadow-[0_0_8px_rgba(255,255,255,0.2)]`} />
        </div>

        {/* Челлендж месяца */}
        <div>
          <h4 className={`text-[9px] font-black uppercase tracking-wider mb-3 ${hasCover ? 'text-white/70' : 'tg-hint'}`}>
            Челлендж месяца
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {monthlyChallenges.challenges.map(challenge => (
              <button
                key={challenge.id}
                onClick={() => setSelectedAchievement({
                  habitId: habit.id, 
                  achievement: {
                    ...challenge,
                    type: 'count' as const
                  }
                })}
                className={`
                  relative p-3 rounded-xl flex flex-col items-center gap-1.5 transition-all
                  ${challenge.unlocked 
                    ? `bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 shadow-lg animate-pulse` 
                    : `${hasCover ? 'bg-white/5 border border-white/10' : 'bg-black/5 border border-black/10'}`
                  }
                `}
              >
                <span className={`text-2xl ${challenge.unlocked ? '' : 'grayscale opacity-40'}`}>
                  {challenge.emoji}
                </span>
                <span className={`text-[7px] font-bold text-center leading-tight ${challenge.unlocked ? 'text-white' : `${hasCover ? 'text-white/40' : 'tg-hint'}`}`}>
                  {challenge.name}
                </span>
                
                {/* Детали прогресса */}
                <div className="w-full mt-1">
                  <span className={`text-[6px] ${
                    challenge.unlocked 
                      ? 'text-green-400 font-bold' 
                      : challenge.progress >= challenge.requirement 
                        ? 'text-red-400' 
                        : `${hasCover ? 'text-white/40' : 'tg-hint'}`
                  } block text-center`}>
                    {challenge.detail}
                  </span>
                </div>

                {!challenge.unlocked && (
                  <div className={`absolute top-1 right-1 text-[10px] ${hasCover ? 'text-white/30' : 'text-gray-400/50'}`}>
                    🔒
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Счётчик дней до сброса */}
          <div className="text-center mt-3 pt-3 border-t border-white/5">
            <span className={`text-[8px] ${hasCover ? 'text-white/50' : 'tg-hint'}`}>
              Обновится через {monthlyChallenges.daysUntilReset} {getDaysWord(monthlyChallenges.daysUntilReset)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Рендер слотов (дни месяца)
  const renderSlots = (habit: Habit, hasCover: boolean) => {
    const now = new Date();
    const daysToRender: Date[] = [];
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    for (let d = 1; d <= lastDayOfMonth; d++) {
      const date = new Date(now.getFullYear(), now.getMonth(), d);
      if (isDateRelevant(habit, date)) {
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
            data-today={isToday ? 'true' : undefined}
            className={`
              min-w-[50px] md:min-w-[45px] h-[70px] md:h-[60px] flex flex-col items-center justify-between py-2 px-1 rounded-2xl md:rounded-xl transition-all relative z-10
              ${className} ${isToday ? 'ring-2 ring-white scale-105 z-20' : ''}
            `}
          >
            <div className="flex flex-col items-center gap-1 w-full h-full">
              <span className="text-[10px] md:text-[9px] font-black">{formatShortDate(date)}</span>
              <span className="text-[8px] md:text-[7px] font-bold opacity-60">{WEEKDAYS[date.getDay()]}</span>
              
              <div className="flex-1 flex items-center justify-center">
                {val === 'freeze' && <span className="text-lg md:text-base drop-shadow-md">❄️</span>}
                {val === 'mini' && <div className="w-2 h-2 md:w-1.5 md:h-1.5 rounded-full bg-current opacity-80" />}
                {type === 'full' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="drop-shadow-sm md:w-3 md:h-3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
            </div>
          </button>
          
          {showBridge && (
            <div className={`h-[4px] md:h-[3px] w-[10px] md:w-[8px] -mx-1 z-0 relative rounded-full ${bridgeColor} animate-pulse`} />
          )}
          {!showBridge && <div className="w-1.5 md:w-1" />}
        </div>
      );
    });
  };

  return (
    <div ref={scrollContainerRef} className="flex flex-col h-full overflow-y-auto no-scrollbar animate-in fade-in duration-300 relative pb-20">
      
      {/* Табы */}
      <div className="px-5 py-2 sticky top-0 z-30 backdrop-blur-md bg-gradient-to-b from-[var(--tg-theme-bg-color)] to-transparent">
        <div className="bg-black/10 p-1.5 rounded-[20px] flex relative border border-white/5 shadow-inner">
          <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-[16px] shadow-md transition-all duration-300 ease-out ${activeTab === 'build' ? 'left-1.5 bg-[#4cc3a1]' : 'left-[calc(50%+3px)] bg-red-500'}`} />
          <button onClick={() => setActiveTab('build')} className={`flex-1 relative z-10 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${activeTab === 'build' ? 'text-white' : 'text-gray-400'}`}>Создать</button>
          <button onClick={() => setActiveTab('quit')} className={`flex-1 relative z-10 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${activeTab === 'quit' ? 'text-white' : 'text-gray-400'}`}>Бросить</button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Таб "Создать" */}
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
            <div className="max-w-4xl mx-auto w-full space-y-4">
              {habits.map(habit => {
                const streak = getCurrentStreak(habit);
                const isTarget = dropTargetId === habit.id;
                const hasCover = !!habit.fileData;
                const isAtomic = !!habit.identity || !!habit.triggerEvent;
                const isExpanded = expandedHabits.has(habit.id);
                const currentStatsTab = statsTab[habit.id] || 'calendar';
                const hasWarning = freezeWarnings.has(habit.id);
                const growthData = calculateGrowth(habit);
                const recentTrend = getRecentGrowthTrend(habit, 7);
                const growthColorClass = getGrowthColor(recentTrend, hasCover);

                return (
                  <div 
                    key={habit.id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, habit.id)}
                    onDragOver={(e) => handleDragOver(e, habit.id)}
                    onDrop={(e) => handleDrop(e, habit.id)}
                    onDragEnd={() => { setDraggedHabitId(null); setDropTargetId(null); }}
                    className={`relative overflow-hidden rounded-[28px] shadow-sm p-4 flex flex-col gap-3 transition-all min-h-[120px] cursor-grab active:cursor-grabbing ${isTarget ? 'scale-[1.02] ring-2 ring-blue-500' : ''} ${draggedHabitId === habit.id ? 'opacity-40' : ''} ${!hasCover ? 'tg-secondary-bg border border-gray-400/5' : ''} ${hasCover ? 'cover-preserve' : ''}`}
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
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[8px]">🔗</span>
                              <span className={`text-[9px] italic ${hasCover ? 'text-white/80' : 'tg-hint'}`}>{habit.triggerEvent}</span>
                            </div>
                          ) : (habit.description && <span className={`text-[9px] line-clamp-1 italic ${hasCover ? 'text-white/70' : 'tg-hint opacity-70'}`}>{habit.description}</span>)}
                        </div>
                      </div>
                      
                      {/* STREAK + GROWTH */}
                      <div className="flex items-center gap-2.5">
                        {streak > 0 && (
                          <div className={`flex items-center gap-0.5 ${hasCover ? 'text-orange-300' : 'text-orange-500'}`}>
                            <span className="text-xs">🔥</span>
                            <span className="text-[10px] font-black">{streak}</span>
                          </div>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setGrowthInfoHabitId(habit.id); }}
                          className="flex flex-col items-end gap-0 group"
                          title="Что такое Рост?"
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] opacity-50">📈</span>
                            <span className={`text-sm font-black tracking-tight ${growthData.hasStarted ? growthColorClass : (hasCover ? 'text-white/40' : 'tg-hint')}`}>
                              {growthData.hasStarted ? formatGrowth(growthData.growth) : '×1.00'}
                            </span>
                            <span className={`text-[8px] opacity-40 group-hover:opacity-100 transition-opacity ${hasCover ? 'text-white' : 'tg-hint'}`}>?</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {growthData.hasStarted ? (
                              <>
                                <span className={`text-[7px] font-bold ${growthColorClass}`}>
                                  {formatGrowthPercent(growthData.growth)}
                                </span>
                                <span className={`text-[7px] ${hasCover ? 'text-white/40' : 'tg-hint'}`}>·</span>
                                <span className={`text-[7px] font-bold ${hasCover ? 'text-white/60' : 'tg-hint'}`}>
                                  день {growthData.daysSinceStart}
                                </span>
                              </>
                            ) : (
                              <span className={`text-[7px] italic ${hasCover ? 'text-white/50' : 'tg-hint'}`}>
                                Начни сегодня
                              </span>
                            )}
                          </div>
                        </button>
                      </div>
                    </div>
                    
                    {/* SLOTS */}
                    <div className="relative z-10 flex overflow-x-auto no-scrollbar pb-1 pt-1 px-1 items-center">
                      {renderSlots(habit, hasCover)}
                    </div>

                    {/* ПРЕДУПРЕЖДЕНИЕ О ЗАМОРОЗКАХ */}
                    {hasWarning && !isExpanded && !dismissedWarnings.has(habit.id) && (
                      <div className="relative z-10 animate-in slide-in-from-top-2 duration-300">
                        <div className={`p-3 rounded-xl ${hasCover ? 'bg-orange-500/20 border border-orange-400/30' : 'bg-orange-500/10 border border-orange-500/20'} flex items-start gap-2`}>
                          <span className="text-lg shrink-0">⚠️</span>
                          <div className="flex-1">
                            <p className={`text-[9px] md:text-[10px] font-bold ${hasCover ? 'text-orange-200' : 'text-orange-600'}`}>
                              Три заморозки подряд
                            </p>
                            <p className={`text-[8px] md:text-[9px] ${hasCover ? 'text-orange-300/70' : 'text-orange-500/70'} mt-0.5`}>
                              Возможно, стоит пересмотреть привычку?
                            </p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); dismissFreezeWarning(habit.id); }}
                            className={`shrink-0 w-5 h-5 flex items-center justify-center rounded-lg transition-all ${
                              hasCover ? 'hover:bg-white/10 text-orange-200' : 'hover:bg-orange-500/20 text-orange-600'
                            }`}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* FOOTER */}
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
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setDeleteMenu({ habitId: habit.id, x: rect.right - 180, y: rect.bottom + 8 });
                          }} 
                          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${hasCover ? 'bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20' : 'bg-red-500/5 text-red-500/30 hover:text-red-500 hover:bg-red-500/10'}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* РАЗВЁРНУТАЯ СТАТИСТИКА С ТАБАМИ */}
                    {isExpanded && (
                      <div className="relative z-10 animate-in slide-in-from-top-2 duration-300">
                        {/* Табы статистики */}
                        <div className="flex gap-1 mb-2 bg-black/20 p-1 rounded-xl">
                          <button
                            onClick={(e) => { e.stopPropagation(); setHabitStatsTab(habit.id, 'calendar'); }}
                            className={`flex-1 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all ${
                              currentStatsTab === 'calendar'
                                ? `bg-green-500 text-white shadow-lg`
                                : `${hasCover ? 'text-white/40 hover:text-white/60' : 'tg-hint hover:bg-black/10'}`
                            }`}
                          >
                            📅 Календарь
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setHabitStatsTab(habit.id, 'charts'); }}
                            className={`flex-1 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all ${
                              currentStatsTab === 'charts'
                                ? `bg-green-500 text-white shadow-lg`
                                : `${hasCover ? 'text-white/40 hover:text-white/60' : 'tg-hint hover:bg-black/10'}`
                            }`}
                          >
                            📈 Графики
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setHabitStatsTab(habit.id, 'achievements'); }}
                            className={`flex-1 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all ${
                              currentStatsTab === 'achievements'
                                ? `bg-green-500 text-white shadow-lg`
                                : `${hasCover ? 'text-white/40 hover:text-white/60' : 'tg-hint hover:bg-black/10'}`
                            }`}
                          >
                            🏆 Награды
                          </button>
                        </div>

                        {/* Контент табов */}
                        <div onClick={(e) => e.stopPropagation()}>
                          {currentStatsTab === 'calendar' && renderMonthCalendar(habit, hasCover)}
                          {currentStatsTab === 'charts' && renderCircularChart(habit, hasCover)}
                          {currentStatsTab === 'achievements' && renderAchievements(habit, hasCover)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={onAddHabit} className="w-full py-4 rounded-2xl border border-dashed border-gray-400/20 tg-text opacity-50 text-[10px] font-black uppercase tracking-widest hover:opacity-100">+ Создать ещё</button>
            </div>
          )
        )}

        {/* Таб "Бросить" */}
        {activeTab === 'quit' && (
          <div className="max-w-4xl mx-auto w-full grid grid-cols-1 gap-4">
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

      {/* Контекстное меню */}
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

      {/* Модалка достижения */}
      {selectedAchievement && (
        <div 
          className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedAchievement(null)}
        >
          <div 
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className={`text-6xl ${selectedAchievement.achievement.unlocked ? '' : 'grayscale opacity-40'}`}>
                {selectedAchievement.achievement.emoji}
              </div>
              
              <div>
                <h3 className="text-xl font-black text-white mb-1">
                  {selectedAchievement.achievement.name}
                  {!selectedAchievement.achievement.unlocked && <span className="ml-2 text-sm">🔒</span>}
                </h3>
                <p className="text-sm text-gray-400">
                  {selectedAchievement.achievement.description}
                </p>
              </div>

              {selectedAchievement.achievement.unlocked ? (
                <div className="w-full py-3 px-4 bg-green-500/20 rounded-xl border border-green-500/30">
                  <p className="text-xs font-bold text-green-400">✓ Разблокировано</p>
                </div>
              ) : (
                <div className="w-full">
                  {/* Для достижений за серии */}
                  {selectedAchievement.achievement.type === 'streak' && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">Прогресс</span>
                        <span className="text-xs font-bold text-white">
                          {selectedAchievement.achievement.progress} / {selectedAchievement.achievement.requirement} дней
                        </span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-700"
                          style={{width: `${(selectedAchievement.achievement.progress / selectedAchievement.achievement.requirement) * 100}%`}}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Осталось: {selectedAchievement.achievement.requirement - selectedAchievement.achievement.progress} {getDaysWord(selectedAchievement.achievement.requirement - selectedAchievement.achievement.progress)}
                      </p>
                    </>
                  )}

                  {/* Для месячных челленджей */}
                  {selectedAchievement.achievement.type === 'count' && 'detail' in selectedAchievement.achievement && (
                    <>
                      <div className="py-3 px-4 bg-white/5 rounded-xl border border-white/10">
                        <p className={`text-sm font-bold ${
                          selectedAchievement.achievement.progress >= selectedAchievement.achievement.requirement 
                            ? 'text-red-400' 
                            : 'text-gray-300'
                        }`}>
                          {(selectedAchievement.achievement as any).detail}
                        </p>
                      </div>
                      {selectedAchievement.achievement.progress >= selectedAchievement.achievement.requirement && (
                        <p className="text-xs text-red-400 mt-2">
                          ⚠️ Превышен лимит
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              <button
                onClick={() => setSelectedAchievement(null)}
                className="mt-2 py-3 px-8 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold text-white transition-all"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💤 Меню «В спячку / Удалить» */}
      {deleteMenu && (
        <>
          <div className="fixed inset-0 z-[490]" onClick={() => setDeleteMenu(null)} />
          <div
            className="fixed z-[500] w-44 bg-[#1c1c1e] rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{ top: Math.min(deleteMenu.y, window.innerHeight - 130), left: Math.max(8, Math.min(deleteMenu.x, window.innerWidth - 184)) }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setArchiveConfirmId(deleteMenu.habitId);
                setDeleteMenu(null);
              }}
              className="p-3 text-left hover:bg-white/5 flex items-center gap-2 text-[11px] font-bold text-white"
            >
              <span className="text-base">💤</span>
              <span>В спячку</span>
            </button>
            <div className="h-[1px] bg-white/10 mx-2" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteHabit(deleteMenu.habitId);
                setDeleteMenu(null);
              }}
              className="p-3 text-left hover:bg-red-500/10 flex items-center gap-2 text-[11px] font-bold text-red-500"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
              <span>Удалить навсегда</span>
            </button>
          </div>
        </>
      )}

      {/* 💤 Подтверждение отправки в спячку */}
      {archiveConfirmId && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setArchiveConfirmId(null)}
        >
          <div
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="text-6xl">💤</div>
              <h3 className="text-xl font-black text-white">Отправить в спячку?</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                Привычка пропадёт с главного экрана и не будет считаться. Уведомления отключатся.
              </p>
              <div className="w-full py-3 px-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                <p className="text-xs text-yellow-200 leading-relaxed">
                  ⚠️ При пробуждении <span className="font-bold">Рост и серия начнутся с нуля</span>.
                  Личный рекорд сохранится.
                </p>
              </div>
              <div className="w-full flex flex-col gap-2 mt-2">
                <button
                  onClick={() => {
                    onArchiveHabit(archiveConfirmId);
                    setArchiveConfirmId(null);
                  }}
                  className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all"
                >
                  💤 В спячку
                </button>
                <button
                  onClick={() => setArchiveConfirmId(null)}
                  className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка «Что такое Рост?» */}
      {growthInfoHabitId && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setGrowthInfoHabitId(null)}
        >
          <div
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">📈</span>
                <h3 className="text-2xl font-black text-white">Рост</h3>
              </div>

              <p className="text-sm text-gray-300 leading-relaxed">
                Каждый день привычки делает тебя <span className="text-green-400 font-bold">лучше</span> или <span className="text-red-400 font-bold">хуже</span>. Это сложный процент — как в инвестициях.
              </p>

              <div className="bg-black/40 rounded-2xl p-4 space-y-2 border border-white/5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300">✅ Выполнил день</span>
                  <span className="text-green-400 font-mono font-bold">×1.01</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300">🔸 Мини-версия</span>
                  <span className="text-yellow-400 font-mono font-bold">×1.005</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300">❄️ Заморозка</span>
                  <span className="text-cyan-400 font-mono font-bold">×1.00</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300">✗ Пропустил</span>
                  <span className="text-red-400 font-mono font-bold">×0.99</span>
                </div>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed">
                Кажется мелочью? Но это сложный процент:
              </p>

              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl p-4 space-y-2 border border-green-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">День 1</span>
                  <span className="text-sm text-white font-mono font-bold">×1.01</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">День 30</span>
                  <span className="text-sm text-white font-mono font-bold">×1.35 <span className="text-green-400 text-xs ml-1">+35%</span></span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Год</span>
                  <span className="text-base text-green-400 font-mono font-black">×37.78 <span className="text-xs ml-1">+3678%</span></span>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 italic leading-relaxed text-center">
                Каждый день — маленький шаг. За год они складываются в результат.
                <br />
                <span className="text-gray-400">— Джеймс Клир, «Атомные привычки»</span>
              </p>

              <button
                onClick={() => setGrowthInfoHabitId(null)}
                className="mt-2 py-3 px-8 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold text-white transition-all"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};  