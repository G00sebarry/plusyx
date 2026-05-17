import React, { useState, useEffect } from 'react';
import { Habit, Task, Column } from '../types';
import {
  fetchSleepingHabits,
  fetchSleepingTasks,
  awakeHabit,
  restoreTask,
  deleteHabitFromDb,
  deleteTaskFromDb,
} from '../api';

interface SleepingScreenProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  columns: Column[];
  onHabitAwakened: (habit: Habit) => void;        // вернуть в habits в App.tsx
  onTaskRestored: (task: Task, columnTitle: string) => void; // вернуть в tasks в App.tsx
  onCountChanged: () => void; // обновить бейдж в настройках
}

const COLOR_MAP: Record<string, string> = {
  'slate': 'bg-slate-500', 'red': 'bg-red-500', 'orange': 'bg-orange-500',
  'green': 'bg-green-500', 'blue': 'bg-blue-500', 'purple': 'bg-purple-500', 'pink': 'bg-pink-500',
};

const formatArchiveDate = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'сегодня';
  if (diffDays === 1) return 'вчера';
  if (diffDays < 7) return `${diffDays} дн. назад`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? 'неделю назад' : `${weeks} нед. назад`;
  }
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Упрощённый расчёт лучшей серии (для отображения "финального достижения")
const calculateFinalBestStreak = (habit: Habit): number => {
  const keys = Object.keys(habit.history || {}).sort();
  let maxStreak = 0;
  let cur = 0;
  let prev: Date | null = null;
  
  // Учитываем reactivatedAt если был
  const startISO = habit.reactivatedAt;
  let startDate: Date | null = null;
  if (startISO) {
    startDate = new Date(startISO);
    startDate.setHours(0, 0, 0, 0);
  }
  
  for (const ds of keys) {
    const [y, m, d] = ds.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (startDate && date < startDate) continue;
    
    const v = habit.history[ds];
    if (v === 'freeze') { cur = 0; prev = null; continue; }
    
    if (v === true || v === 'mini') {
      if (prev) {
        const next = new Date(prev); next.setDate(next.getDate() + 1);
        if (next.getTime() === date.getTime()) cur++;
        else cur = 1;
      } else cur = 1;
      maxStreak = Math.max(maxStreak, cur);
      prev = date;
    } else { cur = 0; prev = null; }
  }
  
  return Math.max(maxStreak, habit.allTimeBestStreak || 0);
};

// Упрощённый расчёт финального Роста (полная копия логики из HabitTracker, сжатая)
const calculateFinalGrowth = (habit: Habit): { growth: number; daysSinceStart: number } => {
  const isScheduled = (date: Date): boolean => {
    if (habit.frequency.days.includes(date.getDay())) return true;
    if (habit.frequency.customDates && habit.frequency.customDates.length > 0) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return habit.frequency.customDates.includes(`${y}-${m}-${d}`);
    }
    return false;
  };
  
  // Точка отсчёта
  let startDate: Date | null = null;
  if (habit.reactivatedAt) {
    startDate = new Date(habit.reactivatedAt);
    startDate.setHours(0, 0, 0, 0);
  } else {
    const keys = Object.keys(habit.history || {}).sort();
    if (keys.length === 0) return { growth: 1, daysSinceStart: 0 };
    const [sy, sm, sd] = keys[0].split('-').map(Number);
    startDate = new Date(sy, sm - 1, sd);
    startDate.setHours(0, 0, 0, 0);
  }
  
  // Конечная точка — дата отправки в спячку
  const endDate = habit.archivedAt ? new Date(habit.archivedAt) : new Date();
  endDate.setHours(0, 0, 0, 0);
  
  let growth = 1;
  let dayCount = 0;
  const cursor = new Date(startDate);
  
  while (cursor <= endDate) {
    dayCount++;
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    const ds = `${y}-${m}-${d}`;
    const val = habit.history[ds];
    const scheduled = isScheduled(cursor);
    
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
  
  return { growth, daysSinceStart: dayCount };
};

const formatGrowth = (g: number): string => {
  if (g >= 10) return `×${g.toFixed(0)}`;
  if (g >= 2) return `×${g.toFixed(1)}`;
  return `×${g.toFixed(2)}`;
};

