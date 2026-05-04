import React, { useState, useEffect } from 'react';
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

const COLLAPSED_STORAGE_KEY = 'plusyx_mobile_grid_collapsed';

/**
 * Мобильный вид календаря: сетка месяца сверху + карточка выбранного дня снизу.
 *
 * Сетку можно сворачивать до одной недели — кнопкой внизу сетки.
 * Состояние "свёрнуто/развёрнуто" сохраняется в localStorage.
 *
 * - Сегодня выбран по умолчанию.
 * - Тап по дню в сетке → карточка снизу обновляется (без модалки).
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
  // Состояние свёрнутости сетки. Стартуем с того что сохранено в localStorage.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Сохраняем при изменении
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
    } catch { /* ignore */ }
  }, [collapsed]);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
      {/* ── СЕТКА МЕСЯЦА (сворачивается) ── */}
      <div className="px-3 pb-3">
        <div className="tg-secondary-bg rounded-2xl p-3">
          <div
            className="transition-all duration-300 ease-out"
            style={{
              // В развёрнутом виде — пропорция 7:6.5 (6 строк дней + дни недели).
              // В свёрнутом — высота определяется aspect-square ячеек, не нужна.
              aspectRatio: collapsed ? undefined : '7/6.5',
            }}
          >
            <MonthHeatmapGrid
              currentDate={currentDate}
              tasks={tasks}
              habits={habits}
              columns={columns}
              onSelectDay={onSelectDay}
              selectedDay={selectedDay}
              showTaskPreview={false}
              compact={true}
              weekOnly={collapsed}
            />
          </div>

          {/* Кнопка-переключатель свернуть/развернуть */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-full mt-2 py-1.5 flex items-center justify-center gap-1.5 tg-hint hover:tg-text active:scale-95 transition-all rounded-lg"
            aria-label={collapsed ? 'Развернуть месяц' : 'Свернуть месяц'}
          >
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-50">
              {collapsed ? 'Развернуть месяц' : 'Свернуть'}
            </span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className={`opacity-50 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
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
