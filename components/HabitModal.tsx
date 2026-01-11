import React, { useState, useEffect, useRef } from 'react';
import { Habit } from '../types';

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (habit: Habit) => void;
  initialHabit?: Habit;
}

// Популярные шаблоны
const TEMPLATES = [
  { title: 'Пить воду', emoji: '💧', color: 'bg-blue-500', unit: 'мл', goal: 2000 },
  { title: 'Спорт', emoji: '🏃', color: 'bg-orange-500', unit: 'мин', goal: 45 },
  { title: 'Чтение', emoji: '📚', color: 'bg-purple-500', unit: 'стр', goal: 20 },
  { title: 'Медитация', emoji: '🧘', color: 'bg-teal-500', unit: 'мин', goal: 15 },
  { title: 'Витамины', emoji: '💊', color: 'bg-green-500', unit: 'шт', goal: 1 },
  { title: 'Английский', emoji: '🇬🇧', color: 'bg-red-500', unit: 'мин', goal: 30 },
  { title: 'Копить', emoji: '💰', color: 'bg-yellow-500', unit: '₽', goal: 500 },
  { title: 'Сон', emoji: '💤', color: 'bg-slate-500', unit: 'ч', goal: 8 },
];

const COLORS = ['bg-slate-500', 'bg-red-500', 'bg-orange-500', 'bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500'];
const EMOJI_PRESETS = ['🔥', '💧', '🏃', '📚', '🧘', '💊', '💰', '🥗', '💤', '🧠', '🎸', '✈️'];

