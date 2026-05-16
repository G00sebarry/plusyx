// @ts-nocheck
import { supabase } from './supabaseClient';

// --- ЗАДАЧИ ---
export const fetchTasks = async (userId) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .is('archived_at', null) // 💤 только активные
    .order('position', { ascending: true }) 
    .order('created_at', { ascending: true });

  if (error) { console.error('Error fetching tasks:', error); return []; }
  // Маппим snake_case → camelCase для новых полей
  return (data || []).map(t => ({
    ...t,
    archivedAt: t.archived_at,
    originalColumnId: t.original_column_id
  }));
};

export const saveTaskToDb = async (task, userId) => {
  const cleanTask = JSON.parse(JSON.stringify(task)); 
  // camelCase → snake_case для новых полей перед записью
  if ('archivedAt' in cleanTask) {
    cleanTask.archived_at = cleanTask.archivedAt;
    delete cleanTask.archivedAt;
  }
  if ('originalColumnId' in cleanTask) {
    cleanTask.original_column_id = cleanTask.originalColumnId;
    delete cleanTask.originalColumnId;
  }
  const { error } = await supabase.from('tasks').upsert({ ...cleanTask, user_id: userId });
  if (error) console.error('Error saving task:', error);
};

export const saveTasksOrderToDb = async (tasks, userId) => {
  if (tasks.length === 0) return;
  const promises = tasks.map(t =>
    supabase
      .from('tasks')
      .update({ position: t.position, columnId: t.columnId, status: t.status })
      .eq('id', t.id)
      .eq('user_id', userId)
  );
  const results = await Promise.all(promises);
  results.forEach(({ error }) => {
    if (error) console.error('Error saving task order:', error);
  });
};

export const deleteTaskFromDb = async (taskId) => {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) console.error('Ошибка удаления задачи:', error);
};

// --- КОЛОНКИ ---
export const fetchColumns = async (userId) => {
  const { data, error } = await supabase
    .from('columns')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true });

  if (error) { console.error('Error fetching columns:', error); return []; }
  return data || [];
};

export const saveColumnsToDb = async (columns, userId) => {
  const updates = columns.map((col, index) => ({
    id: col.id, user_id: userId, title: col.title, type: col.type, position: index
  }));
  const { error } = await supabase.from('columns').upsert(updates);
  if (error) console.error('Error saving columns:', error);
};

export const deleteColumnFromDb = async (columnId) => {
  const { error } = await supabase.from('columns').delete().eq('id', columnId);
  if (error) console.error('Ошибка удаления колонки:', error);
};

// --- ПРИВЫЧКИ (Habits) ---
export const fetchHabits = async (userId) => {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .is('archived_at', null) // 💤 только активные
    .order('position', { ascending: true }) 
    .order('created_at', { ascending: false });
    
  if (error) return [];

  return (data || []).map(h => ({
    id: h.id,
    title: h.title,
    description: h.description,
    notes: h.notes || [],
    color: h.color,
    frequency: h.frequency,
    history: h.history || {},
    emoji: h.emoji,
    position: h.position || 0,
    identity: h.identity,
    triggerEvent: h.trigger_event,
    miniAction: h.mini_action,
    reminderEnabled: h.reminder_enabled,
    reminderTime: h.reminder_time,
    fileData: h.file_data,
    coverPosition: h.cover_position,
    coverIntensity: h.cover_intensity,
    // 💤 СПЯЧКА
    archivedAt: h.archived_at,
    reactivatedAt: h.reactivated_at,
    allTimeBestStreak: h.all_time_best_streak || 0
  }));
};

export const saveHabitToDb = async (habit, userId) => {
  const dbHabit = {
    id: habit.id,
    user_id: userId,
    title: habit.title,
    description: habit.description,
    notes: habit.notes,
    color: habit.color,
    frequency: habit.frequency,
    history: habit.history,
    emoji: habit.emoji,
    position: habit.position || 0,
    identity: habit.identity,
    trigger_event: habit.triggerEvent,
    mini_action: habit.miniAction,
    reminder_enabled: habit.reminderEnabled,
    reminder_time: habit.reminderTime,
    file_data: habit.fileData,
    cover_position: habit.coverPosition,
    cover_intensity: habit.coverIntensity,
    // 💤 СПЯЧКА
    archived_at: habit.archivedAt,
    reactivated_at: habit.reactivatedAt,
    all_time_best_streak: habit.allTimeBestStreak || 0
  };

  const { error } = await supabase.from('habits').upsert(dbHabit);
  if (error) console.error("Save Habit Error:", error);
};

