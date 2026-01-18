import { supabase } from './supabaseClient';
import { Task, Column, Habit, AntiHabit } from './types';

// --- ЗАДАЧИ ---
export const fetchTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    // 🔥 ИЗМЕНЕНИЕ: Сортируем сначала по позиции, потом по дате (для старых)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) { console.error('Ошибка задач:', error); return []; }
  return data as Task[];
};

export const saveTaskToDb = async (task: Task, userId: string) => {
  // При сохранении ставим печать владельца
  const { error } = await supabase.from('tasks').upsert({ ...task, user_id: userId });
  if (error) console.error('Ошибка сохранения задачи:', error);
};

// 🔥 НОВАЯ ФУНКЦИЯ: Сохраняем сразу пачку задач (для сортировки)
export const saveTasksOrderToDb = async (tasks: Task[], userId: string) => {
  const updates = tasks.map(t => ({
    ...t,
    user_id: userId
  }));
  
  const { error } = await supabase.from('tasks').upsert(updates);
  if (error) console.error('Ошибка обновления порядка:', error);
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
    .order('created_at', { ascending: true });

  if (error) return [];
  return data as Column[];
};

export const saveColumnsToDb = async (columns: Column[], userId: string) => {
  // Проходимся по всем колонкам и ставим им user_id
  const columnsWithUser = columns.map(c => ({ ...c, user_id: userId }));
  const { error } = await supabase.from('columns').upsert(columnsWithUser);
  if (error) console.error('Ошибка сохранения колонок:', error);
};

// --- ПРИВЫЧКИ ---
export const fetchHabits = async (userId: string): Promise<Habit[]> => {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) { console.error('Ошибка привычек:', error); return []; }
  return data as Habit[];
};

export const saveHabitToDb = async (habit: Habit, userId: string) => {
  const { error } = await supabase.from('habits').upsert({ ...habit, user_id: userId });
  if (error) console.error('Ошибка сохранения привычки:', error);
};

export const deleteHabitFromDb = async (id: string) => {
  const { error } = await supabase.from('habits').delete().eq('id', id);
  if (error) console.error('Ошибка удаления привычки:', error);
};

// --- ВРЕДНЫЕ ПРИВЫЧКИ ---
export const fetchAntiHabits = async (userId: string): Promise<AntiHabit[]> => {
  const { data, error } = await supabase
    .from('anti_habits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) { console.error('Ошибка AntiHabits:', error); return []; }
  return data as AntiHabit[];
};

export const saveAntiHabitToDb = async (habit: AntiHabit, userId: string) => {
  const { error } = await supabase.from('anti_habits').upsert({ ...habit, user_id: userId });
  if (error) console.error('Ошибка сохранения AntiHabit:', error);
};

export const deleteAntiHabitFromDb = async (id: string) => {
  const { error } = await supabase.from('anti_habits').delete().eq('id', id);
  if (error) console.error('Ошибка удаления AntiHabit:', error);
};
