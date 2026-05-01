import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Task, Habit, Column } from '../../types';
import {
  toLocalDateString,
  getHabitStatusForDate,
  isHabitScheduledForDate,
  nextHabitValue,
} from './calendarUtils';
import { DailyNote } from '../../api';

interface DayCardProps {
  date: Date;
  onClose: () => void;
  onChangeDate: (newDate: Date) => void;

  tasks: Task[];
  habits: Habit[];
  columns: Column[];

  // Журнал заметок дня
  notes: DailyNote[];
  onAddNote: (date: string, text: string) => Promise<void>;
  onUpdateNote: (noteId: string, text: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;

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

const pluralNotes = (n: number): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'записей';
  if (mod10 === 1) return 'запись';
  if (mod10 >= 2 && mod10 <= 4) return 'записи';
  return 'записей';
};

const SWIPE_THRESHOLD = 80;
const LONG_PRESS_MS = 500;

export const DayCard: React.FC<DayCardProps> = ({
  date,
  onClose,
  onChangeDate,
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
  const dStr = toLocalDateString(date);
  const ctx = getContextLabel(date);

  const dayHabits = habits
    .filter(h => isHabitScheduledForDate(h, date))
    .map(h => ({ habit: h, status: getHabitStatusForDate(h, date) }));

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
    const target = e.target as HTMLElement;
    if (target.closest('textarea, input, button, [data-no-swipe]')) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return;
    }
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && !(e.target as HTMLElement)?.closest?.('textarea, input')) goToDay(-1);
      if (e.key === 'ArrowRight' && !(e.target as HTMLElement)?.closest?.('textarea, input')) goToDay(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // ── Тоггл цикла привычки ──────────────────────────────────
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
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // ── Журнал заметок ─────────────────────────────────────────
  const dayNotes = (notes || [])
    .filter(n => n.date === dStr)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  const [draftText, setDraftText] = useState('');
  const draftRef = useRef<HTMLTextAreaElement>(null);

  // Анимация slide-in-from-bottom только при первом открытии,
  // не при смене даты стрелками/свайпом
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 350);
    return () => clearTimeout(t);
  }, []);

  const handleAddNote = async () => {
    const text = draftText.trim();
    if (!text) return;
    setDraftText('');
    if (draftRef.current) draftRef.current.style.height = 'auto';
    await onAddNote(dStr, text);
  };

  const handleDraftInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className={`
          relative w-full max-w-lg tg-bg
          rounded-t-[40px] sm:rounded-[32px] shadow-2xl
          flex flex-col max-h-[92vh] overflow-hidden
          ${mounted ? '' : 'animate-in slide-in-from-bottom duration-300'}
        `}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── ШАПКА ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest tg-hint opacity-60">
            Карточка дня
          </span>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 tg-secondary-bg p-0.5 rounded-xl">
              <button
                onClick={() => goToDay(-1)}
                className="w-7 h-7 flex items-center justify-center tg-text hover:bg-black/5 rounded-lg transition-all active:scale-90"
                aria-label="Предыдущий день"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                onClick={() => goToDay(1)}
                className="w-7 h-7 flex items-center justify-center tg-text hover:bg-black/5 rounded-lg transition-all active:scale-90"
                aria-label="Следующий день"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-black/5 hover:bg-black/10 active:scale-90 transition-all tg-text"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Скролл */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-12">
          {/* Большое число */}
          <div className="px-5 pt-1 pb-3">
            <div className="flex items-baseline gap-3">
              <span
                className={`
                  text-[56px] font-black leading-none tracking-tighter
                  ${ctx.tone === 'today' ? 'tg-text' : 'tg-text opacity-70'}
                `}
              >
                {date.getDate()}
              </span>
              <div className="flex flex-col">
                <span className="text-[15px] font-bold tg-text leading-tight">
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
            {!ctx.text.includes(MONTH_NAMES[date.getMonth()]) && (
              <span className="text-[10px] font-black uppercase tracking-widest tg-hint opacity-40 mt-1.5 inline-block">
                {MONTH_NAMES[date.getMonth()]} {date.getFullYear()}
              </span>
            )}
          </div>

          {/* Мини-стата */}
          {ctx.tone !== 'future' && (dayHabits.length > 0 || dayTasks.length > 0) && (
            <div className="px-5 pb-4 flex gap-2.5">
              {dayHabits.length > 0 && (
                <StatChip label="Привычки" done={habitsDone} total={dayHabits.length} color="green" />
              )}
              {dayTasks.length > 0 && (
                <StatChip label="Задачи" done={tasksDone} total={dayTasks.length} color="blue" />
              )}
            </div>
          )}

          {/* Привычки */}
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

          {/* Задачи */}
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
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
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

          {/* Журнал заметок */}
          <Section
            title="Журнал дня"
            action={
              dayNotes.length > 0 ? (
                <span className="text-[9px] tg-hint opacity-50 font-bold">
                  {dayNotes.length} {pluralNotes(dayNotes.length)}
                </span>
              ) : null
            }
          >
            {dayNotes.length > 0 && (
              <div className="flex flex-col gap-1 mb-2">
                {dayNotes.map(note => (
                  <NoteRow
                    key={note.id}
                    note={note}
                    onUpdate={onUpdateNote}
                    onDelete={onDeleteNote}
                  />
                ))}
              </div>
            )}

            {/* Поле ввода */}
            <div className="flex items-end gap-2 px-2 py-1.5 bg-black/5 rounded-2xl border border-blue-500/0 focus-within:border-blue-500/30 transition-colors">
              <textarea
                ref={draftRef}
                value={draftText}
                onChange={handleDraftInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
                placeholder={dayNotes.length === 0 ? 'Записать первую мысль дня…' : 'Записать ещё…'}
                rows={1}
                className="
                  flex-1 bg-transparent tg-text outline-none resize-none
                  text-[13px] leading-relaxed py-1.5 px-2
                  placeholder:tg-hint placeholder:opacity-40
                "
                style={{ minHeight: 28, maxHeight: 120 }}
              />
              <button
                onClick={handleAddNote}
                disabled={!draftText.trim()}
                className={`
                  w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-all
                  ${draftText.trim()
                    ? 'bg-blue-500 text-white hover:bg-blue-600 active:scale-90'
                    : 'bg-black/5 text-gray-400 cursor-not-allowed'}
                `}
                aria-label="Добавить заметку"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ════════════════════════════════════════════════════════════════
// NoteRow — одна запись журнала
// ════════════════════════════════════════════════════════════════

interface NoteRowProps {
  note: DailyNote;
  onUpdate: (noteId: string, text: string) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}

const NoteRow: React.FC<NoteRowProps> = ({ note, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const [showDelete, setShowDelete] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setText(note.text); }, [note.text]);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.style.height = 'auto';
      editRef.current.style.height = `${editRef.current.scrollHeight}px`;
      const len = editRef.current.value.length;
      editRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const startLongPress = () => {
    longPressFiredRef.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
      setShowDelete(true);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = () => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (showDelete) {
      setShowDelete(false);
      return;
    }
    setEditing(true);
  };

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      await onDelete(note.id);
      return;
    }
    if (trimmed !== note.text) {
      await onUpdate(note.id, trimmed);
    }
    setEditing(false);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDelete(false);
    await onDelete(note.id);
  };

  if (editing) {
    return (
      <div className="flex gap-2.5 p-2.5 bg-black/5 rounded-xl border border-blue-500/30" data-no-swipe>
        <span className="text-[9px] font-black tg-hint opacity-60 min-w-[36px] pt-1 tabular-nums">
          {note.time}
        </span>
        <textarea
          ref={editRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
          }}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setText(note.text);
              setEditing(false);
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
          }}
          className="
            flex-1 bg-transparent tg-text outline-none resize-none
            text-[12px] leading-relaxed
          "
          style={{ minHeight: 20 }}
        />
      </div>
    );
  }

  return (
    <div
      data-no-swipe
      onClick={handleClick}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onMouseDown={(e) => e.button === 0 && startLongPress()}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowDelete(true);
      }}
      className={`
        flex gap-2.5 p-2.5 rounded-xl cursor-pointer select-none transition-all
        ${showDelete
          ? 'bg-red-500/10 border border-red-500/30'
          : 'tg-secondary-bg hover:bg-black/5 border border-transparent'}
      `}
    >
      <span className="text-[9px] font-black tg-hint opacity-60 min-w-[36px] pt-1 tabular-nums">
        {note.time}
      </span>
      <span className="flex-1 text-[12px] leading-relaxed tg-text whitespace-pre-wrap break-words">
        {note.text}
      </span>
      {showDelete && (
        <button
          onClick={handleDelete}
          className="w-7 h-7 flex items-center justify-center bg-red-500 text-white rounded-lg shrink-0 active:scale-90 transition-all hover:bg-red-600"
          aria-label="Удалить заметку"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// Хелперы — Section, StatChip, HabitRow
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
        <span className="text-[10px] font-black uppercase tracking-widest tg-hint">{title}</span>
        {hint && <span className="text-[9px] tg-hint opacity-40">{hint}</span>}
      </div>
      {action}
    </div>
    {children}
  </div>
);

const StatChip: React.FC<{ label: string; done: number; total: number; color: 'green' | 'blue' }> = ({
  label, done, total, color,
}) => {
  const pct = total > 0 ? (done / total) * 100 : 0;
  const barColor = color === 'green' ? 'bg-green-500' : 'bg-blue-500';
  const numColor = color === 'green' ? 'text-green-500' : 'text-blue-500';
  return (
    <div className="flex-1 tg-secondary-bg rounded-2xl px-3 py-2.5">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[9px] font-bold tg-hint opacity-60 uppercase tracking-wider">{label}</span>
        <span className="text-[13px] font-black tabular-nums">
          <span className={numColor}>{done}</span>
          <span className="tg-hint opacity-40">/{total}</span>
        </span>
      </div>
      <div className="h-1 bg-black/10 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
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
      <div className={`text-[9px] font-black tracking-wider px-2 py-1 rounded-md uppercase shrink-0 ${badgeBg}`}>
        {badgeText}
      </div>
    </button>
  );
};
