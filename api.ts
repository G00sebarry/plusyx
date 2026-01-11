import { supabase } from './supabaseClient';
import { Task, Column, Habit, AntiHabit } from './types';

// --- 1. ЗАДАЧИ (TASKS) ---
export const fetchTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
  if (error) { console.error('Ошибка задач:', error); return []; }
  return data as Task[];
};

export const saveTaskToDb = async (task: Task) => {
  const { error } = await supabase.from('tasks').upsert(task);
  if (error) console.error('Ошибка сохранения задачи:', error);
};

export const deleteTaskFromDb = async (taskId: string) => {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) console.error('Ошибка удаления задачи:', error);
};

// --- 2. КОЛОНКИ (COLUMNS) ---
export const fetchColumns = async (): Promise<Column[]> => {
  const { data, error } = await supabase.from('columns').select('*').order('created_at', { ascending: true });
  if (error) return [];
  return data as Column[];
};

export const saveColumnsToDb = async (columns: Column[]) => {
  const { error } = await supabase.from('columns').upsert(columns);
  if (error) console.error('Ошибка сохранения колонок:', error);
};

// --- 3. 🔥 ПОЛЕЗНЫЕ ПРИВЫЧКИ (HABITS) - ЭТОГО НЕ ХВАТАЛО ---
export const fetchHabits = async (): Promise<Habit[]> => {
  const { data, error } = await supabase.from('habits').select('*').order('created_at', { ascending: true });
  if (error) { console.error('Ошибка привычек:', error); return []; }
  return data as Habit[];
};

export const saveHabitToDb = async (habit: Habit) => {
  const { error } = await supabase.from('habits').upsert(habit);
  if (error) console.error('Ошибка сохранения привычки:', error);
};

export const deleteHabitFromDb = async (id: string) => {
  const { error } = await supabase.from('habits').delete().eq('id', id);
  if (error) console.error('Ошибка удаления привычки:', error);
};

// --- 4. 🔥 ВРЕДНЫЕ ПРИВЫЧКИ (ANTI-HABITS) - ЭТОГО ТОЖЕ НЕ БЫЛО ---
export const fetchAntiHabits = async (): Promise<AntiHabit[]> => {
  const { data, error } = await supabase.from('anti_habits').select('*').order('created_at', { ascending: true });
  if (error) { console.error('Ошибка AntiHabits:', error); return []; }
  return data as AntiHabit[];
};

export const saveAntiHabitToDb = async (habit: AntiHabit) => {
  const { error } = await supabase.from('anti_habits').upsert(habit);
  if (error) console.error('Ошибка сохранения AntiHabit:', error);
};

export const deleteAntiHabitFromDb = async (id: string) => {
  const { error } = await supabase.from('anti_habits').delete().eq('id', id);
  if (error) console.error('Ошибка удаления AntiHabit:', error);
};
