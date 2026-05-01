import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Task, Habit, Column } from '../../types';
import {
  toLocalDateString,
  getHabitStatusForDate,
  isHabitScheduledForDate,
  nextHabitValue,
} from './calendarUtils';

interface DayCardProps {
  date: Date;
  onClose: () => void;
  onChangeDate: (newDate: Date) => void;

  tasks: Task[];
  habits: Habit[];
  columns: Column[];

  // Заметка дня — текст и сохранялка
  initialNote: string;
  onSaveNote: (date: string, text: string) => Promise<void>;

  // Те же хендлеры что в WeekListView
  onEditTask: (task: Task) => void;
  onOpenQuickAdd: (dateStr: string) => void;
  onToggleHabit: (id: string, date: string, value: boolean | 'mini' | 'freeze') => void;
  onOpenHabitMenu: (x: number, y: number, habitId: string, dateStr: string) => void;
}

const WEEKDAY_FULL = [
  'Воскресенье', 'Понедельник', 'Вторник', 'Среда',
  'Четверг', 'Пятница', 'Суббота'
];

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

// Контекстный лейбл: «Сегодня» / «Вчера» / «Завтра» / «Через N дней» / «N дней назад»
const getContextLabel = (date: Date): { text: string; tone: 'today' | 'past' | 'future' } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { text: 'Сегодня', tone: 'today' };
  if (diffDays === -1) return { text: 'Вчера', tone: 'past' };
  if (diffDays === 1) return { text: 'Завтра', tone: 'future' };
  if (diffDays > 1 && diffDays <= 14) return { text: `Через ${diffDays} ${pluralDays(diffDays)}`, tone: 'future' };
  if (diffDays < -1 && diffDays >= -14) return { text: `${-diffDays} ${pluralDays(-diffDays)} назад`, tone: 'past' };

  return { text: `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`, tone: diffDays > 0 ? 'future' : 'past' };
};

const pluralDays = (n: number): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
};

const SWIPE_THRESHOLD = 80;
const NOTE_AUTOSAVE_MS = 1000;

