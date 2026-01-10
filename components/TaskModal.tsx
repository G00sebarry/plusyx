import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, ChecklistItem, TaskComment, Checklist } from '../types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: any) => void;
  initialTask?: Task;
}

const toLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

type TaskBlockType = 'meta' | 'cover' | 'checklists' | 'files' | 'comments';

const COLORS = ['slate', 'red', 'orange', 'green', 'blue', 'purple', 'pink'];
const COLOR_MAP: Record<string, string> = {
  'slate': 'bg-slate-500', 'red': 'bg-red-500', 'orange': 'bg-orange-500', 
  'green': 'bg-green-500', 'blue': 'bg-blue-500', 'purple': 'bg-purple-500', 'pink': 'bg-pink-500',
};

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, initialTask }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(toLocalDateString(new Date()));
  const [time, setTime] = useState('');
  const [isTimer, setIsTimer] = useState(false);
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [columnId, setColumnId] = useState<string | undefined>(undefined);
  
  // --- ЦВЕТ (теперь может быть 'default') ---
  const [color, setColor] = useState('default'); 
  // -----------------------------------------

  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState('');
  const [coverData, setCoverData] = useState('');
  const [coverPosition, setCoverPosition] = useState(50);
  const [coverIntensity, setCoverIntensity] = useState(60);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  
  const [blocksOrder, setBlocksOrder] = useState<TaskBlockType[]>(['meta', 'cover', 'checklists', 'files', 'comments']);
  const [draggedBlock, setDraggedBlock] = useState<number | null>(null);
  
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title || '');
      setDescription(initialTask.description || '');
      setDate(initialTask.date || toLocalDateString(new Date()));
      setTime(initialTask.time || '');
      setIsTimer(initialTask.isTimer || false);
      setStatus(initialTask.status || 'todo');
      setColumnId(initialTask.columnId);
      setColor(initialTask.color || 'default'); // Загружаем цвет или дефолт
      setFileName(initialTask.fileName || '');
      setFileData(initialTask.fileData || '');
      setCoverData(initialTask.coverData || '');
      setCoverPosition(initialTask.coverPosition ?? 50);
      setCoverIntensity(initialTask.coverIntensity ?? 60);
      setChecklists(initialTask.checklists || [{ id: 'default', title: 'Чек-лист', items: [], hideCompleted: false }]);
      setComments(initialTask.comments || []);
    } else {
      setTitle(''); setDescription(''); setDate(toLocalDateString(new Date())); setTime(''); setIsTimer(false);
      setStatus('todo'); setColumnId(undefined); setColor('default'); setFileName(''); setFileData(''); 
      setCoverData(''); setCoverPosition(50); setCoverIntensity(60);
      setChecklists([{ id: 'default', title: 'Чек-лист', items: [], hideCompleted: false }]); setComments([]);
    }
  }, [initialTask, isOpen]);

  const handleSave = () => {
    onSave({ 
      ...(initialTask?.id && { id: initialTask.id }), 
      title, description, date, time, isTimer, status, columnId, color, fileName, fileData, coverData, coverPosition, coverIntensity,
      checklists, comments 
    });
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
        if (f.size > 2 * 1024 * 1024) { alert("Лимит 2МБ"); return; }
        setFileName(f.name);
        const r = new FileReader();
        r.onload = ev => setFileData(ev.target?.result as string);
        r.readAsDataURL(f);
    }
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

  const addNewChecklist = () => {
    const newList: Checklist = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'Новый список',
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

  const renderBlock = (type: TaskBlockType) => {
    switch (type) {
      case 'meta':
        return (
          <div className="flex flex-col gap-3">
             <div className="flex items-end gap-2">
                
                {/* --- БЛОК ВЫБОРА МЕТКИ --- */}
                <div className="flex flex-col gap-1 relative">
                    <label className="text-[10px] font-black tg-hint uppercase ml-1">Метка</label>
                    <button 
                      onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                      className="tg-secondary-bg h-12 w-16 px-2 rounded-2xl flex items-center justify-center border border-gray-400/10 active:scale-95 transition-all"
                    >
                      {/* Если цвет выбран - показываем его, если нет - показываем перечеркнутый круг */}
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
                        {/* Кнопка "Нет цвета" */}
                        <button 
                            onClick={() => { setColor('default'); setIsColorPickerOpen(false); }} 
                            className={`w-8 h-8 rounded-xl flex items-center justify-center border border-gray-500/30 shrink-0 ${color === 'default' ? 'bg-white/10' : ''}`}
                        >
                            <div className="w-4 h-4 rounded-full border border-gray-400 relative">
                                <div className="w-full h-px bg-gray-400 rotate-45 absolute top-1/2 left-0" />
                            </div>
                        </button>
                        
                        {/* Цвета */}
                        {COLORS.map(c => (
                          <button key={c} onClick={() => { setColor(c); setIsColorPickerOpen(false); }} className={`w-8 h-8 rounded-xl shrink-0 ${COLOR_MAP[c]} ${color === c ? 'ring-2 ring-white scale-110' : ''}`} />
                        ))}
                      </div>
                    )}
                </div>
                {/* ------------------------- */}

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
             <div className="flex p-1 bg-black/10 rounded-2xl">
                {(['todo', 'in-progress', 'done'] as TaskStatus[]).map(s => (
                    <button key={s} onClick={() => setStatus(s)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-tighter rounded-xl transition-all ${status === s ? 'bg-[var(--tg-theme-button-color)] text-white shadow-md' : 'text-gray-500'}`}>{s === 'todo' ? 'Очередь' : s === 'in-progress' ? 'В работе' : 'Готово'}</button>
                ))}
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
             {checklists.map((list) => (
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
                      {list.items.filter(it => !list.hideCompleted || !it.completed).map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-3 tg-secondary-bg rounded-2xl group">
                           <button onClick={() => setChecklists(checklists.map(l => l.id === list.id ? { ...l, items: l.items.map(it => it.id === item.id ? { ...it, completed: !it.completed } : it) } : l))} className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 ${item.completed ? 'bg-green-500 border-green-500' : 'border-gray-400/30'}`}>{item.completed && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}</button>
                           <input type="text" value={item.text} onChange={e => setChecklists(checklists.map(l => l.id === list.id ? { ...l, items: l.items.map(it => it.id === item.id ? { ...it, text: e.target.value } : it) } : l))} className={`flex-1 text-sm tg-text bg-transparent outline-none ${item.completed ? 'line-through opacity-30 italic' : ''}`} />
                           <button onClick={() => setChecklists(checklists.map(l => l.id === list.id ? { ...l, items: l.items.filter(it => it.id !== item.id) } : l))} className="text-red-500/30 hover:text-red-500 px-2">×</button>
                        </div>
                      ))}
                      <input type="text" placeholder="Добавить..." className="flex-1 tg-secondary-bg p-3 px-4 rounded-xl text-xs font-bold tg-text outline-none mt-1" onKeyDown={e => e.key === 'Enter' && e.currentTarget.value.trim() && (setChecklists(checklists.map(l => l.id === list.id ? { ...l, items: [...l.items, { id: Math.random().toString(36).substr(2, 9), text: e.currentTarget.value, completed: false }] } : l)), e.currentTarget.value = '')} />
                   </div>
                </div>
             ))}
             <button onClick={addNewChecklist} className="w-full py-3 border border-dashed border-gray-400/30 rounded-2xl text-[10px] font-black uppercase tg-hint">+ Новый чек-лист</button>
          </div>
        );
      case 'files':
        return (
          <div className="flex flex-col gap-2">
             <button onClick={() => fileInputRef.current?.click()} className="w-full tg-secondary-bg py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest tg-text flex items-center justify-center gap-2">📎 {fileName ? 'Заменить файл' : 'Прикрепить файл'}</button>
             {fileName && <p className="text-[10px] tg-hint px-2 truncate">Файл: {fileName}</p>}
             <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          </div>
        );
      case 'comments':
        return (
          <div className="flex flex-col gap-3">
             <label className="text-[10px] font-black tg-hint uppercase ml-1">Комментарии</label>
             <div className="flex flex-col gap-2">
                {comments.map(c => (
                  <div key={c.id} className="p-3.5 tg-secondary-bg rounded-2xl border border-black/5"><p className="text-xs tg-text font-medium">{c.text}</p><span className="text-[8px] tg-hint font-black block text-right opacity-40">{c.date}</span></div>
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg tg-bg rounded-t-[40px] sm:rounded-[32px] shadow-2xl p-6 flex flex-col gap-5 animate-in slide-in-from-bottom duration-300 max-h-[92vh] overflow-y-auto no-scrollbar pb-12">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-xl font-black tg-text tracking-tighter uppercase">{initialTask?.id ? 'Правка' : 'Создать'}</h2>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center tg-secondary-bg tg-text rounded-full font-light text-2xl">×</button>
        </div>
        <div className="flex flex-col gap-4">
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full tg-secondary-bg p-4 rounded-2xl tg-text outline-none text-base font-bold placeholder:opacity-40" placeholder="Заголовок задачи" />
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Описание..." rows={2} className="w-full tg-secondary-bg p-4 rounded-2xl tg-text outline-none resize-none text-sm leading-relaxed placeholder:opacity-30" />
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
        <button onClick={handleSave} className="w-full py-5 rounded-[28px] bg-[var(--tg-theme-button-color)] text-white font-black text-lg shadow-2xl active:scale-95 transition-all mt-4 uppercase tracking-widest">
          {initialTask?.id ? 'Сохранить' : 'Готово'}
        </button>
      </div>
      {(isColorPickerOpen || activeMenuId) && <div className="fixed inset-0 z-[205]" onClick={() => { setIsColorPickerOpen(false); setActiveMenuId(null); }} />}
    </div>
  );
};
