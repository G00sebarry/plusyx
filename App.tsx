import React, { useState, useEffect, useRef } from 'react';
import { KanbanBoard } from './components/KanbanBoard';
import { CalendarView } from './components/CalendarView';
import { BottomNav } from './components/BottomNav';
import { TaskModal } from './components/TaskModal';
import { HabitTracker } from './components/HabitTracker';
import { HabitModal } from './components/HabitModal';
import { Task, ViewType, TaskStatus, Habit, Column } from './types';

// Хелпер для получения даты в формате YYYY-MM-DD без сдвига часовых поясов
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
  
  // ИСПРАВЛЕНИЕ: Сразу загружаем данные при старте (Lazy Initialization)
  const [columns, setColumns] = useState<Column[]>(() => {
    const saved = localStorage.getItem('plusyx_columns_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) return parsed;
      } catch (e) { console.error(e); }
    }
    return DEFAULT_COLUMNS;
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('plusyx_tasks_v10');
    return saved ? JSON.parse(saved) : [];
  });

  const [habits, setHabits] = useState<Habit[]>(() => {
    const saved = localStorage.getItem('plusyx_habits_v1');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [editingHabit, setEditingHabit] = useState<Habit | undefined>(undefined);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<string | null>(null);
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('plusyx_theme') as 'light' | 'dark') || 'light'; 
  });

  const [wallpaper, setWallpaper] = useState<string>(() => localStorage.getItem('plusyx_wallpaper') || '');
  const [wallpaperOpacity, setWallpaperOpacity] = useState<number>(() => Number(localStorage.getItem('plusyx_wallpaper_opacity')) || 30);
  const [wallpaperPosition, setWallpaperPosition] = useState<number>(() => Number(localStorage.getItem('plusyx_wallpaper_position')) || 50);

  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('plusyx_theme', theme);
  }, [theme]);

  // Save Data
  useEffect(() => {
    localStorage.setItem('plusyx_tasks_v10', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('plusyx_habits_v1', JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem('plusyx_columns_v1', JSON.stringify(columns));
  }, [columns]);

  useEffect(() => {
    localStorage.setItem('plusyx_wallpaper', wallpaper);
    localStorage.setItem('plusyx_wallpaper_opacity', wallpaperOpacity.toString());
    localStorage.setItem('plusyx_wallpaper_position', wallpaperPosition.toString());
  }, [wallpaper, wallpaperOpacity, wallpaperPosition]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.MainButton.setText(view === 'tracker' ? "Новая привычка" : "Создать задачу");
      tg.MainButton.show();
      const handleClick = () => {
        if (view === 'tracker') {
          setEditingHabit(undefined);
          setIsHabitModalOpen(true);
        } else {
          setEditingTask(undefined);
          setIsTaskModalOpen(true);
        }
      };
      tg.MainButton.onClick(handleClick);
      return () => tg.MainButton.offClick(handleClick);
    }
  }, [view]);

  const handleAddTask = (taskData: Omit<Task, 'id'>) => {
    let cId = taskData.columnId;
    if (!cId) {
      const col = columns.find(c => c.type === taskData.status) || columns[0];
      cId = col?.id || 'col-todo'; 
    }
    const newTask: Task = { ...taskData, id: Math.random().toString(36).substr(2, 9), columnId: cId };
    setTasks(prev => [newTask, ...prev]);
    setIsTaskModalOpen(false);
    setEditingTask(undefined);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    setIsTaskModalOpen(false);
    setEditingTask(undefined);
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
  };

  // --- НОВАЯ ФУНКЦИЯ КОПИРОВАНИЯ ---
  const handleCopyTask = (originalTaskId: string, newTitle: string) => {
    const originalTask = tasks.find(t => t.id === originalTaskId);
    if (!originalTask) return;

    // Глубокое копирование чек-листов, чтобы разорвать связь с оригиналом
    // и дать элементам новые ID (на всякий случай)
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
        comments: [] // Комментарии не копируем, начинаем с чистого листа
    };

    setTasks(prev => {
        // Находим индекс оригинала, чтобы вставить копию сразу за ним
        const index = prev.findIndex(t => t.id === originalTaskId);
        if (index === -1) return [newTask, ...prev];

        const newTasks = [...prev];
        newTasks.splice(index + 1, 0, newTask);
        return newTasks;
    });
  };
  // ---------------------------------

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
      if (h.id === id) {
        return { ...h, history: { ...h.history, [date]: value } };
      }
      return h;
    }));
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
  };

  const handleWallpaperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) { alert("Файл слишком большой! Выберите фото поменьше (до 3МБ), иначе приложение лопнет"); return; }
      const reader = new FileReader();
      reader.onload = (ev) => setWallpaper(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleMoveTask = (id: string, targetColId: string, targetId?: string) => {
    const targetCol = columns.find(c => c.id === targetColId);
    if (!targetCol) return;

    setTasks(prev => {
      const res = [...prev];
      const idx = res.findIndex(t => t.id === id);
      if (idx === -1) return prev;
      
      const [task] = res.splice(idx, 1);
      task.columnId = targetColId;
      task.status = targetCol.type; 

      if (targetId) {
        const tIdx = res.findIndex(t => t.id === targetId);
        res.splice(tIdx === -1 ? res.length : tIdx, 0, task);
      } else {
        res.push(task);
      }
      return res;
    });
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden tg-bg select-none relative">
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
        </div>
        <div className="flex gap-2 relative">
            <button 
              onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)} 
              className={`w-10 h-10 rounded-xl bg-[var(--tg-theme-button-color)] text-white flex items-center justify-center shadow-lg active:scale-90 transition-all ${isCreateMenuOpen ? 'rotate-45' : ''}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>

            {isCreateMenuOpen && (
              <div className="absolute right-0 top-12 w-48 tg-secondary-bg rounded-2xl shadow-2xl border border-gray-400/10 p-2 animate-in slide-in-from-top-2 duration-200 z-[200]">
                <button 
                  onClick={() => { setIsTaskModalOpen(true); setIsCreateMenuOpen(false); setEditingTask(undefined); }}
                  className="w-full text-left p-3 hover:bg-black/5 rounded-xl flex items-center gap-3 transition-colors"
                >
                  <span className="text-blue-500 text-lg">📝</span>
                  <span className="text-sm font-bold tg-text">Новая задача</span>
                </button>
                <button 
                  onClick={() => { setIsHabitModalOpen(true); setIsCreateMenuOpen(false); setEditingHabit(undefined); }}
                  className="w-full text-left p-3 hover:bg-black/5 rounded-xl flex items-center gap-3 transition-colors"
                >
                  <span className="text-green-500 text-lg">🌱</span>
                  <span className="text-sm font-bold tg-text">Новая привычка</span>
                </button>
              </div>
            )}

            <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 rounded-xl tg-secondary-bg border border-gray-400/10 flex items-center justify-center shadow-sm active:scale-90 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
        </div>
      </header>

      {isCreateMenuOpen && <div className="fixed inset-0 z-[140]" onClick={() => setIsCreateMenuOpen(false)} />}

      <main className="flex-1 overflow-y-auto pb-24 relative z-10">
        {view === 'kanban' && (
          <KanbanBoard 
            tasks={tasks}
            columns={columns}
            onUpdateColumns={setColumns}
            onMoveTask={handleMoveTask} 
            onEditTask={setEditingTask} 
            onDeleteTask={setTaskToDelete} 
            // --- ПЕРЕДАЕМ ПРОПС ---
            onCopyTask={handleCopyTask}
            // ----------------------
            onQuickAdd={(s, cId) => {
              setEditingTask({
                id:'', title:'', description:'', 
                date:toLocalDateString(new Date()), status:s, columnId: cId,
                checklists: [], comments: []
              } as Task); 
              setIsTaskModalOpen(true);
            }} 
            onDragEnd={() => {}} 
          />
        )}
        {view === 'calendar' && (
          <CalendarView tasks={tasks} habits={habits} onEditTask={(t) => { setEditingTask(t); setIsTaskModalOpen(true); }} />
        )}
        {view === 'tracker' && (
          <HabitTracker 
            habits={habits} 
            onToggleHabit={handleToggleHabit} 
            onEditHabit={(h) => { setEditingHabit(h); setIsHabitModalOpen(true); }} 
            onDeleteHabit={(id) => setHabitToDelete(id)} 
            onAddHabit={() => { setEditingHabit(undefined); setIsHabitModalOpen(true); }}
            onReorderHabits={setHabits}
          />
        )}
      </main>

      <BottomNav activeView={view} onViewChange={setView} />

      <TaskModal 
        isOpen={isTaskModalOpen || (!!editingTask && !!editingTask.id)} 
        onClose={() => { setIsTaskModalOpen(false); setEditingTask(undefined); }} 
        onSave={editingTask?.id ? handleUpdateTask : handleAddTask} 
        initialTask={editingTask} 
      />

      <HabitModal
        isOpen={isHabitModalOpen || (!!editingHabit && !!editingHabit.id)}
        onClose={() => { setIsHabitModalOpen(false); setEditingHabit(undefined); }}
        onSave={editingHabit?.id ? handleUpdateHabit : handleAddHabit}
        initialHabit={editingHabit}
      />

      {(taskToDelete || habitToDelete) && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setTaskToDelete(null); setHabitToDelete(null); }} />
            <div className="relative w-full max-w-xs tg-bg rounded-[32px] p-8 shadow-2xl flex flex-col gap-6 animate-in zoom-in duration-200">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </div>
                <h2 className="text-xl font-black tg-text text-center uppercase tracking-widest leading-tight">
                  {taskToDelete ? 'Удалить задачу?' : 'Удалить привычку?'}
                </h2>
                <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => { 
                        if (taskToDelete) {
                          setTasks(prev => prev.filter(t => t.id !== taskToDelete)); 
                          setTaskToDelete(null); 
                        } else {
                          setHabits(prev => prev.filter(h => h.id !== habitToDelete));
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
                          <button 
                            onClick={() => wallpaperInputRef.current?.click()} 
                            className="w-full py-3 rounded-xl border border-dashed border-gray-400/30 tg-text text-[9px] font-black uppercase tracking-widest hover:bg-black/5 transition-all"
                          >
                             📁 Загрузить фон
                          </button>
                        ) : (
                          <div className="flex flex-col gap-4">
                             <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between px-1">
                                   <span className="text-[8px] font-black tg-hint uppercase">Яркость</span>
                                   <span className="text-[8px] font-black tg-text">{wallpaperOpacity}%</span>
                                </div>
                                <input 
                                  type="range" min="5" max="100" 
                                  value={wallpaperOpacity} 
                                  onChange={e => setWallpaperOpacity(Number(e.target.value))} 
                                  className="w-full h-1 bg-black/10 rounded-full accent-blue-500 appearance-none"
                                />
                             </div>
                             <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between px-1">
                                   <span className="text-[8px] font-black tg-hint uppercase">Позиция</span>
                                   <span className="text-[8px] font-black tg-text">{wallpaperPosition}%</span>
                                </div>
                                <input 
                                  type="range" min="0" max="100" 
                                  value={wallpaperPosition} 
                                  onChange={e => setWallpaperPosition(Number(e.target.value))} 
                                  className="w-full h-1 bg-black/10 rounded-full accent-orange-500 appearance-none"
                                />
                             </div>
                             <button 
                                onClick={() => wallpaperInputRef.current?.click()} 
                                className="w-full py-2 rounded-lg bg-black/5 tg-text text-[8px] font-black uppercase tracking-widest"
                             >
                                Сменить фото
                             </button>
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
