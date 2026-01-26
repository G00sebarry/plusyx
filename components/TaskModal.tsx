import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, TaskComment, Checklist, TaskFile, Column } from '../types';
import { uploadImage } from '../api'; // 🔥 ИМПОРТ ФУНКЦИИ ЗАГРУЗКИ

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: any) => void;
  initialTask?: Task;
  columns: Column[];
}

const toLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// --- ХЕЛПЕР ДЛЯ ПОИСКА ССЫЛОК ---
const extractUrls = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

type TaskBlockType = 'meta' | 'cover' | 'checklists' | 'files' | 'comments';

const COLORS = ['slate', 'red', 'orange', 'green', 'blue', 'purple', 'pink'];
const COLOR_MAP: Record<string, string> = {
  'slate': 'bg-slate-500', 'red': 'bg-red-500', 'orange': 'bg-orange-500', 
  'green': 'bg-green-500', 'blue': 'bg-blue-500', 'purple': 'bg-purple-500', 'pink': 'bg-pink-500',
};

// --- КОМПОНЕНТ: САМОРАСШИРЯЮЩЕЕСЯ ПОЛЕ (ОБЩЕЕ) ---
const DynamicTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  isTitle?: boolean;
  isOpen?: boolean;
}> = ({ value, onChange, placeholder, className, isTitle, isOpen }) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'; 
      ref.current.style.height = ref.current.scrollHeight + 'px'; 
    }
  }, [value, isOpen]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-transparent outline-none overflow-hidden resize-none block ${className}`}
      onKeyDown={(e) => {
          if (isTitle && e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
          }
      }}
    />
  );
};

// --- КОМПОНЕНТ ДЛЯ ПУНКТА ЧЕК-ЛИСТА ---
const AutoResizeTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  completed: boolean;
}> = ({ value, onChange, onKeyDown, completed }) => {
  
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`flex-1 text-sm tg-text bg-transparent outline-none resize-none overflow-hidden block ${completed ? 'line-through opacity-30 italic' : ''}`}
      style={{ minHeight: '24px', lineHeight: '1.5' }}
    />
  );
};

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, initialTask, columns }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(toLocalDateString(new Date()));
  const [time, setTime] = useState('');
  const [isTimer, setIsTimer] = useState(false);
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [columnId, setColumnId] = useState<string | undefined>(undefined);
  
  const [color, setColor] = useState('default'); 

  // Обложка
  const [coverData, setCoverData] = useState('');
  const [coverPosition, setCoverPosition] = useState(50);
  const [coverIntensity, setCoverIntensity] = useState(60);

  // Файлы
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  
  const [blocksOrder, setBlocksOrder] = useState<TaskBlockType[]>(['meta', 'cover', 'checklists', 'files', 'comments']);
  const [draggedBlock, setDraggedBlock] = useState<number | null>(null);
  
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Инициализация
  useEffect(() => {
    if (isOpen && initialTask) {
      setTitle(initialTask.title || '');
      setDescription(initialTask.description || '');
      setDate(initialTask.date || toLocalDateString(new Date()));
      setTime(initialTask.time || '');
      setIsTimer(initialTask.isTimer || false);
      setStatus(initialTask.status || 'todo');
      setColumnId(initialTask.columnId || columns.find(c => c.type === initialTask.status)?.id);
      setColor(initialTask.color || 'default');
      setCoverData(initialTask.coverData || '');
      setCoverPosition(initialTask.coverPosition ?? 50);
      setCoverIntensity(initialTask.coverIntensity ?? 60);
      setFiles(initialTask.files || []);
      setChecklists(initialTask.checklists || [{ id: 'default', title: 'Чек-лист', items: [], hideCompleted: false }]);
      setComments(initialTask.comments || []);
      setSaveStatus('saved');
    } else if (isOpen && !initialTask) {
      setTitle(''); setDescription(''); setDate(toLocalDateString(new Date())); setTime(''); setIsTimer(false);
      const defaultCol = columns[0];
      setStatus(defaultCol?.type || 'todo'); 
      setColumnId(defaultCol?.id); 
      setColor('default'); 
      setCoverData(''); setCoverPosition(50); setCoverIntensity(60);
      setFiles([]); 
      setChecklists([{ id: 'default', title: 'Чек-лист', items: [], hideCompleted: false }]); setComments([]);
      setSaveStatus('unsaved');
    }
  }, [isOpen, initialTask?.id]);

  const getTaskData = () => ({
    ...(initialTask?.id && { id: initialTask.id }), 
    title, description, date, time, isTimer, status, columnId, color, 
    files,
    coverData, coverPosition, coverIntensity,
    checklists, comments 
  });

  // Автосохранение
  useEffect(() => {
    if (!isOpen || !initialTask?.id) return;
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
        onSave(getTaskData());
        setSaveStatus('saved');
    }, 1000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [title, description, date, time, isTimer, status, columnId, color, coverData, coverPosition, coverIntensity, checklists, comments, files]);

 // СТАЛО:
const handleManualSave = () => {
  // Валидация: не создаём задачу без названия
  if (!title.trim()) {
    // Если редактируем существующую — просто закрываем
    if (initialTask?.id) {
      onClose();
      return;
    }
    // Если новая задача без названия — не создаём, просто закрываем
    onClose();
    return;
  }
  
  onSave(getTaskData());
  onClose();
};


  const handleBlockDragStart = (idx: number) => setDraggedBlock(idx);
  const handleBlockDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedBlock === null || draggedBlock === targetIdx) return;
    const newOrder = [...blocksOrder];
    const [moved] = newOrder.splice(draggedBlock, 1);
    newOrder.splice(targetIdx, 0, moved);
    setBlocksOrder(newOrder);
    setDraggedBlock(targetIdx);
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
        if (f.size > 2 * 1024 * 1024) { alert("Лимит 2МБ"); return; }
        const r = new FileReader();
        r.onload = ev => setCoverData(ev.target?.result as string);
        r.readAsDataURL(f);
    }
  };

  // 🔥 ОБРАБОТКА ЗАГРУЗКИ ФАЙЛОВ
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { 
        alert("Файл слишком большой (макс 5МБ)"); 
        return; 
    }

    setIsUploadingFile(true);
    try {
        const publicUrl = await uploadImage(file); // Используем ту же функцию (bucket 'covers' пока)
        if (publicUrl) {
            const newFile: TaskFile = {
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                url: publicUrl,
                type: 'file'
            };
            setFiles([...files, newFile]);
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
        } else {
            alert("Ошибка загрузки");
        }
    } catch (err) {
        console.error(err);
        alert("Не удалось загрузить файл");
    } finally {
        setIsUploadingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteFile = (fileId: string) => {
      setFiles(files.filter(f => f.id !== fileId));
  };

  // --- ЛОГИКА ЧЕК-ЛИСТОВ ---
  const addNewChecklist = () => {
    const newList: Checklist = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'Чек-лист',
      items: [],
      hideCompleted: false
    };
    setChecklists([...checklists, newList]);
    setActiveMenuId(null);
  };

  const removeChecklist = (id: string) => {
    if (checklists.length > 1) {
      setChecklists(checklists.filter(l => l.id !== id));
    } else {
      setChecklists([{ id: 'default', title: 'Чек-лист', items: [], hideCompleted: false }]);
    }
    setActiveMenuId(null);
  };

  const toggleHideCompleted = (id: string) => {
    setChecklists(checklists.map(l => l.id === id ? { ...l, hideCompleted: !l.hideCompleted } : l));
    setActiveMenuId(null);
  };

// 🔥 ИСПРАВЛЕННАЯ ФУНКЦИЯ ПЕРЕМЕЩЕНИЯ
const moveChecklistItem = (listId: string, itemId: string, direction: 'up' | 'down') => {
  setChecklists(prev => prev.map(list => {
    if (list.id !== listId) return list;
    
    const items = [...list.items];
    const currentIndex = items.findIndex(i => i.id === itemId);
    
    if (currentIndex === -1) return list;
    
    if (direction === 'up' && currentIndex > 0) {
      const temp = items[currentIndex];
      items[currentIndex] = items[currentIndex - 1];
      items[currentIndex - 1] = temp;
    } else if (direction === 'down' && currentIndex < items.length - 1) {
      const temp = items[currentIndex];
      items[currentIndex] = items[currentIndex + 1];
      items[currentIndex + 1] = temp;
    }
    
    return { ...list, items };
  }));
};


  const handleItemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        e.currentTarget.blur();
    }
  };

  const updateComment = (id: string, text: string) => {
    setComments(comments.map(c => c.id === id ? { ...c, text } : c));
  };

  const deleteComment = (id: string) => {
    setComments(comments.filter(c => c.id !== id));
  };

  const detectedLinks = extractUrls(description);

  const renderBlock = (type: TaskBlockType) => {
    switch (type) {
      case 'meta':
        return (
          <div className="flex flex-col gap-3">
             <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1 relative">
                    <label className="text-[10px] font-black tg-hint uppercase ml-1">Метка</label>
                    <button 
                      onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                      className="tg-secondary-bg h-12 w-16 px-2 rounded-2xl flex items-center justify-center border border-gray-400/10 active:scale-95 transition-all"
                    >
                      {color !== 'default' ? (
                         <div className={`w-6 h-6 rounded-full ${COLOR_MAP[color]} shadow-sm ring-2 ring-white/10`} />
                      ) : (
                         <div className="w-6 h-6 rounded-full border-2 border-gray-500/30 flex items-center justify-center relative">
                            <div className="w-full h-0.5 bg-gray-500/30 rotate-45 absolute" />
                         </div>
                      )}
                    </button>
                    
                    {isColorPickerOpen && (
                      <div className="absolute top-16 left-0 bg-[#1c1c1e] p-2 rounded-2xl shadow-2xl flex gap-1.5 z-[210] border border-gray-400/20 overflow-x-auto max-w-[250px] no-scrollbar">
                        <button 
                            onClick={() => { setColor('default'); setIsColorPickerOpen(false); }} 
                            className={`w-8 h-8 rounded-xl flex items-center justify-center border border-gray-500/30 shrink-0 ${color === 'default' ? 'bg-white/10' : ''}`}
                        >
                            <div className="w-4 h-4 rounded-full border border-gray-400 relative">
                                <div className="w-full h-px bg-gray-400 rotate-45 absolute top-1/2 left-0" />
                            </div>
                        </button>
                        {COLORS.map(c => (
                          <button key={c} onClick={() => { setColor(c); setIsColorPickerOpen(false); }} className={`w-8 h-8 rounded-xl shrink-0 ${COLOR_MAP[c]} ${color === c ? 'ring-2 ring-white scale-110' : ''}`} />
                        ))}
                      </div>
                    )}
                </div>

                <div className="flex-1 grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black tg-hint uppercase ml-1">Дата</label>
                      <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full tg-secondary-bg h-12 px-3 rounded-2xl tg-text text-[11px] font-black outline-none text-center appearance-none" />
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] font-black tg-hint uppercase">Время</label>
                          <button 
                            onClick={() => setIsTimer(!isTimer)} 
                            className={`flex items-center gap-1 transition-all active:scale-95 ${isTimer ? 'text-orange-500 opacity-100' : 'text-gray-400 opacity-40 hover:opacity-100'}`}
                            title="Включить таймер обратного отсчета"
                          >
                             <span className="text-[10px] font-black uppercase">{isTimer ? 'ON' : 'OFF'}</span>
                             <span className="text-xs">🔥</span>
                          </button>
                      </div>
                      <input 
                        type="time" 
                        value={time} 
                        onChange={e => setTime(e.target.value)} 
                        className={`
                          w-full h-12 px-3 rounded-2xl tg-text text-[11px] font-black outline-none text-center appearance-none transition-all border-2
                          ${isTimer 
                             ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' 
                             : 'tg-secondary-bg border-transparent'
                          }
                        `} 
                      />
                    </div>
                </div>
             </div>
             
             <div className="flex flex-col gap-1 mt-1">
                 <label className="text-[10px] font-black tg-hint uppercase ml-1">Колонка</label>
                 <div className="flex p-1 bg-black/10 rounded-2xl overflow-x-auto no-scrollbar gap-1">
                    {columns.map(col => (
                        <button 
                            key={col.id} 
                            onClick={() => { setStatus(col.type); setColumnId(col.id); }} 
                            className={`flex-1 py-3 px-4 min-w-[80px] text-[10px] font-black uppercase tracking-tighter rounded-xl transition-all whitespace-nowrap 
                                ${columnId === col.id 
                                    ? 'bg-[var(--tg-theme-button-color)] text-white shadow-md' 
                                    : 'text-gray-500 hover:bg-black/5'
                                }`}
                        >
                            {col.title}
                        </button>
                    ))}
                 </div>
             </div>
          </div>
        );
      case 'cover':
        return (
          <div className="flex flex-col gap-2">
             <label className="text-[10px] font-black tg-hint uppercase ml-1">Обложка карточки</label>
             <div className="flex items-center gap-3">
                <button onClick={() => coverInputRef.current?.click()} className="flex-1 tg-secondary-bg h-12 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest tg-text flex items-center justify-center gap-2 border border-dashed border-gray-400/20">{coverData ? '📸 Изменить' : '🖼️ Обложка JPG'}</button>
                {coverData && <button onClick={() => {setCoverData('');}} className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center text-lg">×</button>}
                <input type="file" ref={coverInputRef} accept="image/jpeg" onChange={handleCoverChange} className="hidden" />
             </div>
             {coverData && (
               <div className="flex flex-col gap-4 p-5 bg-black/5 rounded-[28px]">
                  <div className="relative w-full h-32 rounded-2xl overflow-hidden bg-black/20">
                     <img src={coverData} className="w-full h-full object-cover" style={{ objectPosition: `50% ${coverPosition}%` }} />
                     <div className="absolute inset-0 z-[1]" style={{ backgroundColor: `rgba(0,0,0,${coverIntensity/100})` }} />
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                      <div className="flex flex-col gap-1.5">
                         <div className="flex justify-between px-1"><label className="text-[9px] font-black tg-hint uppercase">Вертикаль</label></div>
                         <input type="range" min="0" max="100" value={coverPosition} onChange={e => setCoverPosition(Number(e.target.value))} className="w-full h-1 bg-black/10 rounded-full accent-blue-500 appearance-none touch-none" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                         <div className="flex justify-between px-1"><label className="text-[9px] font-black tg-hint uppercase">Интенсивность</label></div>
                         <input type="range" min="0" max="100" value={coverIntensity} onChange={e => setCoverIntensity(Number(e.target.value))} className="w-full h-1 bg-black/10 rounded-full accent-purple-500 appearance-none touch-none" />
                      </div>
                  </div>
               </div>
             )}
          </div>
        );
      case 'checklists':
        return (
          <div className="flex flex-col gap-6">
             {checklists.map((list) => {
                // Если скрываем готовые, то используем только невыполненные
                const visibleItems = list.hideCompleted ? list.items.filter(i => !i.completed) : list.items;
                
                return (
                <div key={list.id} className="flex flex-col gap-2 bg-black/5 p-4 rounded-[32px] border border-gray-400/5">
                   <div className="flex justify-between items-center px-2">
                      <div className="flex items-center gap-2">
                        {editingListId === list.id ? (
                           <input autoFocus value={list.title} onChange={e => setChecklists(checklists.map(l => l.id === list.id ? { ...l, title: e.target.value } : l))} onBlur={() => setEditingListId(null)} onKeyDown={e => e.key === 'Enter' && setEditingListId(null)} className="bg-transparent border-b border-blue-500 tg-text text-[11px] font-black uppercase tracking-widest outline-none" />
                        ) : (
                           <h3 onClick={() => setEditingListId(list.id)} className="text-[11px] font-black tg-hint uppercase tracking-[0.2em] cursor-pointer hover:text-blue-500">{list.title}</h3>
                        )}
                      </div>
                      <div className="relative">
                        <button onClick={() => setActiveMenuId(activeMenuId === list.id ? null : list.id)} className="w-8 h-8 flex items-center justify-center text-gray-400">•••</button>
                        {activeMenuId === list.id && (
                          <div className="absolute right-0 top-10 bg-[#1c1c1e] w-48 rounded-2xl shadow-2xl border border-gray-400/20 p-2 z-[220]">
                             <button onClick={() => toggleHideCompleted(list.id)} className="w-full text-left p-3 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase text-white">{list.hideCompleted ? 'Показать всё' : 'Скрыть готовое'}</button>
                             <button onClick={() => removeChecklist(list.id)} className="w-full text-left p-3 hover:bg-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase">Удалить список</button>
                          </div>
                        )}
                      </div>
                   </div>
                   <div className="flex flex-col gap-1.5">
                      {visibleItems.map((item, index) => (
                        <div key={item.id} className="flex items-start gap-3 p-3 tg-secondary-bg rounded-2xl group">
                           <button onClick={() => setChecklists(checklists.map(l => l.id === list.id ? { ...l, items: l.items.map(it => it.id === item.id ? { ...it, completed: !it.completed } : it) } : l))} className={`w-5 h-5 mt-0.5 rounded-lg border-2 flex items-center justify-center shrink-0 ${item.completed ? 'bg-green-500 border-green-500' : 'border-gray-400/30'}`}>{item.completed && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}</button>
                           
                           <AutoResizeTextarea 
                                value={item.text}
                                completed={item.completed}
                                onChange={(val) => setChecklists(checklists.map(l => l.id === list.id ? { ...l, items: l.items.map(it => it.id === item.id ? { ...it, text: val } : it) } : l))}
                                onKeyDown={handleItemKeyDown}
                           />
                           
                           {/* 🔥 БЛОК УПРАВЛЕНИЯ: ВВЕРХ / ВНИЗ / УДАЛИТЬ */}
<div className="flex items-center gap-0.5">
    {/* Кнопка ВВЕРХ */}
    <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          moveChecklistItem(list.id, item.id, 'up'); 
        }}
        className={`w-6 h-6 flex items-center justify-center rounded-lg text-gray-600 hover:text-white hover:bg-white/5 transition-all active:scale-90 ${
          list.items.findIndex(i => i.id === item.id) === 0 ? 'opacity-0 pointer-events-none' : ''
        }`}
    >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"></polyline></svg>
    </button>

    {/* Кнопка ВНИЗ */}
    <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          moveChecklistItem(list.id, item.id, 'down'); 
        }}
        className={`w-6 h-6 flex items-center justify-center rounded-lg text-gray-600 hover:text-white hover:bg-white/5 transition-all active:scale-90 ${
          list.items.findIndex(i => i.id === item.id) === list.items.length - 1 ? 'opacity-0 pointer-events-none' : ''
        }`}
    >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </button>

    {/* Кнопка УДАЛИТЬ */}
    <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          setChecklists(checklists.map(l => l.id === list.id ? { ...l, items: l.items.filter(it => it.id !== item.id) } : l)); 
        }} 
        className="w-6 h-6 flex items-center justify-center rounded-lg text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-90 ml-1"
    >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
</div>

                        </div>
                      ))}
                      <input type="text" placeholder="Добавить..." className="flex-1 tg-secondary-bg p-3 px-4 rounded-xl text-xs font-bold tg-text outline-none mt-1" onKeyDown={e => e.key === 'Enter' && e.currentTarget.value.trim() && (setChecklists(checklists.map(l => l.id === list.id ? { ...l, items: [...l.items, { id: Math.random().toString(36).substr(2, 9), text: e.currentTarget.value, completed: false }] } : l)), e.currentTarget.value = '')} />
                   </div>
                </div>
             );})}
             <button onClick={addNewChecklist} className="w-full py-3 border border-dashed border-gray-400/30 rounded-2xl text-[10px] font-black uppercase tg-hint">+ Новый чек-лист</button>
          </div>
        );
      
      case 'files':
        return (
          <div className="flex flex-col gap-3">
             <label className="text-[10px] font-black tg-hint uppercase ml-1">Вложения</label>
             <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
             
             {/* 🔥 СПИСОК ФАЙЛОВ */}
             {files.length > 0 && (
                <div className="flex flex-col gap-2">
                    {files.map(file => (
                        <div key={file.id} className="flex items-center gap-3 p-3 tg-secondary-bg rounded-2xl border border-white/5 group">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                                📎
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold tg-text truncate hover:text-blue-500 transition-colors">
                                    {file.name}
                                </a>
                                <span className="text-[9px] tg-hint uppercase">Файл</span>
                            </div>
                            <button onClick={() => deleteFile(file.id)} className="w-8 h-8 flex items-center justify-center text-red-500/30 hover:text-red-500 transition-colors">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                    ))}
                </div>
             )}

             <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isUploadingFile}
                className="w-full py-4 rounded-2xl bg-black/5 border border-dashed border-gray-400/10 flex flex-col items-center justify-center gap-2 text-center hover:bg-black/10 transition-all active:scale-95"
             >
                 {isUploadingFile ? (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                        <span className="text-[10px] font-black uppercase tg-hint">Загрузка...</span>
                    </div>
                 ) : (
                    <>
                        <span className="text-xl">☁️</span>
                        <span className="text-[10px] font-black uppercase tg-hint">Загрузить файл</span>
                    </>
                 )}
             </button>
          </div>
        );

      case 'comments':
        return (
          <div className="flex flex-col gap-3">
             <label className="text-[10px] font-black tg-hint uppercase ml-1">Комментарии</label>
             <div className="flex flex-col gap-2">
                {comments.map(c => (
                  <div key={c.id} className="group relative p-3 tg-secondary-bg rounded-2xl border border-black/5 flex items-start gap-2">
                     <div className="flex-1">
                         <DynamicTextarea 
                            value={c.text}
                            onChange={(val) => updateComment(c.id, val)}
                            className="w-full text-xs tg-text font-medium"
                            isOpen={isOpen}
                         />
                     </div>
                     <div className="flex flex-col items-end gap-1">
                         <button onClick={() => deleteComment(c.id)} className="text-red-500/50 hover:text-red-500 p-1">×</button>
                         <span className="text-[8px] tg-hint font-black opacity-40 whitespace-nowrap">{c.date}</span>
                     </div>
                  </div>
                ))}
                <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && newComment.trim() && (setComments([...comments, { id: Math.random().toString(36).substr(2, 9), text: newComment, date: new Date().toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'}) }]), setNewComment(''))} placeholder="Ваш комментарий..." className="w-full tg-secondary-bg p-4 rounded-2xl text-xs tg-text outline-none" />
             </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleManualSave} />
      <div className="relative w-full max-w-lg tg-bg rounded-t-[40px] sm:rounded-[32px] shadow-2xl p-6 flex flex-col gap-5 animate-in slide-in-from-bottom duration-300 max-h-[92vh] overflow-y-auto no-scrollbar pb-12">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-3">
              <h2 className="text-xl font-black tg-text tracking-tighter uppercase">{initialTask?.id ? 'Правка' : 'Создать'}</h2>
              {/* 🔥 ИНДИКАТОР АВТОСОХРАНЕНИЯ (только для существующих) */}
              {initialTask?.id && (
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all duration-300 ${saveStatus === 'saving' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}`}>
                      {saveStatus === 'saving' ? (
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      )}
                      <span className="text-[9px] font-black uppercase tracking-wider">{saveStatus === 'saving' ? 'Saving...' : 'Saved'}</span>
                  </div>
              )}
          </div>
          <button onClick={handleManualSave} className="w-10 h-10 flex items-center justify-center tg-secondary-bg tg-text rounded-full font-light text-2xl active:scale-95 transition-all">×</button>
        </div>
        <div className="flex flex-col gap-4">
          <DynamicTextarea 
             value={title} 
             onChange={setTitle} 
             placeholder="Заголовок задачи"
             className="w-full tg-secondary-bg p-4 rounded-2xl tg-text text-base font-bold placeholder:opacity-40"
             isTitle={true}
             isOpen={isOpen}
          />
          
          <div className="flex flex-col gap-2">
             <DynamicTextarea 
                value={description} 
                onChange={setDescription} 
                placeholder="Описание..."
                className="w-full tg-secondary-bg p-4 rounded-2xl tg-text text-sm leading-relaxed placeholder:opacity-30 min-h-[80px]"
                isOpen={isOpen}
             />
             
             {/* 🔥 ЧИПЫ ДЛЯ ССЫЛОК (НОВОЕ) */}
             {detectedLinks.length > 0 && (
                 <div className="flex flex-wrap gap-2 px-1">
                     {detectedLinks.map((url, i) => (
                         <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border border-blue-500/20 active:scale-95">
                             <span>🔗</span>
                             <span className="max-w-[150px] truncate">{url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                             <span>↗</span>
                         </a>
                     ))}
                 </div>
             )}
          </div>
        </div>
        <div className="flex flex-col gap-6">
          {blocksOrder.map((block, idx) => (
            <div key={block} onDragOver={e => handleBlockDragOver(e, idx)} className={`relative transition-all duration-200 ${draggedBlock === idx ? 'opacity-30 scale-95' : 'opacity-100'}`}>
              <div 
                draggable 
                onDragStart={() => handleBlockDragStart(idx)}
                onDragEnd={() => setDraggedBlock(null)}
                className="absolute -left-2 top-0 bottom-0 w-8 flex items-center justify-center opacity-30 active:opacity-100 cursor-grab active:cursor-grabbing z-20"
              >
                <span className="text-lg select-none">⠿</span>
              </div>
              <div className="pl-6">
                 {renderBlock(block)}
              </div>
            </div>
          ))}
        </div>
        
        {/* 🔥 КНОПКА "СОХРАНИТЬ" ТОЛЬКО ДЛЯ НОВЫХ ЗАДАЧ */}
        {!initialTask?.id ? (
             <button onClick={handleManualSave} className="w-full py-5 rounded-[28px] bg-[var(--tg-theme-button-color)] text-white font-black text-lg shadow-2xl active:scale-95 transition-all mt-4 uppercase tracking-widest">Создать</button>
        ) : (
             <div className="h-4" /> // Пустое место для скролла
        )}
      </div>
      {(isColorPickerOpen || activeMenuId) && <div className="fixed inset-0 z-[205]" onClick={() => { setIsColorPickerOpen(false); setActiveMenuId(null); }} />}
    </div>
  );
};
