import React, { useState, useMemo } from 'react';
import { Task, Habit, TaskStatus } from '../types';

interface CalendarViewProps {
  tasks: Task[];
  habits: Habit[];
  onEditTask: (task: Task) => void;
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  'todo': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'in-progress': 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  'done': 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
};

const HABIT_COLORS = {
  done: 'bg-green-500 text-white border-green-600/20',
  pending: 'bg-gray-400/10 text-gray-400 border-gray-400/20 border-dashed'
};

const toLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks, habits, onEditTask }) => {
  const [category, setCategory] = useState<'tasks' | 'habits'>('tasks');
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysToDisplay = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
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

  // --- ОБНОВЛЕННАЯ ЛОГИКА ПРОВЕРКИ ДАТЫ ---
  // Теперь мы просто смотрим, входит ли день недели в массив frequency.days
  const isHabitScheduledForDate = (habit: Habit, date: Date) => {
    const dayOfWeek = date.getDay(); // 0 (Вс) - 6 (Сб)
    return habit.frequency.days.includes(dayOfWeek);
  };

  const getTasksForDate = (dateStr: string) => tasks.filter(t => t.date === dateStr);
  
  const getHabitStatusForDate = (habit: Habit, date: Date) => {
    const dStr = toLocalDateString(date);
    const value = habit.history[dStr];
    
    // Используем targetValue вместо goalValue
    const goal = habit.targetValue || 1;

    const isDone = habit.isMeasurable 
      ? Number(value || 0) >= goal
      : !!value;

    const isScheduled = isHabitScheduledForDate(habit, date);

    if (isDone) return 'done';
    if (isScheduled) return 'pending';
    return null;
  };

  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const monthName = currentDate.toLocaleString('ru-RU', { month: 'long' });

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 mb-4">
        <div className="flex flex-col">
          <h2 className="text-xl font-black tg-text capitalize tracking-tighter">{monthName} <span className="opacity-20">{currentDate.getFullYear()}</span></h2>
          <div className="flex gap-4 mt-1">
             <button 
               onClick={() => setCategory('tasks')} 
               className={`text-[10px] font-black uppercase tracking-widest transition-all ${category === 'tasks' ? 'text-blue-500 border-b-2 border-blue-500 pb-0.5' : 'text-gray-400 opacity-40 hover:opacity-100'}`}
             >
               Задачи
             </button>
             <button 
               onClick={() => setCategory('habits')} 
               className={`text-[10px] font-black uppercase tracking-widest transition-all ${category === 'habits' ? 'text-green-500 border-b-2 border-green-500 pb-0.5' : 'text-gray-400 opacity-40 hover:opacity-100'}`}
             >
               Привычки
             </button>
          </div>
        </div>
        
        <div className="flex items-center gap-1 bg-black/5 p-1 rounded-2xl">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center tg-text hover:bg-black/5 rounded-xl transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={() => navigate(1)} className="w-9 h-9 flex items-center justify-center tg-text hover:bg-black/5 rounded-xl transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-24">
        <div className="grid grid-cols-7 gap-px bg-gray-400/10 rounded-[24px] overflow-hidden border border-gray-400/10 shadow-sm">
          {weekdays.map(d => (
            <div key={d} className="tg-secondary-bg py-2 text-center">
              <span className="text-[9px] font-black tg-hint uppercase tracking-tighter opacity-50">{d}</span>
            </div>
          ))}

          {daysToDisplay.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} className="tg-bg/20 min-h-[110px]" />;
            
            const dStr = toLocalDateString(date);
            const isToday = toLocalDateString(new Date()) === dStr;
            const dayTasks = getTasksForDate(dStr);
            
            return (
              <div 
                key={dStr} 
                className={`min-h-[120px] p-1 flex flex-col gap-1 transition-all border-r border-b border-gray-400/5 ${isToday ? 'bg-blue-500/5' : 'tg-bg'}`}
              >
                <div className="flex justify-between items-center px-1 mb-0.5">
                  <span className={`text-[11px] font-black ${isToday ? 'text-blue-500' : 'tg-text opacity-30'}`}>
                    {date.getDate()}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                   {category === 'tasks' ? (
                     <>
                       {dayTasks.slice(0, 4).map(task => (
                         <button 
                           key={task.id}
                           onClick={() => onEditTask(task)}
                           className={`text-[7px] px-1 py-0.5 rounded-sm border text-left truncate font-bold uppercase tracking-tighter active:scale-95 transition-transform ${STATUS_COLORS[task.status]}`}
                         >
                           {task.title}
                         </button>
                       ))}
                       {dayTasks.length > 4 && (
                         <span className="text-[7px] font-black tg-hint px-1 opacity-40">+{dayTasks.length - 4} ещё</span>
                       )}
                     </>
                   ) : (
                     <>
                       {habits.map(habit => {
                         const status = getHabitStatusForDate(habit, date);
                         if (!status) return null;
                         
                         return (
                           <div 
                             key={habit.id}
                             className={`text-[7px] px-1 py-0.5 rounded-sm border text-left truncate font-bold uppercase tracking-tighter flex items-center gap-1 ${status === 'done' ? HABIT_COLORS.done : HABIT_COLORS.pending}`}
                           >
                             {/* Отображаем эмодзи если есть */}
                             <span className="text-[8px]">{habit.emoji || (status === 'done' ? '✓' : '○')}</span>
                             <span>{habit.title}</span> {/* habit.name -> habit.title */}
                           </div>
                         );
                       }).filter(Boolean).slice(0, 5)}
                     </>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
