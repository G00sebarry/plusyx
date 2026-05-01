import React, { useCallback, useEffect, useState } from 'react';
import { Task, Habit, Column } from '../../types';
import {
  toLocalDateString,
  getMondayOfWeek,
  addWeeks,
  weekMonthLabel,
  nextHabitValue,
} from './calendarUtils';
import { MonthView } from './MonthView';
import { WeekListView } from './WeekListView';
import { QuickAddModal } from './QuickAddModal';
import { HabitContextMenu } from './HabitContextMenu';
import { DayCard } from './DayCard';

type ViewMode = 'month' | 'week';
type Category = 'tasks' | 'habits' | 'all';

interface CalendarViewProps {
  tasks: Task[];
  habits: Habit[];
  columns: Column[];
  onEditTask: (task: Task) => void;
  onQuickAdd: (task: Partial<Task>) => void;
  onToggleHabit: (id: string, date: string, value: boolean | 'mini' | 'freeze') => void;
  // Журнал заметок дня
  dailyNotes?: import('../../api').DailyNote[];
  onAddDailyNote?: (date: string, text: string) => Promise<void>;
  onUpdateDailyNote?: (noteId: string, text: string) => Promise<void>;
  onDeleteDailyNote?: (noteId: string) => Promise<void>;
}

const VIEW_STORAGE_KEY = 'plusyx_calendar_view';
const CATEGORY_STORAGE_KEY = 'plusyx_calendar_category';

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  habits,
  columns,
  onEditTask,
  onQuickAdd,
  onToggleHabit,
  dailyNotes,
  onAddDailyNote,
  onUpdateDailyNote,
  onDeleteDailyNote,
}) => {
  // ── Состояние навигации ───────────────────────────────────
  const [view, setView] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode | null;
    return saved === 'month' || saved === 'week' ? saved : 'week';
  });
  const [category, setCategory] = useState<Category>(() => {
    const saved = localStorage.getItem(CATEGORY_STORAGE_KEY) as Category | null;
    return saved === 'tasks' || saved === 'habits' || saved === 'all' ? saved : 'tasks';
  });

  // Текущая "опорная" дата. Для месяца — любая дата месяца; для недели — дата к которой нужно подскроллить.
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  // Видимая неделя (для sticky-плашки в week-режиме). Обновляется на скролле из WeekListView.
  const [visibleWeekMonday, setVisibleWeekMonday] = useState<Date>(() => getMondayOfWeek(new Date()));
  // Триггер для принудительной прокрутки в WeekListView (увеличивается при нажатии стрелок/Сегодня)
  const [scrollTrigger, setScrollTrigger] = useState(0);

  // При входе в календарь всегда показываем сегодня — никаких "запомнили месяц назад"
  useEffect(() => {
    const today = new Date();
    setCurrentDate(today);
    setVisibleWeekMonday(getMondayOfWeek(today));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── QuickAdd и контекстное меню привычки ──────────────────
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [habitMenu, setHabitMenu] = useState<{ x: number; y: number; habitId: string; date: string } | null>(null);
  // ── Открытая карточка дня ─────────────────────────────────
  const [openedDay, setOpenedDay] = useState<Date | null>(null);

  // ── Сохранение настроек ───────────────────────────────────
  useEffect(() => { localStorage.setItem(VIEW_STORAGE_KEY, view); }, [view]);
  useEffect(() => { localStorage.setItem(CATEGORY_STORAGE_KEY, category); }, [category]);

  // ── Навигация ─────────────────────────────────────────────
  const navigate = (direction: -1 | 1) => {
    if (view === 'month') {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() + direction);
      setCurrentDate(d);
    } else {
      // В неделе листаем по 4 недели за тап (быстрая навигация)
      const newDate = addWeeks(currentDate, direction * 4);
      setCurrentDate(newDate);
      setScrollTrigger(t => t + 1);
    }
  };

  const goToday = () => {
    const today = new Date();
    setCurrentDate(today);
    if (view === 'week') {
      setVisibleWeekMonday(getMondayOfWeek(today));
      setScrollTrigger(t => t + 1);
    }
  };

  // При смене вида — синхронизируем currentDate с тем, что было видно
  const switchView = (next: ViewMode) => {
    if (next === view) return;
    if (next === 'month') {
      // Переходим в месяц — currentDate берём из видимой недели
      setCurrentDate(visibleWeekMonday);
    } else {
      // Переходим в неделю — берём 1 число месяца если currentDate в этом месяце,
      // иначе текущую дату
      const today = new Date();
      const sameMonth =
        currentDate.getFullYear() === today.getFullYear() &&
        currentDate.getMonth() === today.getMonth();
      const target = sameMonth ? today : currentDate;
      setCurrentDate(target);
      setVisibleWeekMonday(getMondayOfWeek(target));
      setScrollTrigger(t => t + 1);
    }
    setView(next);
  };

  // ── Обработчик тоггла привычки из календаря ──────────────
  const handleCycleHabit = useCallback(
    (habitId: string, dateStr: string, current: boolean | 'mini' | 'freeze' | number | undefined) => {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      onToggleHabit(habitId, dateStr, nextHabitValue(current));
    },
    [onToggleHabit]
  );

  const handleHabitMenuSelect = (status: 'full' | 'mini' | 'freeze' | 'reset') => {
    if (!habitMenu) return;
    let val: boolean | 'mini' | 'freeze' = false;
    if (status === 'full') val = true;
    if (status === 'mini') val = 'mini';
    if (status === 'freeze') val = 'freeze';
    onToggleHabit(habitMenu.habitId, habitMenu.date, val);
    setHabitMenu(null);
  };

  // ── QuickAdd → создание задачи ────────────────────────────
  const handleQuickAdd = (title: string, columnId: string, date: string, time?: string) => {
    const col = columns.find(c => c.id === columnId);
    onQuickAdd({
      id: '',
      title,
      description: '',
      date,
      time: time || '',
      status: col?.type || 'todo',
      columnId,
      checklists: [],
      comments: [],
    });
  };

  // ── Заголовок ─────────────────────────────────────────────
  const headerLabel = view === 'month'
    ? `${currentDate.toLocaleString('ru-RU', { month: 'long' })} ${currentDate.getFullYear()}`
    : weekMonthLabel(visibleWeekMonday);

  const todayStr = toLocalDateString(new Date());
  const isAtToday = view === 'month'
    ? currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear()
    : toLocalDateString(visibleWeekMonday) === toLocalDateString(getMondayOfWeek(new Date()));

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden">
      {/* ── HEADER (двухрядный) ──────────────────────────── */}
      <div className="px-4 md:px-5 pt-4 mb-2">
        {/* Ряд 1: заголовок + стрелки */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-xl font-black tg-text capitalize tracking-tighter truncate min-w-0 flex-1">
            {headerLabel.split(' ').slice(0, -1).join(' ')}{' '}
            <span className="opacity-20">{headerLabel.split(' ').slice(-1)[0]}</span>
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            {!isAtToday && (
              <button
                onClick={goToday}
                className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500/20 transition-all active:scale-95"
              >
                Сегодня
              </button>
            )}
            <div className="flex items-center gap-0.5 tg-secondary-bg p-1 rounded-2xl">
              <button
                onClick={() => navigate(-1)}
                className="w-8 h-8 flex items-center justify-center tg-text hover:bg-black/5 rounded-xl transition-all active:scale-90"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                onClick={() => navigate(1)}
                className="w-8 h-8 flex items-center justify-center tg-text hover:bg-black/5 rounded-xl transition-all active:scale-90"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Ряд 2: категории слева + переключатель видов справа */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-3 md:gap-4 min-w-0">
            <CategoryTab active={category === 'tasks'} accent="blue" onClick={() => setCategory('tasks')}>
              Задачи
            </CategoryTab>
            <CategoryTab active={category === 'habits'} accent="green" onClick={() => setCategory('habits')}>
              Привычки
            </CategoryTab>
            <CategoryTab active={category === 'all'} accent="purple" onClick={() => setCategory('all')}>
              Всё
            </CategoryTab>
          </div>
          <div className="flex tg-secondary-bg p-0.5 rounded-2xl shrink-0">
            <ViewTab active={view === 'month'} onClick={() => switchView('month')}>Мес</ViewTab>
            <ViewTab active={view === 'week'} onClick={() => switchView('week')}>Нед</ViewTab>
          </div>
        </div>
      </div>

      {/* ── КОНТЕНТ ─────────────────────────────────────────── */}
      {view === 'month' ? (
        <div className="flex-1 overflow-y-auto no-scrollbar px-2 md:px-3 pb-24">
          <MonthView
            currentDate={currentDate}
            // В месяце "all" сводим к "tasks" — иначе ячейки слишком плотные.
            // Месяц для смешанного просмотра неудобен; для этого есть неделя.
            category={category === 'habits' ? 'habits' : 'tasks'}
            tasks={tasks}
            habits={habits}
            columns={columns}
            onEditTask={onEditTask}
            onOpenQuickAdd={(d) => setQuickAddDate(d)}
            onOpenDay={(d) => setOpenedDay(d)}
          />
        </div>
      ) : (
        <WeekListView
          anchorDate={currentDate}
          onVisibleWeekChange={setVisibleWeekMonday}
          scrollTrigger={scrollTrigger}
          category={category}
          tasks={tasks}
          habits={habits}
          columns={columns}
          onEditTask={onEditTask}
          onOpenQuickAdd={(d) => setQuickAddDate(d)}
          onCycleHabit={handleCycleHabit}
          onOpenHabitMenu={(x, y, habitId, date) => setHabitMenu({ x, y, habitId, date })}
          onOpenDay={(d) => setOpenedDay(d)}
        />
      )}

      {/* ── МОДАЛКИ ─────────────────────────────────────────── */}
      <QuickAddModal
        isOpen={!!quickAddDate}
        onClose={() => setQuickAddDate(null)}
        onSubmit={handleQuickAdd}
        columns={columns}
        date={quickAddDate || todayStr}
      />

      {habitMenu && (
        <HabitContextMenu
          x={habitMenu.x}
          y={habitMenu.y}
          onClose={() => setHabitMenu(null)}
          onSelect={handleHabitMenuSelect}
        />
      )}

      {openedDay && (
        <DayCard
          date={openedDay}
          onClose={() => setOpenedDay(null)}
          onChangeDate={(d) => {
            setOpenedDay(d);
            // Синхронизируем календарь под карточкой с днём в карточке
            setCurrentDate(d);
            if (view === 'week') setVisibleWeekMonday(getMondayOfWeek(d));
          }}
          tasks={tasks}
          habits={habits}
          columns={columns}
          notes={dailyNotes || []}
          onAddNote={async (date, text) => { if (onAddDailyNote) await onAddDailyNote(date, text); }}
          onUpdateNote={async (noteId, text) => { if (onUpdateDailyNote) await onUpdateDailyNote(noteId, text); }}
          onDeleteNote={async (noteId) => { if (onDeleteDailyNote) await onDeleteDailyNote(noteId); }}
          onEditTask={(task) => {
            // Закрываем карточку дня — иначе TaskModal окажется под ней
            setOpenedDay(null);
            onEditTask(task);
          }}
          onOpenQuickAdd={(d) => setQuickAddDate(d)}
          onToggleHabit={onToggleHabit}
          onOpenHabitMenu={(x, y, habitId, date) => setHabitMenu({ x, y, habitId, date })}
        />
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────
// Маленькие кнопки-табы (внутри файла чтобы не плодить мелочь)
// ────────────────────────────────────────────────────────────

const CategoryTab: React.FC<{
  active: boolean;
  accent: 'blue' | 'green' | 'purple';
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, accent, onClick, children }) => {
  const accentMap = {
    blue: 'text-blue-500 border-blue-500',
    green: 'text-green-500 border-green-500',
    purple: 'text-purple-500 border-purple-500',
  };
  return (
    <button
      onClick={onClick}
      className={`text-[10px] font-black uppercase tracking-widest transition-all ${
        active ? `${accentMap[accent]} border-b-2 pb-0.5` : 'tg-hint opacity-40 hover:opacity-100'
      }`}
    >
      {children}
    </button>
  );
};

const ViewTab: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${
      active ? 'bg-blue-500 text-white' : 'tg-hint hover:bg-black/5'
    }`}
  >
    {children}
  </button>
);
