import React, { useState, useEffect, useRef } from 'react';
import { KanbanBoard } from './components/KanbanBoard';
import { CalendarView } from './components/CalendarView';
import { BottomNav } from './components/BottomNav';
import { TaskModal } from './components/TaskModal';
import { HabitTracker } from './components/HabitTracker';
import { HabitModal } from './components/HabitModal';
import { AntiHabitModal } from './components/AntiHabitModal';
import { Task, ViewType, Habit, Column, AntiHabit } from './types';
import { supabase } from './supabaseClient';

import { 
  fetchTasks, fetchColumns, saveTaskToDb, deleteTaskFromDb, saveColumnsToDb, saveTasksOrderToDb, deleteColumnFromDb,
  fetchHabits, saveHabitToDb, deleteHabitFromDb, saveHabitsOrderToDb,
  fetchAntiHabits, saveAntiHabitToDb, deleteAntiHabitFromDb, saveAntiHabitsOrderToDb,
  getCurrentSession, signInWithGoogle, signOut, onAuthStateChange,
  fetchUserSettings, saveUserSettings
} from './api';

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

// ═══════════════════════════════════════════════════════════
// 🔐 ЭКРАН ВХОДА (Email + Google)
// ═══════════════════════════════════════════════════════════
const LoginScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 📧 Email вход
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('Неверный email или пароль');
        } else if (error.message.includes('Email not confirmed')) {
          setError('Подтвердите email (проверьте почту)');
        } else {
          setError(error.message);
        }
      }
    } catch (err) {
      setError('Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  // 📧 Email регистрация
  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    if (password.length < 6) {
      setError('Пароль минимум 6 символов');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (error) {
        if (error.message.includes('already registered')) {
          setError('Этот email уже зарегистрирован');
        } else {
          setError(error.message);
        }
      } else if (data.user && !data.session) {
        // Email требует подтверждения
        setSuccessMessage('Проверьте почту для подтверждения!');
      }
    } catch (err) {
      setError('Ошибка регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔵 Google вход
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    await signInWithGoogle();
  };

  return (
    <div className="h-screen w-screen tg-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        
        {/* Логотип */}
        <div className="mb-8 flex flex-col items-center">
          <div className="relative w-20 h-20 flex items-center justify-center mb-4">
            <svg width="80" height="80" viewBox="0 0 100 100">
              <rect x="15" y="15" width="50" height="70" fill="#9d73d2" rx="4" />
              <circle cx="40" cy="40" r="12" fill="white" opacity="0.2" />
              <g style={{ transformOrigin: 'center' }}>
                <rect x="50" y="45" width="40" height="40" fill="#4cc3a1" rx="4" />
                <path d="M70 55 V75 M60 65 H80" stroke="white" strokeWidth="6" strokeLinecap="round" />
              </g>
            </svg>
          </div>
          <h1 className="text-3xl font-black tg-text">Plusyx</h1>
          <p className="text-sm tg-hint mt-2 text-center">Трекер привычек и задач</p>
        </div>

        {/* Форма */}
        <div className="tg-secondary-bg rounded-3xl p-6 border border-white/10 shadow-xl">
          
          {/* Переключатель Вход/Регистрация */}
          <div className="flex bg-black/20 p-1 rounded-xl mb-6">
            <button
              onClick={() => { setAuthMode('login'); setError(null); setSuccessMessage(null); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                authMode === 'login' 
                  ? 'bg-white text-black shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Вход
            </button>
            <button
              onClick={() => { setAuthMode('register'); setError(null); setSuccessMessage(null); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                authMode === 'register' 
                  ? 'bg-white text-black shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Регистрация
            </button>
          </div>

          {/* Email форма */}
          <form onSubmit={authMode === 'login' ? handleEmailLogin : handleEmailRegister}>
            <div className="flex flex-col gap-3 mb-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 tg-text placeholder:text-gray-500 outline-none focus:border-blue-500 transition-colors"
                required
              />
              <input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 tg-text placeholder:text-gray-500 outline-none focus:border-blue-500 transition-colors"
                required
                minLength={6}
              />
            </div>

            {/* Ошибка */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-xs text-center font-medium">{error}</p>
              </div>
            )}

            {/* Успех */}
            {successMessage && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <p className="text-green-400 text-xs text-center font-medium">{successMessage}</p>
              </div>
            )}

            {/* Кнопка */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                authMode === 'login' ? '🚀 Войти' : '✨ Создать аккаунт'
              )}
            </button>
          </form>

          {/* Разделитель */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-gray-500 text-xs uppercase tracking-wider">или</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-3.5 bg-white hover:bg-gray-100 text-gray-700 font-bold rounded-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-md"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Войти через Google
          </button>
        </div>

        {/* Подпись */}
        <p className="text-center text-gray-500 text-[10px] mt-6">
          Продолжая, вы соглашаетесь с условиями использования
        </p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 🚀 ГЛАВНОЕ ПРИЛОЖЕНИЕ
// ═══════════════════════════════════════════════════════════
const App: React.FC = () => {
  // --- 🔐 АВТОРИЗАЦИЯ ---
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  // --- UI ---
  const [view, setView] = useState<ViewType>(() => {
    const savedView = localStorage.getItem('plusyx_current_view');
    return (savedView as ViewType) || 'kanban';
  });
  const [isLoading, setIsLoading] = useState(true);

  // --- ДАННЫЕ ---
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [antiHabits, setAntiHabits] = useState<AntiHabit[]>([]);
  
  // --- UI MODALS ---
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
  
  // --- SETTINGS ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('plusyx_theme') as 'light' | 'dark') || 'light');
 const [wallpaper, setWallpaper] = useState<string>('');
const [wallpaperOpacity, setWallpaperOpacity] = useState<number>(30);
const [wallpaperPosition, setWallpaperPosition] = useState<number>(50);

  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const initialSettingsApplied = useRef(false);

  // ═══════════════════════════════════════════════════════════
  // 🔐 ПРОВЕРКА АВТОРИЗАЦИИ (УБРАЛИ TG)
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const checkAuth = async () => {
      const session = await getCurrentSession();
      if (session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email || null);
        setUserName(session.user.user_metadata?.full_name || session.user.email || 'User');
      }
      setIsAuthLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email || null);
        setUserName(session.user.user_metadata?.full_name || session.user.email || 'User');
      } else {
        setUserId(null);
        setUserEmail(null);
        setUserName(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- SAVE VIEW ---
  useEffect(() => {
    localStorage.setItem('plusyx_current_view', view);
  }, [view]);

  // --- 🔥 ЗАГРУЗКА ДАННЫХ ---
  useEffect(() => {
    if (!userId) return;

    const initData = async () => {
      setIsLoading(true);
      try {
        const [dbTasks, dbColumns, dbHabits, dbAntiHabits, dbSettings] = await Promise.all([
           fetchTasks(userId), 
           fetchColumns(userId), 
           fetchHabits(userId), 
           fetchAntiHabits(userId),
           fetchUserSettings(userId)
        ]);
        
        setTasks(dbTasks);
        setHabits(dbHabits);
        setAntiHabits(dbAntiHabits);
        
        if (dbSettings) {
          if (dbSettings.wallpaper) setWallpaper(dbSettings.wallpaper);
          if (dbSettings.wallpaper_opacity !== null) setWallpaperOpacity(dbSettings.wallpaper_opacity);
          if (dbSettings.wallpaper_position !== null) setWallpaperPosition(dbSettings.wallpaper_position);
          if (dbSettings.theme) setTheme(dbSettings.theme as 'light' | 'dark');
        }
        setSettingsLoaded(true);
        
        if (dbColumns && dbColumns.length > 0) setColumns(dbColumns);
        else await saveColumnsToDb(DEFAULT_COLUMNS, userId);

      } catch (e) { console.error("Critical Init Error:", e); } 
      finally { setIsLoading(false); }
    };
    initData();
  }, [userId]);

  // --- THEME ---
  useEffect(() => { 
    document.body.classList.toggle('dark', theme === 'dark'); 
  }, [theme]);

  // --- SETTINGS SAVE ---
  useEffect(() => {
    localStorage.setItem('plusyx_wallpaper', wallpaper);
    localStorage.setItem('plusyx_wallpaper_opacity', wallpaperOpacity.toString());
    localStorage.setItem('plusyx_wallpaper_position', wallpaperPosition.toString());
    localStorage.setItem('plusyx_theme', theme);
    
    if (userId && settingsLoaded) {
      saveUserSettings({
        user_id: userId,
        wallpaper,
        wallpaper_opacity: wallpaperOpacity,
        wallpaper_position: wallpaperPosition,
        theme
      });
    }
  }, [wallpaper, wallpaperOpacity, wallpaperPosition, theme, userId, settingsLoaded]);

  // --- SIGN OUT ---
  const handleSignOut = async () => {
    await signOut();
    setUserId(null);
    setUserEmail(null);
    setUserName(null);
    setIsSettingsOpen(false);
  };

  // --- ОБРАБОТЧИКИ ---
  const handleUpdateColumns = async (newColumns: Column[]) => {
    if (!userId) return;
    setColumns(newColumns);
    await saveColumnsToDb(newColumns, userId);
  };

  const handleDeleteColumn = async (columnId: string) => {
    setColumns(prev => prev.filter(c => c.id !== columnId));
    await deleteColumnFromDb(columnId);
  };

  // --- TASKS ---
  const handleAddTask = async (taskData: Omit<Task, 'id'>) => {
    if (!userId) return;
    let cId = taskData.columnId;
    if (!cId) { const col = columns.find(c => c.type === taskData.status) || columns[0]; cId = col?.id || 'col-todo'; }
    
    const columnTasks = tasks.filter(t => t.columnId === cId);
    const maxPos = columnTasks.length > 0 ? Math.max(...columnTasks.map(t => t.position || 0)) : 0;

    const newTask: Task = { 
      ...taskData, 
      id: Math.random().toString(36).substr(2, 9), 
      columnId: cId,
      position: maxPos + 1000 
    };
    
    setTasks(prev => [...prev, newTask]); 
    setIsTaskModalOpen(false); 
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    await saveTaskToDb(newTask, userId);
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    if (!userId) return;
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    await saveTaskToDb(updatedTask, userId);
  };

  const handleMoveTask = async (id: string, targetColId: string, targetId?: string) => {
    if (!userId) return;
    const targetCol = columns.find(c => c.id === targetColId);
    if (!targetCol) return;

    setTasks(prev => {
      const newTasks = [...prev];
      const taskIndex = newTasks.findIndex(t => t.id === id);
      if (taskIndex === -1) return prev;

      const [movedTask] = newTasks.splice(taskIndex, 1);
      movedTask.columnId = targetColId;
      movedTask.status = targetCol.type;

      if (targetId) {
        const targetIndex = newTasks.findIndex(t => t.id === targetId);
        newTasks.splice(targetIndex === -1 ? newTasks.length : targetIndex, 0, movedTask);
      } else {
        newTasks.push(movedTask);
      }

      const tasksInColumn = newTasks.filter(t => t.columnId === targetColId);
      tasksInColumn.forEach((t, index) => { t.position = index; });

      saveTasksOrderToDb(tasksInColumn, userId);
      return newTasks;
    });
  };

  const handleCopyTask = async (originalTaskId: string, newTitle: string) => {
    if (!userId) return;
    const originalTask = tasks.find(t => t.id === originalTaskId);
    if (!originalTask) return;
    const newChecklists = originalTask.checklists.map(list => ({...list, id: Math.random().toString(36).substr(2, 9), items: list.items.map(item => ({...item, id: Math.random().toString(36).substr(2, 9)}))}));
    
    const newTask: Task = { 
        ...originalTask, 
        id: Math.random().toString(36).substr(2, 9), 
        title: newTitle, 
        checklists: newChecklists, 
        comments: [], 
        files: [],
        position: (originalTask.position || 0) + 0.5 
    };

    setTasks(prev => { const index = prev.findIndex(t => t.id === originalTaskId); if (index === -1) return [newTask, ...prev]; const newTasks = [...prev]; newTasks.splice(index + 1, 0, newTask); return newTasks; });
    await saveTaskToDb(newTask, userId);
  };

  // --- HABITS ---
  const handleAddHabit = async (habitData: Habit) => {
    if (!userId) return;
    // Новая привычка с position: 0 — будет первой
    const newHabit = { ...habitData, id: Math.random().toString(36).substr(2, 9), position: 0 };
    
    // Добавляем в начало списка
    const newHabits = [newHabit, ...habits];
    
    // Пересчитываем позиции всех привычек
    const updated = newHabits.map((h, idx) => ({ ...h, position: idx }));
    setHabits(updated);
    
    setIsHabitModalOpen(false);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    
    // Сохраняем новую привычку и порядок
    await saveHabitToDb(newHabit, userId);
    await saveHabitsOrderToDb(updated, userId);
  };

  const handleUpdateHabit = async (updatedHabit: Habit) => {
    if (!userId) return;
    setHabits(prev => prev.map(h => h.id === updatedHabit.id ? updatedHabit : h));
    setIsHabitModalOpen(false); 
    setEditingHabit(undefined);
    await saveHabitToDb(updatedHabit, userId);
  };

  const handleToggleHabit = async (id: string, date: string, value: boolean | 'mini' | 'freeze') => {
  if (!userId) return;
  
  // Находим привычку и создаём обновлённую версию
  const habit = habits.find(h => h.id === id);
  if (!habit) return;
  
  const newHistory = { ...habit.history };
  if (value === false) {
    delete newHistory[date];
  } else {
    newHistory[date] = value;
  }
  
  const updatedHabit = { ...habit, history: newHistory };
  
  // Обновляем стейт
  setHabits(prev => prev.map(h => h.id === id ? updatedHabit : h));
  
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
  
  // Сохраняем в БД
  await saveHabitToDb(updatedHabit, userId);
};



  const handleReorderHabits = async (newHabits: Habit[]) => {
    if (!userId) return;
    setHabits(newHabits);
    const updated = newHabits.map((h, idx) => ({ ...h, position: idx }));
    setHabits(updated);
    await saveHabitsOrderToDb(updated, userId);
  };

  // --- ANTI HABITS ---
  const handleAddAntiHabit = async (habit: AntiHabit) => {
    if (!userId) return;
    // Новая анти-привычка с position: 0 — будет первой
    const newHabit = { ...habit, id: Math.random().toString(36).substr(2, 9), position: 0 };
    
    // Добавляем в начало списка
    const newAntiHabits = [newHabit, ...antiHabits];
    
    // Пересчитываем позиции
    const updated = newAntiHabits.map((h, idx) => ({ ...h, position: idx }));
    setAntiHabits(updated);
    
    setIsAntiHabitModalOpen(false);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    
    // Сохраняем
    await saveAntiHabitToDb(newHabit, userId);
    await saveAntiHabitsOrderToDb(updated, userId);
  };

  const handleUpdateAntiHabit = async (habit: AntiHabit) => {
    if (!userId) return;
    setAntiHabits(prev => prev.map(h => h.id === habit.id ? habit : h));
    setIsAntiHabitModalOpen(false); 
    setEditingAntiHabit(undefined);
    await saveAntiHabitToDb(habit, userId);
  };

  const handleRelapse = async (id: string) => {
    if (!userId) return;
    let updatedHabit: AntiHabit | undefined;
    setAntiHabits(prev => prev.map(h => {
        if (h.id === id) {
            const now = Date.now(); 
            const currentDuration = now - h.startDate; 
            const newRecord = Math.max(h.longestStreak, currentDuration);
            updatedHabit = { ...h, startDate: now, longestStreak: newRecord, history: [...h.history, { date: now, duration: currentDuration }] };
            return updatedHabit;
        } return h;
    }));
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning');
    if (updatedHabit) await saveAntiHabitToDb(updatedHabit, userId);
  };

  const handleReorderAntiHabits = async (newHabits: AntiHabit[]) => {
    if (!userId) return;
    setAntiHabits(newHabits);
    const updated = newHabits.map((h, idx) => ({ ...h, position: idx }));
    setAntiHabits(updated);
    await saveAntiHabitsOrderToDb(updated, userId);
  };

  // --- DELETE ---
  const handleDeleteConfirm = async () => {
  if (taskToDelete) {
     const id = taskToDelete; 
     setTasks(prev => prev.filter(t => t.id !== id)); 
     setTaskToDelete(null);
     await deleteTaskFromDb(id);
  } else if (habitToDelete) {
     const isHabit = habits.find(h => h.id === habitToDelete);
     const isAnti = antiHabits.find(h => h.id === habitToDelete);
     
     setHabits(prev => prev.filter(h => h.id !== habitToDelete));
     setAntiHabits(prev => prev.filter(h => h.id !== habitToDelete));
     setHabitToDelete(null);
     
     if (isHabit) await deleteHabitFromDb(habitToDelete);
     if (isAnti) await deleteAntiHabitFromDb(habitToDelete);
  }
  
  // 🔧 Принудительно сбрасываем возможные блокировки
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
};

  const handleWallpaperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 3 * 1024 * 1024) { alert("Слишком большой файл!"); return; }
    const reader = new FileReader(); reader.onload = (ev) => setWallpaper(ev.target?.result as string); reader.readAsDataURL(file);
  };

  // ═══════════════════════════════════════════════════════════
  // 🎨 РЕНДЕР
  // ═══════════════════════════════════════════════════════════

  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen tg-bg flex items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!userId) {
    return <LoginScreen />;
  }

  if (isLoading) {
    return (
      <div className="h-screen w-screen tg-bg flex items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-sm font-bold tg-text opacity-50 animate-pulse">Загрузка профиля...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden tg-bg select-none relative">
      {wallpaper && <div className="fixed inset-0 z-0 pointer-events-none transition-all duration-300 ease-out" style={{ backgroundImage: `url(${wallpaper})`, backgroundSize: 'cover', backgroundPosition: `50% ${wallpaperPosition}%`, opacity: wallpaperOpacity / 100 }} />}
      
      <header className="px-5 py-4 flex justify-between items-center border-b border-gray-200/10 tg-secondary-bg/80 backdrop-blur-md shadow-sm z-[150]">
        <div className="flex items-center gap-2">
            <div className="relative w-10 h-10 flex items-center justify-center logo-shadow"><svg width="40" height="40" viewBox="0 0 100 100"><rect x="15" y="15" width="50" height="70" fill="#9d73d2" rx="4" /><circle cx="40" cy="40" r="12" fill="white" opacity="0.2" /><g className="animate-plus-new" style={{ transformOrigin: 'center' }}><rect x="50" y="45" width="40" height="40" fill="#4cc3a1" rx="4" /><path d="M70 55 V75 M60 65 H80" stroke="white" strokeWidth="6" strokeLinecap="round" /></g></svg></div>
            <h1 className="text-2xl font-logo tg-text font-black ml-1">Plusyx</h1>
        </div>
        <div className="flex gap-2 relative">
            <button onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)} className={`w-10 h-10 rounded-xl bg-[var(--tg-theme-button-color)] text-white flex items-center justify-center shadow-lg active:scale-90 transition-all ${isCreateMenuOpen ? 'rotate-45' : ''}`}><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
            {isCreateMenuOpen && (<div className="absolute right-0 top-12 w-48 tg-secondary-bg rounded-2xl shadow-2xl border border-gray-400/10 p-2 animate-in slide-in-from-top-2 duration-200 z-[200]"><button onClick={() => { setIsTaskModalOpen(true); setIsCreateMenuOpen(false); setEditingTask(undefined); }} className="w-full text-left p-3 hover:bg-black/5 rounded-xl flex items-center gap-3 transition-colors"><span className="text-blue-500 text-lg">📝</span><span className="text-sm font-bold tg-text">Новая задача</span></button><button onClick={() => { setIsHabitModalOpen(true); setIsCreateMenuOpen(false); setEditingHabit(undefined); }} className="w-full text-left p-3 hover:bg-black/5 rounded-xl flex items-center gap-3 transition-colors"><span className="text-green-500 text-lg">🌱</span><span className="text-sm font-bold tg-text">Привычка</span></button><button onClick={() => { setIsAntiHabitModalOpen(true); setIsCreateMenuOpen(false); setEditingAntiHabit(undefined); }} className="w-full text-left p-3 hover:bg-black/5 rounded-xl flex items-center gap-3 transition-colors"><span className="text-red-500 text-lg">⛔</span><span className="text-sm font-bold tg-text">Бросить</span></button></div>)}
            <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 rounded-xl tg-secondary-bg border border-gray-400/10 flex items-center justify-center shadow-sm active:scale-90 transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
        </div>
      </header>
      {isCreateMenuOpen && <div className="fixed inset-0 z-[140]" onClick={() => setIsCreateMenuOpen(false)} />}
      <main className="flex-1 overflow-y-auto pb-24 relative z-10">
        {view === 'kanban' && (
          <KanbanBoard 
            tasks={tasks} 
            columns={columns} 
            onUpdateColumns={handleUpdateColumns} 
            onDeleteColumn={handleDeleteColumn} 
            onMoveTask={handleMoveTask} 
            onEditTask={setEditingTask} 
            onDeleteTask={setTaskToDelete} 
            onCopyTask={handleCopyTask} 
            onQuickAdd={(s, cId) => { setEditingTask({ id:'', title:'', description:'', date:toLocalDateString(new Date()), status:s, columnId: cId, checklists: [], comments: []} as Task); setIsTaskModalOpen(true); }} 
            onDragEnd={() => {}} 
          />
        )}
        {view === 'calendar' && <CalendarView tasks={tasks} habits={habits} onEditTask={(t) => { setEditingTask(t); setIsTaskModalOpen(true); }} />}
        
        {view === 'tracker' && (
          <HabitTracker 
             habits={habits} 
             antiHabits={antiHabits} 
             onToggleHabit={handleToggleHabit} 
             onEditHabit={(h) => { setEditingHabit(h); setIsHabitModalOpen(true); }} 
             onDeleteHabit={(id) => setHabitToDelete(id)} 
             onAddHabit={() => { setEditingHabit(undefined); setIsHabitModalOpen(true); }} 
             onReorderHabits={handleReorderHabits}
             
             onAddAntiHabit={() => { setEditingAntiHabit(undefined); setIsAntiHabitModalOpen(true); }} 
             onEditAntiHabit={(h) => { setEditingAntiHabit(h); setIsAntiHabitModalOpen(true); }} 
             onDeleteAntiHabit={(id) => setHabitToDelete(id)} 
             onRelapseAntiHabit={handleRelapse}
             onReorderAntiHabits={handleReorderAntiHabits}
          />
        )}
      </main>
      <BottomNav activeView={view} onViewChange={setView} />
      
      <TaskModal 
        isOpen={isTaskModalOpen || (!!editingTask && !!editingTask.id)} 
        onClose={() => { setIsTaskModalOpen(false); setEditingTask(undefined); }} 
        onSave={editingTask?.id ? handleUpdateTask : handleAddTask} 
        initialTask={editingTask} 
        columns={columns} 
      />
      <HabitModal 
        isOpen={isHabitModalOpen || (!!editingHabit && !!editingHabit.id)} 
        onClose={() => { setIsHabitModalOpen(false); setEditingHabit(undefined); }} 
        onSave={editingHabit?.id ? handleUpdateHabit : handleAddHabit} 
        initialHabit={editingHabit} 
        userId={userId || undefined} 
      />

      <AntiHabitModal isOpen={isAntiHabitModalOpen || (!!editingAntiHabit && !!editingAntiHabit.id)} onClose={() => { setIsAntiHabitModalOpen(false); setEditingAntiHabit(undefined); }} onSave={editingAntiHabit?.id ? handleUpdateAntiHabit : handleAddAntiHabit} initialHabit={editingAntiHabit} />
      
      {(taskToDelete || habitToDelete) && (<div className="fixed inset-0 z-[300] flex items-center justify-center p-6"><div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setTaskToDelete(null); setHabitToDelete(null); }} /><div className="relative w-full max-w-xs tg-bg rounded-[32px] p-8 shadow-2xl flex flex-col gap-6 animate-in zoom-in duration-200"><div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></div><h2 className="text-xl font-black tg-text text-center uppercase tracking-widest leading-tight">{taskToDelete ? 'Удалить задачу?' : 'Удалить?'}</h2><div className="flex flex-col gap-3"><button onClick={handleDeleteConfirm} className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-all">Да, удалить</button><button onClick={() => { setTaskToDelete(null); setHabitToDelete(null); }} className="w-full py-4 tg-secondary-bg tg-text rounded-2xl font-bold active:scale-95 transition-all">Отмена</button></div></div></div>)}
      
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)} />
          <div className="relative w-[280px] tg-bg bg-opacity-80 backdrop-blur-xl rounded-[40px] p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in duration-200 border border-white/20">
            <h2 className="text-lg font-black tg-text text-center uppercase tracking-[0.2em]">Настройки</h2>
            
            {userName && (
              <div className="p-4 tg-secondary-bg rounded-[24px] border border-white/5 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm tg-text truncate">{userName}</div>
                  {userEmail && <div className="text-[10px] tg-hint truncate">{userEmail}</div>}
                </div>
              </div>
            )}
            
            <button onClick={() => window.location.reload()} className="w-full py-3 bg-blue-500/10 text-blue-500 rounded-2xl font-bold uppercase text-[10px] tracking-widest border border-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">🔄 Синхронизировать</button>
            
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[40vh] no-scrollbar">
              <div className="flex items-center justify-between p-4 tg-secondary-bg rounded-[24px] border border-white/5">
                <div className="flex flex-col"><span className="font-bold text-[11px] tg-text uppercase tracking-tight">Тёмная тема</span></div>
                <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className={`w-10 h-5 rounded-full transition-all relative ${theme === 'dark' ? 'bg-green-500' : 'bg-gray-400'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${theme === 'dark' ? 'right-0.5' : 'left-0.5'}`} /></button>
              </div>
              
              <div className="flex flex-col gap-3 p-4 tg-secondary-bg rounded-[24px] border border-white/5">
                <div className="flex justify-between items-center mb-1"><span className="font-bold text-[11px] tg-text uppercase tracking-tight">Фон приложения</span>{wallpaper && (<button onClick={() => setWallpaper('')} className="text-[9px] font-black text-red-500 uppercase">Удалить</button>)}</div>
                <input type="file" ref={wallpaperInputRef} accept="image/*" className="hidden" onChange={handleWallpaperChange} />
                {!wallpaper ? (
                  <button onClick={() => wallpaperInputRef.current?.click()} className="w-full py-3 rounded-xl border border-dashed border-gray-400/30 tg-text text-[9px] font-black uppercase tracking-widest hover:bg-black/5 transition-all">📁 Загрузить фон</button>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5"><div className="flex justify-between px-1"><span className="text-[8px] font-black tg-hint uppercase">Яркость</span><span className="text-[8px] font-black tg-text">{wallpaperOpacity}%</span></div><input type="range" min="5" max="100" value={wallpaperOpacity} onChange={e => setWallpaperOpacity(Number(e.target.value))} className="w-full h-1 bg-black/10 rounded-full accent-blue-500 appearance-none" /></div>
                    <div className="flex flex-col gap-1.5"><div className="flex justify-between px-1"><span className="text-[8px] font-black tg-hint uppercase">Позиция</span><span className="text-[8px] font-black tg-text">{wallpaperPosition}%</span></div><input type="range" min="0" max="100" value={wallpaperPosition} onChange={e => setWallpaperPosition(Number(e.target.value))} className="w-full h-1 bg-black/10 rounded-full accent-orange-500 appearance-none" /></div>
                    <button onClick={() => wallpaperInputRef.current?.click()} className="w-full py-2 rounded-lg bg-black/5 tg-text text-[8px] font-black uppercase tracking-widest">Сменить фото</button>
                  </div>
                )}
              </div>
            </div>
            
            <button onClick={() => setIsSettingsOpen(false)} className="w-full py-4 tg-button rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all">Готово</button>
            
            <button onClick={handleSignOut} className="w-full py-3 bg-red-500/10 text-red-500 rounded-2xl font-bold uppercase text-[10px] tracking-widest border border-red-500/20 active:scale-95 transition-all">
              Выйти из аккаунта
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
