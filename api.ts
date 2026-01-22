// @ts-nocheck
import { supabase } from './supabaseClient';

// --- ЗАДАЧИ ---
export const fetchTasks = async (userId) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true }) 
    .order('created_at', { ascending: true });

  if (error) { console.error('Error fetching tasks:', error); return []; }
  return data || [];
};

export const saveTaskToDb = async (task, userId) => {
  const cleanTask = JSON.parse(JSON.stringify(task)); 
  const { error } = await supabase.from('tasks').upsert({ ...cleanTask, user_id: userId });
  if (error) console.error('Error saving task:', error);
};

export const saveTasksOrderToDb = async (tasks, userId) => {
  if (tasks.length === 0) return;
  const updates = tasks.map(t => ({
    id: t.id, 
    user_id: userId, 
    position: t.position, 
    columnId: t.columnId, 
    status: t.status, 
    title: t.title, 
    description: t.description, 
    date: t.date
  }));
  const { error } = await supabase.from('tasks').upsert(updates);
  if (error) console.error('Error saving order:', error);
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
    .order('position', { ascending: true }) 
    .order('created_at', { ascending: false });
    
  if (error) return [];

  return (data || []).map(h => ({
    id: h.id,
    title: h.title,
    color: h.color,
    frequency: h.frequency,
    history: h.history || {},
    emoji: h.emoji,
    isMeasurable: h.isMeasurable,
    targetValue: Number(h.target_value) || 1,
    unit: h.unit || '',
    position: h.position || 0,
    identity: h.identity,
    triggerEvent: h.trigger_event,
    miniAction: h.mini_action,
    reminderEnabled: h.reminder_enabled,  // ← НОВОЕ
    reminderTime: h.reminder_time,
    fileData: h.file_data,
    coverPosition: h.cover_position,
    coverIntensity: h.cover_intensity
  }));
};

export const saveHabitToDb = async (habit, userId) => {
  const dbHabit = {
    id: habit.id,
    user_id: userId,
    title: habit.title,
    color: habit.color,
    frequency: habit.frequency,
    history: habit.history,
    emoji: habit.emoji,
    isMeasurable: habit.isMeasurable,
    target_value: Number(habit.targetValue) || 1,
    unit: habit.unit || '',
    position: habit.position || 0,
    identity: habit.identity,
    trigger_event: habit.triggerEvent,
    mini_action: habit.miniAction,
    reminder_enabled: habit.reminderEnabled,  // ← НОВОЕ
    reminder_time: habit.reminderTime,
    file_data: habit.fileData,
    cover_position: habit.coverPosition,
    cover_intensity: habit.coverIntensity
  };

  const { error } = await supabase.from('habits').upsert(dbHabit);
  if (error) console.error("Save Habit Error:", error);
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
