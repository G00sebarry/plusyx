import React, { useState, useEffect, useRef } from 'react';
import { Habit } from '../types';
import { fetchTelegramLink } from '../api';

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (habit: Habit) => void;
  initialHabit?: Habit;
  userId?: string;
}

const TEMPLATES = [
  { title: 'Пить воду', emoji: '💧', color: 'bg-blue-500' },
  { title: 'Спорт', emoji: '🏃', color: 'bg-orange-500' },
  { title: 'Чтение', emoji: '📚', color: 'bg-purple-500' },
  { title: 'Медитация', emoji: '🧘', color: 'bg-teal-500' },
  { title: 'Витамины', emoji: '💊', color: 'bg-green-500' },
];

const COLORS = ['bg-slate-500', 'bg-red-500', 'bg-orange-500', 'bg-green-500', 'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500'];
const EMOJI_PRESETS = ['🔥', '💧', '🏃', '📚', '🧘', '💊', '💰', '🥗', '💤', '🧠', '🎸', '✈️'];

const IDENTITY_EXAMPLES = [
  { text: 'Спортсмен', emoji: '💪' },
  { text: 'Читатель', emoji: '📚' },
  { text: 'Продуктивный человек', emoji: '⚡' },
  { text: 'Здоровый человек', emoji: '🌱' },
];

const TRIGGER_EXAMPLES = [
  { text: 'После утреннего кофе', emoji: '☕' },
  { text: 'Когда сажусь за рабочий стол', emoji: '💻' },
  { text: 'Перед сном', emoji: '🌙' },
  { text: 'Когда прихожу домой', emoji: '🏠' },
];

const MINI_EXAMPLES = [
  { text: '2 отжимания', emoji: '💪' },
  { text: '1 страница книги', emoji: '📖' },
  { text: 'Стакан воды', emoji: '💧' },
  { text: '1 минута медитации', emoji: '🧘' },
];

// Компонент кнопки-примера (вынесен наружу для корректной работы с key)
interface ExampleButtonProps {
  text: string;
  emoji: string;
  onClick: () => void;
}

const ExampleButton: React.FC<ExampleButtonProps> = ({ text, emoji, onClick }) => (
  <button
    type="button"
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }}
    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-medium text-gray-300 hover:text-white transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
  >
    <span>{emoji}</span>
    <span>{text}</span>
  </button>
);

// Компонент подсказки (вынесен наружу для корректной работы)
interface TooltipProps {
  id: string;
  text: string;
  activeTooltip: string | null;
  setActiveTooltip: (id: string | null) => void;
}

const Tooltip: React.FC<TooltipProps> = ({ id, text, activeTooltip, setActiveTooltip }) => {
  const isActive = activeTooltip === id;
  
  return (
    <div className="relative inline-block ml-1.5">
      <button 
        type="button"
        onClick={(e) => { 
          e.preventDefault();
          e.stopPropagation(); 
          setActiveTooltip(isActive ? null : id); 
        }}
        className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 text-[11px] font-bold flex items-center justify-center hover:from-indigo-500/30 hover:to-purple-500/30 hover:text-indigo-300 transition-all hover:scale-110 active:scale-95"
      >
        ?
      </button>
      {isActive && (
        <>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={(e) => {
              e.stopPropagation();
              setActiveTooltip(null);
            }}
          />
          <div className="absolute bottom-7 left-1/2 -translate-x-1/2 w-64 p-4 bg-gradient-to-br from-indigo-900/95 to-purple-900/95 backdrop-blur-xl border border-indigo-500/30 rounded-2xl shadow-2xl shadow-indigo-500/20 animate-in zoom-in-95 fade-in duration-200 z-[9999]">
            <p className="text-[11px] text-indigo-100 leading-relaxed font-medium whitespace-pre-line">
              {text}
            </p>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gradient-to-br from-indigo-900 to-purple-900 rotate-45 border-r border-b border-indigo-500/30" />
          </div>
        </>
      )}
    </div>
  );
};

