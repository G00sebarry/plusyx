import React from 'react';
import { Task, Habit, Column } from '../../types';
import { MonthHeatmapGrid } from './MonthHeatmapGrid';
import { WeekListView } from './WeekListView';

interface DesktopLayoutProps {
  currentDate: Date;
  // Управление месяцем в левой сетке (стрелки в шапке сетки)
  onPrevMonth: () => void;
  onNextMonth: () => void;

  // Дата к которой надо подскроллить недельный список и триггер скролла
  weekAnchorDate: Date;
  onWeekVisibleChange: (monday: Date) => void;
  scrollTrigger: number;

  category: 'tasks' | 'habits' | 'all';
  tasks: Task[];
  habits: Habit[];
  columns: Column[];

  onEditTask: (task: Task) => void;
  onOpenQuickAdd: (dateStr: string) => void;
  onCycleHabit: (habitId: string, dateStr: string, current: boolean | 'mini' | 'freeze' | number | undefined) => void;
  onOpenHabitMenu: (x: number, y: number, habitId: string, dateStr: string) => void;
  onOpenDay: (date: Date) => void;
}

export const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  currentDate,
  onPrevMonth,
  onNextMonth,
  weekAnchorDate,
  onWeekVisibleChange,
  scrollTrigger,
  category,
  tasks,
  habits,
  columns,
  onEditTask,
  onOpenQuickAdd,
  onCycleHabit,
  onOpenHabitMenu,
  onOpenDay,
}) => {
  return (
    <div className="flex-1 grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-4 px-4 lg:px-5 pb-6 overflow-hidden">
      {/* ── ЛЕВАЯ КОЛОНКА: месяц с heatmap ── */}
      <div className="flex flex-col min-h-0">
        <MonthHeatmapGrid
          currentDate={currentDate}
          tasks={tasks}
          habits={habits}
          columns={columns}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
          onSelectDay={onOpenDay}
        />
      </div>

      {/* ── ПРАВАЯ КОЛОНКА: неделя-список начиная с сегодня ── */}
      <div className="flex flex-col min-h-0 tg-secondary-bg rounded-3xl overflow-hidden">
        <WeekListView
          anchorDate={weekAnchorDate}
          onVisibleWeekChange={onWeekVisibleChange}
          scrollTrigger={scrollTrigger}
          category={category}
          tasks={tasks}
          habits={habits}
          columns={columns}
          onEditTask={onEditTask}
          onOpenQuickAdd={onOpenQuickAdd}
          onCycleHabit={onCycleHabit}
          onOpenHabitMenu={onOpenHabitMenu}
          onOpenDay={onOpenDay}
        />
      </div>
    </div>
  );
};
