import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Task, Habit, Column } from '../../types';
import {
  toLocalDateString,
  getMondayOfWeek,
  daysOfWeek,
  weekKey,
  addWeeks,
  weekMonthLabel,
  getHabitStatusForDate,
  HABIT_CHIP_STYLE,
  TASK_STATUS_COLOR,
} from './calendarUtils';

interface WeekListViewProps {
  // Дата вокруг которой строится вид — обычно сегодня или дата выбранная стрелками
  anchorDate: Date;
  // Когда видимая неделя меняется — сообщаем наверх (для обновления sticky-плашки)
  onVisibleWeekChange: (monday: Date) => void;
  // Внешний триггер прокрутки (нажали "Сегодня" или стрелку — anchorDate поменялся)
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

const INITIAL_WEEKS_BEFORE = 8;       // Прошлые недели грузим, чтоб юзер мог листать назад
const INITIAL_WEEKS_AFTER = 12;       // И будущие — для прокрутки вперёд
const LOAD_MORE_THRESHOLD = 4;        // Когда осталось меньше N недель до края — подгружаем
const LOAD_BATCH = 8;                  // Сколько недель добавлять за раз
const LONG_PRESS_MS = 500;

const WEEKDAY_FULL = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export const WeekListView: React.FC<WeekListViewProps> = ({
  anchorDate,
  onVisibleWeekChange,
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
  // Список понедельников отсортированный по возрастанию
  const [weeks, setWeeks] = useState<Date[]>(() => {
    const center = getMondayOfWeek(anchorDate);
    const arr: Date[] = [];
    for (let i = -INITIAL_WEEKS_BEFORE; i <= INITIAL_WEEKS_AFTER; i++) {
      arr.push(addWeeks(center, i));
    }
    return arr;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const weekRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dayRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Чтобы не дёргать onVisibleWeekChange лишний раз
  const lastReportedWeekRef = useRef<string>('');

  const todayStr = toLocalDateString(new Date());

  // ──────────────────────────────────────────────────────────
  // Скролл к anchorDate при смене scrollTrigger (нажали "Сегодня" / стрелку)
  // Скроллим к самой дате, чтобы она была первой видимой строкой.
  // ──────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const targetDayKey = toLocalDateString(anchorDate);
    const node = dayRefs.current.get(targetDayKey);
    const container = containerRef.current;

    if (!node || !container) return;

    const containerRect = container.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const offset = nodeRect.top - containerRect.top + container.scrollTop;
    container.scrollTo({ top: offset, behavior: 'smooth' });
  }, [scrollTrigger, anchorDate]);

  // ──────────────────────────────────────────────────────────
  // На монтаже: подскроллить к стартовому дню. Используем ручной scrollTop
  // с явным расчётом offset относительно контейнера. Проверяем что layout уже посчитан.
  // ──────────────────────────────────────────────────────────
  const initialScrollDoneRef = useRef(false);
  const scrollToAnchor = useCallback(() => {
    if (initialScrollDoneRef.current) return;
    const targetDayKey = toLocalDateString(anchorDate);
    const node = dayRefs.current.get(targetDayKey);
    const container = containerRef.current;
    // Должны существовать обе ноды и контейнер должен иметь реальную высоту
    if (!node || !container || container.clientHeight === 0) return;
    // У ноды тоже должна быть высота — иначе layout ещё не посчитан
    if (node.offsetHeight === 0) return;

    // offsetTop у ноды относительно offsetParent. Идём вверх до контейнера, суммируем.
    let offset = 0;
    let el: HTMLElement | null = node;
    while (el && el !== container) {
      offset += el.offsetTop;
      el = el.offsetParent as HTMLElement | null;
    }
    // Если вообще не дошли до контейнера — fallback на bounding rect
    if (!el) {
      const cRect = container.getBoundingClientRect();
      const nRect = node.getBoundingClientRect();
      offset = nRect.top - cRect.top + container.scrollTop;
    }

    container.scrollTop = offset;
    initialScrollDoneRef.current = true;
  }, [anchorDate]);

  // Делаем несколько попыток через rAF, пока скролл не получится
  useLayoutEffect(() => {
    let frame = 0;
    const attempt = () => {
      scrollToAnchor();
      if (!initialScrollDoneRef.current && frame++ < 60) {
        requestAnimationFrame(attempt);
      }
    };
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ──────────────────────────────────────────────────────────
  // Обработчик скролла: подгрузка недель + определение видимой
  // ──────────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const viewportH = container.clientHeight;
    const scrollH = container.scrollHeight;

    // Подгрузка вверх
    if (scrollTop < 200) {
      setWeeks(prev => {
        const first = prev[0];
        const more: Date[] = [];
        for (let i = LOAD_BATCH; i >= 1; i--) more.push(addWeeks(first, -i));
        // Сохраняем визуальное положение: после prepend нужно компенсировать высоту
        const prevScrollH = container.scrollHeight;
        requestAnimationFrame(() => {
          if (containerRef.current) {
            const diff = containerRef.current.scrollHeight - prevScrollH;
            containerRef.current.scrollTop = scrollTop + diff;
          }
        });
        return [...more, ...prev];
      });
    }

    // Подгрузка вниз
    if (scrollTop + viewportH > scrollH - 200) {
      setWeeks(prev => {
        const last = prev[prev.length - 1];
        const more: Date[] = [];
        for (let i = 1; i <= LOAD_BATCH; i++) more.push(addWeeks(last, i));
        return [...prev, ...more];
      });
    }

    // Определяем видимую неделю — ту, чей верх ближе всего к верху вьюпорта
    const probeY = container.getBoundingClientRect().top + 20;
    let bestKey = '';
    let bestDist = Infinity;
    weekRefs.current.forEach((node, key) => {
      const rect = node.getBoundingClientRect();
      const dist = Math.abs(rect.top - probeY);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = key;
      }
    });

    if (bestKey && bestKey !== lastReportedWeekRef.current) {
      lastReportedWeekRef.current = bestKey;
      const monday = weeks.find(w => weekKey(w) === bestKey);
      if (monday) onVisibleWeekChange(monday);
    }
  }, [weeks, onVisibleWeekChange]);

  // ──────────────────────────────────────────────────────────
  // Хелперы для рендера дня
  // ──────────────────────────────────────────────────────────
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(t => {
      if (!t.date) return;
      const arr = map.get(t.date) || [];
      arr.push(t);
      map.set(t.date, arr);
    });
    // Сортируем задачи внутри дня по времени (без времени — в конце)
    map.forEach(arr => {
      arr.sort((a, b) => {
        if (!a.time && !b.time) return 0;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      });
    });
    return map;
  }, [tasks]);

  const showHabits = category === 'habits' || category === 'all';
  const showTasks = category === 'tasks' || category === 'all';

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto no-scrollbar px-2 md:px-3 pb-24"
    >
      <div className="flex flex-col gap-2">
        {(() => {
          // Предыдущий отрисованный день — для определения смены месяца "на стыке"
          let prevRenderedDate: Date | null = null;

          return weeks.map((monday, weekIdx) => {
            const days = daysOfWeek(monday);
            const key = weekKey(monday);

            // Все 7 дней недели рендерятся как есть. Сегодня будет первой видимой строкой
            // за счёт скролла к ноде в ref-callback ниже.

            return (
              <div
                key={key}
                ref={node => {
                  if (node) weekRefs.current.set(key, node);
                  else weekRefs.current.delete(key);
                }}
                className="flex flex-col gap-2"
              >
                {days.map(date => {
                  const dStr = toLocalDateString(date);

                  // Плашка месяца появляется перед днём, если:
                  //  - это самый первый отрисованный день в списке, или
                  //  - у этого дня сменился месяц/год по сравнению с предыдущим отрисованным днём
                  const showMonthLabel =
                    !prevRenderedDate ||
                    date.getMonth() !== prevRenderedDate.getMonth() ||
                    date.getFullYear() !== prevRenderedDate.getFullYear();

                  // Запоминаем для следующей итерации
                  prevRenderedDate = date;

                  const monthName = date.toLocaleString('ru-RU', { month: 'long' });
                  const year = date.getFullYear();

                  return (
                    <React.Fragment key={dStr}>
                      {showMonthLabel && (
                        <div className="flex items-center gap-2 px-2 pt-2 pb-0.5 sticky top-0 z-10 tg-secondary-bg/95 backdrop-blur-sm">
                          <span className="text-[11px] font-black uppercase tracking-widest tg-text">
                            {monthName}
                          </span>
                          <span className="text-[10px] font-bold tg-hint opacity-40">
                            {year}
                          </span>
                          <div className="flex-1 h-[1px] bg-gray-400/15 ml-1" />
                        </div>
                      )}
                      <div
                        ref={node => {
                          if (node) {
                            dayRefs.current.set(dStr, node);
                            // Если это целевой день и мы ещё не скроллили — попробовать скроллить сейчас.
                            if (
                              !initialScrollDoneRef.current &&
                              dStr === toLocalDateString(anchorDate)
                            ) {
                              requestAnimationFrame(scrollToAnchor);
                            }
                          } else {
                            dayRefs.current.delete(dStr);
                          }
                        }}
                      >
                        <DayRow
                          date={date}
                          todayStr={todayStr}
                          showHabits={showHabits}
                          showTasks={showTasks}
                          habits={habits}
                          columns={columns}
                          tasks={tasksByDate.get(dStr) || []}
                          onEditTask={onEditTask}
                          onOpenQuickAdd={onOpenQuickAdd}
                          onCycleHabit={onCycleHabit}
                          onOpenHabitMenu={onOpenHabitMenu}
                          onOpenDay={onOpenDay}
                        />
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// Строка одного дня
// ════════════════════════════════════════════════════════════════

interface DayRowProps {
  date: Date;
  todayStr: string;
  showHabits: boolean;
  showTasks: boolean;
  habits: Habit[];
  columns: Column[];
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onOpenQuickAdd: (dateStr: string) => void;
  onCycleHabit: (habitId: string, dateStr: string, current: boolean | 'mini' | 'freeze' | number | undefined) => void;
  onOpenHabitMenu: (x: number, y: number, habitId: string, dateStr: string) => void;
  onOpenDay: (date: Date) => void;
}

const DayRow: React.FC<DayRowProps> = ({
  date,
  todayStr,
  showHabits,
  showTasks,
  habits,
  columns,
  tasks,
  onEditTask,
  onOpenQuickAdd,
  onCycleHabit,
  onOpenHabitMenu,
  onOpenDay,
}) => {
  const dStr = toLocalDateString(date);
  const isToday = dStr === todayStr;
  const isPast = dStr < todayStr;
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const dayHabits = showHabits
    ? habits
        .map(h => ({
          habit: h,
          status: getHabitStatusForDate(h, date),
        }))
        .filter(x => x.status !== null)
    : [];

  const hasContent = dayHabits.length > 0 || tasks.length > 0;

  // Цвет акцент-полоски слева
  const accentClass = isToday
    ? 'border-l-blue-500'
    : isPast
    ? 'border-l-gray-400/20'
    : 'border-l-gray-400/30';

  // Заметные разделители между ячейками + hover-эффект с лёгким масштабированием
  const bgClass = isToday
    ? 'bg-blue-500/8 ring-1 ring-inset ring-blue-500/20 shadow-[0_2px_8px_-2px_rgba(59,130,246,0.15)]'
    : 'tg-secondary-bg ring-1 ring-inset ring-gray-400/[0.08]';

  const opacityClass = isPast && !isToday ? 'opacity-70' : '';

  return (
    <div
      className={`
        grid grid-cols-[56px_1fr] md:grid-cols-[72px_1fr] gap-3 px-3 py-2.5 rounded-2xl border-l-2
        transition-all duration-200 ease-out
        hover:scale-[1.015] hover:ring-blue-500/30 hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.3)]
        ${accentClass} ${bgClass} ${opacityClass}
      `}
    >
      {/* ── Левая колонка: день недели + число (кликабельна — открывает карточку дня) ───────────────── */}
      <button
        onClick={() => onOpenDay(date)}
        className="flex flex-col text-left active:scale-95 transition-transform hover:opacity-80"
      >
        <span
          className={`
            text-[9px] md:text-[10px] font-black uppercase tracking-widest
            ${isToday ? 'text-blue-500' : isWeekend ? 'text-red-400/70' : 'tg-hint opacity-50'}
          `}
        >
          {WEEKDAY_FULL[dayOfWeek]}
          {isToday && <span className="ml-1">· сегодня</span>}
        </span>
        <span
          className={`
            text-[20px] md:text-[22px] font-black leading-none mt-0.5
            ${isToday ? 'tg-text' : isWeekend ? 'text-red-400/70' : 'tg-text opacity-50'}
          `}
        >
          {date.getDate()}
        </span>
      </button>

      {/* ── Правая колонка: чипы привычек + список задач ─────── */}
      <div className="flex flex-col gap-1.5 min-w-0">
        {/* Чипы привычек */}
        {showHabits && dayHabits.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {dayHabits.map(({ habit, status }) => (
              <HabitChip
                key={habit.id}
                habit={habit}
                status={status!}
                dateStr={dStr}
                onCycle={onCycleHabit}
                onOpenMenu={onOpenHabitMenu}
              />
            ))}
          </div>
        )}

        {/* Задачи */}
        {showTasks && tasks.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {tasks.map(task => {
              const col = columns.find(c => c.id === task.columnId);
              const colorClass = col
                ? TASK_STATUS_COLOR[col.type]
                : TASK_STATUS_COLOR[task.status];
              const isDone = (col?.type || task.status) === 'done';

              return (
                <button
                  key={task.id}
                  onClick={() => onEditTask(task)}
                  className="flex items-center gap-2 py-1 px-1 rounded-lg hover:bg-black/5 active:scale-[0.99] transition-all text-left"
                >
                  <span className="text-[10px] tg-hint font-bold min-w-[36px] tabular-nums">
                    {task.time || '—'}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colorClass}`} />
                  <span
                    className={`
                      text-[12px] md:text-[13px] tg-text font-medium truncate flex-1
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

        {/* Пустое состояние / кнопка добавить */}
        {!hasContent && showTasks && (
          <button
            onClick={() => onOpenQuickAdd(dStr)}
            className="text-left text-[11px] tg-hint opacity-30 hover:opacity-100 transition-opacity py-1"
          >
            + добавить задачу
          </button>
        )}
        {showTasks && hasContent && tasks.length === 0 && (
          <button
            onClick={() => onOpenQuickAdd(dStr)}
            className="text-left text-[10px] tg-hint opacity-25 hover:opacity-80 transition-opacity py-0.5"
          >
            + задача
          </button>
        )}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// Чип привычки с тоггл-кликом и long-press
// ════════════════════════════════════════════════════════════════

interface HabitChipProps {
  habit: Habit;
  status: 'done' | 'mini' | 'freeze' | 'pending';
  dateStr: string;
  onCycle: (habitId: string, dateStr: string, current: boolean | 'mini' | 'freeze' | number | undefined) => void;
  onOpenMenu: (x: number, y: number, habitId: string, dateStr: string) => void;
}

const HabitChip: React.FC<HabitChipProps> = ({ habit, status, dateStr, onCycle, onOpenMenu }) => {
  const longPressTimer = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const current = habit.history[dateStr];

  const startLongPress = (x: number, y: number) => {
    longPressFiredRef.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      onOpenMenu(x, y, habit.id, dateStr);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (longPressFiredRef.current) {
      // Контекстное меню уже открылось — не циклим
      longPressFiredRef.current = false;
      return;
    }
    onCycle(habit.id, dateStr, current);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenMenu(e.clientX, e.clientY, habit.id, dateStr);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) startLongPress(t.clientX, t.clientY);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Только левая кнопка
    if (e.button !== 0) return;
    startLongPress(e.clientX, e.clientY);
  };

  const colorClass = HABIT_CHIP_STYLE[status];

  return (
    <button
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onMouseDown={handleMouseDown}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      className={`
        text-[10px] md:text-[11px] px-2 py-1 rounded-md font-bold tracking-tight
        flex items-center gap-1 active:scale-95 transition-all select-none
        ${colorClass}
      `}
    >
      <span className="text-[10px] md:text-[11px] shrink-0">{habit.emoji || '🔥'}</span>
      <span className="truncate max-w-[140px] md:max-w-[200px]">{habit.title}</span>
    </button>
  );
};
