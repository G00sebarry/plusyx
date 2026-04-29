import { Habit } from '../../types';

export const toLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const isHabitScheduledForDate = (habit: Habit, date: Date) => {
  if (habit.frequency.days.includes(date.getDay())) return true;
  if (habit.frequency.customDates && habit.frequency.customDates.length > 0) {
    const dateStr = toLocalDateString(date);
    return habit.frequency.customDates.includes(dateStr);
  }
  return false;
};

export type HabitDayStatus = 'done' | 'mini' | 'freeze' | 'pending' | null;

export const getHabitStatusForDate = (habit: Habit, date: Date): HabitDayStatus => {
  const dStr = toLocalDateString(date);
  const value = habit.history[dStr];
  const goal = habit.targetValue || 1;
  const isScheduled = isHabitScheduledForDate(habit, date);

  if (value === 'freeze') return 'freeze';
  if (value === 'mini') return 'mini';

  const isDone = habit.isMeasurable
    ? Number(value || 0) >= goal
    : !!value;

  if (isDone) return 'done';
  if (isScheduled) return 'pending';
  return null;
};

// Возвращает Понедельник недели, в которую попадает date
export const getMondayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

// Сдвиг недели на N недель (N может быть отрицательным)
export const addWeeks = (date: Date, weeks: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
};

// Стабильный ключ недели для React-key и виртуализации
export const weekKey = (monday: Date): string => toLocalDateString(monday);

// Все 7 дат недели начиная с понедельника
export const daysOfWeek = (monday: Date): Date[] => {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
};

// Название месяца для sticky-плашки. Если неделя пересекает два месяца — оба.
export const weekMonthLabel = (monday: Date): string => {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const mNameStart = monday.toLocaleString('ru-RU', { month: 'long' });
  const mNameEnd = sunday.toLocaleString('ru-RU', { month: 'long' });
  const yStart = monday.getFullYear();
  const yEnd = sunday.getFullYear();

  if (mNameStart === mNameEnd) {
    return `${mNameStart} ${yStart}`;
  }
  if (yStart === yEnd) {
    return `${mNameStart} — ${mNameEnd} ${yStart}`;
  }
  return `${mNameStart} ${yStart} — ${mNameEnd} ${yEnd}`;
};

// Цвета статусов привычки для чипа в неделе-списке
export const HABIT_CHIP_STYLE: Record<NonNullable<HabitDayStatus>, string> = {
  done: 'bg-green-500 text-white',
  mini: 'bg-yellow-500 text-white',
  freeze: 'bg-cyan-400 text-white',
  pending: 'bg-gray-500/15 tg-hint border border-dashed border-gray-400/30',
};

// Цвета колонок статусов задачи
export const TASK_STATUS_COLOR: Record<string, string> = {
  todo: 'bg-blue-500/80 text-white',
  'in-progress': 'bg-orange-500/80 text-white',
  done: 'bg-green-500/80 text-white',
};

// Следующий статус по клику (как в HabitTracker.handleToggle)
// pending/null → done(true) → mini → freeze → null(false)
export const nextHabitValue = (
  current: boolean | 'mini' | 'freeze' | number | undefined
): boolean | 'mini' | 'freeze' => {
  if (current === true) return 'mini';
  if (current === 'mini') return 'freeze';
  if (current === 'freeze') return false;
  return true;
};
