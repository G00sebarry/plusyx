import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Task, Habit, TaskStatus, Column } from '../types';

interface CalendarViewProps {
  tasks: Task[];
  habits: Habit[];
  columns: Column[];
  onEditTask: (task: Task) => void;
  onQuickAdd: (task: Partial<Task>) => void;
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  'todo': 'bg-blue-500/80 text-white',
  'in-progress': 'bg-orange-500/80 text-white',
  'done': 'bg-green-500/80 text-white'
};

const HABIT_STATUS_COLORS: Record<string, string> = {
  'done': 'bg-green-500 text-white',
  'mini': 'bg-yellow-500 text-white',
  'freeze': 'bg-cyan-400 text-white',
  'pending': 'bg-gray-500/20 tg-hint border border-dashed border-gray-400/30'
};

const toLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// --- QUICK ADD MODAL ---
interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, columnId: string, date: string, time?: string) => void;
  columns: Column[];
  date: string;
  position?: { x: number; y: number };
}

const QuickAddModal: React.FC<QuickAddModalProps> = ({ isOpen, onClose, onSubmit, columns, date, position }) => {
  const [title, setTitle] = useState('');
  const [columnId, setColumnId] = useState(columns[0]?.id || '');
  const [time, setTime] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setTime('');
      setColumnId(columns[0]?.id || '');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, columns]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit(title.trim(), columnId, date, time || undefined);
    onClose();
  };

  const formattedDate = (() => {
    const d = new Date(date);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  })();

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div 
        ref={modalRef}
        className="relative tg-bg rounded-[28px] shadow-2xl border border-gray-400/10 w-full max-w-sm p-5 flex flex-col gap-4 animate-in zoom-in-95 fade-in duration-200"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📝</span>
            <h3 className="text-sm font-black tg-text uppercase tracking-tight">Быстрая задача</h3>
          </div>
          <span className="text-[10px] font-bold tg-hint bg-blue-500/10 text-blue-500 px-2 py-1 rounded-lg">{formattedDate}</span>
        </div>

        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Название задачи..."
          className="w-full bg-black/5 tg-text rounded-2xl px-4 py-3 text-sm font-bold outline-none border border-gray-400/10 focus:border-blue-500/50 transition-colors placeholder:opacity-30"
        />

        <div className="flex gap-2">
          <div className="flex-1 flex flex-col gap-1">
            <span className="text-[8px] font-black tg-hint uppercase px-1">Колонка</span>
            <select
              value={columnId}
              onChange={e => setColumnId(e.target.value)}
              className="w-full bg-black/5 tg-text rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none border border-gray-400/10 appearance-none"
            >
              {columns.map(col => (
                <option key={col.id} value={col.id}>{col.title}</option>
              ))}
            </select>
          </div>
          <div className="w-28 flex flex-col gap-1">
            <span className="text-[8px] font-black tg-hint uppercase px-1">Время</span>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full bg-black/5 tg-text rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none border border-gray-400/10"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl tg-secondary-bg tg-text text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="flex-1 py-3 rounded-2xl bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-30 shadow-lg shadow-blue-500/20"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN CALENDAR ---
