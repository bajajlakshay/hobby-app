import * as SQLite from 'expo-sqlite';

/**
 * On-device SQLite database backing the offline-first notes store.
 *
 * The `notes` table is the source of truth the UI reads from. Every column
 * mirrors the server's note plus a set of sync-tracking flags used by the
 * {@link ./sync} engine to reconcile local changes with the backend:
 *
 * - `id`         Stable local primary key (a client-generated UUID). Used by the
 *                router and every screen; never changes once assigned.
 * - `remoteId`   The server's GUID for this note, learned on the first successful
 *                push. NULL until then (i.e. a note created while offline).
 * - `pendingCreate`  Note has never been created on the server yet (needs POST).
 * - `contentDirty`   Title/content/plainText/color changed since last push (PUT).
 * - `pinnedDirty` / `archivedDirty` / `trashedDirty`  The matching flag changed
 *                and must be replayed against its dedicated endpoint.
 * - `pendingDelete`  Note was permanently deleted locally (needs DELETE, then the
 *                row is removed).
 * - `updatedAtLocal` Epoch ms of the last local edit, used for list ordering.
 */

const DB_NAME = 'hobbyapp-notes.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Opens (once) and initializes the notes database, returning the shared handle. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndInit();
  }
  return dbPromise;
}

async function openAndInit(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS notes (
      id             TEXT PRIMARY KEY NOT NULL,
      userId         TEXT NOT NULL,
      remoteId       TEXT,
      title          TEXT NOT NULL DEFAULT '',
      content        TEXT NOT NULL DEFAULT '',
      plainText      TEXT NOT NULL DEFAULT '',
      color          TEXT,
      isPinned       INTEGER NOT NULL DEFAULT 0,
      isArchived     INTEGER NOT NULL DEFAULT 0,
      isTrashed      INTEGER NOT NULL DEFAULT 0,
      createdAt      TEXT NOT NULL,
      updatedAt      TEXT,
      updatedAtLocal INTEGER NOT NULL DEFAULT 0,
      pendingCreate  INTEGER NOT NULL DEFAULT 0,
      contentDirty   INTEGER NOT NULL DEFAULT 0,
      pinnedDirty    INTEGER NOT NULL DEFAULT 0,
      archivedDirty  INTEGER NOT NULL DEFAULT 0,
      trashedDirty   INTEGER NOT NULL DEFAULT 0,
      pendingDelete  INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_notes_user ON notes (userId);
    CREATE INDEX IF NOT EXISTS idx_notes_remote ON notes (remoteId);

    CREATE TABLE IF NOT EXISTS task_reminders (
      taskId TEXT PRIMARY KEY NOT NULL,
      reminderAt TEXT NOT NULL,
      notificationId TEXT
    );
  `);
  return db;
}