// Лёгкий апдейт: пишем ТОЛЬКО поле history. Используется при тапе по ячейке
// чек-листа — payload крошечный, запрос быстрее, меньше конкуренции на строке.
// Возвращает { error } чтобы вызывающий мог реагировать.
export const saveHabitHistoryToDb = async (habitId, userId, history) => {
  const { error } = await supabase
    .from('habits')
    .update({ history })
    .eq('id', habitId)
    .eq('user_id', userId);
  if (error) console.error("Save Habit History Error:", error);
  return { error };
};

// Лёгкий апдейт only-best-streak — пишется когда юзер бьёт личный рекорд.
// Используется автоматически в обработчике handleToggleHabit
export const saveHabitBestStreakToDb = async (habitId, userId, bestStreak) => {
  const { error } = await supabase
    .from('habits')
    .update({ all_time_best_streak: bestStreak })
    .eq('id', habitId)
    .eq('user_id', userId);
  if (error) console.error("Save Best Streak Error:", error);
  return { error };
};

export const saveHabitsOrderToDb = async (habits, userId) => {
  if (habits.length === 0) return;
  const updates = habits.map((h, index) => ({
    id: h.id,
    user_id: userId,
    title: h.title,
    frequency: h.frequency, 
    color: h.color,
    position: index 
  }));
  const { error } = await supabase.from('habits').upsert(updates);
  if (error) console.error('Error saving habits order:', error);
};

export const deleteHabitFromDb = async (id) => {
  await supabase.from('habits').delete().eq('id', id);
};

// ═══════════════════════════════════════════════════════════
// 💤 СПЯЧКА — ПРИВЫЧКИ
// ═══════════════════════════════════════════════════════════

// Получить только спящие привычки юзера
export const fetchSleepingHabits = async (userId) => {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .not('archived_at', 'is', null) // только спящие
    .order('archived_at', { ascending: false }); // последние засыпавшие сверху

  if (error) { console.error('Error fetching sleeping habits:', error); return []; }

  return (data || []).map(h => ({
    id: h.id,
    title: h.title,
    description: h.description,
    notes: h.notes || [],
    color: h.color,
    frequency: h.frequency,
    history: h.history || {},
    emoji: h.emoji,
    position: h.position || 0,
    identity: h.identity,
    triggerEvent: h.trigger_event,
    miniAction: h.mini_action,
    reminderEnabled: h.reminder_enabled,
    reminderTime: h.reminder_time,
    fileData: h.file_data,
    coverPosition: h.cover_position,
    coverIntensity: h.cover_intensity,
    archivedAt: h.archived_at,
    reactivatedAt: h.reactivated_at,
    allTimeBestStreak: h.all_time_best_streak || 0
  }));
};

// Отправить привычку в спячку.
// bestStreak (опционально) — сохранить актуальный личный рекорд перед спячкой.
export const archiveHabit = async (habitId, userId, bestStreak) => {
  const payload = { archived_at: new Date().toISOString() };
  if (typeof bestStreak === 'number' && bestStreak > 0) {
    payload.all_time_best_streak = bestStreak;
  }
  const { error } = await supabase
    .from('habits')
    .update(payload)
    .eq('id', habitId)
    .eq('user_id', userId);
  if (error) console.error("Archive Habit Error:", error);
  return { error };
};

// Разбудить привычку — снимаем archived_at, ставим reactivated_at (точка отсчёта)
export const awakeHabit = async (habitId, userId) => {
  const { error } = await supabase
    .from('habits')
    .update({
      archived_at: null,
      reactivated_at: new Date().toISOString()
    })
    .eq('id', habitId)
    .eq('user_id', userId);
  if (error) console.error("Awake Habit Error:", error);
  return { error };
};

// Получить количество спящих привычек (для бейджа в настройках)
export const countSleepingHabits = async (userId) => {
  const { count, error } = await supabase
    .from('habits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('archived_at', 'is', null);
  if (error) { console.error('Error counting sleeping habits:', error); return 0; }
  return count || 0;
};

// --- ⛔ АНТИ-ПРИВЫЧКИ ---
export const fetchAntiHabits = async (userId) => {
  const { data, error } = await supabase
    .from('antihabits')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) { console.error("Fetch AntiHabits Error:", error); return []; }
  
  return (data || []).map(h => ({
    ...h,
    startDate: h.start_date,
    longestStreak: h.longest_streak,
    position: h.position || 0,
    fileData: h.file_data,            
    coverPosition: h.cover_position,  
    coverIntensity: h.cover_intensity 
  }));
};

