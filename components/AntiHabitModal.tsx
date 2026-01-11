import React, { useState, useEffect, useRef } from 'react';
import { AntiHabit } from '../types';

interface AntiHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (habit: AntiHabit) => void;
  initialHabit?: AntiHabit;
}

const COLORS = ['bg-slate-500', 'bg-red-500', 'bg-orange-500', 'bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500'];
const EMOJI_PRESETS = ['🚬', '🍺', '🍟', '🍭', '📱', '🎮', '🤬', '🥐', '💊', '☕'];

export const AntiHabitModal: React.FC<AntiHabitModalProps> = ({ isOpen, onClose, onSave, initialHabit }) => {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('bg-red-500');
  const [emoji, setEmoji] = useState('⛔');
  
  // Даты строками для инпутов
  const [startDateStr, setStartDateStr] = useState('');
  const [startTimeStr, setStartTimeStr] = useState('');
  
  // Обложка
  const [fileData, setFileData] = useState<string>('');
  const [coverPosition, setCoverPosition] = useState<number>(50);
  const [coverIntensity, setCoverIntensity] = useState<number>(60);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCustomEmoji, setIsCustomEmoji] = useState(false);

  useEffect(() => {
    if (isOpen) {
        if (initialHabit) {
            // РЕДАКТИРОВАНИЕ
            setTitle(initialHabit.title);
            setColor(initialHabit.color);
            setEmoji(initialHabit.emoji);
            setFileData(initialHabit.fileData || '');
            setCoverPosition(initialHabit.coverPosition ?? 50);
            setCoverIntensity(initialHabit.coverIntensity ?? 60);
            
            // Превращаем timestamp в строки для инпутов
            const d = new Date(initialHabit.startDate);
            setStartDateStr(toInputDate(d));
            setStartTimeStr(toInputTime(d));
        } else {
            // СОЗДАНИЕ НОВОЙ
            setTitle(''); 
            setColor('bg-red-500'); 
            setEmoji('⛔');
            setFileData(''); 
            setCoverPosition(50); 
            setCoverIntensity(60);
            
            // По умолчанию ставим "сейчас"
            const now = new Date();
            setStartDateStr(toInputDate(now));
            setStartTimeStr(toInputTime(now));
        }
    }
  }, [isOpen, initialHabit]);

  // Хелперы для дат
  const toInputDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const toInputTime = (d: Date) => {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
        if (f.size > 3 * 1024 * 1024) { alert("Макс 3МБ"); return; }
        const r = new FileReader();
        r.onload = ev => setFileData(ev.target?.result as string);
        r.readAsDataURL(f);
    }
  };

  const handleSave = () => {
    if (!title.trim()) return;

    // Собираем дату и время обратно в Timestamp
    const start = new Date(`${startDateStr}T${startTimeStr}`);
    
    const newHabit: AntiHabit = {
      ...(initialHabit || { id: '', history: [], longestStreak: 0 }),
      id: initialHabit?.id || Math.random().toString(36).substr(2, 9),
      title,
      emoji,
      color,
      startDate: start.getTime(),
      longestStreak: initialHabit?.longestStreak || 0,
      history: initialHabit?.history || [], // История сохраняется при редактировании
      fileData,
      coverPosition,
      coverIntensity
    };
    onSave(newHabit);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg tg-bg rounded-t-[40px] sm:rounded-[32px] shadow-2xl flex flex-col gap-0 animate-in slide-in-from-bottom duration-300 max-h-[92vh] overflow-y-auto no-scrollbar">
        
        {/* ЗАГОЛОВОК */}
        <div className="p-6 pb-2 flex justify-between items-center">
             <h2 className="text-xl font-black tg-text tracking-tighter uppercase">{initialHabit ? 'Настройка' : 'Бросить привычку'}</h2>
             <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-full text-gray-400 text-xl hover:text-white transition-colors">×</button>
        </div>

        <div className="p-6 pt-0 flex flex-col gap-6">
            
            {/* ВВОД НАЗВАНИЯ И ЭМОДЗИ */}
            <div className="flex gap-3">
                <div className="relative">
                    <button onClick={() => setIsCustomEmoji(!isCustomEmoji)} className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg border-2 ${isCustomEmoji ? 'border-white' : 'border-transparent'} ${color} transition-all active:scale-95`}>{emoji}</button>
                    {isCustomEmoji && (
                         <div className="absolute top-16 left-0 bg-[#2c2c2e] p-3 rounded-2xl shadow-2xl border border-white/10 w-[240px] z-50 flex flex-col gap-3 animate-in fade-in zoom-in-95 origin-top-left">
                            <div className="grid grid-cols-5 gap-2">
                                {EMOJI_PRESETS.map(e => <button key={e} onClick={() => { setEmoji(e); setIsCustomEmoji(false); }} className="w-9 h-9 flex items-center justify-center text-xl bg-white/5 rounded-xl hover:bg-white/10">{e}</button>)}
                            </div>
                            <div className="flex justify-between gap-1 pt-2 border-t border-white/5">
                                {COLORS.map(c => <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full ${c} ${color === c ? 'ring-2 ring-white scale-110' : ''}`} />)}
                            </div>
                         </div>
                    )}
                </div>
                <div className="flex-1 bg-black/5 rounded-2xl p-1 pl-4 flex items-center border border-white/5 focus-within:border-red-500/50 transition-colors">
                    <input autoFocus={!initialHabit} value={title} onChange={e => setTitle(e.target.value)} placeholder="Что бросаем? (напр. Курение)" className="w-full bg-transparent outline-none font-bold tg-text text-lg placeholder:opacity-30" />
                </div>
            </div>

            {/* ВЫБОР ДАТЫ НАЧАЛА (С какого момента не делаю?) */}
            <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black tg-hint uppercase ml-1">С какого момента не делаю?</label>
                <div className="flex gap-2">
                    <input type="date" value={startDateStr} onChange={e => setStartDateStr(e.target.value)} className="flex-1 bg-black/5 border border-white/5 rounded-2xl p-3 font-bold tg-text outline-none text-center" />
                    <input type="time" value={startTimeStr} onChange={e => setStartTimeStr(e.target.value)} className="w-24 bg-black/5 border border-white/5 rounded-2xl p-3 font-bold tg-text outline-none text-center" />
                </div>
            </div>

            {/* ЗАГРУЗКА ОБЛОЖКИ */}
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center px-1">
                     <label className="text-[10px] font-black tg-hint uppercase">Обложка</label>
                     {fileData && <button onClick={() => setFileData('')} className="text-[9px] font-black text-red-500 uppercase hover:text-red-400">Удалить</button>}
                </div>
                {!fileData ? (
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 rounded-2xl bg-black/5 border border-dashed border-gray-400/20 tg-text text-[10px] font-black uppercase tracking-widest hover:bg-black/10 transition-all flex items-center justify-center gap-2"><span>📷</span> Загрузить фото</button>
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

            {/* КНОПКА СОХРАНИТЬ */}
            <button onClick={handleSave} className="w-full py-5 rounded-[28px] bg-red-500 text-white font-black text-lg shadow-2xl active:scale-95 transition-all mt-2 uppercase tracking-widest hover:brightness-110">
                {initialHabit ? 'Сохранить' : 'Начать воздержание'}
            </button>
        </div>
        {isCustomEmoji && <div className="fixed inset-0 z-40" onClick={() => setIsCustomEmoji(false)} />}
      </div>
    </div>
  );
};
