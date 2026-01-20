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

export interface TaskFile {
  id: string;
  name: string;
  url?: string;
  data?: string;
  type: string;
  size?: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  date: string;
  time?: string;
  isTimer?: boolean;
  status: TaskStatus;
  columnId?: string;
  color?: string;
  position: number;
  fileName?: string;
  fileData?: string;
  files?: TaskFile[];
  coverData?: string;
  coverPosition?: number;
  coverIntensity?: number;
  checklists: Checklist[];
  comments?: TaskComment[];
}

// --- ПРИВЫЧКИ (АТОМНЫЕ) ---
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

  // 🔥 ОБНОВЛЕННАЯ ИСТОРИЯ
  // value: 
  // - number (прогресс)
  // - true (выполнено Full)
  // - 'mini' (выполнено Mini)
  // - 'freeze' (заморожено)
  history: Record<string, boolean | number | 'mini' | 'freeze'>;
  
  // 🔥 НОВЫЕ ПОЛЯ (МЕТОД КЛИРА)
  identity?: string;     // "Я — Атлет"
  triggerEvent?: string; // "После кофе"
  miniAction?: string;   // "Хотя бы 2 отжимания"
  reminderTime?: string; // "08:00" (Техническое время)

  position: number;
  fileName?: string;
  fileData?: string;
  coverPosition?: number;
  coverIntensity?: number;
}

// --- АНТИ-ПРИВЫЧКИ ---
export interface AntiHabit {
  id: string;
  title: string;
  emoji: string;
  color: string;
  startDate: number;
  longestStreak: number;
  goal?: number;
  history: { date: number; duration: number }[];
  position: number;
  fileData?: string;
  coverPosition?: number;
  coverIntensity?: number;
}

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