export const saveAntiHabitToDb = async (habit, userId) => {
  const { startDate, longestStreak, fileData, coverPosition, coverIntensity, ...rest } = habit;
  
  const dbHabit = {
    ...rest,
    start_date: startDate,
    longest_streak: longestStreak,
    file_data: fileData,            
    cover_position: coverPosition,  
    cover_intensity: coverIntensity,
    user_id: userId
  };

  const { error } = await supabase.from('antihabits').upsert(dbHabit);
  if (error) console.error("Save AntiHabit Error:", error);
};

export const saveAntiHabitsOrderToDb = async (habits, userId) => {
  if (habits.length === 0) return;
  const updates = habits.map((h, index) => ({
    id: h.id,
    user_id: userId,
    title: h.title,
    color: h.color,
    start_date: h.startDate,
    longest_streak: h.longestStreak,
    position: index
  }));

  const { error } = await supabase.from('antihabits').upsert(updates);
  if (error) console.error('Error saving AntiHabits order:', error);
};

export const deleteAntiHabitFromDb = async (id) => {
  await supabase.from('antihabits').delete().eq('id', id);
};

// ═══════════════════════════════════════════════════════════
// 💤 СПЯЧКА — ЗАДАЧИ
// ═══════════════════════════════════════════════════════════

// Получить только спящие задачи юзера
export const fetchSleepingTasks = async (userId) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false });

  if (error) { console.error('Error fetching sleeping tasks:', error); return []; }
  return (data || []).map(t => ({
    ...t,
    archivedAt: t.archived_at,
    originalColumnId: t.original_column_id
  }));
};

// Отправить задачу в спячку — запоминаем columnId, чтобы потом вернуть туда же
export const archiveTask = async (taskId, userId, columnId) => {
  const { error } = await supabase
    .from('tasks')
    .update({
      archived_at: new Date().toISOString(),
      original_column_id: columnId
    })
    .eq('id', taskId)
    .eq('user_id', userId);
  if (error) console.error("Archive Task Error:", error);
  return { error };
};

// Восстановить задачу из спячки.
// fallbackColumnId — куда положить, если original_column_id уже не существует.
export const restoreTask = async (taskId, userId, fallbackColumnId) => {
  // Сначала смотрим original_column_id у задачи
  const { data: taskRow, error: fetchErr } = await supabase
    .from('tasks')
    .select('original_column_id')
    .eq('id', taskId)
    .eq('user_id', userId)
    .single();

  if (fetchErr) {
    console.error("Restore Task Fetch Error:", fetchErr);
    return { error: fetchErr };
  }

  let targetColumnId = taskRow?.original_column_id || fallbackColumnId;

  // Проверим что колонка существует
  if (targetColumnId) {
    const { data: colRow } = await supabase
      .from('columns')
      .select('id')
      .eq('id', targetColumnId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!colRow) targetColumnId = fallbackColumnId; // колонка удалена — fallback
  }

  const { error } = await supabase
    .from('tasks')
    .update({
      archived_at: null,
      original_column_id: null,
      columnId: targetColumnId
    })
    .eq('id', taskId)
    .eq('user_id', userId);
  if (error) console.error("Restore Task Error:", error);
  return { error, restoredColumnId: targetColumnId };
};

// Получить количество спящих задач (для бейджа)
export const countSleepingTasks = async (userId) => {
  const { count, error } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('archived_at', 'is', null);
  if (error) { console.error('Error counting sleeping tasks:', error); return 0; }
  return count || 0;
};

// --- ☁️ ЗАГРУЗКА ФАЙЛОВ ---
export const uploadImage = async (file) => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error } = await supabase.storage.from('covers').upload(filePath, file);
    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(filePath);
    return publicUrl;
  } catch (error) {
    console.error('Ошибка загрузки файла:', error);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════
// 🔐 АВТОРИЗАЦИЯ (Google OAuth)
// ═══════════════════════════════════════════════════════════

export const getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return session;
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return user;
};

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://plusyx.ru'
    }
  });
  
  if (error) {
    console.error('Error signing in with Google:', error);
    return null;
  }
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
  }
};

