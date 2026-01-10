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
  
  // --- НОВОЕ ПОЛЕ ---
  isTimer?: boolean; // Включен ли режим таймера (обратный отсчет)
  // ------------------

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

export type FrequencyType = 'daily' | 'presets' | 'even-days' | 'odd-days' | 'interval' | 'quota-week' | 'quota-month' | 'quota-custom' | 'specific-dates';

export interface HabitFrequency {
  type: FrequencyType;
  preset?: 'mon-wed-fri' | 'tue-thu-sat';
  intervalDays?: number;
  quotaCount?: number;
  quotaPeriod?: number;
  specificDates?: string[]; // Список дат в формате ГГГГ-ММ-ДД
}

export interface Habit {
  id: string;
  name: string;
  color: string;
  question: string;
  isMeasurable: boolean;
  unit?: string;
  goalValue?: number;
  targetType: 'at-least' | 'at-most';
  frequency: HabitFrequency;
  reminderEnabled: boolean;
  reminderTime?: string;
  notes?: string;
  history: Record<string, boolean | number>;
  fileName?: string;
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
