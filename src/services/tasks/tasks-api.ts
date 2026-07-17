import { useMemo } from 'react';
import * as Notifications from 'expo-notifications';

import { useSession } from '@/services/auth/session-context';
import { getDb } from '@/services/notes/db';
import type { SaveTaskPayload, Task } from './types';

export async function getLocalReminder(taskId: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ reminderAt: string }>('SELECT reminderAt FROM task_reminders WHERE taskId = ?', [taskId]);
  return row?.reminderAt ?? null;
}

export async function setLocalReminder(taskId: string, date: Date, title: string): Promise<void> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const db = await getDb();
  const row = await db.getFirstAsync<{ notificationId: string }>('SELECT notificationId FROM task_reminders WHERE taskId = ?', [taskId]);
  if (row?.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(row.notificationId);
  }
  
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Task Reminder',
      body: title || 'You have a pending task to complete!',
    },
    trigger: date,
  });

  await db.runAsync('INSERT OR REPLACE INTO task_reminders (taskId, reminderAt, notificationId) VALUES (?, ?, ?)', [taskId, date.toISOString(), id]);
}

/** Tasks API bound to the authenticated session's auto-refreshing fetch. */
export function useTasksApi() {
  const { authFetch } = useSession();

  return useMemo(
    () => ({
      list: (search?: string) => {
        const params = new URLSearchParams();
        if (search?.trim()) {
          params.set('search', search.trim());
        }
        const query = params.toString();
        return authFetch<Task[]>(`/api/tasks${query ? `?${query}` : ''}`);
      },

      get: (id: string) => authFetch<Task>(`/api/tasks/${id}`),

      create: (payload: SaveTaskPayload) =>
        authFetch<Task>('/api/tasks', { method: 'POST', body: payload }),

      update: (id: string, payload: SaveTaskPayload) =>
        authFetch<Task>(`/api/tasks/${id}`, { method: 'PUT', body: payload }),

      remove: (id: string) => authFetch<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
    }),
    [authFetch],
  );
}
