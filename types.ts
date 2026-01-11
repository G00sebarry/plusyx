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

// --- ОБНОВЛЕННАЯ СЕКЦИЯ ПРИВЫЧЕК ---
// Мы убрали старые сложные интерфейсы (HabitFrequency, FrequencyType)
// и сделали одну простую и понятную структуру

export interface Habit {
  id: string;
  title: string;        // Раньше было name. Теперь везде title для единообразия.
  description?: string; // Раньше было question. Теперь это "Мотивация".
  
  emoji?: string;       // НОВОЕ: Эмодзи-аватарка
  color: string;        // Цвет фона иконки

  isMeasurable: boolean;
  targetValue?: number; // Раньше было goalValue
  unit?: string;        // Ед. измерения (мл, стр, км)

  // Новая упрощенная частота (дни недели)
  frequency: {
    type: 'daily' | 'specific' | 'flexible';
    days: number[]; // Массив чисел: 0 - Вс, 1 - Пн ... 6 - Сб
  };

  history: Record<string, boolean | number>;
  
  // Дополнительные поля (оставил на всякий случай для совместимости или будущего)
  reminderTime?: string;
  fileName?: string;
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
