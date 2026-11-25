/// <reference types="vite/client" />
import React, { useCallback, useEffect, useRef } from 'react';
import type { Habit, Task } from '../types';
import './matrix-shell.css';
import { matrixCloudEnabled } from './matrixTestMode';
import { supabase } from '../supabaseClient';

export const matrixPreviewEnabled = import.meta.env.DEV || matrixCloudEnabled;

interface MatrixPreviewProps {
  backstage: boolean;
  userId: string;
  tasks: Task[];
  habits: Habit[];
  onOpenTask: (task: Task) => void;
  onOpenHabit: (habit: Habit) => void;
}

export function MatrixPreview({ backstage, userId, tasks, habits, onOpenTask, onOpenHabit }: MatrixPreviewProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const attachFrame = useCallback((node: HTMLIFrameElement | null) => {
    frame.current = node;
    if (!node || !matrixCloudEnabled) return;
    const table = () => supabase.from('life_matrices');
    Object.assign(node, { matrixStore: {
      async load() {
        const { data, error } = await table().select('snapshot,revision').eq('owner_id', userId).maybeSingle();
        if (error) throw error;
        return data;
      },
      async save(snapshot: unknown, revision: number) {
        const next = { snapshot, revision: revision + 1 };
        const query = revision === 0
          ? table().insert({ ...next, owner_id: userId })
          : table().update(next).eq('owner_id', userId).eq('revision', revision);
        const { data, error } = await query.select('revision').maybeSingle();
        if (error && error.code !== '23505') throw error;
        if (!data) throw new Error('matrix-conflict');
        return data.revision;
      }
    } });
  }, [userId]);
  const publish = useCallback(() => {
    frame.current?.contentWindow?.postMessage({
      type: 'plusyx:board', account: userId,
      tasks: tasks.filter(task => !task.archivedAt).map(task => ({
        id: task.id, title: task.title, status: task.status, date: task.date,
        cover: task.coverData || task.fileData, coverPosition: task.coverPosition, coverIntensity: task.coverIntensity
      })),
      habits: habits.filter(habit => !habit.archivedAt).map(habit => ({
        id: habit.id, title: habit.title, cover: habit.fileData,
        coverPosition: habit.coverPosition, coverIntensity: habit.coverIntensity
      }))
    }, window.location.origin);
  }, [userId,tasks,habits]);
  useEffect(publish, [publish]);
  useEffect(() => {
    const openLinkedCard = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const message = event.data;
      if (message?.type !== 'plusyx:open-card' || message.account !== userId) return;
      if (message.kind === 'task') {
        const task = tasks.find(item => item.id === message.id && !item.archivedAt);
        if (task) onOpenTask(task);
      } else if (message.kind === 'habit') {
        const habit = habits.find(item => item.id === message.id && !item.archivedAt);
        if (habit) onOpenHabit(habit);
      }
    };
    window.addEventListener('message', openLinkedCard);
    return () => window.removeEventListener('message', openLinkedCard);
  }, [userId, tasks, habits, onOpenTask, onOpenHabit]);
  return <iframe
    key={userId} ref={attachFrame} onLoad={publish}
    title="Матрица 9×9"
    src={'/prototypes/life-matrix/index.html?account=' + encodeURIComponent(userId) + (matrixCloudEnabled ? '&cloud=account' : '')}
    aria-hidden={backstage || undefined}
    className="block w-full flex-1 min-h-0 border-0 rounded-2xl"
    style={{ colorScheme: 'dark', background: 'transparent' }}
  />;
}
