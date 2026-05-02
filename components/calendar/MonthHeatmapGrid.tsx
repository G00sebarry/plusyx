import React, { useMemo } from 'react';
import { Task, Habit, Column } from '../../types';
import {
  toLocalDateString,
  getMondayOfWeek,
  isHabitScheduledForDate,
  getHabitStatusForDate,
} from './calendarUtils';

interface MonthHeatmapGridProps {
  currentDate: Date;
  tasks: Task[];
  habits: Habit[];
  columns: Column[];
  /** @deprecated Стрелки месяца теперь в общем хедере календаря */
  onPrevMonth?: () => void;
  /** @deprecated Стрелки месяца теперь в общем хедере календаря */
  onNextMonth?: () => void;
  onSelectDay: (date: Date) => void;
  /** Текущий выбранный день — подсвечивается обводкой в сетке */
  selectedDay?: Date;
  /** На десктопе показываем превью названий задач в ячейке. На мобиле — нет, мало места */
  showTaskPreview?: boolean;
}

const WEEKDAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

// Возвращает плотность привычек на день: 0 = ничего не запланировано / не выполнено,
// 0.25, 0.5, 0.75, 1 — по завершённости.
const computeHabitDensity = (date: Date, habits: Habit[]): number => {
  const scheduled = habits.filter(h => isHabitScheduledForDate(h, date));
  if (scheduled.length === 0) return 0;

  let score = 0;
  scheduled.forEach(h => {
    const status = getHabitStatusForDate(h, date);
    if (status === 'done' || status === 'freeze') score += 1;
    else if (status === 'mini') score += 0.5;
  });

  const ratio = score / scheduled.length;
  // Дискретизируем в 4 уровня — чтобы heatmap был чище
  if (ratio === 0) return 0;
  if (ratio <= 0.33) return 0.25;
  if (ratio <= 0.66) return 0.5;
  if (ratio < 1) return 0.75;
  return 1;
};

const heatmapBg = (density: number, isCurrentMonth: boolean, isFuture: boolean): string => {
  if (density === 0 || isFuture) {
    return isCurrentMonth ? 'bg-black/[0.18]' : 'bg-black/[0.08]';
  }
  // Зелёная плотность через rgba
  if (density >= 1) return 'bg-green-500/85';
  if (density >= 0.75) return 'bg-green-500/65';
  if (density >= 0.5) return 'bg-green-500/45';
  return 'bg-green-500/25';
};

const dotColorForTask = (task: Task, columns: Column[]): string => {
  const col = columns.find(c => c.id === task.columnId);
  const type = col?.type || task.status;
  if (type === 'done') return 'bg-green-500';
  if (type === 'in-progress') return 'bg-orange-500';
  return 'bg-blue-500';
};

