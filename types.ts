export type TaskStatus = 'todo' | 'in-progress' | 'done';

export interface Column {
  id: string;
  title: string;
  type: TaskStatus;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Checklist {
  id: string;
  title: string;
  items: ChecklistItem[];
  hideCompleted: boolean;
}

export interface TaskComment {
  id: string;
  text: string;
  date: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  date: string;
  time?: string;
  
  isTimer?: boolean; // Включен ли режим таймера

  status: TaskStatus;
  columnId?: string; // Привязка к конкретной колонке
  color?: string;
  fileName?: string;
  fileData?: string;
  coverData?: string;
  coverPosition?: number; // 0 to 100
  coverIntensity?: number; // 0 to 100
  checklists: Checklist[];
  comments?: TaskComment[];
}

// --- ПРИВЫЧКИ (СОЗДАТЬ) ---
export interface Habit {
  id: string;
  title: string;        
  description?: string; 
  
  emoji?: string;       
  color: string;        

  isMeasurable: boolean;
  targetValue?: number; 
  unit?: string;        

  frequency: {
    type: 'daily' | 'specific' | 'flexible';
    days: number[]; // 0 - Вс, 1 - Пн ... 6 - Сб
  };

  history: Record<string, boolean | number>;
  
  reminderTime?: string;
  fileName?: string;
  fileData?: string;
  coverPosition?: number;
  coverIntensity?: number;
}

// --- 🔥 ВРЕДНЫЕ ПРИВЫЧКИ (БРОСИТЬ) ---
// Новая сущность, которую мы добавили
export interface AntiHabit {
  id: string;
  title: string;
  emoji: string;
  color: string; // Цвет кольца прогресса
  
  startDate: number;     // Дата начала (Timestamp), чтобы тикал таймер
  longestStreak: number; // Рекорд в миллисекундах
  goal?: number;         // Цель (если есть)
  
  history: { date: number; duration: number }[]; // История срывов
  
  // Кастомизация обложки (наша фишка)
  fileData?: string;
  coverPosition?: number;
  coverIntensity?: number;
}
// -------------------------------------

export type ViewType = 'kanban' | 'calendar' | 'tracker';

declare global {
  interface Window {
    Telegram?: any;
    process?: {
      env: {
        API_KEY: string;
      };
    };
  }
}

export {};
