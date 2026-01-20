import React, { useState, useEffect } from 'react';
import { Habit } from '../types';

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (habit: Habit) => void;
  initialHabit?: Habit;
}

const COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 
  'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 
  'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500', 
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 
  'bg-pink-500', 'bg-rose-500'
];

const EMOJIS = ['🔥', '💧', '🏃', '🧘', '📚', '💊', '🥗', '🧠', '💰', '🎸', '🎨', '🧹', '🚬', '🚫'];

const DAYS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

export const HabitModal: React.FC<HabitModalProps> = ({ isOpen, onClose, onSave, initialHabit }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  
  // Атомные поля
  const [identity, setIdentity] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('');
  const [miniAction, setMiniAction] = useState('');
  const [reminderTime, setReminderTime] = useState('');

  const [frequencyType, setFrequencyType] = useState<'daily' | 'specific' | 'flexible'>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  
  const [isMeasurable, setIsMeasurable] = useState(false);
  const [targetValue, setTargetValue] = useState<string>('1');
  const [unit, setUnit] = useState('');
  
  // Для управления подсказками (Tooltip)
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Загрузка данных при открытии (Редактирование)
  useEffect(() => {
    if (initialHabit) {
      setTitle(initialHabit.title);
      setDescription(initialHabit.description || '');
      setColor(initialHabit.color);
      setEmoji(initialHabit.emoji || '🔥');
      setFrequencyType(initialHabit.frequency.type);
      setSelectedDays(initialHabit.frequency.days);
      setIsMeasurable(initialHabit.isMeasurable);
      setTargetValue(String(initialHabit.targetValue || 1));
      setUnit(initialHabit.unit || '');
      
      // Новые поля
      setIdentity(initialHabit.identity || '');
      setTriggerEvent(initialHabit.triggerEvent || '');
      setMiniAction(initialHabit.miniAction || '');
      setReminderTime(initialHabit.reminderTime || '');
    } else {
      resetForm();
    }
  }, [initialHabit, isOpen]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setColor(COLORS[3]);
    setEmoji('🔥');
    setFrequencyType('daily');
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    setIsMeasurable(false);
    setTargetValue('1');
    setUnit('');
    setIdentity('');
    setTriggerEvent('');
    setMiniAction('');
    setReminderTime('');
  };

  const handleSave = () => {
    if (!title.trim()) {
        alert('Назови привычку!');
        return;
    }

    const newHabit: any = { // Используем any временно для удобства сборки, типы проверятся снаружи
      id: initialHabit?.id || '',
      title,
      description,
      color,
      emoji,
      frequency: {
        type: frequencyType,
        days: frequencyType === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : selectedDays
      },
      isMeasurable,
      targetValue: Number(targetValue),
      unit,
      history: initialHabit?.history || {},
      
      // Новые поля
      identity,
      triggerEvent,
      miniAction,
      reminderTime,
      
      // Сохраняем старые поля (файлы, позиции), если это редактирование
      position: initialHabit?.position || 0,
      fileData: initialHabit?.fileData,
      coverPosition: initialHabit?.coverPosition,
      coverIntensity: initialHabit?.coverIntensity
    };

    onSave(newHabit);
    onClose();
  };

  const toggleDay = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter(d => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex]);
    }
  };

  // Компонент подсказки
  const InfoIcon = ({ id, text }: { id: string, text: string }) => (
    <div className="relative inline-block ml-1">
        <button 
            onClick={() => setActiveTooltip(activeTooltip === id ? null : id)}
            className="w-4 h-4 rounded-full bg-white/10 text-white/50 text-[10px] font-bold flex items-center justify-center hover:bg-white/20 hover:text-white transition-all"
        >
            ?
        </button>
        {activeTooltip === id && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-48 p-3 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl z-50 animate-in zoom-in-95 duration-200">
                <p className="text-[10px] text-gray-300 leading-relaxed text-center">{text}</p>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/90 rotate-45 border-r border-b border-white/10" />
            </div>
        )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full sm:max-w-md h-[92vh] sm:h-auto bg-[#1c1c1e] sm:rounded-[40px] rounded-t-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300 border border-white/10">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-[#1c1c1e]/50 backdrop-blur-md z-10">
          <h2 className="text-sm font-black text-white uppercase tracking-widest">
            {initialHabit ? 'Редактировать' : 'Новая привычка'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-all">✕</button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar" onClick={() => setActiveTooltip(null)}>
            
            {/* 1. БЛОК ЛИЧНОСТИ (IDENTITY) */}
            <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center">
                    Шаг 1: Кто ты? 
                    <InfoIcon id="identity" text="Цель — не просто пробежать марафон, а стать бегуном. Напиши личность, которую ты строишь (например: Атлет, Читатель)." />
                </label>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 focus-within:border-blue-500/50 transition-colors">
                    <span className="text-gray-400 text-sm mr-2">Я стану</span>
                    <input 
                        type="text" 
                        value={identity} 
                        onChange={e => setIdentity(e.target.value)} 
                        placeholder="Здоровым человеком..." 
                        className="bg-transparent text-white font-bold outline-none placeholder:text-gray-600 w-full mt-1"
                    />
                </div>
            </div>

            {/* 2. БЛОК ДЕЙСТВИЯ (HABIT) */}
            <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Шаг 2: Что делаем?</label>
                <div className="flex gap-3">
                    <div className="w-14 h-14 shrink-0 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl relative overflow-hidden group">
                        <select 
                            value={emoji} 
                            onChange={e => setEmoji(e.target.value)} 
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        >
                            {EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                        {emoji}
                    </div>
                    <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5 focus-within:border-blue-500/50 transition-colors">
                        <input 
                            type="text" 
                            value={title} 
                            onChange={e => setTitle(e.target.value)} 
                            placeholder="Название (напр. Бег)" 
                            className="bg-transparent text-white font-black text-lg outline-none placeholder:text-gray-600 w-full"
                        />
                    </div>
                </div>

                {/* Измеримость */}
                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={isMeasurable} onChange={e => setIsMeasurable(e.target.checked)} className="accent-blue-500 w-4 h-4 rounded-md" />
                        <span className="text-xs font-bold text-gray-300">Считать цифры?</span>
                    </label>
                    {isMeasurable && (
                        <div className="flex gap-2 flex-1 animate-in fade-in slide-in-from-left-2">
                            <input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)} className="w-16 bg-black/20 rounded-lg px-2 py-1 text-white text-center text-xs font-bold outline-none border border-white/10 focus:border-blue-500" placeholder="Сколько" />
                            <input type="text" value={unit} onChange={e => setUnit(e.target.value)} className="flex-1 bg-black/20 rounded-lg px-2 py-1 text-white text-xs font-bold outline-none border border-white/10 focus:border-blue-500" placeholder="Ед. (мл, стр)" />
                        </div>
                    )}
                </div>
            </div>

            {/* 3. БЛОК КОНТЕКСТА (TRIGGER) */}
            <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center">
                    Шаг 3: Когда?
                    <InfoIcon id="trigger" text="Привяжи привычку к событию, которое уже происходит. Это создает мощный рефлекс." />
                </label>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
                    {/* Человеческий триггер */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-blue-400 uppercase">Триггер (Контекст)</span>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-sm">После того как я</span>
                            <input 
                                type="text" 
                                value={triggerEvent} 
                                onChange={e => setTriggerEvent(e.target.value)} 
                                placeholder="налью кофе..." 
                                className="bg-transparent text-white border-b border-white/20 focus:border-blue-500 outline-none w-full py-1 text-sm font-bold"
                            />
                        </div>
                    </div>

                    {/* Техническое время */}
                    <div className="flex flex-col gap-1 pt-2 border-t border-white/5">
                        <span className="text-[10px] font-bold text-gray-500 uppercase flex justify-between">
                            Время для напоминания
                            <span className="text-[8px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400">Техническое</span>
                        </span>
                        <input 
                            type="time" 
                            value={reminderTime} 
                            onChange={e => setReminderTime(e.target.value)} 
                            className="bg-black/20 text-white rounded-lg p-2 text-sm font-bold outline-none border border-white/10 w-full"
                        />
                    </div>
                </div>

                {/* Частота */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    <button onClick={() => setFrequencyType('daily')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border transition-all ${frequencyType === 'daily' ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-400 border-transparent'}`}>Каждый день</button>
                    <button onClick={() => setFrequencyType('specific')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border transition-all ${frequencyType === 'specific' ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-400 border-transparent'}`}>Дни недели</button>
                </div>
                {frequencyType === 'specific' && (
                    <div className="flex justify-between gap-1 animate-in slide-in-from-top-2">
                        {DAYS.map((d, i) => (
                            <button 
                                key={d} 
                                onClick={() => toggleDay(i)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-black transition-all ${selectedDays.includes(i) ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* 4. БЛОК ПЛАН "Б" (MINI ACTION) */}
            <div className="space-y-3 pb-8">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center">
                    Шаг 4: Если лень?
                    <InfoIcon id="mini" text="Правило 2 минут. Если совсем нет сил, сделай это действие, чтобы не разорвать цепочку дней." />
                </label>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 focus-within:border-yellow-500/50 transition-colors">
                    <span className="text-gray-400 text-sm block mb-1">Я сделаю хотя бы...</span>
                    <input 
                        type="text" 
                        value={miniAction} 
                        onChange={e => setMiniAction(e.target.value)} 
                        placeholder="2 отжимания / 1 страницу" 
                        className="bg-transparent text-yellow-500 font-bold outline-none placeholder:text-gray-600/50 w-full"
                    />
                </div>
            </div>

            {/* Выбор цвета */}
            <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Цвет карточки</label>
                <div className="flex flex-wrap gap-3">
                    {COLORS.map(c => (
                        <button 
                            key={c} 
                            onClick={() => setColor(c)} 
                            className={`w-6 h-6 rounded-full transition-transform ${c} ${color === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-black' : 'opacity-50 hover:opacity-100'}`} 
                        />
                    ))}
                </div>
            </div>

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/5 bg-[#1c1c1e]/80 backdrop-blur-md z-20">
            <button 
                onClick={handleSave}
                className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-gray-200 active:scale-95 transition-all"
            >
                {initialHabit ? 'Сохранить изменения' : 'Создать привычку'}
            </button>
        </div>

      </div>
    </div>
  );
};