export const MonthHeatmapGrid: React.FC<MonthHeatmapGridProps> = ({
  currentDate,
  tasks,
  habits,
  columns,
  onSelectDay,
  selectedDay,
  showTaskPreview,
}) => {
  // Строим 6 рядов × 7 дней — стандартная сетка месяца
  const cells = useMemo(() => {
    const firstOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const gridStart = getMondayOfWeek(firstOfMonth);
    const result: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      result.push(d);
    }
    return result;
  }, [currentDate]);

  // Карта задач по дате
  const tasksByDate = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.forEach(t => {
      if (!t.date) return;
      const arr = m.get(t.date) || [];
      arr.push(t);
      m.set(t.date, arr);
    });
    return m;
  }, [tasks]);

  const todayStr = toLocalDateString(new Date());
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  return (
    <div className="flex flex-col h-full">
      {/* Название месяца — компактное, без своих стрелок (они в общей шапке) */}
      <div className="flex items-center justify-center mb-2">
        <span className="text-[11px] font-black uppercase tracking-widest tg-text">
          {MONTH_NAMES[currentMonth]} <span className="opacity-30">{currentYear}</span>
        </span>
      </div>

      {/* Дни недели */}
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={`
              text-[9px] text-center font-bold tracking-widest
              ${i >= 5 ? 'text-red-400/70' : 'tg-hint opacity-40'}
            `}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Сетка — ячейки заполняют доступную высоту равномерно, без aspect-square */}
      <div className="grid grid-cols-7 grid-rows-6 gap-1 flex-1 min-h-0">
        {cells.map(date => {
          const dStr = toLocalDateString(date);
          const isCurrentMonth = date.getMonth() === currentMonth;
          const isToday = dStr === todayStr;
          const isFuture = dStr > todayStr;
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const dayTasks = tasksByDate.get(dStr) || [];
          const density = computeHabitDensity(date, habits);
          const isSelected = selectedDay && dStr === toLocalDateString(selectedDay) && !isToday;

          // Для превью текстом показываем 2 названия + "+N ещё"
          const previewTasks = dayTasks.slice(0, 2);
          const hiddenCount = dayTasks.length - previewTasks.length;

          // Цвет рамки: сегодня — синяя, выбранный — белая полупрозрачная
          const ringClass = isToday
            ? 'ring-2 ring-blue-500 ring-offset-0'
            : isSelected
            ? 'ring-2 ring-white/30 ring-offset-0'
            : '';

          return (
            <button
              key={dStr}
              onClick={() => onSelectDay(date)}
              className={`
                rounded-lg ${showTaskPreview ? 'p-1.5' : 'p-1.5'} flex flex-col text-left min-w-0 min-h-0
                transition-all hover:scale-[1.04] hover:z-10 active:scale-95
                ${heatmapBg(density, isCurrentMonth, isFuture)}
                ${ringClass}
                ${!isCurrentMonth ? 'opacity-40' : ''}
              `}
            >
              <span
                className={`
                  text-[11px] font-bold leading-none shrink-0
                  ${isToday ? 'text-white' : ''}
                  ${!isToday && density >= 0.75 ? 'text-white/90' : ''}
                  ${!isToday && density < 0.75 && isWeekend && isCurrentMonth ? 'text-red-400/70' : ''}
                  ${!isToday && density < 0.75 && !isWeekend ? 'tg-text opacity-70' : ''}
                `}
              >
                {date.getDate()}
              </span>

              {showTaskPreview ? (
                /* ── ДЕСКТОП: превью названий задач ── */
                previewTasks.length > 0 && (
                  <div className="mt-auto w-full overflow-hidden">
                    {previewTasks.map(t => (
                      <div
                        key={t.id}
                        className={`
                          text-[9px] leading-[1.25] truncate
                          ${isToday ? 'text-white/95 font-medium' : ''}
                          ${!isToday && density >= 0.75 ? 'text-white/80' : ''}
                          ${!isToday && density < 0.75 ? 'tg-text opacity-60' : ''}
                        `}
                      >
                        {t.title}
                      </div>
                    ))}
                    {hiddenCount > 0 && (
                      <div className={`
                        text-[8px] leading-[1.25] truncate font-medium
                        ${isToday ? 'text-white/60' : 'tg-hint opacity-50'}
                      `}>
                        +{hiddenCount} ещё
                      </div>
                    )}
                  </div>
                )
              ) : (
                /* ── МОБИЛА: точки задач ── */
                dayTasks.length > 0 && (
                  <div className="mt-auto flex gap-[2px] flex-wrap items-end">
                    {dayTasks.slice(0, 4).map(t => (
                      <span
                        key={t.id}
                        className={`w-[5px] h-[5px] rounded-full ${dotColorForTask(t, columns)}`}
                      />
                    ))}
                    {dayTasks.length - 4 > 0 && (
                      <span className="text-[8px] font-bold tg-hint opacity-70 ml-0.5">+{dayTasks.length - 4}</span>
                    )}
                  </div>
                )
              )}
            </button>
          );
        })}
      </div>

      {/* Легенда */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-400/10">
        <span className="text-[8px] tg-hint opacity-40 tracking-widest font-bold">МЕНЬШЕ</span>
        <div className="flex gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-black/[0.18]" />
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500/25" />
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500/45" />
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500/65" />
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500/85" />
        </div>
        <span className="text-[8px] tg-hint opacity-40 tracking-widest font-bold">БОЛЬШЕ</span>
      </div>
    </div>
  );
};