export const HabitModal: React.FC<HabitModalProps> = ({ isOpen, onClose, onSave, initialHabit }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('bg-blue-500');
  const [emoji, setEmoji] = useState('🔥');
  
  const [isMeasurable, setIsMeasurable] = useState(false);
  const [goal, setGoal] = useState<number>(1);
  const [unit, setUnit] = useState('');

  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [isCustomEmoji, setIsCustomEmoji] = useState(false);

  // --- СОСТОЯНИЕ ДЛЯ ОБЛОЖКИ ---
  const [fileData, setFileData] = useState<string>('');
  const [coverPosition, setCoverPosition] = useState<number>(50);
  const [coverIntensity, setCoverIntensity] = useState<number>(60);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // -----------------------------

  useEffect(() => {
    if (initialHabit) {
      setTitle(initialHabit.title);
      setDescription(initialHabit.description || '');
      setColor(initialHabit.color);
      setEmoji(initialHabit.emoji || '🔥');
      setIsMeasurable(initialHabit.isMeasurable || false);
      setGoal(initialHabit.targetValue || 1);
      setUnit(initialHabit.unit || '');
      
      if (initialHabit.frequency && initialHabit.frequency.days) {
        setSelectedDays(initialHabit.frequency.days);
      } else {
        setSelectedDays([1, 2, 3, 4, 5, 6, 0]);
      }

      // Восстанавливаем обложку
      setFileData(initialHabit.fileData || '');
      setCoverPosition(initialHabit.coverPosition ?? 50);
      setCoverIntensity(initialHabit.coverIntensity ?? 60);

    } else {
      resetForm();
    }
  }, [initialHabit, isOpen]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setColor('bg-blue-500'); setEmoji('🔥');
    setIsMeasurable(false); setGoal(1); setUnit(''); setSelectedDays([1, 2, 3, 4, 5, 6, 0]);
    setFileData(''); setCoverPosition(50); setCoverIntensity(60);
  };

  const handleTemplateClick = (t: typeof TEMPLATES[0]) => {
    setTitle(t.title);
    setEmoji(t.emoji);
    setColor(t.color);
    if (t.unit) {
      setIsMeasurable(true);
      setUnit(t.unit);
      setGoal(t.goal);
    }
  };

  const toggleDay = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      if (selectedDays.length > 1) {
        setSelectedDays(prev => prev.filter(d => d !== dayIndex));
      }
    } else {
      setSelectedDays(prev => [...prev, dayIndex]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
        if (f.size > 3 * 1024 * 1024) { alert("Файл слишком большой (макс 3МБ)"); return; }
        const r = new FileReader();
        r.onload = ev => setFileData(ev.target?.result as string);
        r.readAsDataURL(f);
    }
  };

  const handleSave = () => {
    if (!title.trim()) return;
    const isEveryDay = selectedDays.length === 7;
    
    const newHabit: Habit = {
      ...(initialHabit || { id: '', history: {} }),
      id: initialHabit?.id || Math.random().toString(36).substr(2, 9),
      title,
      description,
      color,
      emoji,
      isMeasurable,
      targetValue: isMeasurable ? Number(goal) : 1,
      unit: isMeasurable ? unit : '',
      frequency: {
        type: isEveryDay ? 'daily' : 'specific',
        days: selectedDays
      },
      history: initialHabit?.history || {},
      
      // Сохраняем данные обложки
      fileData,
      coverPosition,
      coverIntensity
    };
    onSave(newHabit);
  };

  const getFrequencyLabel = () => {
    if (selectedDays.length === 7) return 'Каждый день';
    if (selectedDays.length === 5 && !selectedDays.includes(0) && !selectedDays.includes(6)) return 'По будням';
    if (selectedDays.length === 2 && selectedDays.includes(0) && selectedDays.includes(6)) return 'Выходные';
    return 'Выбранные дни';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg tg-bg rounded-t-[40px] sm:rounded-[32px] shadow-2xl flex flex-col gap-0 animate-in slide-in-from-bottom duration-300 max-h-[92vh] overflow-y-auto no-scrollbar">
        
        {/* --- ЗАГОЛОВОК И ШАБЛОНЫ --- */}
        <div className="p-6 pb-2">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-black tg-text tracking-tighter uppercase">{initialHabit ? 'Настройка' : 'Новая привычка'}</h2>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-full text-gray-400 text-xl hover:text-white transition-colors">×</button>
            </div>
            
            {!initialHabit && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2">
                    {TEMPLATES.map(t => (
                        <button 
                            key={t.title} 
                            onClick={() => handleTemplateClick(t)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 whitespace-nowrap active:scale-95 transition-all hover:bg-white/10 shrink-0"
                        >
                            <span>{t.emoji}</span>
                            <span className="text-[10px] font-bold tg-text">{t.title}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>

        <div className="p-6 pt-0 flex flex-col gap-6">

            {/* --- ОСНОВНОЙ ВВОД (НАЗВАНИЕ + ЭМОДЗИ) --- */}
            <div className="flex gap-3">
                <div className="relative">
                    <button 
                        onClick={() => setIsCustomEmoji(!isCustomEmoji)}
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg border-2 ${isCustomEmoji ? 'border-white' : 'border-transparent'} ${color} transition-all active:scale-95`}
                    >
                        {emoji}
                    </button>
                    
                    {isCustomEmoji && (
                        <div className="absolute top-16 left-0 bg-[#2c2c2e] p-3 rounded-2xl shadow-2xl border border-white/10 w-[280px] z-50 flex flex-col gap-3 animate-in fade-in zoom-in-95 origin-top-left">
                            <div className="grid grid-cols-6 gap-2">
                                {EMOJI_PRESETS.map(e => (
                                    <button key={e} onClick={() => { setEmoji(e); setIsCustomEmoji(false); }} className="w-9 h-9 flex items-center justify-center text-xl bg-white/5 rounded-xl hover:bg-white/10 transition-colors">{e}</button>
                                ))}
                            </div>
                            <div className="flex gap-2 items-center bg-black/20 p-2 rounded-xl">
                                <span className="text-[9px] font-bold text-gray-400 uppercase ml-1 whitespace-nowrap">Свой:</span>
                                <input 
                                    type="text" maxLength={2} placeholder="😎"
                                    className="w-full bg-transparent outline-none text-center font-bold text-white text-lg"
                                    onChange={(e) => { if(e.target.value) { setEmoji(e.target.value); } }}
                                />
                            </div>
                            <div className="flex justify-between gap-1 pt-2 border-t border-white/5">
                                {COLORS.map(c => (
                                    <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full ${c} ${color === c ? 'ring-2 ring-white scale-110' : ''} transition-all`} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex-1 bg-black/5 rounded-2xl p-1 pl-4 flex items-center border border-white/5 focus-within:border-blue-500/50 transition-colors">
                    <input 
                        autoFocus={!initialHabit}
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Название (напр. Бег)"
                        className="w-full bg-transparent outline-none font-bold tg-text text-lg placeholder:opacity-30"
                    />
                </div>
            </div>

            {/* --- ТИП (ПРОСТАЯ / ИЗМЕРИМАЯ) --- */}
            <div className="bg-black/5 p-1 rounded-[18px] flex relative border border-white/5">
                <div 
                    className="absolute top-1 bottom-1 w-[48%] bg-[var(--tg-theme-button-color)] rounded-[14px] transition-all duration-300 shadow-md"
                    style={{ left: isMeasurable ? '51%' : '1%' }}
                />
                <button onClick={() => setIsMeasurable(false)} className={`flex-1 py-3 text-[10px] font-black uppercase relative z-10 text-center transition-colors ${!isMeasurable ? 'text-white' : 'tg-text opacity-50'}`}>Простая</button>
                <button onClick={() => setIsMeasurable(true)} className={`flex-1 py-3 text-[10px] font-black uppercase relative z-10 text-center transition-colors ${isMeasurable ? 'text-white' : 'tg-text opacity-50'}`}>Измеримая</button>
            </div>

            {isMeasurable && (
                <div className="flex gap-3 animate-in slide-in-from-top-2 fade-in">
                    <div className="flex-1 flex flex-col gap-1">
                        <label className="text-[9px] font-black tg-hint uppercase ml-2">Цель в день</label>
                        <input type="number" value={goal} onChange={e => setGoal(Number(e.target.value))} className="w-full bg-black/5 border border-white/5 rounded-2xl p-3 px-4 font-bold text-center outline-none tg-text focus:border-blue-500/30 transition-colors" />
                    </div>
                    <div className="w-1/3 flex flex-col gap-1">
                        <label className="text-[9px] font-black tg-hint uppercase ml-2">Ед. изм.</label>
                        <input type="text" placeholder="мл..." value={unit} onChange={e => setUnit(e.target.value)} className="w-full bg-black/5 border border-white/5 rounded-2xl p-3 px-4 font-bold text-center outline-none tg-text focus:border-blue-500/30 transition-colors" />
                    </div>
                </div>
            )}

            {/* --- ДНИ НЕДЕЛИ --- */}
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-end px-1">
                    <label className="text-[10px] font-black tg-hint uppercase">Дни выполнения</label>
                    <span className="text-[10px] font-bold text-[var(--tg-theme-button-color)] uppercase animate-pulse">{getFrequencyLabel()}</span>
                </div>
                <div className="flex justify-between gap-1 bg-black/5 p-2 rounded-2xl border border-white/5">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                        const isSelected = selectedDays.includes(d);
                        const labels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
                        return (
                            <button
                                key={d}
                                onClick={() => toggleDay(d)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${isSelected ? 'bg-white text-black shadow-lg scale-105' : 'text-gray-500 hover:bg-white/5'}`}
                            >
                                {labels[d]}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* --- БЛОК ОБЛОЖКИ --- */}
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center px-1">
                     <label className="text-[10px] font-black tg-hint uppercase">Обложка</label>
                     {fileData && <button onClick={() => setFileData('')} className="text-[9px] font-black text-red-500 uppercase hover:text-red-400">Удалить</button>}
                </div>
                {!fileData ? (
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="w-full py-3 rounded-2xl bg-black/5 border border-dashed border-gray-400/20 tg-text text-[10px] font-black uppercase tracking-widest hover:bg-black/10 transition-all flex items-center justify-center gap-2"
                    >
                       <span>📷</span> Загрузить фото
                    </button>
                ) : (
                    <div className="bg-black/5 p-4 rounded-[28px] border border-white/5 animate-in fade-in">
                        <div className="relative w-full h-32 rounded-2xl overflow-hidden bg-black/20 shadow-inner mb-4">
                           <img src={fileData} className="w-full h-full object-cover" style={{ objectPosition: `50% ${coverPosition}%` }} />
                           <div className="absolute inset-0 z-[1]" style={{ backgroundColor: `rgba(0,0,0,${coverIntensity/100})` }} />
                           <div className="absolute bottom-2 right-2 z-10 bg-black/50 px-2 py-1 rounded-lg backdrop-blur-md">
                              <span className="text-[8px] font-bold text-white uppercase">Превью</span>
                           </div>
                        </div>
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between px-1">
                                    <span className="text-[8px] font-black tg-hint uppercase">Позиция</span>
                                    <span className="text-[8px] font-bold tg-text">{coverPosition}%</span>
                                </div>
                                <input type="range" min="0" max="100" value={coverPosition} onChange={e => setCoverPosition(Number(e.target.value))} className="w-full h-1 bg-black/10 rounded-full appearance-none touch-none accent-blue-500" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between px-1">
                                    <span className="text-[8px] font-black tg-hint uppercase">Затемнение</span>
                                    <span className="text-[8px] font-bold tg-text">{coverIntensity}%</span>
                                </div>
                                <input type="range" min="0" max="100" value={coverIntensity} onChange={e => setCoverIntensity(Number(e.target.value))} className="w-full h-1 bg-black/10 rounded-full appearance-none touch-none accent-purple-500" />
                            </div>
                        </div>
                    </div>
                )}
                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>

            {/* --- МОТИВАЦИЯ --- */}
            <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black tg-hint uppercase ml-1">Мотивация</label>
                <textarea 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Зачем мне это нужно?"
                    rows={2}
                    className="w-full bg-black/5 border border-white/5 rounded-2xl p-4 text-xs font-medium tg-text outline-none resize-none placeholder:opacity-30 focus:border-blue-500/30 transition-colors"
                />
            </div>

            {/* --- СОХРАНИТЬ --- */}
            <button onClick={handleSave} className="w-full py-5 rounded-[28px] bg-[var(--tg-theme-button-color)] text-white font-black text-lg shadow-2xl active:scale-95 transition-all mt-2 uppercase tracking-widest hover:brightness-110">
                {initialHabit ? 'Сохранить' : 'Создать'}
            </button>

        </div>
        
        {isCustomEmoji && <div className="fixed inset-0 z-40" onClick={() => setIsCustomEmoji(false)} />}
      </div>
    </div>
  );
};