export const SleepingScreen: React.FC<SleepingScreenProps> = ({
  isOpen, onClose, userId, columns, onHabitAwakened, onTaskRestored, onCountChanged
}) => {
  const [activeTab, setActiveTab] = useState<'habits' | 'tasks'>('habits');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Подтверждения
  const [awakeConfirm, setAwakeConfirm] = useState<{ type: 'habit' | 'task'; id: string; title: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'habit' | 'task'; id: string; title: string } | null>(null);
  
  // Локальный тост (внутри экрана)
  const [localToast, setLocalToast] = useState<{ icon: string; message: string } | null>(null);
  const showLocalToast = (icon: string, message: string) => {
    setLocalToast({ icon, message });
    setTimeout(() => setLocalToast(null), 2500);
  };

  // Загрузка при открытии
  useEffect(() => {
    if (!isOpen || !userId) return;
    let cancelled = false;
    
    const load = async () => {
      setIsLoading(true);
      try {
        const [h, t] = await Promise.all([
          fetchSleepingHabits(userId),
          fetchSleepingTasks(userId)
        ]);
        if (!cancelled) {
          setHabits(h);
          setTasks(t);
        }
      } catch (e) {
        console.error('Failed to load sleeping items:', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    
    load();
    return () => { cancelled = true; };
  }, [isOpen, userId]);

  const handleAwakeHabit = async (habitId: string) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    
    setAwakeConfirm(null);
    
    // 💤 Создаём пробуждённую версию: history оставляем (для allTime view),
    // reactivatedAt = now, archivedAt = null, allTimeBestStreak обновляем если побит
    const finalBest = calculateFinalBestStreak(habit);
    const wokenHabit: Habit = {
      ...habit,
      archivedAt: undefined,
      reactivatedAt: new Date().toISOString(),
      allTimeBestStreak: Math.max(habit.allTimeBestStreak || 0, finalBest)
    };
    
    // Убираем из локального списка спящих
    setHabits(prev => prev.filter(h => h.id !== habitId));
    showLocalToast('🌅', 'Привычка пробудилась');
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    
    // Зовём БД и App.tsx
    await awakeHabit(habitId, userId);
    onHabitAwakened(wokenHabit);
    onCountChanged();
  };

  const handleRestoreTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    setAwakeConfirm(null);
    
    // Куда восстанавливать: original_column_id если существует, иначе первая колонка
    const fallbackColumnId = columns[0]?.id || '';
    setTasks(prev => prev.filter(t => t.id !== taskId));
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    
    const result = await restoreTask(taskId, userId, fallbackColumnId);
    const restoredColumnId = result?.restoredColumnId || fallbackColumnId;
    const restoredCol = columns.find(c => c.id === restoredColumnId);
    const colTitle = restoredCol?.title || 'первой колонке';
    
    // Задача с восстановленным columnId
    const restoredTask: Task = {
      ...task,
      archivedAt: undefined,
      originalColumnId: undefined,
      columnId: restoredColumnId,
      status: restoredCol?.type || task.status
    };
    
    // Если колонка изменилась — предупредим юзера
    const wasOriginal = task.originalColumnId === restoredColumnId;
    if (!wasOriginal && task.originalColumnId) {
      showLocalToast('⚠️', `Колонка удалена, задача в "${colTitle}"`);
    } else {
      showLocalToast('🌅', 'Задача восстановлена');
    }
    
    onTaskRestored(restoredTask, colTitle);
    onCountChanged();
  };

  const handleDeleteHabitForever = async (habitId: string) => {
    setDeleteConfirm(null);
    setHabits(prev => prev.filter(h => h.id !== habitId));
    showLocalToast('🗑️', 'Удалено навсегда');
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning');
    await deleteHabitFromDb(habitId);
    onCountChanged();
  };

  const handleDeleteTaskForever = async (taskId: string) => {
    setDeleteConfirm(null);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    showLocalToast('🗑️', 'Удалено навсегда');
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning');
    await deleteTaskFromDb(taskId);
    onCountChanged();
  };

  if (!isOpen) return null;

  const totalCount = habits.length + tasks.length;
  const isEmpty = !isLoading && totalCount === 0;

  return (
    <div className="fixed inset-0 z-[350] tg-bg flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <header className="px-5 py-4 flex justify-between items-center border-b border-gray-200/10 tg-secondary-bg/80 backdrop-blur-md shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💤</span>
          <div className="flex flex-col">
            <h2 className="text-lg font-black tg-text uppercase tracking-tight">Спячка</h2>
            {totalCount > 0 && (
              <span className="text-[9px] tg-hint font-bold">{totalCount} {totalCount === 1 ? 'элемент' : totalCount < 5 ? 'элемента' : 'элементов'}</span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center tg-secondary-bg tg-text rounded-full font-light text-2xl active:scale-95 transition-all"
        >
          ×
        </button>
      </header>

      {/* Tabs */}
      {!isEmpty && (
        <div className="px-5 py-3 shrink-0">
          <div className="bg-black/10 p-1 rounded-2xl flex relative border border-white/5">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl shadow-md transition-all duration-300 ease-out bg-blue-500 ${
                activeTab === 'habits' ? 'left-1' : 'left-[calc(50%+3px)]'
              }`}
            />
            <button
              onClick={() => setActiveTab('habits')}
              className={`flex-1 relative z-10 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${
                activeTab === 'habits' ? 'text-white' : 'tg-hint'
              }`}
            >
              Привычки {habits.length > 0 && `(${habits.length})`}
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex-1 relative z-10 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${
                activeTab === 'tasks' ? 'text-white' : 'tg-hint'
              }`}
            >
              Задачи {tasks.length > 0 && `(${tasks.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24 px-5 no-scrollbar">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6 px-6">
            <div className="text-7xl animate-pulse opacity-60">💤</div>
            <p className="text-sm tg-hint max-w-[280px] leading-relaxed">
              Здесь будут привычки и задачи, которые ты отправил в спячку
            </p>
          </div>
        )}

        {!isLoading && !isEmpty && activeTab === 'habits' && (
          <div className="flex flex-col gap-4 pt-2 max-w-2xl mx-auto">
            {habits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="text-5xl opacity-40">🌱</div>
                <p className="text-xs tg-hint">Нет спящих привычек</p>
              </div>
            ) : habits.map(habit => {
              const hasCover = !!habit.fileData;
              const finalGrowth = calculateFinalGrowth(habit);
              const finalBest = calculateFinalBestStreak(habit);
              
              return (
                <div
                  key={habit.id}
                  className={`relative overflow-hidden rounded-[28px] p-5 flex flex-col gap-3 ${
                    !hasCover ? 'tg-secondary-bg border border-gray-400/5' : 'cover-preserve'
                  }`}
                  style={hasCover ? {
                    backgroundImage: `url(${habit.fileData})`,
                    backgroundSize: 'cover',
                    backgroundPosition: `50% ${habit.coverPosition ?? 50}%`
                  } : {}}
                >
                  {hasCover && (
                    <div
                      className="absolute inset-0 z-0"
                      style={{ backgroundColor: `rgba(0,0,0,${Math.max((habit.coverIntensity ?? 60) / 100, 0.65)})` }}
                    />
                  )}
                  
                  {/* Бейдж "В СПЯЧКЕ" */}
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/20 backdrop-blur-sm border border-blue-500/30">
                    <span className="text-[10px]">💤</span>
                    <span className="text-[8px] font-black uppercase tracking-wider text-blue-300">Спит</span>
                  </div>

                  {/* Header привычки */}
                  <div className="relative z-10 flex items-center gap-2.5">
                    <div className={`w-12 h-12 rounded-xl ${habit.color} flex items-center justify-center text-2xl shrink-0 shadow-sm border border-white/10 opacity-70`}>
                      {habit.emoji || '🔥'}
                    </div>
                    <div className="flex flex-col">
                      {habit.identity && (
                        <div className="self-start px-1.5 py-0.5 rounded-md bg-white/20 backdrop-blur-sm text-[7px] font-black uppercase tracking-widest text-white mb-0.5 shadow-sm border border-white/10 w-fit">
                          {habit.identity}
                        </div>
                      )}
                      <span className={`text-sm font-black uppercase tracking-tight ${hasCover ? 'text-white drop-shadow-md' : 'tg-text'}`}>
                        {habit.title}
                      </span>
                      {habit.archivedAt && (
                        <span className={`text-[9px] mt-0.5 ${hasCover ? 'text-white/60' : 'tg-hint'}`}>
                          уснула {formatArchiveDate(habit.archivedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Финальные метрики — "надгробие" */}
                  <div className={`relative z-10 grid grid-cols-3 gap-2 mt-1 p-3 rounded-2xl ${hasCover ? 'bg-black/40 backdrop-blur-sm border border-white/10' : 'bg-black/20 border border-white/5'}`}>
                    <div className="text-center">
                      <div className={`text-base font-black ${hasCover ? 'text-green-300' : 'text-green-500'}`}>
                        {formatGrowth(finalGrowth.growth)}
                      </div>
                      <div className={`text-[7px] font-bold uppercase tracking-wider ${hasCover ? 'text-white/50' : 'tg-hint'}`}>
                        Финальный рост
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`text-base font-black ${hasCover ? 'text-orange-300' : 'text-orange-500'}`}>
                        ⭐ {finalBest}
                      </div>
                      <div className={`text-[7px] font-bold uppercase tracking-wider ${hasCover ? 'text-white/50' : 'tg-hint'}`}>
                        Лучшая серия
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`text-base font-black ${hasCover ? 'text-white' : 'tg-text'}`}>
                        {finalGrowth.daysSinceStart}
                      </div>
                      <div className={`text-[7px] font-bold uppercase tracking-wider ${hasCover ? 'text-white/50' : 'tg-hint'}`}>
                        Дней прожито
                      </div>
                    </div>
                  </div>

                  {/* Действия */}
                  <div className="relative z-10 flex gap-2 mt-1">
                    <button
                      onClick={() => setAwakeConfirm({ type: 'habit', id: habit.id, title: habit.title })}
                      className="flex-1 py-3 px-4 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-black uppercase text-[10px] tracking-wider transition-all active:scale-95 shadow-lg flex items-center justify-center gap-1.5"
                    >
                      <span>🌅</span>
                      <span>Разбудить</span>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ type: 'habit', id: habit.id, title: habit.title })}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                        hasCover ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                      }`}
                      title="Удалить навсегда"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && !isEmpty && activeTab === 'tasks' && (
          <div className="flex flex-col gap-2 pt-2 max-w-2xl mx-auto">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="text-5xl opacity-40">📝</div>
                <p className="text-xs tg-hint">Нет спящих задач</p>
              </div>
            ) : tasks.map(task => {
              const colorBar = task.color && task.color !== 'default' ? COLOR_MAP[task.color] : null;
              const originalCol = columns.find(c => c.id === task.originalColumnId);
              
              return (
                <div
                  key={task.id}
                  className="relative tg-secondary-bg p-4 rounded-2xl border border-gray-100/10 flex items-center gap-3"
                >
                  {colorBar && (
                    <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${colorBar}`} />
                  )}
                  
                  <div className="flex-1 min-w-0 pl-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base">💤</span>
                      <h3 className="text-sm font-bold tg-text truncate">{task.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.archivedAt && (
                        <span className="text-[9px] tg-hint">уснула {formatArchiveDate(task.archivedAt)}</span>
                      )}
                      {originalCol && (
                        <>
                          <span className="text-[8px] tg-hint opacity-40">·</span>
                          <span className="text-[9px] tg-hint">из «{originalCol.title}»</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => setAwakeConfirm({ type: 'task', id: task.id, title: task.title })}
                      className="px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-black uppercase text-[9px] tracking-wider transition-all active:scale-95 shadow-sm"
                    >
                      🌅 Вернуть
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ type: 'task', id: task.id, title: task.title })}
                      className="w-9 h-9 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center transition-all active:scale-95"
                      title="Удалить навсегда"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Подтверждение пробуждения */}
      {awakeConfirm && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setAwakeConfirm(null)}
        >
          <div
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="text-6xl">🌅</div>
              <h3 className="text-xl font-black text-white">
                {awakeConfirm.type === 'habit' ? 'Разбудить привычку?' : 'Восстановить задачу?'}
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                «{awakeConfirm.title}»
              </p>
              {awakeConfirm.type === 'habit' && (
                <div className="w-full py-3 px-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                  <p className="text-xs text-yellow-200 leading-relaxed">
                    Рост и серия начнутся с нуля. Личный рекорд сохранится.
                  </p>
                </div>
              )}
              <div className="w-full flex flex-col gap-2 mt-2">
                <button
                  onClick={() => awakeConfirm.type === 'habit' ? handleAwakeHabit(awakeConfirm.id) : handleRestoreTask(awakeConfirm.id)}
                  className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all"
                >
                  🌅 {awakeConfirm.type === 'habit' ? 'Разбудить' : 'Восстановить'}
                </button>
                <button
                  onClick={() => setAwakeConfirm(null)}
                  className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Подтверждение удаления навсегда */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
              </div>
              <h3 className="text-xl font-black text-white">Удалить навсегда?</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                «{deleteConfirm.title}»
              </p>
              <div className="w-full py-3 px-4 bg-red-500/10 rounded-xl border border-red-500/20">
                <p className="text-xs text-red-300 leading-relaxed">
                  Это действие нельзя отменить. Вся история {deleteConfirm.type === 'habit' ? 'привычки' : 'задачи'} будет потеряна.
                </p>
              </div>
              <div className="w-full flex flex-col gap-2 mt-2">
                <button
                  onClick={() => deleteConfirm.type === 'habit' ? handleDeleteHabitForever(deleteConfirm.id) : handleDeleteTaskForever(deleteConfirm.id)}
                  className="w-full py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all"
                >
                  🗑️ Удалить навсегда
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Локальный тост */}
      {localToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[700] px-5 py-3 bg-[#1c1c1e] rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-2xl">{localToast.icon}</span>
          <span className="text-sm font-bold text-white">{localToast.message}</span>
        </div>
      )}
    </div>
  );
};
