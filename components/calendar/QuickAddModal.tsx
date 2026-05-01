import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Column } from '../../types';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, columnId: string, date: string, time?: string) => void;
  columns: Column[];
  date: string;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  columns,
  date,
}) => {
  const [title, setTitle] = useState('');
  const [columnId, setColumnId] = useState(columns[0]?.id || '');
  const [time, setTime] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setTime('');
      setColumnId(columns[0]?.id || '');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, columns]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit(title.trim(), columnId, date, time || undefined);
    onClose();
  };

  const formattedDate = (() => {
    const d = new Date(date);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  })();

  return createPortal(
    <div className="fixed inset-0 z-[450] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={modalRef}
        className="relative tg-bg rounded-[28px] shadow-2xl border border-gray-400/10 w-full max-w-sm p-5 flex flex-col gap-4 animate-in zoom-in-95 fade-in duration-200"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📝</span>
            <h3 className="text-sm font-black tg-text uppercase tracking-tight">Быстрая задача</h3>
          </div>
          <span className="text-[10px] font-bold tg-hint bg-blue-500/10 text-blue-500 px-2 py-1 rounded-lg">
            {formattedDate}
          </span>
        </div>

        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Название задачи..."
          className="w-full bg-black/5 tg-text rounded-2xl px-4 py-3 text-sm font-bold outline-none border border-gray-400/10 focus:border-blue-500/50 transition-colors placeholder:opacity-30"
        />

        <div className="flex gap-2">
          <div className="flex-1 flex flex-col gap-1">
            <span className="text-[8px] font-black tg-hint uppercase px-1">Колонка</span>
            <select
              value={columnId}
              onChange={(e) => setColumnId(e.target.value)}
              className="w-full bg-black/5 tg-text rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none border border-gray-400/10 appearance-none"
            >
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.title}
                </option>
              ))}
            </select>
          </div>
          <div className="w-28 flex flex-col gap-1">
            <span className="text-[8px] font-black tg-hint uppercase px-1">Время</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-black/5 tg-text rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none border border-gray-400/10"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl tg-secondary-bg tg-text text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="flex-1 py-3 rounded-2xl bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-30 shadow-lg shadow-blue-500/20"
          >
            Создать
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
