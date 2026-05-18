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
  completedAt?: string;
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

export interface TaskLink {
  id: string;
  url: string;       // полный URL, всегда с протоколом
  label?: string;    // опциональное кастомное описание ссылки
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
  blocksOrder?: string[];

  // 🔗 ССЫЛКИ
  links?: TaskLink[];

  // 💤 СПЯЧКА
  archivedAt?: string;        // ISO timestamp — когда отправлена в спячку
  originalColumnId?: string;  // куда возвращать при пробуждении
}

// --- ПРИВЫЧКИ ---
export interface Habit {
  id: string;
  title: string;        
  description?: string;
  notes?: Array<{
    id: string;
    text: string;
    date: string;
  }>;
  emoji?: string;       
  color: string;       
  
  // Оставляем для совместимости с HabitModal, но не используем в логике
  isMeasurable?: boolean;
  targetValue?: number; 
  unit?: string;        

  frequency: {
    type: 'daily' | 'specific' | 'flexible';
    days: number[];
    customDates?: string[];
  };

  // 🔥 ИСТОРИЯ — теперь только простые значения
  history: Record<string, boolean | 'mini' | 'freeze'>;
  
  // ⚛️ АТОМНЫЕ ПОЛЯ
  identity?: string;
  triggerEvent?: string;
  miniAction?: string;
  
  // 🔔 УВЕДОМЛЕНИЯ
  reminderEnabled?: boolean;
  reminderTime?: string;

  position: number;
  fileName?: string;
  fileData?: string;
  coverPosition?: number;
  coverIntensity?: number;

  // 💤 СПЯЧКА
  archivedAt?: string;          // ISO timestamp — когда отправлена в спячку
  reactivatedAt?: string;       // ISO timestamp — когда последний раз пробудилась (точка отсчёта для метрик)
  allTimeBestStreak?: number;   // личный рекорд — никогда не сбрасывается при пробуждении
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
