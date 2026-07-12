import { useNotes } from './notes-provider';

/**
 * Notes API used by the screens. Backed by the offline-first local store and
 * background sync engine (see {@link ./notes-provider}), so reads and writes
 * work with no connectivity and reconcile with the server when it's reachable.
 *
 * Exposes the same CRUD method names as before, plus sync status
 * (`isOnline`, `isSyncing`, `pendingCount`).
 */
export function useNotesApi() {
  return useNotes();
}