export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
};

// ═══════════════════════════════════════════════════════════
// 🖼️ USER SETTINGS (WALLPAPER)
// ═══════════════════════════════════════════════════════════

export const fetchUserSettings = async (userId) => {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching settings:', error);
  }
  return data;
};

export const saveUserSettings = async (settings: {
  user_id: string;
  wallpaper?: string;
  wallpaper_opacity?: number;
  wallpaper_position?: number;
  theme?: string;
}) => {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({
      ...settings,
      updated_at: new Date().toISOString()
    }, { 
      onConflict: 'user_id' 
    });
  
  if (error) console.error('Error saving settings:', error);
  return data;
};
// ═══════════════════════════════════════════════════════════
// 📲 TELEGRAM LINKS (для Google-пользователей)
// ═══════════════════════════════════════════════════════════

export const fetchTelegramLink = async (userId: string) => {
  const { data, error } = await supabase
    .from('telegram_links')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching telegram link:', error);
  }
  return data;
};

export const disconnectTelegram = async (userId: string) => {
  const { error } = await supabase
    .from('telegram_links')
    .delete()
    .eq('user_id', userId);
  return !error;
};

export const saveTelegramLink = async (userId: string, chatId: string, username?: string) => {
  const { data, error } = await supabase
    .from('telegram_links')
    .upsert({
      user_id: userId,
      chat_id: chatId,
      username: username || null
    }, { onConflict: 'user_id' });
  
  if (error) console.error('Error saving telegram link:', error);
  return data;
};

// ═══════════════════════════════════════════════════════════
// 💬 HABIT QUOTES (цитаты для уведомлений)
// ═══════════════════════════════════════════════════════════

export const fetchRandomQuote = async () => {
  const { data, error } = await supabase
    .from('habit_quotes')
    .select('*');
  
  if (error || !data || data.length === 0) return null;
  
  // Возвращаем случайную цитату
  const randomIndex = Math.floor(Math.random() * data.length);
  return data[randomIndex];
};

// ═══════════════════════════════════════════════════════════
// 🔐 TELEGRAM PENDING TOKEN
// ═══════════════════════════════════════════════════════════

export const createTelegramToken = async (userId: string) => {
  // Удаляем старые токены этого пользователя
  await supabase
    .from('telegram_pending')
    .delete()
    .eq('user_id', userId);

  // Генерируем безопасный токен
  const token = crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);

  const { error } = await supabase
    .from('telegram_pending')
    .insert({
      user_id: userId,
      token: token
    });

  if (error) {
    console.error('Error creating telegram token:', error);
    return null;
  }

  return token;
};

// ═══════════════════════════════════════════════════════════
// 📝 DAILY NOTES (заметки-журнал дня в карточке календаря)
// Каждая запись отдельной строкой с временем создания
// ═══════════════════════════════════════════════════════════

export interface DailyNote {
  id: string;
  date: string;
  time: string;
  text: string;
  created_at: string;
}

// Получить все заметки пользователя сгруппированные по дате
export const fetchDailyNotes = async (userId: string): Promise<Record<string, DailyNote[]>> => {
  const { data, error } = await supabase
    .from('daily_notes')
    .select('id, date, time, text, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching daily notes:', error);
    return {};
  }

  const map: Record<string, DailyNote[]> = {};
  (data || []).forEach((row: DailyNote) => {
    if (!map[row.date]) map[row.date] = [];
    map[row.date].push(row);
  });
  return map;
};

// Создать новую заметку. Время = текущее HH:MM.
export const addDailyNote = async (userId: string, date: string, text: string): Promise<DailyNote | null> => {
  if (!text.trim()) return null;

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('daily_notes')
    .insert({
      user_id: userId,
      date,
      time,
      text: text.trim()
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding daily note:', error);
    return null;
  }
  return data as DailyNote;
};

// Обновить текст существующей заметки
export const updateDailyNote = async (noteId: string, text: string) => {
  const { error } = await supabase
    .from('daily_notes')
    .update({
      text: text.trim(),
      updated_at: new Date().toISOString()
    })
    .eq('id', noteId);

  if (error) console.error('Error updating daily note:', error);
};

// Удалить заметку
export const deleteDailyNote = async (noteId: string) => {
  const { error } = await supabase
    .from('daily_notes')
    .delete()
    .eq('id', noteId);

  if (error) console.error('Error deleting daily note:', error);
};
