import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, Column } from '../types';

interface KanbanBoardProps {
  tasks: Task[];
  columns: Column[];
  onUpdateColumns: (cols: Column[]) => void;
  onMoveTask: (draggedId: string, targetColId: string, targetId?: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onQuickAdd: (status: TaskStatus, columnId: string) => void;
  onCopyTask: (originalTaskId: string, newTitle: string) => void;
  onDragEnd: (draggedId: string, targetColId: string, targetId?: string) => void;
}

// --- ХЕЛПЕРЫ ДЛЯ ЦВЕТОВ ---
const COLOR_MAP: Record<string, string> = {
  'slate': 'bg-slate-500', 'red': 'bg-red-500', 'orange': 'bg-orange-500', 
  'green': 'bg-green-500', 'blue': 'bg-blue-500', 'purple': 'bg-purple-500', 'pink': 'bg-pink-500',
};

// --- ХЕЛПЕРЫ ДЛЯ ДАТЫ ---
const toLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDateLabel = (dateStr: string) => {
  const today = toLocalDateString(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = toLocalDateString(tomorrowDate);

  if (dateStr === today) return 'Сегодня';
  if (dateStr === tomorrow) return 'Завтра';
  
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

// --- КОМПОНЕНТ ТАЙМЕРА ---
const TaskTimer = ({ task, hasCover }: { task: Task; hasCover: boolean }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [statusColor, setStatusColor] = useState<string>('text-gray-400');
  const [isExpired, setIsExpired] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    if (!task.isTimer || !task.time || !task.date) return;

    const calculateTime = () => {
      const now = new Date();
      const deadline = new Date(`${task.date}T${task.time}`);
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        setIsExpired(true);
        return;
      }

      setIsExpired(false);

      const totalMinutes = Math.floor(diff / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const seconds = Math.floor((diff % 60000) / 1000);

      if (hours < 8) {
        setStatusColor('text-red-500');
        setIsUrgent(true);
      } else if (hours < 16) {
        setStatusColor('text-orange-500');
        setIsUrgent(false);
      } else if (hours < 24) {
        setStatusColor('text-green-500');
        setIsUrgent(false);
      } else {
        setStatusColor(hasCover ? 'text-white' : 'text-gray-400');
        setIsUrgent(false);
      }

      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days} дн.`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}ч ${minutes.toString().padStart(2, '0')}м`);
      } else {
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [task.date, task.time, task.isTimer, hasCover]);

  if (!task.isTimer || !task.time) {
    return (
      <div className={`flex items-center gap-1 text-[10px] font-bold ${hasCover ? 'text-white/70' : 'tg-hint'}`}>
         <span>{formatDateLabel(task.date)}</span>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="w-fit flex items-center gap-1.5 bg-red-500/10 px-2 py-1 rounded-md animate-pulse border border-red-500/20">
         <span className="text-[10px]">💀</span>
         <span className="text-[9px] font-black text-red-500 uppercase tracking-wider">Время вышло</span>
      </div>
    );
  }

  return (
    <div className={`w-fit flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/20 backdrop-blur-md border border-white/5 transition-all duration-500 ${isUrgent ? 'animate-pulse bg-red-500/10 border-red-500/30' : ''}`}>
      <span className="text-[10px]">🔥</span>
      <span className={`text-[10px] font-black tabular-nums tracking-wide ${statusColor}`}>
        {timeLeft}
      </span>
    </div>
  );
};
// ---------------------------------------------

const TYPE_COLORS: Record<TaskStatus, string> = {
  'todo': 'border-blue-500',
  'in-progress': 'border-orange-500',
  'done': 'border-green-500'
};

const NAV_COLORS: Record<TaskStatus, string> = {
  'todo': 'text-blue-500 bg-blue-500/10',
  'in-progress': 'text-orange-500 bg-orange-500/10',
  'done': 'text-green-500 bg-green-500/10'
};

const NAV_COLORS_COVER: Record<TaskStatus, string> = {
  'todo': 'text-blue-300 bg-blue-500/20',
  'in-progress': 'text-orange-300 bg-orange-500/20',
  'done': 'text-green-300 bg-green-500/20'
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ 
  tasks, columns, onUpdateColumns, onMoveTask, onEditTask, onDeleteTask, onQuickAdd, onCopyTask 
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');
  
  const [activeMenuColId, setActiveMenuColId] = useState<string | null>(null);
  const [editingColId, setEditingColId] = useState<string | null>(null);

  const [activeTaskMenuId, setActiveTaskMenuId] = useState<string | null>(null);
  const [copyingTaskId, setCopyingTaskId] = useState<string | null>(null);
  const [copyTitle, setCopyTitle] = useState('');

  const handleAddColumn = () => {
    if (!newColTitle.trim()) { setIsAddingColumn(false); return; }
    const newCol: Column = {
      id: `col-${Math.random().toString(36).substr(2, 9)}`,
      title: newColTitle,
      type: 'todo' 
    };
    onUpdateColumns([...columns, newCol]);
    setNewColTitle('');
    setIsAddingColumn(false);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
  };

  const handleDeleteColumn = (colId: string) => {
    const hasTasks = tasks.some(t => t.columnId === colId);
    if (hasTasks) {
      if (!confirm("В этой колонке есть задачи. Всё равно удалить?")) return;
    }
    onUpdateColumns(columns.filter(c => c.id !== colId));
    setActiveMenuColId(null);
  };

  const handleUpdateColumnType = (colId: string, newType: TaskStatus) => {
    onUpdateColumns(columns.map(c => c.id === colId ? { ...c, type: newType } : c));
    setActiveMenuColId(null);
  };

  const handleQuickMove = (taskId: string, direction: 'left' | 'right', currentColId: string) => {
    const index = columns.findIndex(c => c.id === currentColId);
    if (index === -1) return;
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx >= 0 && targetIdx < columns.length) {
      onMoveTask(taskId, columns[targetIdx].id);
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    }
  };

