import React, { useMemo } from 'react';
import { Task, Habit, Column } from '../../types';
import {
  toLocalDateString,
  getHabitStatusForDate,
  TASK_STATUS_COLOR,
  HABIT_CHIP_STYLE,
} from './calendarUtils';

interface MonthViewProps {
  currentDate: Date;
  category: 'tasks' | 'habits';
  tasks: Task[];
  habits: Habit[];
  columns: Column[];
  onEditTask: (task: Task) => void;
  onOpenQuickAdd: (dateStr: string) => void;
}

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  category,
  tasks,
  habits,
  columns,
  onEditTask,
  onOpenQuickAdd,
}) => {
  const daysToDisplay = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, 1);
    const days: (Date | null)[] = [];
    const firstDay = date.getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < offset; i++) days.push(null);
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentDate]);

  const getTasksForDate = (dateStr: string) => tasks.filter((t) => t.date === dateStr);
  const todayStr = toLocalDateString(new Date());

  const handleCellClick = (e: React.MouseEvent, dateStr: string) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-task-btn]') || target.closest('[data-habit-item]')) return;
    onOpenQuickAdd(dateStr);
  };

  return (
    <div className="grid grid-cols-7 gap-px tg-secondary-bg rounded-[20px] md:rounded-[24px] overflow-hidden border border-gray-400/10">
      {weekdays.map((d, i) => (
        <div key={d} className="tg-secondary-bg py-2 md:py-2.5 text-center">
          <span
            className={`text-[9px] md:text-[10px] font-black uppercase tracking-tighter ${
              i >= 5 ? 'text-red-400/60' : 'tg-hint opacity-50'
            }`}
          >
            {d}
          </span>
        </div>
      ))}

      {daysToDisplay.map((date, i) => {
        if (!date) return <div key={`empty-${i}`} className="tg-bg min-h-[80px] md:min-h-[120px]" />;

        const dStr = toLocalDateString(date);
        const isToday = todayStr === dStr;
        const isPast = dStr < todayStr;
        const dayTasks = getTasksForDate(dStr);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

        return (
          <div
            key={dStr}
            onClick={(e) => category === 'tasks' && handleCellClick(e, dStr)}
            className={`
              min-h-[80px] md:min-h-[120px] p-1 md:p-1.5 flex flex-col gap-0.5 transition-all relative group
              ${isToday ? 'bg-blue-500/8 ring-1 ring-inset ring-blue-500/20' : 'tg-bg'}
              ${isPast && !isToday ? 'opacity-60' : ''}
              ${category === 'tasks' ? 'cursor-pointer hover:bg-blue-500/5' : ''}
            `}
          >
            <div className="flex justify-between items-center px-0.5 mb-0.5">
              <span
                className={`
                  text-[11px] md:text-[12px] font-black leading-none
                  ${
                    isToday
                      ? 'bg-blue-500 text-white w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[10px] md:text-[11px]'
                      : ''
                  }
                  ${!isToday && isWeekend ? 'text-red-400/50' : ''}
                  ${!isToday && !isWeekend ? 'tg-text opacity-30' : ''}
                `}
              >
                {date.getDate()}
              </span>

              {category === 'tasks' && (
                <button
                  data-task-btn
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenQuickAdd(dStr);
                  }}
                  className="w-5 h-5 md:w-6 md:h-6 rounded-md flex items-center justify-center text-blue-500/0 group-hover:text-blue-500/60 hover:!text-blue-500 hover:bg-blue-500/10 transition-all text-[14px] md:text-[16px] font-bold"
                >
                  +
                </button>
              )}
            </div>

            <div className="flex flex-col gap-[3px] flex-1 overflow-hidden">
              {category === 'tasks' ? (
                <>
                  {dayTasks.slice(0, 3).map((task) => {
                    const col = columns.find((c) => c.id === task.columnId);
                    const statusColor = col
                      ? TASK_STATUS_COLOR[col.type]
                      : TASK_STATUS_COLOR[task.status];
                    return (
                      <button
                        key={task.id}
                        data-task-btn
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTask(task);
                        }}
                        className={`text-[7px] md:text-[8px] px-1.5 py-[3px] md:py-1 rounded-md text-left truncate font-bold tracking-tight active:scale-95 transition-all ${statusColor}`}
                      >
                        {task.title}
                      </button>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <span className="text-[7px] font-black tg-hint px-1 opacity-40">
                      +{dayTasks.length - 3}
                    </span>
                  )}
                </>
              ) : (
                <>
                  {habits
                    .map((habit) => {
                      const status = getHabitStatusForDate(habit, date);
                      if (!status) return null;
                      const colorClass = HABIT_CHIP_STYLE[status];

                      return (
                        <div
                          key={habit.id}
                          data-habit-item
                          className={`text-[7px] md:text-[8px] px-1.5 py-[3px] md:py-1 rounded-md text-left truncate font-bold tracking-tight flex items-center gap-1 ${colorClass}`}
                        >
                          <span className="text-[7px] md:text-[9px] shrink-0">
                            {habit.emoji || '🔥'}
                          </span>
                          <span className="truncate">{habit.title}</span>
                        </div>
                      );
                    })
                    .filter(Boolean)
                    .slice(0, 4)}
                  {habits.filter((h) => getHabitStatusForDate(h, date)).length > 4 && (
                    <span className="text-[7px] font-black tg-hint px-1 opacity-40">
                      +{habits.filter((h) => getHabitStatusForDate(h, date)).length - 4}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
