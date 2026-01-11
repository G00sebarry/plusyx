import React, { useState, useEffect, useRef } from 'react';
import { Task, Column, Checklist, ChecklistItem, TaskStatus } from '../types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id'> | Task) => void;
  initialTask?: Task;
  columns?: Column[]; // Добавил optional, чтобы не ломалось если вдруг не передали
}

// --- 🔥 НОВЫЙ КОМПОНЕНТ: Текстовое поле, которое растет само ---
const AutoResizeTextarea: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}> = ({ value, onChange, placeholder, className, autoFocus }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      // Сбрасываем высоту, чтобы уменьшиться если текст удалили
      textareaRef.current.style.height = 'auto';
      // Ставим высоту по контенту
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={1}
      autoFocus={autoFocus}
      className={className}
      // Отключаем Enter (чтобы не создавалась новая строка, а сохранялось? 
      // Хотя в чек-листе Enter обычно нужен для переноса. Оставим как есть.)
    />
  );
};
// -------------------------------------------------------------

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, initialTask, columns = [] }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [columnId, setColumnId] = useState('');
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  
  // Обложка
  const [fileData, setFileData] = useState<string>('');
  const [coverPosition, setCoverPosition] = useState<number>(50);
  const [coverIntensity, setCoverIntensity] = useState<number>(60);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialTask) {
        setTitle(initialTask.title);
        setDescription(initialTask.description);
        
        // Разбиваем дату и время
        const d = new Date(initialTask.date);
        setDateStr(toInputDate(d));
        // Если в initialTask есть время (строка), берем её, иначе из даты
        setTimeStr(initialTask.time || toInputTime(d));

        setStatus(initialTask.status);
        setColumnId(initialTask.columnId || '');
        setChecklists(initialTask.checklists || []);
        
        setFileData(initialTask.fileData || '');
        setCoverPosition(initialTask.coverPosition ?? 50);
        setCoverIntensity(initialTask.coverIntensity ?? 60);
      } else {
        // Default values for new task
        setTitle('');
        setDescription('');
        
        const now = new Date();
        setDateStr(toInputDate(now));
        setTimeStr(toInputTime(now));
        
        setStatus('todo');
        setColumnId(columns[0]?.id || '');
        setChecklists([]);
        
        setFileData('');
        setCoverPosition(50);
        setCoverIntensity(60);
      }
    }
  }, [isOpen, initialTask, columns]);

  const toInputDate = (d: Date) => {
    // Проверка на валидность даты
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const toInputTime = (d: Date) => {
    if (isNaN(d.getTime())) return '12:00';
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const handleSave = () => {
    if (!title.trim()) return;

    const fullDate = new Date(`${dateStr}T${timeStr || '00:00'}`);

    const taskData: any = {
      title,
      description,
      date: dateStr, // Сохраняем строку даты
      time: timeStr, // Сохраняем строку времени отдельно
      status,
      columnId,
      checklists,
      fileData,
      coverPosition,
      coverIntensity,
    };

    if (initialTask) {
      onSave({ ...initialTask, ...taskData });
    } else {
      onSave(taskData);
    }
  };

  // --- ЛОГИКА ЧЕК-ЛИСТОВ ---
  const addChecklist = () => {
    const newChecklist: Checklist = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'Новый список',
      items: [],
      hideCompleted: false
    };
    setChecklists([...checklists, newChecklist]);
  };

  const updateChecklistTitle = (id: string, newTitle: string) => {
    setChecklists(checklists.map(cl => cl.id === id ? { ...cl, title: newTitle } : cl));
  };

  const deleteChecklist = (id: string) => {
    if (confirm('Удалить список?')) {
        setChecklists(checklists.filter(cl => cl.id !== id));
    }
  };

  const addChecklistItem = (listId: string) => {
    const newItem: ChecklistItem = {
      id: Math.random().toString(36).substr(2, 9),
      text: '',
      completed: false
    };
    setChecklists(checklists.map(cl => 
      cl.id === listId ? { ...cl, items: [...cl.items, newItem] } : cl
    ));
  };

  const updateChecklistItem = (listId: string, itemId: string, text: string) => {
    setChecklists(checklists.map(cl => {
      if (cl.id !== listId) return cl;
      return {
        ...cl,
        items: cl.items.map(item => item.id === itemId ? { ...item, text } : item)
      };
    }));
  };

  const toggleChecklistItem = (listId: string, itemId: string) => {
    setChecklists(checklists.map(cl => {
      if (cl.id !== listId) return cl;
      return {
        ...cl,
        items: cl.items.map(item => item.id === itemId ? { ...item, completed: !item.completed } : item)
      };
    }));
  };

  const deleteChecklistItem = (listId: string, itemId: string) => {
    setChecklists(checklists.map(cl => {
      if (cl.id !== listId) return cl;
      return {
        ...cl,
        items: cl.items.filter(item => item.id !== itemId)
      };
    }));
  };

  // --- ЛОГИКА ОБЛОЖКИ ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
        if (f.size > 3 * 1024 * 1024) { alert("Макс 3МБ"); return; }
        const r = new FileReader();
        r.onload = ev => setFileData(ev.target?.result as string);
        r.readAsDataURL(f);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg tg-bg rounded-t-[40px] sm:rounded-[32px] shadow-2xl flex flex-col gap-0 animate-in slide-in-from-bottom duration-300 max-h-[92vh] overflow-y-auto no-scrollbar">
        
        {/* HEADER */}
        <div className="p-6 pb-2 flex justify-between items-center z-10">
            <h2 className="text-xl font-black tg-text tracking-tighter uppercase">{initialTask ? 'Редактировать' : 'Новая задача'}</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-full text-gray-400 text-xl hover:text-white transition-colors">×</button>
        </div>

        <div className="p-6 pt-0 flex flex-col gap-6">
            
            {/* INPUTS */}
            <div className="flex flex-col gap-4">
                <input 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    placeholder="Название задачи" 
                    className="w-full bg-black/5 rounded-2xl p-4 text-lg font-bold tg-text outline-none border border-transparent focus:border-white/10 transition-colors placeholder:opacity-30" 
                    autoFocus={!initialTask}
                />
                
                <textarea 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    placeholder="Описание..." 
                    className="w-full bg-black/5 rounded-2xl p-4 font-medium tg-text outline-none border border-transparent focus:border-white/10 transition-colors resize-none h-24 placeholder:opacity-30"
                />
            </div>

            {/* CHECKLISTS SECTION */}
            <div className="flex flex-col gap-4">
                {checklists.map(list => (
                    <div key={list.id} className="bg-black/5 rounded-[24px] p-4 flex flex-col gap-2 border border-white/5">
                        <div className="flex justify-between items-center mb-1">
                            <input 
                                value={list.title} 
                                onChange={e => updateChecklistTitle(list.id, e.target.value)}
                                className="bg-transparent font-black text-xs uppercase tracking-widest tg-hint outline-none w-full"
                                placeholder="НАЗВАНИЕ СПИСКА"
                            />
                            <div className="flex gap-2">
                                <button onClick={() => deleteChecklist(list.id)} className="text-gray-500 hover:text-red-500 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            {list.items.map(item => (
                                <div key={item.id} className="flex items-start gap-3 group">
                                    {/* Чекбокс теперь имеет отступ сверху, чтобы ровно стоять с текстом */}
                                    <button onClick={() => toggleChecklistItem(list.id, item.id)} className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${item.completed ? 'bg-green-500 border-green-500' : 'border-gray-500 hover:border-gray-300'}`}>
                                        {item.completed && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                                    </button>
                                    
                                    {/* 🔥 ИСПОЛЬЗУЕМ НОВЫЙ КОМПОНЕНТ 🔥 */}
                                    <AutoResizeTextarea
                                        value={item.text}
                                        onChange={(e) => updateChecklistItem(list.id, item.id, e.target.value)}
                                        className={`flex-1 bg-transparent outline-none tg-text resize-none overflow-hidden min-h-[24px] leading-6 ${item.completed ? 'line-through opacity-50' : ''}`}
                                        placeholder="Что сделать?"
                                    />

                                    <button onClick={() => deleteChecklistItem(list.id, item.id)} className="mt-1 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity">×</button>
                                </div>
                            ))}
                            <button onClick={() => addChecklistItem(list.id)} className="text-left text-sm font-bold text-blue-500 hover:text-blue-400 mt-1 py-1 px-1">+ Добавить пункт</button>
                        </div>
                    </div>
                ))}

                <button onClick={addChecklist} className="w-full py-3 border border-dashed border-gray-500/30 rounded-2xl text-[10px] font-black uppercase tracking-widest tg-hint hover:bg-black/5 transition-all">
                    + Новый чек-лист
                </button>
            </div>

            {/* ОБЛОЖКА */}
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center px-1">
                     <label className="text-[10px] font-black tg-hint uppercase">Обложка карточки</label>
                     {fileData && <button onClick={() => setFileData('')} className="text-[9px] font-black text-red-500 uppercase hover:text-red-400">Удалить</button>}
                </div>
                {!fileData ? (
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 rounded-2xl bg-black/5 border border-dashed border-gray-400/20 tg-text text-[10px] font-black uppercase tracking-widest hover:bg-black/10 transition-all flex items-center justify-center gap-2"><span>🖼️</span> Обложка JPG</button>
                ) : (
                    <div className="bg-black/5 p-4 rounded-[28px] border border-white/5 animate-in fade-in">
                        <div className="relative w-full h-32 rounded-2xl overflow-hidden bg-black/20 shadow-inner mb-4">
                           <img src={fileData} className="w-full h-full object-cover" style={{ objectPosition: `50% ${coverPosition}%` }} />
                           <div className="absolute inset-0 z-[1]" style={{ backgroundColor: `rgba(0,0,0,${coverIntensity/100})` }} />
                        </div>
                        <div className="flex flex-col gap-3">
                            <input type="range" min="0" max="100" value={coverPosition} onChange={e => setCoverPosition(Number(e.target.value))} className="w-full h-1 bg-black/10 rounded-full appearance-none accent-blue-500" />
                            <input type="range" min="0" max="100" value={coverIntensity} onChange={e => setCoverIntensity(Number(e.target.value))} className="w-full h-1 bg-black/10 rounded-full appearance-none accent-purple-500" />
                        </div>
                    </div>
                )}
                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>

            {/* META DATA */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-black/5 p-3 rounded-2xl flex flex-col gap-1 border border-white/5">
                    <span className="text-[9px] font-black tg-hint uppercase">Метка</span>
                    <div className="flex gap-1 mt-1">
                        {['todo', 'in-progress', 'done'].map((s) => (
                            <button 
                                key={s} 
                                onClick={() => setStatus(s as TaskStatus)} 
                                className={`w-6 h-6 rounded-full border-2 ${status === s ? 'border-white' : 'border-transparent'} ${s==='todo'?'bg-gray-500':s==='in-progress'?'bg-blue-500':'bg-green-500'}`}
                            />
                        ))}
                    </div>
                </div>

                <div className="bg-black/5 p-3 rounded-2xl flex flex-col gap-1 border border-white/5">
                    <span className="text-[9px] font-black tg-hint uppercase">Дата</span>
                    <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} className="bg-transparent text-sm font-bold tg-text outline-none w-full" />
                </div>

                <div className="bg-black/5 p-3 rounded-2xl flex flex-col gap-1 border border-white/5">
                    <div className="flex justify-between"><span className="text-[9px] font-black tg-hint uppercase">Время</span> <span className="text-[9px] font-bold text-orange-500">OFF 🔥</span></div>
                    <input type="time" value={timeStr} onChange={e => setTimeStr(e.target.value)} className="bg-transparent text-sm font-bold tg-text outline-none w-full" />
                </div>
            </div>

            <button onClick={handleSave} className="w-full py-4 rounded-2xl bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] font-bold text-lg shadow-lg active:scale-95 transition-all mt-2">
                {initialTask ? 'Сохранить изменения' : 'Создать задачу'}
            </button>
        </div>
      </div>
    </div>
  );
};
