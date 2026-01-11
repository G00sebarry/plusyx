import React, { useState, useEffect, useRef } from 'react';
import { KanbanBoard } from './components/KanbanBoard';
import { CalendarView } from './components/CalendarView';
import { BottomNav } from './components/BottomNav';
import { TaskModal } from './components/TaskModal';
import { HabitTracker } from './components/HabitTracker';
import { HabitModal } from './components/HabitModal';
import { AntiHabitModal } from './components/AntiHabitModal';
import { Task, ViewType, TaskStatus, Habit, Column, AntiHabit } from './types';
import { supabase } from './supabaseClient';

// 🔥 ИМПОРТИРУЕМ НАШИ НОВЫЕ ФУНКЦИИ РАБОТЫ С БАЗОЙ
import { fetchTasks, fetchColumns, saveTaskToDb, deleteTaskFromDb, saveColumnsToDb } from './api';

// Хелпер для получения даты
const toLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const DEFAULT_COLUMNS: Column[] = [
  { id: 'col-todo', title: 'Очередь', type: 'todo' },
  { id: 'col-progress', title: 'В работе', type: 'in-progress' },
  { id: 'col-done', title: 'Готово', type: 'done' }
];

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('kanban');
  const [isLoading, setIsLoading] = useState(true); // ⏳ Индикатор загрузки базы

  // --- STATE: ТЕПЕРЬ НАЧИНАЕМ С ПУСТЫХ МАССИВОВ (Ждем базу) ---
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // --- STATE: ПРИВЫЧКИ (ПОКА ОСТАВЛЯЕМ LOCALSTORAGE, ПЕРЕНЕСЕМ ПОЗЖЕ) ---
  const [habits, setHabits] = useState<Habit[]>(() => {
    try {
      const saved = localStorage.getItem('plusyx_habits_v1');
      let parsed = saved ? JSON.parse(saved) : [];
      // Миграция старых данных (твой код)
      parsed = parsed.map((h: any) => ({
        ...h,
        title: h.title || h.name || 'Привычка',
        frequency: {
          type: h.frequency?.type || 'daily',
          days: Array.isArray(h.frequency?.days) ? h.frequency.days : [0, 1, 2, 3, 4, 5, 6]
        },
        emoji: h.emoji || '🔥',
        description: h.description || h.question || '',
        history: h.history || {}
      }));
      return parsed;
    } catch (e) { return []; }
  });

  const [antiHabits, setAntiHabits] = useState<AntiHabit[]>(() => {
    try {
        const saved = localStorage.getItem('plusyx_antihabits_v1');
        return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });
  
  // --- UI STATE ---
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [isAntiHabitModalOpen, setIsAntiHabitModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [editingHabit, setEditingHabit] = useState<Habit | undefined>(undefined);
  const [editingAntiHabit, setEditingAntiHabit] = useState<AntiHabit | undefined>(undefined);
  
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<string | null>(null);
  
  // --- THEME & WALLPAPER (ЭТО ОСТАВЛЯЕМ В LOCALSTORAGE - ТАК БЫСТРЕЕ) ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('plusyx_theme') as 'light' | 'dark') || 'light'; 
  });
  const [wallpaper, setWallpaper] = useState<string>(() => localStorage.getItem('plusyx_wallpaper') || '');
  const [wallpaperOpacity, setWallpaperOpacity] = useState<number>(() => Number(localStorage.getItem('plusyx_wallpaper_opacity')) || 30);
  const [wallpaperPosition, setWallpaperPosition] = useState<number>(() => Number(localStorage.getItem('plusyx_wallpaper_position')) || 50);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  // --- 🔥 1. ЗАГРУЗКА ДАННЫХ ИЗ SUPABASE ---
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      try {
        const [dbTasks, dbColumns] = await Promise.all([ fetchTasks(), fetchColumns() ]);
        
        setTasks(dbTasks);
        
        if (dbColumns && dbColumns.length > 0) {
          setColumns(dbColumns);
        } else {
          // Если база новая и колонок нет - сохраним дефолтные туда
          await saveColumnsToDb(DEFAULT_COLUMNS);
        }
      } catch (e) {
        console.error("Critical Init Error:", e);
      } finally {
        setIsLoading(false);
      }
    };
    initData();
  }, []);

  // --- EFFECTS (Только для локальных настроек и привычек) ---
  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('plusyx_theme', theme);
  }, [theme]);

  // УБРАЛИ сохранение tasks и columns в LocalStorage! Теперь только в БД.
  useEffect(() => { localStorage.setItem('plusyx_habits_v1', JSON.stringify(habits)); }, [habits]);
  useEffect(() => { localStorage.setItem('plusyx_antihabits_v1', JSON.stringify(antiHabits)); }, [antiHabits]); 
  
  useEffect(() => {
    localStorage.setItem('plusyx_wallpaper', wallpaper);
    localStorage.setItem('plusyx_wallpaper_opacity', wallpaperOpacity.toString());
    localStorage.setItem('plusyx_wallpaper_position', wallpaperPosition.toString());
  }, [wallpaper, wallpaperOpacity, wallpaperPosition]);

  // Telegram Setup
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      if (view === 'tracker') {
        tg.MainButton.hide();
      } else {
        tg.MainButton.setText("Создать задачу");
        tg.MainButton.show();
      }
      const handleClick = () => {
         setEditingTask(undefined);
         setIsTaskModalOpen(true);
      };
      tg.MainButton.onClick(handleClick);
      return () => tg.MainButton.offClick(handleClick);
    }
  }, [view]);

  // --- 🔥 ОБРАБОТЧИКИ ЗАДАЧ (С DB) ---
  
  const handleAddTask = async (taskData: Omit<Task, 'id'>) => {
    let cId = taskData.columnId;
    if (!cId) {
      const col = columns.find(c => c.type === taskData.status) || columns[0];
      cId = col?.id || 'col-todo'; 
    }
    // Генерируем ID локально для оптимистичного UI
    const newTask: Task = { ...taskData, id: Math.random().toString(36).substr(2, 9), columnId: cId };
    
    // 1. Сразу обновляем экран (чтобы юзер не ждал)
    setTasks(prev => [newTask, ...prev]);
    setIsTaskModalOpen(false);
    setEditingTask(undefined);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');

    // 2. Тихо сохраняем в базу
    await saveTaskToDb(newTask);
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    // 1. UI
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    setIsTaskModalOpen(false);
    setEditingTask(undefined);
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');

    // 2. DB
    await saveTaskToDb(updatedTask);
  };

  const handleDeleteTaskConfirm = async () => {
     if (taskToDelete) {
        const id = taskToDelete;
        // 1. UI
        setTasks(prev => prev.filter(t => t.id !== id)); 
        setTaskToDelete(null);
        // 2. DB
        await deleteTaskFromDb(id);
     }
  };

  const handleCopyTask = async (originalTaskId: string, newTitle: string) => {
    const originalTask = tasks.find(t => t.id === originalTaskId);
    if (!originalTask) return;

    // Генерируем новые ID для чек-листов, чтобы они не были связаны
    const newChecklists = originalTask.checklists.map(list => ({
        ...list,
        id: Math.random().toString(36).substr(2, 9),
        items: list.items.map(item => ({...item, id: Math.random().toString(36).substr(2, 9)}))
    }));

    const newTask: Task = {
        ...originalTask,
        id: Math.random().toString(36).substr(2, 9),
        title: newTitle,
        checklists: newChecklists,
        comments: [],
        files: [] // Файлы не копируем, чтобы не дублировать тяжелые данные
    };

    // 1. UI
    setTasks(prev => {
        const index = prev.findIndex(t => t.id === originalTaskId);
        if (index === -1) return [newTask, ...prev];
        const newTasks = [...prev];
        newTasks.splice(index + 1, 0, newTask);
        return newTasks;
    });

    // 2. DB
    await saveTaskToDb(newTask);
  };

  const handleMoveTask = async (id: string, targetColId: string, targetId?: string) => {
    const targetCol = columns.find(c => c.id === targetColId);
    if (!targetCol) return;

    // Сначала вычисляем новую задачу, чтобы отправить в БД
    let taskToSave: Task | undefined;

    setTasks(prev => {
      const res = [...prev];
      const idx = res.findIndex(t => t.id === id);
      if (idx === -1) return prev;
      
      const [task] = res.splice(idx, 1);
      task.columnId = targetColId;
      task.status = targetCol.type; 
      taskToSave = task; // Запоминаем для сохранения

      if (targetId) {
        const tIdx = res.findIndex(t => t.id === targetId);
        res.splice(tIdx === -1 ? res.length : tIdx, 0, task);
      } else {
        res.push(task);
      }
      return res;
    });

    // DB
    if (taskToSave) {
        await saveTaskToDb(taskToSave);
    }
  };

  // --- ПРИВЫЧКИ (ПОКА LOCALSTORAGE) ---
  const handleAddHabit = (habitData: Habit) => {
    setHabits(prev => [habitData, ...prev]);
    setIsHabitModalOpen(false);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
  };
  const handleUpdateHabit = (updatedHabit: Habit) => {
    setHabits(prev => prev.map(h => h.id === updatedHabit.id ? updatedHabit : h));
    setIsHabitModalOpen(false);
    setEditingHabit(undefined);
  };
  const handleToggleHabit = (id: string, date: string, value: number | boolean) => {
    setHabits(prev => prev.map(h => {
      if (h.id === id) return { ...h, history: { ...h.history, [date]: value } };
      return h;
    }));
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
  };

  // --- ВРЕДНЫЕ ПРИВЫЧКИ (ПОКА LOCALSTORAGE) ---
  const handleAddAntiHabit = (habit: AntiHabit) => {
    setAntiHabits(prev => [habit, ...prev]);
    setIsAntiHabitModalOpen(false);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
  };
  const handleUpdateAntiHabit = (habit: AntiHabit) => {
    setAntiHabits(prev => prev.map(h => h.id === habit.id ? habit : h));
    setIsAntiHabitModalOpen(false);
    setEditingAntiHabit(undefined);
  };
  const handleRelapse = (id: string) => {
    setAntiHabits(prev => prev.map(h => {
        if (h.id === id) {
            const now = Date.now();
            const currentDuration = now - h.startDate;
            const newRecord = Math.max(h.longestStreak, currentDuration);
            return {
                ...h,
                startDate: now, 
                longestStreak: newRecord,
                history: [...h.history, { date: now, duration: currentDuration }]
            };
        }
        return h;
    }));
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning');
  };

  // --- ОБОИ ---
  const handleWallpaperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) { alert("Слишком большой файл!"); return; }
      const reader = new FileReader();
      reader.onload = (ev) => setWallpaper(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // --- ЗАГРУЗОЧНЫЙ ЭКРАН ---
  if (isLoading) {
      return (
          <div className="h-screen w-screen tg-bg flex items-center justify-center flex-col gap-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-sm font-bold tg-text opacity-50 animate-pulse">Загрузка базы данных...</div>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden tg-bg select-none relative">
      {/* ОБОИ */}
      {wallpaper && (
        <div 
          className="fixed inset-0 z-0 pointer-events-none transition-all duration-300 ease-out" 
          style={{ 
            backgroundImage: `url(${wallpaper})`, 
            backgroundSize: 'cover', 
            backgroundPosition: `50% ${wallpaperPosition}%`,
            opacity: wallpaperOpacity / 100
          }} 
        />
      )}

      {/* HEADER */}
      <header className="px-5 py-4 flex justify-between items-center border-b border-gray-200/10 tg-secondary-bg/80 backdrop-blur-md shadow-sm z-[150]">
        <div className="flex items-center gap-2">
            <div className="relative w-10 h-10 flex items-center justify-center logo-shadow">
                <svg width="40" height="40" viewBox="0 0 100 100">
                    <rect x="15" y="15" width="50" height="70" fill="#9d73d2" rx="4" />
                    <circle cx="40" cy="40" r="12" fill="white" opacity="0.2" />
                    <g className="animate-plus-new" style={{ transformOrigin: 'center' }}>
                        <rect x="50" y="45" width="40" height="40" fill="#4cc3a1" rx="4" />
                        <path d="M70 55 V75 M60 65 H80" stroke="white" strokeWidth="6" strokeLinecap="round" />
                    </g>
                </svg>
            </div>
            <h1 className="text-2xl font-logo tg-text font-black ml-1">Plusyx</h1>
            {/* Индикатор облака (декор) */}
            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold border border-blue-500/30">CLOUD</span>
        </div>
        <div className="flex gap-2 relative">
            <button onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)} className={`w-10 h-10 rounded-xl bg-[var(--tg-theme-button-color)] text-white flex items-center justify-center shadow-lg active:scale-90 transition-all ${isCreateMenuOpen ? 'rotate-45' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            {isCreateMenuOpen && (
              <div className="absolute right-0 top-12 w-48 tg-secondary-bg rounded-2xl shadow-2xl border border-gray-400/10 p-2 animate-in slide-in-from-top-2 duration-200 z-[200]">
                <button onClick={() => { setIsTaskModalOpen(true); setIsCreateMenuOpen(false); setEditingTask(undefined); }} className="w-full text-left p-3 hover:bg-black/5 rounded-xl flex items-center gap-3 transition-colors">
                  <span className="text-blue-500 text-lg">📝</span><span className="text-sm font-bold tg-text">Новая задача</span>
                </button>
                <button onClick={() => { setIsHabitModalOpen(true); setIsCreateMenuOpen(false); setEditingHabit(undefined); }} className="w-full text-left p-3 hover:bg-black/5 rounded-xl flex items-center gap-3 transition-colors">
                  <span className="text-green-500 text-lg">🌱</span><span className="text-sm font-bold tg-text">Привычка</span>
                </button>
                <button onClick={() => { setIsAntiHabitModalOpen(true); setIsCreateMenuOpen(false); setEditingAntiHabit(undefined); }} className="w-full text-left p-3 hover:bg-black/5 rounded-xl flex items-center gap-3 transition-colors">
                  <span className="text-red-500 text-lg">⛔</span><span className="text-sm font-bold tg-text">Бросить</span>
                </button>
              </div>
            )}
            <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 rounded-xl tg-secondary-bg border border-gray-400/10 flex items-center justify-center shadow-sm active:scale-90 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
        </div>
      </header>
      {isCreateMenuOpen && <div className="fixed inset-0 z-[140]" onClick={() => setIsCreateMenuOpen(false)} />}

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto pb-24 relative z-10">
        {view === 'kanban' && (
          <KanbanBoard 
            tasks={tasks} columns={columns} onUpdateColumns={setColumns} onMoveTask={handleMoveTask} onEditTask={setEditingTask} onDeleteTask={setTaskToDelete} onCopyTask={handleCopyTask}
            onQuickAdd={(s, cId) => { setEditingTask({ id:'', title:'', description:'', date:toLocalDateString(new Date()), status:s, columnId: cId, checklists: [], comments: []} as Task); setIsTaskModalOpen(true); }} onDragEnd={() => {}} 
          />
        )}
        {view === 'calendar' && (
          <CalendarView tasks={tasks} habits={habits} onEditTask={(t) => { setEditingTask(t); setIsTaskModalOpen(true); }} />
        )}
        {view === 'tracker' && (
          <HabitTracker 
            habits={habits} antiHabits={antiHabits}
            onToggleHabit={handleToggleHabit} 
            onEditHabit={(h) => { setEditingHabit(h); setIsHabitModalOpen(true); }} 
            onDeleteHabit={(id) => setHabitToDelete(id)} 
            onAddHabit={() => { setEditingHabit(undefined); setIsHabitModalOpen(true); }}
            onReorderHabits={setHabits}
            onAddAntiHabit={() => { setEditingAntiHabit(undefined); setIsAntiHabitModalOpen(true); }}
            onEditAntiHabit={(h) => { setEditingAntiHabit(h); setIsAntiHabitModalOpen(true); }}
            onDeleteAntiHabit={(id) => setHabitToDelete(id)}
            onRelapseAntiHabit={handleRelapse}
          />
        )}
      </main>

      <BottomNav activeView={view} onViewChange={setView} />

      {/* MODALS */}
      <TaskModal 
        isOpen={isTaskModalOpen || (!!editingTask && !!editingTask.id)} 
        onClose={() => { setIsTaskModalOpen(false); setEditingTask(undefined); }} 
        onSave={editingTask?.id ? handleUpdateTask : handleAddTask} 
        initialTask={editingTask} columns={columns}
      />
      <HabitModal
        isOpen={isHabitModalOpen || (!!editingHabit && !!editingHabit.id)}
        onClose={() => { setIsHabitModalOpen(false); setEditingHabit(undefined); }}
        onSave={editingHabit?.id ? handleUpdateHabit : handleAddHabit}
        initialHabit={editingHabit}
      />
      <AntiHabitModal 
        isOpen={isAntiHabitModalOpen || (!!editingAntiHabit && !!editingAntiHabit.id)}
        onClose={() => { setIsAntiHabitModalOpen(false); setEditingAntiHabit(undefined); }}
        onSave={editingAntiHabit?.id ? handleUpdateAntiHabit : handleAddAntiHabit}
        initialHabit={editingAntiHabit}
      />

      {/* DELETE CONFIRM */}
      {(taskToDelete || habitToDelete) && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setTaskToDelete(null); setHabitToDelete(null); }} />
            <div className="relative w-full max-w-xs tg-bg rounded-[32px] p-8 shadow-2xl flex flex-col gap-6 animate-in zoom-in duration-200">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </div>
                <h2 className="text-xl font-black tg-text text-center uppercase tracking-widest leading-tight">
                  {taskToDelete ? 'Удалить задачу?' : 'Удалить?'}
                </h2>
                <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => { 
                        if (taskToDelete) { handleDeleteTaskConfirm(); } 
                        else {
                          setHabits(prev => prev.filter(h => h.id !== habitToDelete));
                          setAntiHabits(prev => prev.filter(h => h.id !== habitToDelete));
                          setHabitToDelete(null);
                        }
                      }} 
                      className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                    >
                      Да, удалить
                    </button>
                    <button onClick={() => { setTaskToDelete(null); setHabitToDelete(null); }} className="w-full py-4 tg-secondary-bg tg-text rounded-2xl font-bold active:scale-95 transition-all">Отмена</button>
                </div>
            </div>
        </div>
      )}

      {/* SETTINGS (Без изменений) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)} />
            <div className="relative w-[280px] tg-bg bg-opacity-80 backdrop-blur-xl rounded-[40px] p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in duration-200 border border-white/20">
                <h2 className="text-lg font-black tg-text text-center uppercase tracking-[0.2em]">Настройки</h2>
                <div className="flex flex-col gap-4 overflow-y-auto max-h-[55vh] no-scrollbar">
                    <div className="flex items-center justify-between p-4 tg-secondary-bg rounded-[24px] border border-white/5">
                        <div className="flex flex-col">
                            <span className="font-bold text-[11px] tg-text uppercase tracking-tight">Тёмная тема</span>
                        </div>
                        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className={`w-10 h-5 rounded-full transition-all relative ${theme === 'dark' ? 'bg-green-500' : 'bg-gray-400'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${theme === 'dark' ? 'right-0.5' : 'left-0.5'}`} />
                        </button>
                    </div>
                    <div className="flex flex-col gap-3 p-4 tg-secondary-bg rounded-[24px] border border-white/5">
                        <div className="flex justify-between items-center mb-1">
                           <span className="font-bold text-[11px] tg-text uppercase tracking-tight">Фон приложения</span>
                           {wallpaper && (
                             <button onClick={() => setWallpaper('')} className="text-[9px] font-black text-red-500 uppercase">Удалить</button>
                           )}
                        </div>
                        <input type="file" ref={wallpaperInputRef} accept="image/*" className="hidden" onChange={handleWallpaperChange} />
                        {!wallpaper ? (
                          <button onClick={() => wallpaperInputRef.current?.click()} className="w-full py-3 rounded-xl border border-dashed border-gray-400/30 tg-text text-[9px] font-black uppercase tracking-widest hover:bg-black/5 transition-all">📁 Загрузить фон</button>
                        ) : (
                          <div className="flex flex-col gap-4">
                             <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between px-1"><span className="text-[8px] font-black tg-hint uppercase">Яркость</span><span className="text-[8px] font-black tg-text">{wallpaperOpacity}%</span></div>
                                <input type="range" min="5" max="100" value={wallpaperOpacity} onChange={e => setWallpaperOpacity(Number(e.target.value))} className="w-full h-1 bg-black/10 rounded-full accent-blue-500 appearance-none" />
                             </div>
                             <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between px-1"><span className="text-[8px] font-black tg-hint uppercase">Позиция</span><span className="text-[8px] font-black tg-text">{wallpaperPosition}%</span></div>
                                <input type="range" min="0" max="100" value={wallpaperPosition} onChange={e => setWallpaperPosition(Number(e.target.value))} className="w-full h-1 bg-black/10 rounded-full accent-orange-500 appearance-none" />
                             </div>
                             <button onClick={() => wallpaperInputRef.current?.click()} className="w-full py-2 rounded-lg bg-black/5 tg-text text-[8px] font-black uppercase tracking-widest">Сменить фото</button>
                          </div>
                        )}
                    </div>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="w-full py-4 tg-button rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all">Готово</button>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