export const CalendarView: React.FC<CalendarViewProps> = ({ tasks, habits, columns, onEditTask, onQuickAdd }) => {
  const [category, setCategory] = useState<'tasks' | 'habits'>('tasks');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);

  const daysToDisplay = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, 1);
    const days: (Date | null)[] = [];
    const firstDay = date.getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    
    for (let i = 0; i < offset; i++) days.push(null);
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentDate]);

  const navigate = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const goToday = () => setCurrentDate(new Date());

  const isHabitScheduledForDate = (habit: Habit, date: Date) => {
    const dayOfWeek = date.getDay();
    return habit.frequency.days.includes(dayOfWeek);
  };

  const getTasksForDate = (dateStr: string) => tasks.filter(t => t.date === dateStr);
  
  const getHabitStatusForDate = (habit: Habit, date: Date) => {
    const dStr = toLocalDateString(date);
    const value = habit.history[dStr];
    const goal = habit.targetValue || 1;
    const isScheduled = isHabitScheduledForDate(habit, date);

    if (value === 'freeze') return 'freeze';
    if (value === 'mini') return 'mini';
    
    const isDone = habit.isMeasurable 
      ? Number(value || 0) >= goal
      : !!value;

    if (isDone) return 'done';
    if (isScheduled) return 'pending';
    return null;
  };

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
      comments: []
    });
  };

  const handleCellClick = (e: React.MouseEvent, dateStr: string) => {
    // Only open quick add if clicking on the cell background, not on a task
    const target = e.target as HTMLElement;
    if (target.closest('[data-task-btn]') || target.closest('[data-habit-item]')) return;
    setQuickAddDate(dateStr);
  };

  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const monthName = currentDate.toLocaleString('ru-RU', { month: 'long' });
  const todayStr = toLocalDateString(new Date());
  const isCurrentMonth = currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden">
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 md:px-5 pt-4 mb-3">
        <div className="flex flex-col">
          <h2 className="text-xl font-black tg-text capitalize tracking-tighter">
            {monthName} <span className="opacity-20">{currentDate.getFullYear()}</span>
          </h2>
          <div className="flex gap-4 mt-1">
            <button 
              onClick={() => setCategory('tasks')} 
              className={`text-[10px] font-black uppercase tracking-widest transition-all ${category === 'tasks' ? 'text-blue-500 border-b-2 border-blue-500 pb-0.5' : 'tg-hint opacity-40 hover:opacity-100'}`}
            >
              Задачи
            </button>
            <button 
              onClick={() => setCategory('habits')} 
              className={`text-[10px] font-black uppercase tracking-widest transition-all ${category === 'habits' ? 'text-green-500 border-b-2 border-green-500 pb-0.5' : 'tg-hint opacity-40 hover:opacity-100'}`}
            >
              Привычки
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <button 
              onClick={goToday}
              className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500/20 transition-all active:scale-95"
            >
              Сегодня
            </button>
          )}
          <div className="flex items-center gap-0.5 tg-secondary-bg p-1 rounded-2xl">
            <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center tg-text hover:bg-black/5 rounded-xl transition-all active:scale-90">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button onClick={() => navigate(1)} className="w-9 h-9 flex items-center justify-center tg-text hover:bg-black/5 rounded-xl transition-all active:scale-90">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* CALENDAR GRID */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-2 md:px-3 pb-24">
        <div className="grid grid-cols-7 gap-px tg-secondary-bg rounded-[20px] md:rounded-[24px] overflow-hidden border border-gray-400/10">
          {/* WEEKDAY HEADERS */}
          {weekdays.map((d, i) => (
            <div key={d} className="tg-secondary-bg py-2 md:py-2.5 text-center">
              <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-tighter ${i >= 5 ? 'text-red-400/60' : 'tg-hint opacity-50'}`}>
                {d}
              </span>
            </div>
          ))}

          {/* DAY CELLS */}
          {daysToDisplay.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} className="tg-bg min-h-[80px] md:min-h-[120px]" />;
            
            const dStr = toLocalDateString(date);
            const isToday = todayStr === dStr;
            const isPast = dStr < todayStr;
            const dayTasks = getTasksForDate(dStr);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            
            return (
              <div 
                key={dStr} 
                onClick={(e) => category === 'tasks' && handleCellClick(e, dStr)}
                className={`
                  min-h-[80px] md:min-h-[120px] p-1 md:p-1.5 flex flex-col gap-0.5 transition-all relative group
                  ${isToday ? 'bg-blue-500/8 ring-1 ring-inset ring-blue-500/20' : 'tg-bg'}
                  ${isPast && !isToday ? 'opacity-60' : ''}
                  ${category === 'tasks' ? 'cursor-pointer hover:bg-blue-500/5' : ''}
                `}
              >
                {/* DAY NUMBER */}
                <div className="flex justify-between items-center px-0.5 mb-0.5">
                  <span className={`
                    text-[11px] md:text-[12px] font-black leading-none
                    ${isToday ? 'bg-blue-500 text-white w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[10px] md:text-[11px]' : ''}
                    ${!isToday && isWeekend ? 'text-red-400/50' : ''}
                    ${!isToday && !isWeekend ? 'tg-text opacity-30' : ''}
                  `}>
                    {date.getDate()}
                  </span>
                  
                  {/* + button for tasks mode */}
                  {category === 'tasks' && (
                    <button
                      data-task-btn
                      onClick={(e) => { e.stopPropagation(); setQuickAddDate(dStr); }}
                      className="w-5 h-5 md:w-6 md:h-6 rounded-md flex items-center justify-center text-blue-500/0 group-hover:text-blue-500/60 hover:!text-blue-500 hover:bg-blue-500/10 transition-all text-[14px] md:text-[16px] font-bold"
                    >
                      +
                    </button>
                  )}
                </div>

                {/* CONTENT */}
                <div className="flex flex-col gap-[3px] flex-1 overflow-hidden">
                  {category === 'tasks' ? (
                    <>
                      {dayTasks.slice(0, 3).map(task => {
                        const col = columns.find(c => c.id === task.columnId);
                        const statusColor = col ? STATUS_COLORS[col.type] : STATUS_COLORS[task.status];
                        return (
                          <button 
                            key={task.id}
                            data-task-btn
                            onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                            className={`text-[7px] md:text-[8px] px-1.5 py-[3px] md:py-1 rounded-md text-left truncate font-bold tracking-tight active:scale-95 transition-all ${statusColor}`}
                          >
                            {task.title}
                          </button>
                        );
                      })}
                      {dayTasks.length > 3 && (
                        <span className="text-[7px] font-black tg-hint px-1 opacity-40">+{dayTasks.length - 3}</span>
                      )}
                    </>
                  ) : (
                    <>
                      {habits.map(habit => {
                        const status = getHabitStatusForDate(habit, date);
                        if (!status) return null;
                        const colorClass = HABIT_STATUS_COLORS[status] || HABIT_STATUS_COLORS.pending;
                        
                        return (
                          <div 
                            key={habit.id}
                            data-habit-item
                            className={`text-[7px] md:text-[8px] px-1.5 py-[3px] md:py-1 rounded-md text-left truncate font-bold tracking-tight flex items-center gap-1 ${colorClass}`}
                          >
                            <span className="text-[7px] md:text-[9px] shrink-0">{habit.emoji || '🔥'}</span>
                            <span className="truncate">{habit.title}</span>
                          </div>
                        );
                      }).filter(Boolean).slice(0, 4)}
                      {habits.filter(h => getHabitStatusForDate(h, date)).length > 4 && (
                        <span className="text-[7px] font-black tg-hint px-1 opacity-40">
                          +{habits.filter(h => getHabitStatusForDate(h, date)).length - 4}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* QUICK ADD MODAL */}
      <QuickAddModal
        isOpen={!!quickAddDate}
        onClose={() => setQuickAddDate(null)}
        onSubmit={handleQuickAdd}
        columns={columns}
        date={quickAddDate || todayStr}
      />
    </div>
  );
};
