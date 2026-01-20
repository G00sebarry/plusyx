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

    icon: h.emoji,
    isMeasurable: h.isMeasurable,
    targetValue: Number(h.target_value) || 1,
    unit: h.unit || '',
    position: h.position || 0,
    
    // 🔥 НОВЫЕ ПОЛЯ (Маппинг из БД snake_case в JS camelCase)
    identity: h.identity,
    triggerEvent: h.trigger_event,
    miniAction: h.mini_action,
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

    emoji: habit.icon,
    isMeasurable: habit.isMeasurable,
    target_value: Number(habit.targetValue) || 1,
    unit: habit.unit || '',
    position: habit.position || 0,
    
    // 🔥 СОХРАНЕНИЕ НОВЫХ ПОЛЕЙ
    identity: habit.identity,
    trigger_event: habit.triggerEvent,
    mini_action: habit.miniAction,
    reminder_time: habit.reminderTime,
    
    file_data: habit.fileData,
    cover_position: habit.coverPosition,
    cover_intensity: habit.coverIntensity
  };

  const { error } = await supabase.from('habits').upsert(dbHabit);
  if (error) console.error("Save Habit Error:", error);
};

// 🔥 Сохранение порядка привычек (без изменений, но убедимся)
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
    .order('position', { ascending: true }) // 🔥 Сортируем по позиции
    .order('created_at', { ascending: false });

  if (error) { console.error("Fetch AntiHabits Error:", error); return []; }
  
  return (data || []).map(h => ({
    ...h,
    startDate: h.start_date,
    longestStreak: h.longest_streak,
    position: h.position || 0, // 🔥 Читаем позицию
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

// 🔥 НОВАЯ ФУНКЦИЯ: Сохранение порядка Анти-Привычек
export const saveAntiHabitsOrderToDb = async (habits, userId) => {
    if (habits.length === 0) return;
    
    // Подготавливаем массив обновлений
    const updates = habits.map((h, index) => ({
      id: h.id,
      user_id: userId,
      title: h.title,
      // Минимальный набор полей, чтобы Supabase не ругался
      color: h.color,
      start_date: h.startDate,
      longest_streak: h.longestStreak,
      
      position: index // 👈 Главное обновление
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
