import React from 'react';
import { Task, Habit, Column } from '../../types';
import { DailyNote } from '../../api';
import { MonthHeatmapGrid } from './MonthHeatmapGrid';
import { DayCard } from './DayCard';

interface DesktopLayoutProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;

  category: 'tasks' | 'habits' | 'all';
  tasks: Task[];
  habits: Habit[];
  columns: Column[];

  selectedDay: Date;
  onSelectDay: (date: Date) => void;

  notes: DailyNote[];
  onAddNote: (date: string, text: string) => Promise<void>;
  onUpdateNote: (noteId: string, text: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;

  onEditTask: (task: Task) => void;
  onOpenQuickAdd: (dateStr: string) => void;
  onToggleHabit: (id: string, date: string, value: boolean | 'mini' | 'freeze') => void;
  onOpenHabitMenu: (x: number, y: number, habitId: string, dateStr: string) => void;
}

export const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  currentDate,
  onPrevMonth,
  onNextMonth,
  tasks,
  habits,
  columns,
  selectedDay,
  onSelectDay,
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onEditTask,
  onOpenQuickAdd,
  onToggleHabit,
  onOpenHabitMenu,
}) => {
  return (
    <div className="flex-1 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3 px-4 lg:px-5 pb-6 overflow-hidden min-h-0">
      {/* ── ЛЕВАЯ КОЛОНКА: сетка месяца с превью задач в ячейках ── */}
      <div className="flex flex-col h-full min-h-0 tg-secondary-bg rounded-3xl overflow-hidden p-4">
        <MonthHeatmapGrid
          currentDate={currentDate}
          tasks={tasks}
          habits={habits}
          columns={columns}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
          onSelectDay={onSelectDay}
          selectedDay={selectedDay}
          showTaskPreview={true}
        />
      </div>

      {/* ── ПРАВАЯ КОЛОНКА: карточка дня (всегда видна, обновляется при клике в сетке) ── */}
      <div className="flex flex-col h-full min-h-0 tg-secondary-bg rounded-3xl overflow-hidden">
        <DayCard
          mode="inline"
          date={selectedDay}
          onChangeDate={onSelectDay}
          tasks={tasks}
          habits={habits}
          columns={columns}
          notes={notes}
          onAddNote={onAddNote}
          onUpdateNote={onUpdateNote}
          onDeleteNote={onDeleteNote}
          onEditTask={onEditTask}
          onOpenQuickAdd={onOpenQuickAdd}
          onToggleHabit={onToggleHabit}
          onOpenHabitMenu={onOpenHabitMenu}
        />
      </div>
    </div>
  );
};
