import { useMemo } from 'react';

import { useSession } from '@/services/auth/session-context';

import type { SaveTaskPayload, Task } from './types';

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
