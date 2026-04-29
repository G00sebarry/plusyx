import React, { useEffect, useRef } from 'react';

interface HabitContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onSelect: (status: 'full' | 'mini' | 'freeze' | 'reset') => void;
}

export const HabitContextMenu: React.FC<HabitContextMenuProps> = ({ x, y, onClose, onSelect }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[500] w-40 bg-[#1c1c1e] rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      style={{
        top: Math.min(y, window.innerHeight - 220),
        left: Math.min(x, window.innerWidth - 170),
      }}
    >
      <button
        onClick={() => onSelect('full')}
        className="p-3 text-left hover:bg-white/5 flex items-center gap-2 text-[10px] font-bold text-white"
      >
        <div className="w-3 h-3 rounded-full bg-green-500" /> Выполнено
      </button>
      <button
        onClick={() => onSelect('mini')}
        className="p-3 text-left hover:bg-white/5 flex items-center gap-2 text-[10px] font-bold text-white"
      >
        <div className="w-3 h-3 rounded-full border-2 border-yellow-500" /> Мини-версия
      </button>
      <button
        onClick={() => onSelect('freeze')}
        className="p-3 text-left hover:bg-white/5 flex items-center gap-2 text-[10px] font-bold text-white"
      >
        <span className="text-sm">❄️</span> Заморозка
      </button>
      <div className="h-[1px] bg-white/10 mx-2" />
      <button
        onClick={() => onSelect('reset')}
        className="p-3 text-left hover:bg-white/5 flex items-center gap-2 text-[10px] font-bold text-red-500"
      >
        Сбросить
      </button>
    </div>
  );
};
