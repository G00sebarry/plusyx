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

  if (error) {
    console.error('Ошибка загрузки задач:', error);
    return [];
  }
  return data as Task[];
};

export const saveTaskToDb = async (task: Task, userId: string) => {
  const cleanTask = JSON.parse(JSON.stringify(task)); 
  const { error } = await supabase.from('tasks').upsert({ ...cleanTask, user_id: userId });
  if (error) console.error('Ошибка сохранения задачи:', error);
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
  const { error } = await supabase.from('tasks').upsert(updates);
  if (error) console.error('Ошибка сохранения порядка:', error);
};

export const deleteTaskFromDb = async (taskId: string) => {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) console.error('Ошибка удаления задачи:', error);
};

// --- 🔥 КОЛОНКИ (ИСПРАВЛЕНО: order -> position) ---
export const fetchColumns = async (userId: string): Promise<Column[]> => {
  const { data, error } = await supabase
    .from('columns')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true }); // Сортируем по position

  if (error) {
    console.error('Ошибка загрузки колонок:', error);
    return [];
  }
  
  return data as Column[];
};

export const saveColumnsToDb = async (columns: Column[], userId: string) => {
  const updates = columns.map((col, index) => ({
    id: col.id,
    user_id: userId,
    title: col.title,
    type: col.type,
    position: index // Сохраняем как position
  }));

  const { error } = await supabase.from('columns').upsert(updates);
  if (error) console.error('Ошибка сохранения колонок:', error);
};

// --- ПРИВЫЧКИ ---
export const fetchHabits = async (userId: string): Promise<Habit[]> => {
  const { data, error } = await supabase.from('habits').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data as Habit[];
};

export const saveHabitToDb = async (habit: Habit, userId: string) => {
  const { error } = await supabase.from('habits').upsert({ ...habit, user_id: userId });
  if (error) console.error(error);
};

export const deleteHabitFromDb = async (id: string) => {
  const { error } = await supabase.from('habits').delete().eq('id', id);
  if (error) console.error(error);
};

// --- АНТИ-ПРИВЫЧКИ ---
export const fetchAntiHabits = async (userId: string): Promise<AntiHabit[]> => {
  const { data, error } = await supabase.from('antihabits').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data as AntiHabit[];
};

export const saveAntiHabitToDb = async (habit: AntiHabit, userId: string) => {
  const { error } = await supabase.from('antihabits').upsert({ ...habit, user_id: userId });
  if (error) console.error(error);
};

export const deleteAntiHabitFromDb = async (id: string) => {
  const { error } = await supabase.from('antihabits').delete().eq('id', id);
  if (error) console.error(error);
};