  const moveColumn = (colId: string, direction: 'left' | 'right' | 'start' | 'end') => {
    const index = columns.findIndex(c => c.id === colId);
    if (index === -1) return;

    const newColumns = [...columns];
    const [col] = newColumns.splice(index, 1);

    if (direction === 'start') {
        newColumns.unshift(col);
    } else if (direction === 'end') {
        newColumns.push(col);
    } else if (direction === 'left') {
        newColumns.splice(index - 1, 0, col);
    } else if (direction === 'right') {
        newColumns.splice(index + 1, 0, col);
    }

    onUpdateColumns(newColumns);
    setActiveMenuColId(null);
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
  };

  const handleStartCopy = (task: Task) => {
      setCopyingTaskId(task.id);
      setCopyTitle(task.title);
      setActiveTaskMenuId(null);
  };

  const handleConfirmCopy = () => {
      if (copyingTaskId && copyTitle.trim()) {
          onCopyTask(copyingTaskId, copyTitle);
          setCopyingTaskId(null);
          setCopyTitle('');
          window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
    
    const target = e.currentTarget as HTMLElement;
    setTimeout(() => {
        target.style.opacity = '0.4'; 
        target.style.transform = 'scale(0.95)';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTaskId(null);
    setDropTargetId(null);
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
    target.style.transform = 'scale(1)';
  };

  // Этот метод мы используем, чтобы остановить всплытие на кнопках
  const stopProp = (e: React.BaseSyntheticEvent) => {
      e.stopPropagation();
  };

  // 🔥 НОВАЯ ФУНКЦИЯ ДЛЯ ОТРИСОВКИ ЧЕК-ЛИСТОВ (KAITEN STYLE) 🔥
  const renderChecklists = (task: Task) => {
    if (!task.checklists || task.checklists.length === 0) return null;

    return (
      <div className="flex flex-col gap-1.5 mt-2 relative z-10">
        {task.checklists.map(list => {
          const total = list.items.length;
          if (total === 0) return null; 
          
          const done = list.items.filter(i => i.completed).length;
          const isComplete = total > 0 && total === done;
          const percent = Math.round((done / total) * 100);

          return (
            <div key={list.id} className="relative h-6 rounded-md overflow-hidden bg-black/30 border border-white/5 w-full group">
              {/* Фон-прогресс бар */}
              <div 
                className={`absolute left-0 top-0 bottom-0 transition-all duration-300 ${isComplete ? 'bg-green-500/20' : 'bg-white/10'}`} 
                style={{ width: `${percent}%` }}
              />

              {/* Контент строки */}
              <div className="absolute inset-0 flex justify-between items-center px-2">
                 {/* Название чек-листа */}
                 <span className={`text-[9px] font-bold truncate pr-2 ${isComplete ? 'text-white/50 line-through' : 'text-white/90'}`}>
                   {list.title}
                 </span>

                 {/* Счетчики */}
                 <div className="flex items-center gap-1.5 shrink-0">
                    {/* Если готово - галочка */}
                    {isComplete ? (
                        <div className="flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="text-green-400">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span className="text-[9px] font-bold text-green-400">{done}/{total}</span>
                        </div>
                    ) : (
                        <span className="text-[9px] font-bold text-white/60">{done}/{total}</span>
                    )}
                 </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex overflow-x-auto h-full p-4 gap-5 snap-x snap-mandatory no-scrollbar">
      {columns.map((column, index) => {
        const isFirst = index === 0;
        const isLast = index === columns.length - 1;

        return (
        <div 
          key={column.id} 
          className="min-w-[85vw] md:min-w-[320px] flex flex-col snap-center h-full"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            const draggedId = e.dataTransfer.getData('taskId') || draggedTaskId;
            if (draggedId) onMoveTask(draggedId, column.id);
          }}
        >
          <div className={`mb-4 h-[48px] px-5 border-l-4 ${TYPE_COLORS[column.type]} tg-secondary-bg rounded-r-2xl flex justify-between items-center shadow-sm shrink-0 relative z-[60]`}>
            {editingColId === column.id ? (
              <input 
                autoFocus 
                className="bg-transparent tg-text font-black text-[11px] uppercase tracking-[0.2em] outline-none border-b border-blue-500 w-full mr-4"
                value={column.title}
                onChange={e => onUpdateColumns(columns.map(c => c.id === column.id ? { ...c, title: e.target.value } : c))}
                onBlur={() => setEditingColId(null)}
                onKeyDown={e => e.key === 'Enter' && setEditingColId(null)}
              />
            ) : (
              <h2 onClick={() => setEditingColId(column.id)} className="text-[11px] font-black tg-text opacity-90 uppercase tracking-[0.2em] truncate mr-2 cursor-pointer">{column.title}</h2>
            )}
            
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-black tg-hint bg-black/5 px-2 py-0.5 rounded-full shrink-0">
                  {tasks.filter(t => t.columnId === column.id).length}
               </span>
               <div className="relative">
                  <button 
                    onClick={() => {
                        setActiveMenuColId(activeMenuColId === column.id ? null : column.id);
                        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
                    }}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                  </button>
                  
                  {activeMenuColId === column.id && (
                    <div className="absolute right-0 top-10 w-48 tg-secondary-bg rounded-2xl shadow-2xl border border-gray-400/10 p-2 z-[70] animate-in fade-in zoom-in-95 duration-200">
                        <button onClick={() => setEditingColId(column.id)} className="w-full text-left p-2.5 hover:bg-black/5 rounded-xl text-[9px] font-black uppercase tracking-widest tg-text">✏️ Переименовать</button>
                        
                        <div className="my-1 border-t border-gray-400/5" />
                        <div className="px-2.5 py-1.5 text-[8px] font-black tg-hint uppercase">Позиция:</div>
                        <div className="flex gap-1 px-1.5 pb-1">
                             {!isFirst && (
                                <button onClick={() => moveColumn(column.id, 'start')} className="h-8 flex-1 bg-black/5 rounded-lg flex items-center justify-center hover:bg-black/10 transition-colors" title="В начало">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                                </button>
                             )}
                             {!isFirst && (
                                <button onClick={() => moveColumn(column.id, 'left')} className="h-8 flex-1 bg-black/5 rounded-lg flex items-center justify-center hover:bg-black/10 transition-colors" title="Влево">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                </button>
                             )}
                             {!isLast && (
                                <button onClick={() => moveColumn(column.id, 'right')} className="h-8 flex-1 bg-black/5 rounded-lg flex items-center justify-center hover:bg-black/10 transition-colors" title="Вправо">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                </button>
                             )}
                             {!isLast && (
                                <button onClick={() => moveColumn(column.id, 'end')} className="h-8 flex-1 bg-black/5 rounded-lg flex items-center justify-center hover:bg-black/10 transition-colors" title="В конец">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                                </button>
                             )}
                        </div>

                        <div className="my-1 border-t border-gray-400/5" />
                        <div className="px-2.5 py-1.5 text-[8px] font-black tg-hint uppercase">Тип поведения:</div>
                        {(['todo', 'in-progress', 'done'] as TaskStatus[]).map(t => (
                          <button key={t} onClick={() => handleUpdateColumnType(column.id, t)} className={`w-full text-left p-2 rounded-lg text-[8px] font-black uppercase mb-0.5 ${column.type === t ? 'bg-blue-500 text-white' : 'hover:bg-black/5 tg-text'}`}>
                            {t === 'todo' ? '⭕ Очередь' : t === 'in-progress' ? '🟠 В работе' : '✅ Готово'}
                          </button>
                        ))}
                        
                        <div className="my-1 border-t border-gray-400/5" />
                        <button onClick={() => handleDeleteColumn(column.id)} className="w-full text-left p-2.5 hover:bg-red-500/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-red-500">🗑️ Удалить</button>
                    </div>
                  )}
               </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-4 flex-1 pb-24 min-h-[500px]">
            {tasks.filter(t => t.columnId === column.id).map(task => {
              const hasCover = !!task.coverData;
              const prevCol = index > 0 ? columns[index - 1] : null;
              const nextCol = index < columns.length - 1 ? columns[index + 1] : null;

              // --- ЛОГИКА БЛОКИРОВКИ DRAG ---
              const isMenuOpen = activeTaskMenuId === task.id;
              const isCopying = copyingTaskId === task.id;
              const isDraggable = !isMenuOpen && !isCopying;
              // ------------------------------

              return (
                <div key={task.id} className="flex flex-col gap-2"> 
                <div 
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDropTargetId(task.id); }}
                  onDragLeave={() => setDropTargetId(null)}
                  onDrop={e => {
                    e.preventDefault(); e.stopPropagation();
                    const draggedId = e.dataTransfer.getData('taskId') || draggedTaskId;
                    if (draggedId) onMoveTask(draggedId, column.id, task.id);
                    setDropTargetId(null);
                  }}
                  className={`relative transition-all duration-200 ${dropTargetId === task.id ? 'scale-105' : ''} ${isMenuOpen ? 'z-[100]' : 'z-0'}`}
                >
                  <div 
                    draggable={isDraggable} 
                    onDragStart={e => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className={`
                       relative tg-secondary-bg p-5 rounded-[28px] shadow-sm border border-gray-100/10 flex flex-col gap-3 
                       transition-all overflow-hidden min-h-[140px]
                       ${isDraggable ? 'active:scale-[0.98] cursor-grab active:cursor-grabbing' : 'cursor-default'}
                    `}
                    onClick={() => {
                        if (isMenuOpen) setActiveTaskMenuId(null);
                        else onEditTask(task);
                    }}
                  >
                    {/* МЕТКА */}
                    {task.color && task.color !== 'default' && (
                       <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${COLOR_MAP[task.color] || 'bg-blue-500'} z-20`} />
                    )}

                    {hasCover && (
                      <>
                        <img src={task.coverData} className="absolute inset-0 w-full h-full object-cover z-0" style={{ objectPosition: `50% ${task.coverPosition ?? 50}%` }} />
                        <div className="absolute inset-0 z-[1]" style={{ backgroundColor: `rgba(0,0,0,${(task.coverIntensity ?? 60) / 100})` }} />
                      </>
                    )}

                    <div className="relative z-10 flex flex-col gap-3 h-full">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className={`font-bold text-[15px] leading-tight flex-1 tracking-tight ${hasCover ? 'text-white' : 'tg-text'}`}>{task.title}</h3>
                          
                          {/* --- КНОПКА МЕНЮ ЗАДАЧИ (ТРИ ТОЧКИ) --- */}
                          <div className="relative">
                            <button 
                                onClick={e => { 
                                    e.stopPropagation(); 
                                    // Переключаем меню и сразу запрещаем драг через перерисовку родителя
                                    setActiveTaskMenuId(activeTaskMenuId === task.id ? null : task.id); 
                                }}
                                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }} 
                                className={`
                                    p-1 rounded-lg transition-all duration-200 cursor-pointer relative z-50
                                    ${hasCover 
                                        ? 'text-white/60 hover:text-white hover:bg-white/20' 
                                        : 'text-gray-400 hover:text-white hover:bg-black/10'}
                                `}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                            </button>

                            {/* Выпадающее меню */}
                            {activeTaskMenuId === task.id && (
                                <div 
                                    className="absolute right-0 top-8 w-44 bg-[#1e1e1e] rounded-xl shadow-2xl border border-gray-600/20 p-1.5 z-[100] animate-in fade-in zoom-in-95 duration-200 cursor-default" 
                                    onClick={(e) => e.stopPropagation()} 
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            handleStartCopy(task); 
                                        }}
                                        className="w-full text-left p-2.5 hover:bg-white/5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2 cursor-pointer"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                        Создать копию
                                    </button>
                                    <div className="h-px bg-white/5 my-1" />
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            onDeleteTask(task.id); 
                                        }}
                                        className="w-full text-left p-2.5 hover:bg-red-500/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-2 cursor-pointer"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        Удалить
                                    </button>
                                </div>
                            )}
                          </div>
                          {/* -------------------------------------- */}

                        </div>
                        {task.description && <p className={`text-[11px] line-clamp-2 italic ${hasCover ? 'text-white/60' : 'tg-hint opacity-70'}`}>{task.description}</p>}
                        
                        {/* 🔥 РЕНДЕРИНГ ЧЕК-ЛИСТОВ ВМЕСТО ОДНОЙ ПОЛОСКИ 🔥 */}
                        {renderChecklists(task)}

                        <div className="flex items-center justify-between mt-auto">
                            <div className="flex flex-col gap-2 flex-1">
                                {task.date && (
                                   <TaskTimer task={task} hasCover={hasCover} />
                                )}
                            </div>

                            <div className="flex gap-1.5 ml-2">
                                {prevCol && (
                                  <button 
                                    onClick={e => { stopProp(e); handleQuickMove(task.id, 'left', column.id); }}
                                    onMouseDown={stopProp} 
                                    onPointerDown={stopProp}
                                    className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 shadow-sm ${hasCover ? NAV_COLORS_COVER[prevCol.type] : NAV_COLORS[prevCol.type]}`}
                                    title={`В колонку: ${prevCol.title}`}
                                  >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="15 18 9 12 15 6"/></svg>
                                  </button>
                                )}
                                {nextCol && (
                                  <button 
                                    onClick={e => { stopProp(e); handleQuickMove(task.id, 'right', column.id); }}
                                    onMouseDown={stopProp} 
                                    onPointerDown={stopProp} 
                                    className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 shadow-sm ${hasCover ? NAV_COLORS_COVER[nextCol.type] : NAV_COLORS[nextCol.type]}`}
                                    title={`В колонку: ${nextCol.title}`}
                                  >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="9 18 15 12 9 6"/></svg>
                                  </button>
                                )}
                            </div>
                        </div>
                    </div>
                  </div>
                </div>

                {/* --- ФОРМА СОЗДАНИЯ КОПИИ --- */}
                {copyingTaskId === task.id && (
                    <div 
                        className="bg-[#1e1e1e] p-4 rounded-[24px] border border-l-4 border-l-[var(--tg-theme-button-color)] border-gray-600/30 animate-in slide-in-from-top-2 duration-300 shadow-2xl mt-1 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--tg-theme-button-color)] mb-2">
                             Создание копии...
                        </div>
                        <textarea 
                            autoFocus
                            value={copyTitle}
                            onChange={e => setCopyTitle(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleConfirmCopy();
                                }
                            }}
                            className="w-full bg-black/20 p-3 rounded-xl text-xs font-bold text-white outline-none resize-none mb-3 border border-white/5 focus:border-[var(--tg-theme-button-color)]/50 transition-colors"
                            rows={2}
                        />
                        <div className="flex justify-end gap-2">
                            <button 
                                onClick={() => setCopyingTaskId(null)}
                                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                            >
                                Отмена
                            </button>
                            <button 
                                onClick={handleConfirmCopy}
                                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase text-white bg-[var(--tg-theme-button-color)] hover:brightness-110 active:scale-95 transition-all shadow-lg"
                            >
                                Создать
                            </button>
                        </div>
                    </div>
                )}
                {/* --------------------------- */}

                </div>
              );
            })}
            
            <button 
              onClick={() => onQuickAdd(column.type, column.id)} 
              className="w-full py-5 flex items-center justify-center border-2 border-dashed border-gray-400/20 rounded-[28px] group hover:border-[var(--tg-theme-button-color)] transition-all shrink-0 mt-2"
            >
              <span className="text-[11px] tg-hint group-hover:text-[var(--tg-theme-button-color)] font-black uppercase tracking-[0.2em]">+ Добавить</span>
            </button>
          </div>
        </div>
        ); 
      })} 

      <div className={`flex flex-col h-full snap-center transition-all duration-500 ease-out ${isAddingColumn ? 'min-w-[85vw] md:min-w-[320px]' : 'min-w-[48px]'}`}>
          {!isAddingColumn ? (
            <button 
              onClick={() => { setIsAddingColumn(true); window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium'); }}
              className="w-[48px] h-[48px] flex items-center justify-center tg-secondary-bg/50 backdrop-blur-md rounded-[18px] border border-gray-400/10 hover:bg-[#4cc3a1] hover:text-white transition-all duration-300 hover:scale-110 active:scale-90 shadow-md group"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="group-hover:scale-110 transition-transform"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          ) : (
            <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 duration-300">
                <div className="tg-secondary-bg p-6 rounded-[32px] border border-gray-400/10 shadow-xl flex flex-col gap-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black tg-hint uppercase tracking-widest">Новая колонка</span>
                        <button onClick={() => setIsAddingColumn(false)} className="tg-text opacity-40 hover:opacity-100 font-bold text-lg">×</button>
                    </div>
                    <input 
                      autoFocus
                      placeholder="Название..."
                      value={newColTitle}
                      onChange={e => setNewColTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddColumn()}
                      className="bg-black/5 tg-text p-4 rounded-2xl outline-none font-bold placeholder:opacity-30"
                    />
                    <button 
                      onClick={handleAddColumn}
                      className="w-full py-4 bg-blue-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all mt-2"
                    >
                      Создать колонку
                    </button>
                </div>
            </div>
          )}
      </div>

      {(activeMenuColId || activeTaskMenuId) && <div className="fixed inset-0 z-[55]" onClick={() => { setActiveMenuColId(null); setActiveTaskMenuId(null); }} />}
    </div>
  );
};
