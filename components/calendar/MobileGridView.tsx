import React from 'react';
import { Task, Habit, Column } from '../../types';
import { DailyNote } from '../../api';
import { MonthHeatmapGrid } from './MonthHeatmapGrid';
import { DayCard } from './DayCard';

interface MobileGridViewProps {
  currentDate: Date;
  selectedDay: Date;
  onSelectDay: (date: Date) => void;

  tasks: Task[];
  habits: Habit[];
  columns: Column[];

  notes: DailyNote[];
  onAddNote: (date: string, text: string) => Promise<void>;
  onUpdateNote: (noteId: string, text: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;

  onEditTask: (task: Task) => void;
  onOpenQuickAdd: (dateStr: string) => void;
  onToggleHabit: (id: string, date: string, value: boolean | 'mini' | 'freeze') => void;
  onOpenHabitMenu: (x: number, y: number, habitId: string, dateStr: string) => void;
}

/**
 * Мобильный вид календаря: сетка месяца сверху + карточка выбранного дня снизу.
 * Всё в одном вертикальном скроллящемся потоке, никакого переключателя видов.
 *
 * - Сегодня выбран по умолчанию.
 * - Тап по дню в сетке → карточка снизу обновляется (без модалки).
 * - Прокрутка страницы скроллит сетку и карточку как один документ.
 */
export const MobileGridView: React.FC<MobileGridViewProps> = ({
  currentDate,
  selectedDay,
  onSelectDay,
  tasks,
  habits,
  columns,
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
    <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
      {/* ── СЕТКА МЕСЯЦА ── */}
      <div className="px-3 pb-3">
        <div className="tg-secondary-bg rounded-2xl p-3" style={{ aspectRatio: '7/6' }}>
          <MonthHeatmapGrid
            currentDate={currentDate}
            tasks={tasks}
            habits={habits}
            columns={columns}
            onSelectDay={onSelectDay}
            selectedDay={selectedDay}
            showTaskPreview={false}
            compact={true}
          />
        </div>
      </div>

      {/* ── КАРТОЧКА ВЫБРАННОГО ДНЯ ── */}
      <div className="px-3">
        <div className="tg-secondary-bg rounded-2xl overflow-hidden">
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
    </div>
  );
};
