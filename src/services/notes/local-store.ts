import { getDb } from './db';
import { newLocalId } from './ids';
import type { Note, NoteView, SaveNotePayload } from './types';

/** A raw row of the `notes` table (booleans/flags stored as 0/1 integers). */
export interface NoteRow {
  id: string;
  userId: string;
  remoteId: string | null;
  title: string;
  content: string;
  plainText: string;
  color: string | null;
  isPinned: number;
  isArchived: number;
  isTrashed: number;
  createdAt: string;
  updatedAt: string | null;
  updatedAtLocal: number;
  pendingCreate: number;
  contentDirty: number;
  pinnedDirty: number;
  archivedDirty: number;
  trashedDirty: number;
  pendingDelete: number;
}

/** Server-note shape used when reconciling a pulled note into the local store. */
export interface ServerNote {
  id: string;
  title: string;
  content: string;
  plainText: string;
  color: string | null;
  isPinned: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  createdAt: string;
  updatedAt: string | null;
}

const ALL_COLUMNS =
  'id, userId, remoteId, title, content, plainText, color, isPinned, isArchived, isTrashed, ' +
  'createdAt, updatedAt, updatedAtLocal, pendingCreate, contentDirty, pinnedDirty, ' +
  'archivedDirty, trashedDirty, pendingDelete';

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    plainText: row.plainText,
    color: row.color,
    isPinned: row.isPinned === 1,
    isArchived: row.isArchived === 1,
    isTrashed: row.isTrashed === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** True if the row has any change that still needs to be pushed to the server. */
export function isRowDirty(row: NoteRow): boolean {
  return (
    row.pendingCreate === 1 ||
    row.contentDirty === 1 ||
    row.pinnedDirty === 1 ||
    row.archivedDirty === 1 ||
    row.trashedDirty === 1 ||
    row.pendingDelete === 1
  );
}

// --- Reads (UI) -------------------------------------------------------------

export async function listLocal(
  userId: string,
  view: NoteView,
  search?: string,
): Promise<Note[]> {
  const db = await getDb();
  const where: string[] = ['userId = ?', 'pendingDelete = 0'];
  const params: (string | number)[] = [userId];

  if (view === 'Active') {
    where.push('isTrashed = 0', 'isArchived = 0');
  } else if (view === 'Archived') {
    where.push('isTrashed = 0', 'isArchived = 1');
  } else {
    where.push('isTrashed = 1');
  }

  const term = search?.trim().toLowerCase();
  if (term) {
    where.push('(lower(title) LIKE ? OR lower(plainText) LIKE ?)');
    const like = `%${term}%`;
    params.push(like, like);
  }

  const rows = await db.getAllAsync<NoteRow>(
    `SELECT ${ALL_COLUMNS} FROM notes WHERE ${where.join(' AND ')} ` +
      'ORDER BY isPinned DESC, updatedAtLocal DESC',
    params,
  );
  return rows.map(rowToNote);
}

export async function getLocal(userId: string, id: string): Promise<Note | null> {
  const row = await findRow(userId, id);
  return row ? rowToNote(row) : null;
}

async function findRow(userId: string, id: string): Promise<NoteRow | null> {
  const db = await getDb();
  return db.getFirstAsync<NoteRow>(
    `SELECT ${ALL_COLUMNS} FROM notes WHERE id = ? AND userId = ?`,
    [id, userId],
  );
}

// --- Writes (UI) ------------------------------------------------------------

