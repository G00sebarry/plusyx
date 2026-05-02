import React, { useState, useEffect } from 'react';
import { Task, Habit, Column } from '../../types';
import { DailyNote } from '../../api';
import { MonthHeatmapGrid } from './MonthHeatmapGrid';
import { WeekListView } from './WeekListView';
import { DayCard } from './DayCard';

// ════════════════════════════════════════════════════════════════
// Три панели — порядок настраивается пользователем через стрелки
// ════════════════════════════════════════════════════════════════

type PanelId = 'month' | 'week' | 'day';

const DEFAULT_ORDER: PanelId[] = ['month', 'week', 'day'];
const ORDER_STORAGE_KEY = 'plusyx_desktop_panel_order';

const PANEL_LABELS: Record<PanelId, string> = {
  month: 'МЕСЯЦ',
  week: 'РАСПИСАНИЕ',
  day: 'КАРТОЧКА ДНЯ',
};

// ──────────────────────────────────────────────────────────
// Безопасное чтение порядка панелей из localStorage
// ──────────────────────────────────────────────────────────
const loadOrder = (): PanelId[] => {
  if (typeof window === 'undefined') return DEFAULT_ORDER;
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw);
    // валидация: должны быть все три панели и без дубликатов
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      DEFAULT_ORDER.every(p => parsed.includes(p))
    ) {
      return parsed as PanelId[];
    }
  } catch { /* ignore */ }
  return DEFAULT_ORDER;
};

interface DesktopLayoutProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;

  weekAnchorDate: Date;
  onWeekVisibleChange: (monday: Date) => void;
  scrollTrigger: number;

  category: 'tasks' | 'habits' | 'all';
  tasks: Task[];
  habits: Habit[];
  columns: Column[];

  // День, выбранный в правой панели "Карточка дня"
  selectedDay: Date;
  onSelectDay: (date: Date) => void;

  notes: DailyNote[];
  onAddNote: (date: string, text: string) => Promise<void>;
  onUpdateNote: (noteId: string, text: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;

  onEditTask: (task: Task) => void;
  onOpenQuickAdd: (dateStr: string) => void;
  onCycleHabit: (habitId: string, dateStr: string, current: boolean | 'mini' | 'freeze' | number | undefined) => void;
  onToggleHabit: (id: string, date: string, value: boolean | 'mini' | 'freeze') => void;
  onOpenHabitMenu: (x: number, y: number, habitId: string, dateStr: string) => void;
}

// ════════════════════════════════════════════════════════════════
// Обёртка для одной панели — добавляет шапку с лейблом и стрелками свапа
// ════════════════════════════════════════════════════════════════

const PanelShell: React.FC<{
  label: string;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  children: React.ReactNode;
  /** Если true — лейбл и стрелки прячутся (для DayCard у которого свой заголовок) */
  hideLabel?: boolean;
  /** Доп. контент в шапке справа от лейбла (например, навигация дня) */
  headerExtra?: React.ReactNode;
}> = ({ label, canMoveLeft, canMoveRight, onMoveLeft, onMoveRight, children, hideLabel, headerExtra }) => {
  return (
    <div className="flex flex-col h-full min-h-0 tg-secondary-bg rounded-3xl overflow-hidden">
      {!hideLabel && (
        <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest tg-hint opacity-50">
              {label}
            </span>
            {headerExtra}
          </div>
          <div className="flex gap-1">
            <button
              onClick={onMoveLeft}
              disabled={!canMoveLeft}
              title="Передвинуть влево"
              aria-label="Передвинуть панель влево"
              className={`
                w-6 h-6 flex items-center justify-center rounded-md transition-all
                ${canMoveLeft
                  ? 'bg-black/5 hover:bg-black/10 tg-hint hover:tg-text active:scale-90 cursor-pointer'
                  : 'bg-black/[0.02] tg-hint opacity-20 cursor-not-allowed'}
              `}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={onMoveRight}
              disabled={!canMoveRight}
              title="Передвинуть вправо"
              aria-label="Передвинуть панель вправо"
              className={`
                w-6 h-6 flex items-center justify-center rounded-md transition-all
                ${canMoveRight
                  ? 'bg-black/5 hover:bg-black/10 tg-hint hover:tg-text active:scale-90 cursor-pointer'
                  : 'bg-black/[0.02] tg-hint opacity-20 cursor-not-allowed'}
              `}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// Главный компонент — рендер трёх панелей в выбранном порядке
// ════════════════════════════════════════════════════════════════

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
  selectedDay,
  onSelectDay,
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onEditTask,
  onOpenQuickAdd,
  onCycleHabit,
  onToggleHabit,
  onOpenHabitMenu,
}) => {
  const [order, setOrder] = useState<PanelId[]>(loadOrder);

  // Сохраняем порядок панелей в localStorage
  useEffect(() => {
    try {
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
    } catch { /* ignore */ }
  }, [order]);

  // Свап двух соседних панелей
  const swap = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[idx], next[target]] = [next[target], next[idx]];
    setOrder(next);
  };

  const renderPanelContent = (id: PanelId): React.ReactNode => {
    if (id === 'month') {
      return (
        <div className="px-4 pb-4 pt-0 h-full overflow-hidden">
          <MonthHeatmapGrid
            currentDate={currentDate}
            tasks={tasks}
            habits={habits}
            columns={columns}
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
            onSelectDay={onSelectDay}
          />
        </div>
      );
    }
    if (id === 'week') {
      return (
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
          onOpenDay={onSelectDay}
        />
      );
    }
    if (id === 'day') {
      return (
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
      );
    }
    return null;
  };

  return (
    <div className="flex-1 grid grid-cols-3 gap-3 px-4 lg:px-5 pb-6 overflow-hidden min-h-0">
      {order.map((id, idx) => (
        <PanelShell
          key={id}
          label={PANEL_LABELS[id]}
          canMoveLeft={idx > 0}
          canMoveRight={idx < order.length - 1}
          onMoveLeft={() => swap(idx, -1)}
          onMoveRight={() => swap(idx, 1)}
          // У DayCard собственная шапка — лейбл/стрелки PanelShell всё равно нужны для свапа,
          // но прятать их в этом случае не будем — они унифицируют интерфейс
          hideLabel={false}
        >
          {renderPanelContent(id)}
        </PanelShell>
      ))}
    </div>
  );
};
