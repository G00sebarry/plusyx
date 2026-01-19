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

// --- 🔥 ПРИВЫЧКИ (GOD MODE) ---
export const fetchHabits = async (userId) => {
  console.log(`📥 Загружаю привычки для user: ${userId}`);
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error("❌ Ошибка загрузки привычек:", error);
    return [];
  }

  console.log(`✅ Найдено привычек в базе: ${data?.length}`);
  if (data?.length > 0) console.log("Первая привычка:", data[0]);

  return (data || []).map(h => ({
    id: h.id,
    title: h.title,
    color: h.color,
    icon: h.emoji,          // Берем из колонки emoji
    frequency: h.frequency,
    targetValue: h.targetValue, // Берем из колонки targetValue
    history: h.history || {}
  }));
};

export const saveHabitToDb = async (habit, userId) => {
  console.log("📤 Сохраняю привычку:", habit);
  
  const dbHabit = {
    id: habit.id,
    user_id: userId,
    title: habit.title,
    color: habit.color,
    emoji: habit.icon,      // Кладем в emoji
    frequency: habit.frequency,
    targetValue: habit.targetValue || 1, // Защита от пустоты
    history: habit.history
  };

  const { error } = await supabase.from('habits').upsert(dbHabit);
  
  if (error) {
    console.error("❌ CRITICAL ERROR SAVING HABIT:", error);
    alert(`ОШИБКА СОХРАНЕНИЯ ПРИВЫЧКИ:\n${error.message}\n${error.details}`);
  } else {
    console.log("✅ Привычка успешно сохранена!");
  }
};

export const deleteHabitFromDb = async (id) => {
  await supabase.from('habits').delete().eq('id', id);
};

// --- АНТИ-ПРИВЫЧКИ ---
export const fetchAntiHabits = async (userId) => {
  // Пробуем 'anti_habits' (как на скрине)
  const { data, error } = await supabase
    .from('anti_habits') 
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) { 
      console.error("Ошибка AntiHabits:", error); 
      return []; 
  }
  
  return (data || []).map(h => ({
    ...h,
    startDate: h.start_date,
    longestStreak: h.longest_streak,
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

  const { error } = await supabase.from('anti_habits').upsert(dbHabit);
  if (error) {
      console.error("Ошибка сохранения AntiHabit:", error);
      alert("Ошибка сохранения Анти-привычки: " + error.message);
  }
};

export const deleteAntiHabitFromDb = async (id) => {
  await supabase.from('anti_habits').delete().eq('id', id);
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