export async function createLocal(userId: string, payload: SaveNotePayload): Promise<Note> {
  const db = await getDb();
  const id = newLocalId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO notes (${ALL_COLUMNS}) VALUES ` +
      '(?, ?, NULL, ?, ?, ?, ?, 0, 0, 0, ?, NULL, ?, 1, 0, 0, 0, 0, 0)',
    [id, userId, payload.title, payload.content, payload.plainText, payload.color, now, Date.now()],
  );
  return (await getLocal(userId, id))!;
}

export async function updateLocal(
  userId: string,
  id: string,
  payload: SaveNotePayload,
): Promise<Note | null> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE notes SET title = ?, content = ?, plainText = ?, color = ?, ' +
      'updatedAt = ?, updatedAtLocal = ?, contentDirty = 1 WHERE id = ? AND userId = ?',
    [
      payload.title,
      payload.content,
      payload.plainText,
      payload.color,
      new Date().toISOString(),
      Date.now(),
      id,
      userId,
    ],
  );
  return getLocal(userId, id);
}

export async function setPinnedLocal(
  userId: string,
  id: string,
  isPinned: boolean,
): Promise<Note | null> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE notes SET isPinned = ?, pinnedDirty = 1, updatedAt = ?, updatedAtLocal = ? ' +
      'WHERE id = ? AND userId = ?',
    [isPinned ? 1 : 0, new Date().toISOString(), Date.now(), id, userId],
  );
  return getLocal(userId, id);
}

export async function setArchivedLocal(
  userId: string,
  id: string,
  isArchived: boolean,
): Promise<Note | null> {
  const db = await getDb();
  // Mirror the server: archiving also unpins. The archive endpoint applies that
  // server-side on sync, so no separate pin push is needed here.
  await db.runAsync(
    'UPDATE notes SET isArchived = ?, isPinned = CASE WHEN ? = 1 THEN 0 ELSE isPinned END, ' +
      'archivedDirty = 1, updatedAt = ?, updatedAtLocal = ? WHERE id = ? AND userId = ?',
    [isArchived ? 1 : 0, isArchived ? 1 : 0, new Date().toISOString(), Date.now(), id, userId],
  );
  return getLocal(userId, id);
}

export async function trashLocal(userId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE notes SET isTrashed = 1, isPinned = 0, trashedDirty = 1, updatedAt = ?, ' +
      'updatedAtLocal = ? WHERE id = ? AND userId = ?',
    [new Date().toISOString(), Date.now(), id, userId],
  );
}

export async function restoreLocal(userId: string, id: string): Promise<Note | null> {
  const db = await getDb();
  // Mirror the server: restore also unarchives.
  await db.runAsync(
    'UPDATE notes SET isTrashed = 0, isArchived = 0, trashedDirty = 1, updatedAt = ?, ' +
      'updatedAtLocal = ? WHERE id = ? AND userId = ?',
    [new Date().toISOString(), Date.now(), id, userId],
  );
  return getLocal(userId, id);
}

/** Permanently deletes every trashed note (queues server deletes for synced ones). */
export async function emptyTrashLocal(userId: string): Promise<void> {
  const db = await getDb();
  // Never-pushed notes can be dropped outright; the rest are queued for DELETE.
  await db.runAsync(
    'DELETE FROM notes WHERE userId = ? AND isTrashed = 1 AND pendingCreate = 1',
    [userId],
  );
  await db.runAsync(
    'UPDATE notes SET pendingDelete = 1, updatedAtLocal = ? WHERE userId = ? AND isTrashed = 1',
    [Date.now(), userId],
  );
}

export async function removeLocal(userId: string, id: string): Promise<void> {
  const db = await getDb();
  const row = await findRow(userId, id);
  if (!row) {
    return;
  }
  if (row.pendingCreate === 1) {
    // Never reached the server; just drop it.
    await db.runAsync('DELETE FROM notes WHERE id = ? AND userId = ?', [id, userId]);
  } else {
    await db.runAsync(
      'UPDATE notes SET pendingDelete = 1, updatedAtLocal = ? WHERE id = ? AND userId = ?',
      [Date.now(), id, userId],
    );
  }
}

// --- Sync helpers (used by ./sync) -----------------------------------------

/** All rows for the user that still have changes to push, oldest edit first. */
export async function getPendingRows(userId: string): Promise<NoteRow[]> {
  const db = await getDb();
  return db.getAllAsync<NoteRow>(
    `SELECT ${ALL_COLUMNS} FROM notes WHERE userId = ? AND ` +
      '(pendingCreate = 1 OR contentDirty = 1 OR pinnedDirty = 1 OR archivedDirty = 1 ' +
      'OR trashedDirty = 1 OR pendingDelete = 1) ORDER BY updatedAtLocal ASC',
    [userId],
  );
}

/** Every row for the user (used by pull to detect server-side deletions). */
export async function getAllRows(userId: string): Promise<NoteRow[]> {
  const db = await getDb();
  return db.getAllAsync<NoteRow>(
    `SELECT ${ALL_COLUMNS} FROM notes WHERE userId = ?`,
    [userId],
  );
}

/**
 * Records the server id after the first successful push. `contentDirty` is only
 * cleared if the note wasn't edited while the create was in flight
 * (`editedAtOrBefore` is the row's `updatedAtLocal` as read by the sync pass).
 */
export async function markCreated(
  id: string,
  remoteId: string,
  editedAtOrBefore: number,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE notes SET remoteId = ?, pendingCreate = 0, ' +
      'contentDirty = CASE WHEN updatedAtLocal <= ? THEN 0 ELSE contentDirty END WHERE id = ?',
    [remoteId, editedAtOrBefore, id],
  );
}

/**
 * Clears sync flags after a successful push — but only if the note wasn't
 * edited while the request was in flight (a newer edit re-dirties the row and
 * must survive to be pushed on the next pass).
 */
export async function clearFlags(
  id: string,
  flags: (keyof NoteRow)[],
  editedAtOrBefore: number,
): Promise<void> {
  if (flags.length === 0) {
    return;
  }
  const db = await getDb();
  const set = flags.map((f) => `${f} = 0`).join(', ');
  await db.runAsync(`UPDATE notes SET ${set} WHERE id = ? AND updatedAtLocal <= ?`, [
    id,
    editedAtOrBefore,
  ]);
}

export async function hardDelete(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM notes WHERE id = ?', [id]);
}

/**
 * Inserts or overwrites the local copy of a note pulled from the server. Skips
 * rows that still have local changes pending (local wins until it's pushed).
 */
export async function upsertFromServer(userId: string, note: ServerNote): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<NoteRow>(
    `SELECT ${ALL_COLUMNS} FROM notes WHERE userId = ? AND remoteId = ?`,
    [userId, note.id],
  );

  const orderKey = Date.parse(note.updatedAt ?? note.createdAt) || Date.now();

  if (!existing) {
    await db.runAsync(
      `INSERT INTO notes (${ALL_COLUMNS}) VALUES ` +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0)',
      [
        note.id, // local id == server id for server-originated notes
        userId,
        note.id,
        note.title,
        note.content,
        note.plainText,
        note.color,
        note.isPinned ? 1 : 0,
        note.isArchived ? 1 : 0,
        note.isTrashed ? 1 : 0,
        note.createdAt,
        note.updatedAt,
        orderKey,
      ],
    );
    return;
  }

  if (isRowDirty(existing)) {
    return; // local changes pending — don't clobber them.
  }

  // The WHERE clause re-checks the dirty flags so an edit that lands between
  // the read above and this write can't be overwritten by server state.
  await db.runAsync(
    'UPDATE notes SET title = ?, content = ?, plainText = ?, color = ?, isPinned = ?, ' +
      'isArchived = ?, isTrashed = ?, createdAt = ?, updatedAt = ?, updatedAtLocal = ? ' +
      'WHERE id = ? AND pendingCreate = 0 AND contentDirty = 0 AND pinnedDirty = 0 ' +
      'AND archivedDirty = 0 AND trashedDirty = 0 AND pendingDelete = 0',
    [
      note.title,
      note.content,
      note.plainText,
      note.color,
      note.isPinned ? 1 : 0,
      note.isArchived ? 1 : 0,
      note.isTrashed ? 1 : 0,
      note.createdAt,
      note.updatedAt,
      orderKey,
      existing.id,
    ],
  );
}

/** Removes all notes that don't belong to the current user (account switch). */
export async function deleteOtherUsers(userId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM notes WHERE userId != ?', [userId]);
}

/** Number of notes with unsynced local changes, for the offline indicator. */
export async function pendingCount(userId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM notes WHERE userId = ? AND ' +
      '(pendingCreate = 1 OR contentDirty = 1 OR pinnedDirty = 1 OR archivedDirty = 1 ' +
      'OR trashedDirty = 1 OR pendingDelete = 1)',
    [userId],
  );
  return row?.n ?? 0;
}