export const HabitModal: React.FC<HabitModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialHabit,
  userId
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('bg-blue-500');
  const [emoji, setEmoji] = useState('🔥');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [isCustomEmoji, setIsCustomEmoji] = useState(false);

  const [isAtomicMode, setIsAtomicMode] = useState(false);
  const [identity, setIdentity] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('');
  const [miniAction, setMiniAction] = useState('');
  
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('');
  
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [isCheckingLink, setIsCheckingLink] = useState(false);
  
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const [fileData, setFileData] = useState<string>('');
  const [coverPosition, setCoverPosition] = useState<number>(50);
  const [coverIntensity, setCoverIntensity] = useState<number>(60);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkTelegramLink = async () => {
      if (!userId) return;
      setIsCheckingLink(true);
      try {
        const link = await fetchTelegramLink(userId);
        if (link) {
          setTelegramLinked(true);
          setTelegramUsername(link.username);
        } else {
          setTelegramLinked(false);
          setTelegramUsername(null);
        }
      } catch (e) {
        console.error('Error checking telegram link:', e);
        setTelegramLinked(false);
      }
      setIsCheckingLink(false);
    };
    if (isOpen) checkTelegramLink();
  }, [isOpen, userId]);

  useEffect(() => {
    if (initialHabit) {
      setTitle(initialHabit.title);
      setDescription(initialHabit.description || '');
      setColor(initialHabit.color);
      setEmoji(initialHabit.emoji || '🔥');
      if (initialHabit.frequency && initialHabit.frequency.days) {
        setSelectedDays(initialHabit.frequency.days);
      } else {
        setSelectedDays([1, 2, 3, 4, 5, 6, 0]);
      }
      setFileData(initialHabit.fileData || '');
      setCoverPosition(initialHabit.coverPosition ?? 50);
      setCoverIntensity(initialHabit.coverIntensity ?? 60);
      setIdentity(initialHabit.identity || '');
      setTriggerEvent(initialHabit.triggerEvent || '');
      setMiniAction(initialHabit.miniAction || '');
      setReminderEnabled(initialHabit.reminderEnabled || false);
      setReminderTime(initialHabit.reminderTime || '');
      if (initialHabit.identity || initialHabit.triggerEvent || initialHabit.miniAction) {
        setIsAtomicMode(true);
      }
    } else {
      resetForm();
    }
  }, [initialHabit, isOpen]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setColor('bg-blue-500'); setEmoji('🔥');
    setSelectedDays([1, 2, 3, 4, 5, 6, 0]);
    setFileData(''); setCoverPosition(50); setCoverIntensity(60);
    setIdentity(''); setTriggerEvent(''); setMiniAction('');
    setReminderEnabled(false); setReminderTime('');
    setIsAtomicMode(false);
  };

  const handleTemplateClick = (t: typeof TEMPLATES[0]) => {
    setTitle(t.title); setEmoji(t.emoji); setColor(t.color);
  };

  const toggleDay = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      if (selectedDays.length > 1) setSelectedDays(prev => prev.filter(d => d !== dayIndex));
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
      id: initialHabit?.id || Math.random().toString(36).substr(2, 9),
      title,
      description,
      color,
      emoji,
      frequency: { type: isEveryDay ? 'daily' : 'specific', days: selectedDays },
      history: initialHabit?.history || {},
      fileData,
      coverPosition,
      coverIntensity,
      identity: isAtomicMode ? identity : '',
      triggerEvent: isAtomicMode ? triggerEvent : '',
      miniAction: isAtomicMode ? miniAction : '',
      reminderEnabled: reminderEnabled && !!reminderTime && telegramLinked,
      reminderTime: reminderTime || undefined,
      position: initialHabit?.position || 0
    };
    onSave(newHabit);
  };

  const getFrequencyLabel = () => {
    if (selectedDays.length === 7) return 'Каждый день';
    if (selectedDays.length === 5 && !selectedDays.includes(0) && !selectedDays.includes(6)) return 'По будням';
    return 'Выбранные дни';
  };

  const handleConnectTelegram = () => {
    const botUsername = 'plusyxbot';
    const startParam = userId;
    const url = `https://t.me/${botUsername}?start=${startParam}`;
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-lg tg-bg rounded-t-[32px] sm:rounded-[40px] shadow-2xl flex flex-col max-h-[92vh] animate-in slide-in-from-bottom duration-300 overflow-hidden">
        
        <div className="p-6 pb-2 shrink-0 relative z-20 bg-inherit">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-black tg-text tracking-tight uppercase">
              {initialHabit ? 'Настройка' : 'Новая привычка'}
            </h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-full text-gray-400 text-xl hover:text-white transition-colors">×</button>
          </div>

          <div className="flex bg-black/20 p-1 rounded-xl mb-4 border border-white/5">
            <button 
              type="button"
              onClick={() => setIsAtomicMode(false)} 
              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${!isAtomicMode ? 'bg-white text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              📋 Обычная
            </button>
            <button 
              type="button"
              onClick={() => setIsAtomicMode(true)} 
              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${isAtomicMode ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/30' : 'text-gray-400 hover:text-white'}`}
            >
              <span>⚛️</span> Атомная
            </button>
          </div>
          
          {!initialHabit && !isAtomicMode && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2">
              {TEMPLATES.map(t => (
                <button 
                  key={t.title} 
                  type="button"
                  onClick={() => handleTemplateClick(t)} 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 whitespace-nowrap active:scale-95 transition-all hover:bg-white/10 shrink-0"
                >
                  <span>{t.emoji}</span><span className="text-[10px] font-bold tg-text">{t.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-0 flex flex-col gap-6 no-scrollbar">

          <div className="flex gap-3">
            <div className="relative">
              <button 
                type="button"
                onClick={() => setIsCustomEmoji(!isCustomEmoji)} 
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg border-2 ${isCustomEmoji ? 'border-white' : 'border-transparent'} ${color} transition-all active:scale-95`}
              >
                {emoji}
              </button>
              {isCustomEmoji && (
                <div className="absolute top-16 left-0 bg-[#2c2c2e] p-3 rounded-2xl shadow-2xl border border-white/10 w-[280px] z-50 flex flex-col gap-3 animate-in fade-in zoom-in-95 origin-top-left" onClick={e => e.stopPropagation()}>
                  <div className="grid grid-cols-6 gap-2">
                    {EMOJI_PRESETS.map(e => (
                      <button 
                        key={e} 
                        type="button"
                        onClick={() => { setEmoji(e); setIsCustomEmoji(false); }} 
                        className="w-9 h-9 flex items-center justify-center text-xl bg-white/5 rounded-xl hover:bg-white/10"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center bg-black/20 p-2 rounded-xl">
                    <span className="text-[9px] font-bold text-gray-400 uppercase ml-1">Свой:</span>
                    <input 
                      type="text" 
                      maxLength={2} 
                      placeholder="😎" 
                      className="w-full bg-transparent outline-none text-center font-bold text-white text-lg" 
                      onChange={(e) => { if(e.target.value) setEmoji(e.target.value); }} 
                    />
                  </div>
                  <div className="flex justify-between gap-1 pt-2 border-t border-white/5">
                    {COLORS.map(c => (
                      <button 
                        key={c} 
                        type="button"
                        onClick={() => setColor(c)} 
                        className={`w-6 h-6 rounded-full ${c} ${color === c ? 'ring-2 ring-white scale-110' : ''}`} 
                      />
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
                placeholder="Название привычки..." 
                className="w-full bg-transparent outline-none font-bold tg-text text-lg placeholder:opacity-30" 
              />
            </div>
          </div>

          {isAtomicMode && (
            <div className="animate-in fade-in slide-in-from-top-2 flex flex-col gap-5">
              
              {/* Личность */}
              <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🎯</span>
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-indigo-300 uppercase flex items-center">
                      Кем ты хочешь стать?
                      <Tooltip 
                        id="identity" 
                        text="Не просто 'хочу бегать', а 'я — бегун'.

Привычки формируют личность. Каждое действие — это голос за тот тип человека, которым ты хочешь стать."
                        activeTooltip={activeTooltip}
                        setActiveTooltip={setActiveTooltip}
                      />
                    </label>
                  </div>
                </div>
                <input 
                  value={identity} 
                  onChange={e => setIdentity(e.target.value)} 
                  placeholder="Например: Спортсмен.." 
                  className="bg-black/20 border border-white/10 rounded-xl p-3 text-white font-medium placeholder:text-white/30 outline-none focus:border-indigo-500/50 transition-colors" 
                />
                <div className="flex gap-2 flex-wrap">
                  {IDENTITY_EXAMPLES.map((ex, index) => (
                    <ExampleButton 
                      key={`identity-${index}`}
                      text={ex.text}
                      emoji={ex.emoji}
                      onClick={() => setIdentity(ex.text)}
                    />
                  ))}
                </div>
              </div>

              {/* Триггер */}
              <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⚡</span>
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-blue-300 uppercase flex items-center">
                      Когда ты будешь это делать?
                      <Tooltip 
                        id="trigger" 
                        text="Привяжи привычку к конкретному моменту дня.

'После утреннего кофе' работает лучше, чем 'утром'. Чем точнее триггер — тем выше вероятность выполнения."
                        activeTooltip={activeTooltip}
                        setActiveTooltip={setActiveTooltip}
                      />
                    </label>
                  </div>
                </div>
                <input 
                  value={triggerEvent} 
                  onChange={e => setTriggerEvent(e.target.value)} 
                  placeholder="После того как..." 
                  className="bg-black/20 border border-white/10 rounded-xl p-3 text-white font-medium placeholder:text-white/30 outline-none focus:border-blue-500/50 transition-colors" 
                />
                <div className="flex gap-2 flex-wrap">
                  {TRIGGER_EXAMPLES.map((ex, index) => (
                    <ExampleButton 
                      key={`trigger-${index}`}
                      text={ex.text}
                      emoji={ex.emoji}
                      onClick={() => setTriggerEvent(ex.text)}
                    />
                  ))}
                </div>
              </div>

              {/* Мини-действие */}
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🍃</span>
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-amber-300 uppercase flex items-center">
                      Самая простая версия
                      <Tooltip 
                        id="mini" 
                        text="В плохой день? Сделай хотя бы минимум.

2 отжимания, 1 страница книги — это сохранит привычку живой. Главное правило: действие должно быть слишком простым, чтобы НЕ сделать его."
                        activeTooltip={activeTooltip}
                        setActiveTooltip={setActiveTooltip}
                      />
                    </label>
                  </div>
                </div>
                <input 
                  value={miniAction} 
                  onChange={e => setMiniAction(e.target.value)} 
                  placeholder="Хотя бы..." 
                  className="bg-black/20 border border-white/10 rounded-xl p-3 text-white font-medium placeholder:text-white/30 outline-none focus:border-amber-500/50 transition-colors" 
                />
                <div className="flex gap-2 flex-wrap">
                  {MINI_EXAMPLES.map((ex, index) => (
                    <ExampleButton 
                      key={`mini-${index}`}
                      text={ex.text}
                      emoji={ex.emoji}
                      onClick={() => setMiniAction(ex.text)}
                    />
                  ))}
                </div>
              </div>

            </div>
          )}

          <div className="flex flex-col gap-3 p-4 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔔</span>
                <div>
                  <span className="text-[11px] font-black tg-text uppercase">Напоминание</span>
                  <p className="text-[9px] text-gray-400">Пришлём в Telegram</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setReminderEnabled(!reminderEnabled)}
                className={`relative w-12 h-7 rounded-full transition-all duration-300 ${reminderEnabled ? 'bg-green-500' : 'bg-white/10'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${reminderEnabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            
            {reminderEnabled && (
              <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                {isCheckingLink ? (
                  <div className="flex items-center gap-2 p-3 bg-black/20 rounded-xl">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] text-gray-400">Проверяем Telegram...</span>
                  </div>
                ) : telegramLinked ? (
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <span className="text-lg">✅</span>
                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-green-400">Telegram подключён</span>
                      {telegramUsername && <p className="text-[9px] text-green-300/60">@{telegramUsername}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚠️</span>
                      <span className="text-[10px] font-bold text-yellow-400">Telegram не подключён</span>
                    </div>
                    <p className="text-[9px] text-yellow-300/60 leading-relaxed">Чтобы получать напоминания, подключи свой Telegram</p>
                    <button 
                      type="button"
                      onClick={handleConnectTelegram}
                      className="w-full py-3 bg-[#0088cc] hover:bg-[#0099dd] text-white rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-blue-500/20"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                      Подключить Telegram
                    </button>
                    <p className="text-[8px] text-gray-500 text-center">Откроется бот — нажми Start и готово!</p>
                  </div>
                )}
                
{telegramLinked && (
  <div className="flex items-center gap-3">
    <span className="text-[10px] font-bold text-gray-400">⏰ Время:</span>
    <input 
      type="time" 
      value={reminderTime} 
      onChange={e => setReminderTime(e.target.value)} 
      className="flex-1 bg-black/20 text-white text-sm font-bold rounded-xl px-4 py-2 outline-none border border-white/10 focus:border-blue-500 transition-colors"
    />
  </div>
)}
                      {telegramLinked && !reminderTime && (
              <p className="text-[9px] text-yellow-500 font-medium">⚠️ Укажи время для напоминания</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-end px-1">
          <label className="text-[10px] font-black tg-hint uppercase">График</label>
          <span className="text-[10px] font-bold text-[var(--tg-theme-button-color)] uppercase">{getFrequencyLabel()}</span>
        </div>
        <div className="flex justify-between gap-1 bg-black/5 p-2 rounded-2xl border border-white/5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const labels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
            return (
              <button 
                key={d} 
                type="button"
                onClick={() => toggleDay(d)} 
                className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${selectedDays.includes(d) ? 'bg-white text-black shadow-lg scale-105' : 'text-gray-500 hover:bg-white/5'}`}
              >
                {labels[d]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center px-1">
          <label className="text-[10px] font-black tg-hint uppercase">Обложка</label>
          {fileData && <button type="button" onClick={() => setFileData('')} className="text-[9px] font-black text-red-500 uppercase">Удалить</button>}
        </div>
        {!fileData ? (
          <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-3 rounded-2xl bg-black/5 border border-dashed border-gray-400/20 tg-text text-[10px] font-black uppercase tracking-widest hover:bg-black/10 transition-all flex items-center justify-center gap-2">
            <span>📷</span> Загрузить фото
          </button>
        ) : (
          <div className="bg-black/5 p-4 rounded-[28px] border border-white/5 animate-in fade-in">
            <div className="relative w-full h-32 rounded-2xl overflow-hidden bg-black/20 shadow-inner mb-4">
              <img src={fileData} alt="Cover" className="w-full h-full object-cover" style={{ objectPosition: `50% ${coverPosition}%` }} />
              <div className="absolute inset-0 z-[1]" style={{ backgroundColor: `rgba(0,0,0,${coverIntensity/100})` }} />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[8px] font-black tg-hint uppercase px-1">Позиция</span>
                <input type="range" min="0" max="100" value={coverPosition} onChange={e => setCoverPosition(Number(e.target.value))} className="w-full h-1 bg-black/10 rounded-full appearance-none accent-blue-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[8px] font-black tg-hint uppercase px-1">Затемнение</span>
                <input type="range" min="0" max="100" value={coverIntensity} onChange={e => setCoverIntensity(Number(e.target.value))} className="w-full h-1 bg-black/10 rounded-full appearance-none accent-purple-500" />
              </div>
            </div>
          </div>
        )}
        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="hidden" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black tg-hint uppercase ml-1">Описание / Мотивация</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Зачем мне это нужно?" rows={2} className="w-full bg-black/5 border border-white/5 rounded-2xl p-4 text-xs font-medium tg-text outline-none resize-none placeholder:opacity-30 focus:border-blue-500/30 transition-colors" />
      </div>

      <button type="button" onClick={handleSave} className="w-full py-5 rounded-[28px] bg-[var(--tg-theme-button-color)] text-white font-black text-lg shadow-2xl active:scale-95 transition-all mt-2 uppercase tracking-widest hover:brightness-110">
        {initialHabit ? 'Сохранить' : 'Создать'}
      </button>
    </div>
    
    {isCustomEmoji && <div className="fixed inset-0 z-40" onClick={() => setIsCustomEmoji(false)} />}
  </div>
</div>
);
};