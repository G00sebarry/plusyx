import { Task, Column, Habit, AntiHabit } from './types';
import { supabase } from './supabaseClient';

// --- ЗАДАЧИ ---
export const fetchTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true }) 
    .order('created_at', { ascending: true });

  if (error) { console.error('Error fetching tasks:', error); return []; }
  return (data || []) as unknown as Task[];
};

export const saveTaskToDb = async (task: Task, userId: string) => {
  const cleanTask = JSON.parse(JSON.stringify(task)); 
  const { error } = await supabase.from('tasks').upsert({ ...cleanTask, user_id: userId } as any);
  if (error) console.error('Error saving task:', error);
};

export const saveTasksOrderToDb = async (tasks: Task[], userId: string) => {
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
  const { error } = await supabase.from('tasks').upsert(updates as any);
  if (error) console.error('Error saving order:', error);
};

export const deleteTaskFromDb = async (taskId: string) => {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) console.error('Ошибка удаления задачи:', error);
};

// --- КОЛОНКИ ---
export const fetchColumns = async (userId: string): Promise<Column[]> => {
  const { data, error } = await supabase
    .from('columns')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true });

  if (error) { console.error('Error fetching columns:', error); return []; }
  return (data || []) as unknown as Column[];
};

export const saveColumnsToDb = async (columns: Column[], userId: string) => {
  const updates = columns.map((col, index) => ({
    id: col.id, user_id: userId, title: col.title, type: col.type, position: index
  }));
  const { error } = await supabase.from('columns').upsert(updates as any);
  if (error) console.error('Error saving columns:', error);
};

// --- 🔥 ПРИВЫЧКИ (ИСПРАВЛЕНО) ---
export const fetchHabits = async (userId: string): Promise<Habit[]> => {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) return [];

  return (data || []).map((h: any) => ({
    id: h.id,
    title: h.title,
    color: h.color,
    icon: h.icon,
    frequency: h.frequency,
    targetValue: h.target_value, 
    history: h.history || {}
  })) as unknown as Habit[]; 
};

export const saveHabitToDb = async (habit: Habit, userId: string) => {
  // 🔥 ПРИНУДИТЕЛЬНОЕ ОТКЛЮЧЕНИЕ ПРОВЕРКИ ТИПОВ НА ЧТЕНИЕ
  // Это спасет, если types.ts не подцепил обновление
  const h = habit as any; 

  const dbHabit = {
    id: h.id,
    user_id: userId,
    title: h.title,
    color: h.color,
    icon: h.icon,
    frequency: h.frequency,
    target_value: h.targetValue, 
    history: h.history
  };

  const { error } = await supabase.from('habits').upsert(dbHabit as any);
  if (error) console.error("Save Habit Error:", error);
};

export const deleteHabitFromDb = async (id: string) => {
  await supabase.from('habits').delete().eq('id', id);
};

// --- АНТИ-ПРИВЫЧКИ ---
export const fetchAntiHabits = async (userId: string): Promise<AntiHabit[]> => {
  const { data, error } = await supabase
    .from('antihabits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) { console.error("Fetch Error:", error); return []; }
  
  return (data || []).map((h: any) => ({
    ...h,
    startDate: h.start_date,
    longestStreak: h.longest_streak,
    fileData: h.file_data,            
    coverPosition: h.cover_position,  
    coverIntensity: h.cover_intensity 
  })) as unknown as AntiHabit[];
};

export const saveAntiHabitToDb = async (habit: AntiHabit, userId: string) => {
  // 🔥 ТОЖЕ ОТКЛЮЧАЕМ ПРОВЕРКУ
  const h = habit as any;
  const { startDate, longestStreak, fileData, coverPosition, coverIntensity, ...rest } = h;
  
  const dbHabit = {
    ...rest,
    start_date: startDate,
    longest_streak: longestStreak,
    file_data: fileData,            
    cover_position: coverPosition,  
    cover_intensity: coverIntensity,
    user_id: userId
  };

  const { error } = await supabase.from('antihabits').upsert(dbHabit as any);
  if (error) console.error("Save Error:", error);
};

export const deleteAntiHabitFromDb = async (id: string) => {
  await supabase.from('antihabits').delete().eq('id', id);
};

// --- ☁️ ЗАГРУЗКА ФАЙЛОВ ---
export const uploadImage = async (file: File): Promise<string | null> => {
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
