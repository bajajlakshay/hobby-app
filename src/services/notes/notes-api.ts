import { useMemo } from 'react';

import { useSession } from '@/services/auth/session-context';

import type { Note, NoteView, SaveNotePayload } from './types';

/** Notes API bound to the authenticated session's auto-refreshing fetch. */
export function useNotesApi() {
  const { authFetch } = useSession();

  return useMemo(
    () => ({
      list: (view: NoteView = 'Active', search?: string) => {
        const params = new URLSearchParams({ view });
        if (search?.trim()) {
          params.set('search', search.trim());
        }
        return authFetch<Note[]>(`/api/notes?${params.toString()}`);
      },

      get: (id: string) => authFetch<Note>(`/api/notes/${id}`),

      create: (payload: SaveNotePayload) =>
        authFetch<Note>('/api/notes', { method: 'POST', body: payload }),

      update: (id: string, payload: SaveNotePayload) =>
        authFetch<Note>(`/api/notes/${id}`, { method: 'PUT', body: payload }),

      setPinned: (id: string, isPinned: boolean) =>
        authFetch<Note>(`/api/notes/${id}/pinned`, { method: 'PUT', body: isPinned }),

      setArchived: (id: string, isArchived: boolean) =>
        authFetch<Note>(`/api/notes/${id}/archived`, { method: 'PUT', body: isArchived }),

      trash: (id: string) => authFetch<void>(`/api/notes/${id}/trash`, { method: 'POST' }),

      restore: (id: string) => authFetch<Note>(`/api/notes/${id}/restore`, { method: 'POST' }),

      remove: (id: string) => authFetch<void>(`/api/notes/${id}`, { method: 'DELETE' }),
    }),
    [authFetch],
  );
}
