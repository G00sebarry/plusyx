import { createClient } from '@supabase/supabase-js';
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
  return data as Task[];
};

export const saveTaskToDb = async (task: Task, userId: string) => {
  const cleanTask = JSON.parse(JSON.stringify(task)); 
  const { error } = await supabase.from('tasks').upsert({ ...cleanTask, user_id: userId });
  if (error) console.error('Error saving task:', error);
};

export const saveTasksOrderToDb = async (tasks: Task[], userId: string) => {
  if (tasks.length === 0) return;
  const updates = tasks.map(t => ({
    id: t.id, user_id: userId, position: t.position, columnId: t.columnId, status: t.status, title: t.title, description: t.description, date: t.date
  }));
  const { error } = await supabase.from('tasks').upsert(updates);
  if (error) console.error('Error saving order:', error);
};

export const deleteTaskFromDb = async (taskId: string) => {
  await supabase.from('tasks').delete().eq('id', taskId);
};

// --- КОЛОНКИ ---
export const fetchColumns = async (userId: string): Promise<Column[]> => {
  const { data, error } = await supabase.from('columns').select('*').eq('user_id', userId).order('position', { ascending: true });
  if (error) { console.error('Error fetching columns:', error); return []; }
  return data as Column[];
};

export const saveColumnsToDb = async (columns: Column[], userId: string) => {
  const updates = columns.map((col, index) => ({
    id: col.id, user_id: userId, title: col.title, type: col.type, position: index
  }));
  const { error } = await supabase.from('columns').upsert(updates);
  if (error) console.error('Error saving columns:', error);
};

// --- ПРИВЫЧКИ ---
export const fetchHabits = async (userId: string): Promise<Habit[]> => {
  const { data, error } = await supabase.from('habits').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) return [];
  return data.map((h: any) => ({ ...h, targetValue: h.target_value })) as Habit[];
};

export const saveHabitToDb = async (habit: Habit, userId: string) => {
  const { targetValue, ...rest } = habit;
  const dbHabit = { ...rest, target_value: targetValue, user_id: userId };
  const { error } = await supabase.from('habits').upsert(dbHabit);
  if (error) console.error(error);
};

export const deleteHabitFromDb = async (id: string) => {
  await supabase.from('habits').delete().eq('id', id);
};

// --- 🔥 АНТИ-ПРИВЫЧКИ (ПОЛНЫЙ МАППИНГ) ---
export const fetchAntiHabits = async (userId: string): Promise<AntiHabit[]> => {
  const { data, error } = await supabase.from('antihabits').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) { console.error("Fetch Error:", error); return []; }
  
  // Переводим Snake_case (База) -> CamelCase (React)
  return data.map((h: any) => ({
    ...h,
    startDate: h.start_date,
    longestStreak: h.longest_streak,
    fileData: h.file_data,            // 👈 Картинка
    coverPosition: h.cover_position,  // 👈 Позиция
    coverIntensity: h.cover_intensity // 👈 Затемнение
  })) as AntiHabit[];
};

export const saveAntiHabitToDb = async (habit: AntiHabit, userId: string) => {
  // Переводим CamelCase (React) -> Snake_case (База)
  const { startDate, longestStreak, fileData, coverPosition, coverIntensity, ...rest } = habit;
  
  const dbHabit = {
    ...rest,
    start_date: startDate,
    longest_streak: longestStreak,
    file_data: fileData,            // 👈 Картинка
    cover_position: coverPosition,  // 👈 Позиция
    cover_intensity: coverIntensity,// 👈 Затемнение
    user_id: userId
  };

  const { error } = await supabase.from('antihabits').upsert(dbHabit);
  if (error) {
      console.error("Save Error:", error);
      alert("Ошибка сохранения: " + error.message);
  }
};

export const deleteAntiHabitFromDb = async (id: string) => {
  await supabase.from('antihabits').delete().eq('id', id);
};
