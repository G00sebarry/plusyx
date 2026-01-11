import { supabase } from './supabaseClient';
import { Task, Column, Habit, AntiHabit } from './types';

// --- ЗАДАЧИ (TASKS) ---

// 1. Получить все задачи
export const fetchTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: true }); // Сортируем, чтобы старые были сверху

  if (error) {
    console.error('Ошибка загрузки задач:', error);
    return [];
  }
  return data as Task[];
};

// 2. Добавить или Обновить задачу
export const saveTaskToDb = async (task: Task) => {
  // Supabase сам поймет: если ID есть в базе -> обновит, если нет -> создаст
  const { error } = await supabase
    .from('tasks')
    .upsert(task); 

  if (error) console.error('Ошибка сохранения задачи:', error);
};

// 3. Удалить задачу
export const deleteTaskFromDb = async (taskId: string) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) console.error('Ошибка удаления задачи:', error);
};

// --- КОЛОНКИ (COLUMNS) ---
export const fetchColumns = async (): Promise<Column[]> => {
  const { data, error } = await supabase
    .from('columns')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return [];
  return data as Column[];
};

export const saveColumnsToDb = async (columns: Column[]) => {
  // Здесь мы просто перезаписываем массив колонок (упрощенно)
  const { error } = await supabase.from('columns').upsert(columns);
  if (error) console.error('Ошибка сохранения колонок:', error);
};
