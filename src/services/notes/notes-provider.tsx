import { useNetworkState } from 'expo-network';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { useSession } from '@/services/auth/session-context';

import {
  createLocal,
  deleteOtherUsers,
  emptyTrashLocal,
  getLocal,
  listLocal,
  pendingCount,
  removeLocal,
  restoreLocal,
  setArchivedLocal,
  setPinnedLocal,
  trashLocal,
  updateLocal,
} from './local-store';
import { syncNow } from './sync';
import type { Note, NoteView, SaveNotePayload } from './types';

/**
 * Offline-first notes API. Every read and write hits the on-device SQLite store
 * first (so the app works with no connectivity), while a background sync engine
 * reconciles with the server whenever it's reachable.
 */
export interface NotesContextValue {
  list: (view?: NoteView, search?: string) => Promise<Note[]>;
  get: (id: string) => Promise<Note>;
  create: (payload: SaveNotePayload) => Promise<Note>;
  update: (id: string, payload: SaveNotePayload) => Promise<Note>;
  setPinned: (id: string, isPinned: boolean) => Promise<Note>;
  setArchived: (id: string, isArchived: boolean) => Promise<Note>;
  trash: (id: string) => Promise<void>;
  restore: (id: string) => Promise<Note>;
  remove: (id: string) => Promise<void>;
  /** Permanently deletes everything in the trash. */
  emptyTrash: () => Promise<void>;
  /** Forces a push+pull now (e.g. pull-to-refresh). */
  sync: () => Promise<void>;
  /** Whether the device currently has a usable connection. */
  isOnline: boolean;
  /** Whether a sync is in flight. */
  isSyncing: boolean;
  /** Number of notes with changes not yet pushed to the server. */
  pendingCount: number;
  /** Bumps whenever local data may have changed; lets lists know to reload. */
  dataVersion: number;
}

const NotesContext = createContext<NotesContextValue | null>(null);

export function useNotes(): NotesContextValue {
  const value = use(NotesContext);
  if (!value) {
    throw new Error('useNotes must be used within a <NotesProvider />');
  }
  return value;
}

export function NotesProvider({ children }: PropsWithChildren) {
  const { user, authFetch } = useSession();
  const userId = user?.userId ?? null;

  const net = useNetworkState();
  // Treat "unknown" (undefined) as online — be optimistic and let requests fail
  // naturally if the network is actually down.
  const isOnline = net.isConnected !== false && net.isInternetReachable !== false;

  const [isSyncing, setIsSyncing] = useState(false);
  const [pending, setPending] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);

  const isOnlineRef = useRef(isOnline);
  const syncingRef = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bumpVersion = useCallback(() => setDataVersion((v) => v + 1), []);

  const refreshPending = useCallback(async (uid: string) => {
    try {
      setPending(await pendingCount(uid));
    } catch {
      // Non-fatal; the count is only cosmetic.
    }
  }, []);

  const runSync = useCallback(async () => {
    if (!userId || !isOnlineRef.current || syncingRef.current) {
      return;
    }
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      await syncNow(userId, authFetch);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      await refreshPending(userId);
      bumpVersion();
    }
  }, [userId, authFetch, refreshPending, bumpVersion]);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
    }
    syncTimer.current = setTimeout(() => void runSync(), 600);
  }, [runSync]);

  // After a local write: refresh the badge, reload visible lists, kick off a sync.
  const afterMutation = useCallback(() => {
    if (userId) {
      void refreshPending(userId);
    }
    bumpVersion();
    scheduleSync();
  }, [userId, refreshPending, bumpVersion, scheduleSync]);

  // Bootstrap when the signed-in user changes: drop any other account's cached
  // notes, then do an initial sync to pull this account's notes.
  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
    (async () => {
      await deleteOtherUsers(userId);
      if (!active) {
        return;
      }
      await refreshPending(userId);
      bumpVersion();
      void runSync();
    })();
    return () => {
      active = false;
    };
  }, [userId, refreshPending, bumpVersion, runSync]);

  // Sync as soon as connectivity is (re)gained.
  useEffect(() => {
    if (isOnline && !isOnlineRef.current) {
      void runSync();
    }
    isOnlineRef.current = isOnline;
  }, [isOnline, runSync]);

  const value = useMemo<NotesContextValue>(() => {
    const uid = userId;
    return {
      list: (view: NoteView = 'Active', search?: string) =>
        uid ? listLocal(uid, view, search) : Promise.resolve([]),
      get: async (id: string) => {
        const note = uid ? await getLocal(uid, id) : null;
        if (!note) {
          throw new Error('Note not found');
        }
        return note;
      },
      create: async (payload: SaveNotePayload) => {
        const note = await createLocal(uid!, payload);
        afterMutation();
        return note;
      },
      update: async (id: string, payload: SaveNotePayload) => {
        const note = await updateLocal(uid!, id, payload);
        afterMutation();
        return note!;
      },
      setPinned: async (id: string, isPinned: boolean) => {
        const note = await setPinnedLocal(uid!, id, isPinned);
        afterMutation();
        return note!;
      },
      setArchived: async (id: string, isArchived: boolean) => {
        const note = await setArchivedLocal(uid!, id, isArchived);
        afterMutation();
        return note!;
      },
      trash: async (id: string) => {
        await trashLocal(uid!, id);
        afterMutation();
      },
      restore: async (id: string) => {
        const note = await restoreLocal(uid!, id);
        afterMutation();
        return note!;
      },
      remove: async (id: string) => {
        await removeLocal(uid!, id);
        afterMutation();
      },
      emptyTrash: async () => {
        await emptyTrashLocal(uid!);
        afterMutation();
      },
      sync: runSync,
      isOnline,
      isSyncing,
      pendingCount: pending,
      // Fold status into the identity so consumers (lists) re-read after a sync.
      dataVersion,
    };
  }, [userId, afterMutation, runSync, isOnline, isSyncing, pending, dataVersion]);

  return <NotesContext value={value}>{children}</NotesContext>;
}