export const DayCard: React.FC<DayCardProps> = ({
  date,
  onClose,
  onChangeDate,
  tasks,
  habits,
  columns,
  initialNote,
  onSaveNote,
  onEditTask,
  onOpenQuickAdd,
  onToggleHabit,
  onOpenHabitMenu,
}) => {
  const dStr = toLocalDateString(date);
  const ctx = getContextLabel(date);

  // Привычки этого дня (запланированные)
  const dayHabits = habits
    .filter(h => isHabitScheduledForDate(h, date))
    .map(h => ({
      habit: h,
      status: getHabitStatusForDate(h, date),
    }));

  // Задачи этого дня, отсортированные по времени
  const dayTasks = [...tasks]
    .filter(t => t.date === dStr)
    .sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });

  const habitsDone = dayHabits.filter(x => x.status === 'done' || x.status === 'mini' || x.status === 'freeze').length;
  const tasksDone = dayTasks.filter(t => {
    const col = columns.find(c => c.id === t.columnId);
    return (col?.type || t.status) === 'done';
  }).length;

  // ── Свайп между днями ──────────────────────────────────────
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartXRef.current = t.clientX;
    touchStartYRef.current = t.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartXRef.current;
    const dy = t.clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Свайп вниз — закрываем карточку (только если жест явно вертикальный и достаточно длинный)
    if (dy > 120 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      onClose();
      return;
    }

    // Горизонтальный свайп — смена дня
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;

    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + (dx < 0 ? 1 : -1));
    onChangeDate(newDate);
  };

  const goToDay = (offset: number) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + offset);
    onChangeDate(newDate);
  };

  // ── Закрытие по Escape ─────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goToDay(-1);
      if (e.key === 'ArrowRight') goToDay(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // ── Заметка дня + автосохранение ───────────────────────────
  const [noteText, setNoteText] = useState(initialNote);
  const [noteStatus, setNoteStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const noteTimerRef = useRef<number | null>(null);
  const noteInitialRef = useRef(initialNote);

  // Когда меняется день — обновляем initial и сбрасываем
  useEffect(() => {
    setNoteText(initialNote);
    noteInitialRef.current = initialNote;
    setNoteStatus('idle');
  }, [initialNote, dStr]);

  const onNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setNoteText(v);
    if (noteTimerRef.current !== null) clearTimeout(noteTimerRef.current);
    setNoteStatus('saving');
    noteTimerRef.current = window.setTimeout(async () => {
      try {
        await onSaveNote(dStr, v);
        noteInitialRef.current = v;
        setNoteStatus('saved');
        // Через 3 сек убираем плашку «Saved»
        window.setTimeout(() => setNoteStatus('idle'), 3000);
      } catch (err) {
        console.error('Save note error:', err);
        setNoteStatus('idle');
      }
    }, NOTE_AUTOSAVE_MS);
  };

  // ── Тоггл цикла привычки + хаптик ──────────────────────────
  const handleHabitToggle = useCallback(
    (habit: Habit) => {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      const current = habit.history[dStr];
      onToggleHabit(habit.id, dStr, nextHabitValue(current));
    },
    [dStr, onToggleHabit]
  );

  const longPressTimer = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const startLongPress = (habit: Habit, x: number, y: number) => {
    longPressFiredRef.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      onOpenHabitMenu(x, y, habit.id, dStr);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // ──────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[400] flex md:items-center md:justify-center md:p-4"
      onClick={onClose}
    >
      {/* Затемнение */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* Карточка */}
      <div
        className="
          relative tg-bg overflow-hidden
          w-full h-full md:h-auto md:max-h-[90vh] md:w-full md:max-w-md
          md:rounded-[28px] md:shadow-2xl md:border md:border-gray-400/10
          flex flex-col
          animate-in slide-in-from-bottom md:zoom-in-95 md:slide-in-from-bottom-0 fade-in duration-300
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating ✕ — всегда видна, поверх всего, в безопасной зоне */}
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="
            absolute z-30 right-3 w-11 h-11 flex items-center justify-center
            rounded-full bg-black/40 backdrop-blur-md text-white
            shadow-lg active:scale-90 transition-all hover:bg-black/60
          "
          style={{ top: 'max(12px, env(safe-area-inset-top))' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* ── Шапка: drag-handle + стрелки ── */}
        <div
          className="flex items-center justify-between px-4 pb-2 shrink-0 relative"
          style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Drag-индикатор для мобилы (показывает что можно свайпнуть вниз) */}
          <div className="md:hidden w-12 h-1 rounded-full bg-white/30 absolute left-1/2 -translate-x-1/2 top-2 pointer-events-none" />

          <div className="flex items-center gap-1 tg-secondary-bg p-1 rounded-2xl">
            <button
              onClick={() => goToDay(-1)}
              className="w-8 h-8 flex items-center justify-center tg-text hover:bg-black/5 rounded-xl transition-all active:scale-90"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={() => goToDay(1)}
              className="w-8 h-8 flex items-center justify-center tg-text hover:bg-black/5 rounded-xl transition-all active:scale-90"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Невидимый spacer чтобы стрелки не уезжали под floating ✕ */}
          <div className="w-11 h-11" aria-hidden />
        </div>

        {/* Скроллируемый контент */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
          {/* ── Большое число + день недели ── */}
          <div className="px-5 pt-2 pb-4">
            <div className="flex items-baseline gap-3">
              <span
                className={`
                  text-[64px] font-black leading-none tracking-tighter
                  ${ctx.tone === 'today' ? 'tg-text' : 'tg-text opacity-70'}
                `}
              >
                {date.getDate()}
              </span>
              <div className="flex flex-col">
                <span className="text-base font-bold tg-text leading-tight">
                  {WEEKDAY_FULL[date.getDay()]}
                </span>
                <span
                  className={`
                    text-[10px] font-black uppercase tracking-widest mt-0.5
                    ${ctx.tone === 'today' ? 'text-blue-500' : ctx.tone === 'future' ? 'text-purple-500' : 'tg-hint opacity-60'}
                  `}
                >
                  {ctx.text}
                </span>
              </div>
            </div>
            {/* Месяц-год показываем только если контекстный лейбл его не содержит */}
            {!ctx.text.includes(MONTH_NAMES[date.getMonth()]) && (
              <span className="text-[10px] font-black uppercase tracking-widest tg-hint opacity-40 mt-1.5 inline-block">
                {MONTH_NAMES[date.getMonth()]} {date.getFullYear()}
              </span>
            )}
          </div>

          {/* ── Мини-стата (только для прошлых и сегодняшних) ── */}
          {ctx.tone !== 'future' && (dayHabits.length > 0 || dayTasks.length > 0) && (
            <div className="px-5 pb-4 flex gap-2.5">
              {dayHabits.length > 0 && (
                <StatChip
                  label="Привычки"
                  done={habitsDone}
                  total={dayHabits.length}
                  color="green"
                />
              )}
              {dayTasks.length > 0 && (
                <StatChip
                  label="Задачи"
                  done={tasksDone}
                  total={dayTasks.length}
                  color="blue"
                />
              )}
            </div>
          )}

          {/* ── Привычки ── */}
          {dayHabits.length > 0 && (
            <Section title="Привычки" hint="тап — статус · удержание — меню">
              <div className="flex flex-col gap-1.5">
                {dayHabits.map(({ habit, status }) => (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    status={status}
                    onClick={() => {
                      if (longPressFiredRef.current) {
                        longPressFiredRef.current = false;
                        return;
                      }
                      handleHabitToggle(habit);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onOpenHabitMenu(e.clientX, e.clientY, habit.id, dStr);
                    }}
                    onTouchStart={(e) => {
                      const t = e.touches[0];
                      if (t) startLongPress(habit, t.clientX, t.clientY);
                    }}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    onMouseDown={(e) => e.button === 0 && startLongPress(habit, e.clientX, e.clientY)}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* ── Задачи ── */}
          <Section
            title="Задачи"
            action={
              <button
                onClick={() => onOpenQuickAdd(dStr)}
                className="text-[11px] font-bold text-blue-500 hover:underline"
              >
                + добавить
              </button>
            }
          >
            {dayTasks.length === 0 ? (
              <button
                onClick={() => onOpenQuickAdd(dStr)}
                className="w-full text-left text-[12px] tg-hint opacity-40 hover:opacity-100 transition-opacity py-3 px-3 rounded-xl border border-dashed border-gray-400/15"
              >
                Пока ничего не запланировано
              </button>
            ) : (
              <div className="flex flex-col gap-1">
                {dayTasks.map(task => {
                  const col = columns.find(c => c.id === task.columnId);
                  const isDone = (col?.type || task.status) === 'done';
                  const dotColor =
                    col?.type === 'done' ? '#22c55e' :
                    col?.type === 'in-progress' ? '#f97316' :
                    '#3b82f6';

                  return (
                    <button
                      key={task.id}
                      onClick={() => onEditTask(task)}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-black/5 active:scale-[0.99] transition-all text-left tg-secondary-bg"
                    >
                      <span className="text-[10px] tg-hint font-bold min-w-[36px] tabular-nums">
                        {task.time || '—'}
                      </span>
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: dotColor }}
                      />
                      <span
                        className={`
                          text-[13px] tg-text font-medium flex-1 truncate
                          ${isDone ? 'line-through opacity-50' : ''}
                        `}
                      >
                        {task.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Section>

          {/* ── Заметка дня ── */}
          <Section
            title="Заметка дня"
            action={
              noteStatus === 'saving' ? (
                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-blue-500/10 text-blue-500">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  Saving
                </span>
              ) : noteStatus === 'saved' ? (
                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-green-500/10 text-green-500">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Saved
                </span>
              ) : null
            }
          >
            <textarea
              value={noteText}
              onChange={onNoteChange}
              placeholder="Что было сегодня? Мысли, наблюдения, планы…"
              rows={4}
              className="
                w-full tg-secondary-bg tg-text rounded-2xl px-4 py-3 text-[13px] leading-relaxed
                outline-none border border-gray-400/10 focus:border-blue-500/40 transition-colors
                resize-none placeholder:tg-hint placeholder:opacity-40
              "
            />
          </Section>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// Helpers — Section, StatChip, HabitRow
// ════════════════════════════════════════════════════════════════

const Section: React.FC<{
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, hint, action, children }) => (
  <div className="px-5 pb-5">
    <div className="flex items-baseline justify-between mb-2.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest tg-hint">
          {title}
        </span>
        {hint && <span className="text-[9px] tg-hint opacity-40">{hint}</span>}
      </div>
      {action}
    </div>
    {children}
  </div>
);

const StatChip: React.FC<{
  label: string;
  done: number;
  total: number;
  color: 'green' | 'blue';
}> = ({ label, done, total, color }) => {
  const pct = total > 0 ? (done / total) * 100 : 0;
  const barColor = color === 'green' ? 'bg-green-500' : 'bg-blue-500';
  const numColor = color === 'green' ? 'text-green-500' : 'text-blue-500';
  return (
    <div className="flex-1 tg-secondary-bg rounded-2xl px-3 py-2.5">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[9px] font-bold tg-hint opacity-60 uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[13px] font-black tabular-nums">
          <span className={numColor}>{done}</span>
          <span className="tg-hint opacity-40">/{total}</span>
        </span>
      </div>
      <div className="h-1 bg-black/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

interface HabitRowProps {
  habit: Habit;
  status: 'done' | 'mini' | 'freeze' | 'pending' | null;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
}

const HabitRow: React.FC<HabitRowProps> = ({
  habit, status, onClick, onContextMenu, onTouchStart, onTouchEnd, onTouchMove, onMouseDown, onMouseUp, onMouseLeave,
}) => {
  const isDone = status === 'done';
  const isMini = status === 'mini';
  const isFreeze = status === 'freeze';

  let bg = 'bg-black/[0.02] border-dashed border-gray-400/15';
  let iconBg = 'bg-gray-500/10';
  let badgeBg = 'bg-transparent text-gray-500/50';
  let badgeText = 'Ждёт';

  if (isDone) {
    bg = 'bg-green-500/10 border-green-500/25';
    iconBg = 'bg-green-500';
    badgeBg = 'bg-green-500 text-white';
    badgeText = 'Готово';
  } else if (isMini) {
    bg = 'bg-yellow-500/10 border-yellow-500/30';
    iconBg = 'bg-yellow-500';
    badgeBg = 'bg-yellow-500 text-white';
    badgeText = 'Мини';
  } else if (isFreeze) {
    bg = 'bg-cyan-500/10 border-cyan-400/30';
    iconBg = 'bg-cyan-400';
    badgeBg = 'bg-cyan-400 text-white';
    badgeText = '❄️ Заморозка';
  }

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      className={`
        flex items-center gap-3 py-2.5 px-3 rounded-xl border transition-all active:scale-[0.99] select-none
        ${bg}
      `}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[15px] shrink-0 ${iconBg}`}>
        {habit.emoji || '🔥'}
      </div>
      <span className={`flex-1 text-[13px] font-bold text-left tg-text ${status === 'pending' ? 'opacity-60' : ''}`}>
        {habit.title}
      </span>
      <div
        className={`text-[9px] font-black tracking-wider px-2 py-1 rounded-md uppercase shrink-0 ${badgeBg}`}
      >
        {badgeText}
      </div>
    </button>
  );
};
