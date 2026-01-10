
import React, { useState, useEffect, useRef } from 'react';
import { Habit, HabitFrequency, FrequencyType } from '../types';

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (habit: Habit) => void;
  initialHabit?: Habit;
}

// Хелпер для получения даты в формате YYYY-MM-DD без сдвига часовых поясов
const toLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

type HabitBlockType = 'type_toggle' | 'question' | 'cover' | 'frequency' | 'measurable' | 'reminder';

const COLORS = ['slate', 'red', 'orange', 'green', 'blue', 'purple', 'pink'];
const COLOR_MAP: Record<string, string> = {
  'slate': 'bg-slate-500', 'red': 'bg-red-500', 'orange': 'bg-orange-500', 
  'green': 'bg-green-500', 'blue': 'bg-blue-500', 'purple': 'bg-purple-500', 'pink': 'bg-pink-500',
};

const WEEK_DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const HabitModal: React.FC<HabitModalProps> = ({ isOpen, onClose, onSave, initialHabit }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('blue');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [isMeasurable, setIsMeasurable] = useState(false);
  const [unit, setUnit] = useState('');
  const [goalValue, setGoalValue] = useState<number>(1);
  const [freq, setFreq] = useState<HabitFrequency>({ type: 'daily' });
  const [targetType, setTargetType] = useState<'at-least' | 'at-most'>('at-least');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00');
  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState('');
  const [coverPosition, setCoverPosition] = useState(50);
  const [coverIntensity, setCoverIntensity] = useState(60);
  
  const [blocksOrder, setBlocksOrder] = useState<HabitBlockType[]>(['type_toggle', 'question', 'cover', 'frequency', 'measurable', 'reminder']);
  const [draggedBlock, setDraggedBlock] = useState<number | null>(null);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialHabit) {
      setName(initialHabit.name);
      setColor(initialHabit.color);
      setQuestion(initialHabit.question || '');
      setIsMeasurable(initialHabit.isMeasurable);
      setUnit(initialHabit.unit || '');
      setGoalValue(initialHabit.goalValue || 1);
      setFreq(initialHabit.frequency || { type: 'daily' });
      setTargetType(initialHabit.targetType);
      setReminderEnabled(initialHabit.reminderEnabled);
      setReminderTime(initialHabit.reminderTime || '08:00');
      setFileName(initialHabit.fileName || '');
      setFileData(initialHabit.fileData || '');
      setCoverPosition(initialHabit.coverPosition ?? 50);
      setCoverIntensity(initialHabit.coverIntensity ?? 60);
    } else {
      setName(''); setColor('blue'); setQuestion(''); setIsMeasurable(false);
      setUnit(''); setGoalValue(1); setFreq({ type: 'daily' }); setTargetType('at-least');
      setReminderEnabled(false); setReminderTime('08:00'); setFileName(''); setFileData('');
      setCoverPosition(50); setCoverIntensity(60);
    }
  }, [initialHabit, isOpen]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: initialHabit?.id || Math.random().toString(36).substr(2, 9),
      name, color, question, isMeasurable, unit, goalValue, frequency: freq, targetType, reminderEnabled, reminderTime,
      fileName, fileData, coverPosition, coverIntensity,
      history: initialHabit?.history || {}
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

  const toggleDate = (dateStr: string) => {
    const dates = freq.specificDates || [];
    if (dates.includes(dateStr)) {
        setFreq({ ...freq, type: 'specific-dates', specificDates: dates.filter(d => d !== dateStr) });
    } else {
        setFreq({ ...freq, type: 'specific-dates', specificDates: [...dates, dateStr] });
    }
  };

  const renderCalendar = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    let startOffset = firstDay.getDay() - 1;
    if (startOffset === -1) startOffset = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(<div key={`empty-${i}`} className="w-10 h-10" />);
    for (let d = 1; d <= daysInMonth; d++) {
        const dStr = toLocalDateString(new Date(year, month, d));
        const isSelected = freq.specificDates?.includes(dStr);
        cells.push(<button key={dStr} onClick={() => toggleDate(dStr)} className={`w-10 h-10 rounded-xl text-[10px] font-bold ${isSelected ? 'bg-blue-500 text-white shadow-lg' : 'bg-black/5 tg-text'}`}>{d}</button>);
    }
    return cells;
  };

  const renderBlock = (type: HabitBlockType) => {
    switch (type) {
      case 'type_toggle':
        return (
          <div className="flex p-1 bg-black/10 rounded-2xl">
              <button onClick={() => setIsMeasurable(false)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${!isMeasurable ? 'bg-[var(--tg-theme-button-color)] text-white shadow-md' : 'text-gray-500'}`}>Простая</button>
              <button onClick={() => setIsMeasurable(true)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${isMeasurable ? 'bg-[var(--tg-theme-button-color)] text-white shadow-md' : 'text-gray-500'}`}>Измеримая</button>
          </div>
        );
      case 'question':
        return (
          <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black tg-hint uppercase ml-1">Вопрос</label>
              <input type="text" value={question} onChange={e => setQuestion(e.target.value)} className="w-full tg-secondary-bg h-12 px-4 rounded-2xl tg-text text-xs italic outline-none" placeholder="Сделали ли вы это сегодня?" />
          </div>
        );
      case 'cover':
        return (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black tg-hint uppercase ml-1">Обложка</label>
            <div className="flex items-center gap-3">
               <button onClick={() => fileInputRef.current?.click()} className="flex-1 tg-secondary-bg h-12 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest tg-text flex items-center justify-center gap-2 border border-dashed border-gray-400/20">{fileData ? '📸 Изменить' : '🖼️ Загрузить JPG'}</button>
               {fileData && <button onClick={() => {setFileData(''); setFileName('');}} className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center text-lg">×</button>}
               <input type="file" ref={fileInputRef} accept="image/jpeg" onChange={handleFileChange} className="hidden" />
            </div>
            {fileData && (
              <div className="flex flex-col gap-4 p-5 bg-black/5 rounded-[28px]">
                  <div className="relative w-full h-32 rounded-2xl overflow-hidden bg-black/20">
                     <img src={fileData} className="w-full h-full object-cover" style={{ objectPosition: `50% ${coverPosition}%` }} />
                     <div className="absolute inset-0 z-[1]" style={{ backgroundColor: `rgba(0,0,0,${coverIntensity/100})` }} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black tg-hint uppercase">Вертикаль</label><input type="range" min="0" max="100" value={coverPosition} onChange={e => setCoverPosition(Number(e.target.value))} className="w-full h-1 bg-black/10 rounded-full appearance-none touch-none accent-blue-500" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black tg-hint uppercase">Интенсивность</label><input type="range" min="0" max="100" value={coverIntensity} onChange={e => setCoverIntensity(Number(e.target.value))} className="w-full h-1 bg-black/10 rounded-full appearance-none touch-none accent-purple-500" /></div>
                  </div>
              </div>
            )}
          </div>
        );
      case 'frequency':
        return (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black tg-hint uppercase ml-1">Частота</label>
            <div className="bg-black/5 rounded-[28px] p-4 flex flex-col gap-3">
               <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => {setFreq({type:'daily'}); setIsCalendarOpen(false);}} className={`py-3 rounded-xl text-[9px] font-black uppercase ${freq.type==='daily' ? 'bg-blue-500 text-white shadow-md' : 'bg-black/5 text-gray-400'}`}>Каждый день</button>
                  <button onClick={() => {setFreq({type:'specific-dates', specificDates: freq.specificDates || []}); setIsCalendarOpen(!isCalendarOpen);}} className={`py-3 rounded-xl text-[9px] font-black uppercase ${freq.type==='specific-dates' ? 'bg-blue-500 text-white shadow-md' : 'bg-black/5 text-gray-400'}`}>Выбрать даты</button>
               </div>
               <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => {setFreq({type:'presets', preset:'mon-wed-fri'}); setIsCalendarOpen(false);}} className={`py-3 rounded-xl text-[9px] font-black uppercase ${freq.preset==='mon-wed-fri' ? 'bg-blue-500 text-white shadow-md' : 'bg-black/5 text-gray-400'}`}>Пн, Ср, Пт</button>
                  <button onClick={() => {setFreq({type:'presets', preset:'tue-thu-sat'}); setIsCalendarOpen(false);}} className={`py-3 rounded-xl text-[9px] font-black uppercase ${freq.preset==='tue-thu-sat' ? 'bg-blue-500 text-white shadow-md' : 'bg-black/5 text-gray-400'}`}>Вт, Чт, Сб</button>
               </div>
               <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => {setFreq({type:'even-days'}); setIsCalendarOpen(false);}} className={`py-3 rounded-xl text-[9px] font-black uppercase ${freq.type==='even-days' ? 'bg-blue-500 text-white shadow-md' : 'bg-black/5 text-gray-400'}`}>Чётные числа</button>
                  <button onClick={() => {setFreq({type:'odd-days'}); setIsCalendarOpen(false);}} className={`py-3 rounded-xl text-[9px] font-black uppercase ${freq.type==='odd-days' ? 'bg-blue-500 text-white shadow-md' : 'bg-black/5 text-gray-400'}`}>Нечётные числа</button>
               </div>
               {isCalendarOpen && (
                 <div className="bg-black/5 rounded-2xl p-3">
                    <div className="grid grid-cols-7 gap-1 mb-2 text-center">{WEEK_DAYS_SHORT.map(d => <span key={d} className="text-[8px] font-black tg-hint">{d}</span>)}</div>
                    <div className="grid grid-cols-7 gap-1">{renderCalendar()}</div>
                 </div>
               )}
               <div className="flex flex-col gap-2 border-t border-black/5 pt-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setFreq({type:'quota-week', quotaCount: freq.quotaCount || 3})} className={`w-5 h-5 rounded-full border-2 ${freq.type==='quota-week' ? 'bg-blue-500 border-blue-500' : 'border-gray-400/30'}`} />
                    <input type="number" value={freq.quotaCount || 3} onChange={e => setFreq({...freq, type:'quota-week', quotaCount: parseInt(e.target.value)})} className="w-10 h-8 bg-black/10 rounded-lg text-center font-black tg-text text-xs" />
                    <span className="text-xs font-bold tg-text">раз в неделю</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setFreq({type:'quota-month', quotaCount: freq.quotaCount || 10})} className={`w-5 h-5 rounded-full border-2 ${freq.type==='quota-month' ? 'bg-blue-500 border-blue-500' : 'border-gray-400/30'}`} />
                    <input type="number" value={freq.quotaCount || 10} onChange={e => setFreq({...freq, type:'quota-month', quotaCount: parseInt(e.target.value)})} className="w-10 h-8 bg-black/10 rounded-lg text-center font-black tg-text text-xs" />
                    <span className="text-xs font-bold tg-text">раз в месяц</span>
                  </div>
               </div>
            </div>
          </div>
        );
      case 'measurable':
        return isMeasurable ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1"><label className="text-[9px] font-black tg-hint uppercase">Ед.</label><input value={unit} onChange={e=>setUnit(e.target.value)} className="w-full tg-secondary-bg h-11 px-3 rounded-xl tg-text text-xs outline-none" placeholder="мин" /></div>
            <div className="flex flex-col gap-1"><label className="text-[9px] font-black tg-hint uppercase">Цель</label><input type="number" value={goalValue} onChange={e=>setGoalValue(Number(e.target.value))} className="w-full tg-secondary-bg h-11 px-3 rounded-xl tg-text text-sm font-black outline-none" /></div>
            <div className="flex flex-col gap-1"><label className="text-[9px] font-black tg-hint uppercase">Тип</label><select value={targetType} onChange={e=>setTargetType(e.target.value as any)} className="w-full tg-secondary-bg h-11 px-2 rounded-xl tg-text text-[9px] font-black uppercase outline-none"><option value="at-least">Min</option><option value="at-most">Max</option></select></div>
          </div>
        ) : null;
      case 'reminder':
        return (
          <div className="flex items-center justify-between p-4 bg-black/5 rounded-[28px]">
             <div className="flex flex-col"><span className="text-[10px] font-black tg-text uppercase">Напоминание</span><input type="time" value={reminderTime} onChange={e=>setReminderTime(e.target.value)} className="bg-transparent text-sm font-black tg-text outline-none" /></div>
             <button onClick={() => setReminderEnabled(!reminderEnabled)} className={`w-12 h-6 rounded-full relative transition-all ${reminderEnabled ? 'bg-green-500' : 'bg-gray-400'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${reminderEnabled ? 'right-1' : 'left-1'}`} /></button>
          </div>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg tg-bg rounded-t-[40px] sm:rounded-[32px] shadow-2xl p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto no-scrollbar pb-10">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-xl font-black tg-text tracking-tighter uppercase">{initialHabit ? 'Правка' : 'Создать'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full tg-secondary-bg tg-text flex items-center justify-center font-light text-xl">×</button>
        </div>
        <div className="flex gap-3">
             <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] font-black tg-hint uppercase ml-1">Название</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="w-full tg-secondary-bg h-12 px-4 rounded-2xl tg-text font-bold outline-none border border-transparent focus:border-blue-500/30" 
                  placeholder={isMeasurable ? "напр. Медитация" : "напр. Йога"} 
                />
             </div>
             <div className="flex flex-col gap-1 relative">
                <label className="text-[10px] font-black tg-hint uppercase ml-1">Цвет</label>
                <button onClick={() => setIsColorPickerOpen(!isColorPickerOpen)} className="tg-secondary-bg h-12 w-16 rounded-2xl border border-gray-400/10 flex items-center justify-center transition-all"><div className={`w-5 h-5 rounded-full ${COLOR_MAP[color]} shadow-sm`} /></button>
                {isColorPickerOpen && (
                  <div className="absolute top-16 right-0 bg-[#1c1c1e] p-2 rounded-2xl shadow-2xl flex gap-1.5 z-[310] border border-gray-400/20">
                    {COLORS.map(c => <button key={c} onClick={() => { setColor(c); setIsColorPickerOpen(false); }} className={`w-8 h-8 rounded-xl ${COLOR_MAP[c]} ${color === c ? 'ring-2 ring-white scale-110' : ''}`} />)}
                  </div>
                )}
             </div>
        </div>
        <div className="flex flex-col gap-5 mt-2">
           {blocksOrder.map((block, idx) => {
             const content = renderBlock(block);
             if (!content) return null;
             return (
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
                    {content}
                 </div>
               </div>
             );
           })}
        </div>
        <button onClick={handleSave} className="w-full py-5 rounded-[28px] bg-[var(--tg-theme-button-color)] text-white font-black text-lg shadow-2xl active:scale-95 transition-all mt-2 uppercase tracking-widest">
          {initialHabit ? 'Сохранить' : 'Готово'}
        </button>
      </div>
      {isColorPickerOpen && <div className="fixed inset-0 z-[305]" onClick={() => setIsColorPickerOpen(false)} />}
    </div>
  );
};
