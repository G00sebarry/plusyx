import React, { useCallback, useEffect, useState } from 'react';
import { Task, Habit, Column } from '../../types';
import {
  toLocalDateString,
  nextHabitValue,
} from './calendarUtils';
import { MobileGridView } from './MobileGridView';
import { QuickAddModal } from './QuickAddModal';
import { HabitContextMenu } from './HabitContextMenu';
import { DayCard } from './DayCard';
import { DesktopLayout } from './DesktopLayout';

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
  // Режима view больше нет — всегда показывается сетка месяца + карточка дня
  // (раньше был переключатель Мес/Нед на мобиле, теперь убран).
  const [category, setCategory] = useState<Category>(() => {
    const saved = localStorage.getItem(CATEGORY_STORAGE_KEY) as Category | null;
    return saved === 'tasks' || saved === 'habits' || saved === 'all' ? saved : 'tasks';
  });

  // Текущая "опорная" дата месяца — любая дата внутри отображаемого месяца.
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  // При входе в календарь всегда показываем сегодня
  useEffect(() => {
    setCurrentDate(new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── QuickAdd и контекстное меню привычки ──────────────────
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [habitMenu, setHabitMenu] = useState<{ x: number; y: number; habitId: string; date: string } | null>(null);
  // ── Открытая карточка дня (модалка — теперь только когда нужно открыть конкретный день поверх) ─
  const [openedDay, setOpenedDay] = useState<Date | null>(null);

  // ── Выбранный день для inline-карточки.
  //    По умолчанию — сегодня. Меняется кликом по дню в сетке/списке.
  const [selectedDayDesktop, setSelectedDayDesktop] = useState<Date>(() => new Date());

  // ── Адаптивность: десктоп >= 1024px ───────────────────────
  const [isDesktopMQ, setIsDesktopMQ] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktopMQ(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── Сохранение настроек ───────────────────────────────────
  useEffect(() => { localStorage.setItem(CATEGORY_STORAGE_KEY, category); }, [category]);

  // ── Навигация: стрелки всегда листают месяц ────────────────
  const navigate = (direction: -1 | 1) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + direction);
    setCurrentDate(d);
  };

  const goToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDayDesktop(today);
  };

  // ── Обработчик тоггла привычки из календаря ──────────────
  // Шлём команду 'cycle' — App.tsx вычислит следующее значение из актуального state
  // (защита от race condition при быстрых последовательных тапах).
  const handleCycleHabit = useCallback(
    (habitId: string, dateStr: string, _current?: boolean | 'mini' | 'freeze' | number | undefined) => {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      onToggleHabit(habitId, dateStr, 'cycle' as any);
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
  // Заголовок и состояние "сегодня" — всегда по месяцу сетки
  const headerLabel = `${currentDate.toLocaleString('ru-RU', { month: 'long' })} ${currentDate.getFullYear()}`;
  const todayStr = toLocalDateString(new Date());
  const isAtToday =
    currentDate.getMonth() === new Date().getMonth() &&
    currentDate.getFullYear() === new Date().getFullYear();

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
        </div>
      </div>

      {/* ── КОНТЕНТ ─────────────────────────────────────────── */}
      {/* ДЕСКТОП ≥1024px: двухколоночный дашборд (Сетка + Карточка дня) */}
      <div className="hidden lg:flex flex-1 min-h-0">
        <DesktopLayout
          currentDate={currentDate}
          onPrevMonth={() => navigate(-1)}
          onNextMonth={() => navigate(1)}
          category={category}
          tasks={tasks}
          habits={habits}
          columns={columns}
          // На десктопе клик по дню НЕ открывает модалку — только обновляет inline-карточку
          selectedDay={selectedDayDesktop}
          onSelectDay={setSelectedDayDesktop}
          notes={dailyNotes || []}
          onAddNote={async (date, text) => { if (onAddDailyNote) await onAddDailyNote(date, text); }}
          onUpdateNote={async (noteId, text) => { if (onUpdateDailyNote) await onUpdateDailyNote(noteId, text); }}
          onDeleteNote={async (noteId) => { if (onDeleteDailyNote) await onDeleteDailyNote(noteId); }}
          onEditTask={onEditTask}
          onOpenQuickAdd={(d) => setQuickAddDate(d)}
          onToggleHabit={onToggleHabit}
          onOpenHabitMenu={(x, y, habitId, date) => setHabitMenu({ x, y, habitId, date })}
        />
      </div>

      {/* МОБИЛА <1024px: сетка месяца + карточка дня снизу одним скроллом */}
      <div className="lg:hidden flex-1 flex flex-col min-h-0">
        <MobileGridView
          currentDate={currentDate}
          selectedDay={selectedDayDesktop}
          onSelectDay={setSelectedDayDesktop}
          tasks={tasks}
          habits={habits}
          columns={columns}
          notes={dailyNotes || []}
          onAddNote={async (date, text) => { if (onAddDailyNote) await onAddDailyNote(date, text); }}
          onUpdateNote={async (noteId, text) => { if (onUpdateDailyNote) await onUpdateDailyNote(noteId, text); }}
          onDeleteNote={async (noteId) => { if (onDeleteDailyNote) await onDeleteDailyNote(noteId); }}
          onEditTask={onEditTask}
          onOpenQuickAdd={(d) => setQuickAddDate(d)}
          onToggleHabit={onToggleHabit}
          onOpenHabitMenu={(x, y, habitId, date) => setHabitMenu({ x, y, habitId, date })}
        />
      </div>

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
