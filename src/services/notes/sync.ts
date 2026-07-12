import { ApiError, type RequestOptions } from '@/services/api/client';

import {
  clearFlags,
  getAllRows,
  getPendingRows,
  hardDelete,
  isRowDirty,
  markCreated,
  upsertFromServer,
  type NoteRow,
  type ServerNote,
} from './local-store';

/**
 * Authenticated request function (the session's `authFetch`). Throws
 * {@link ApiError} on a server error response, and a raw network error (not an
 * `ApiError`) when the device is offline.
 */
export type Requester = <T>(path: string, options?: Omit<RequestOptions, 'token'>) => Promise<T>;

const VIEWS = ['Active', 'Archived', 'Trash'] as const;

/**
 * Reconciles the local store with the server: pushes every pending local change
 * through the existing REST endpoints, then pulls the server's canonical state.
 * Best-effort — if the device is offline (or the server errors), changes stay
 * queued locally and are retried on the next sync. Never throws.
 *
 * @returns whether both phases completed without error.
 */
export async function syncNow(userId: string, request: Requester): Promise<boolean> {
  let ok = true;
  try {
    await pushPending(userId, request);
  } catch {
    ok = false;
  }
  try {
    await pullAll(userId, request);
  } catch {
    ok = false;
  }
  return ok;
}

// --- Push -------------------------------------------------------------------

async function pushPending(userId: string, request: Requester): Promise<void> {
  const rows = await getPendingRows(userId);
  for (const row of rows) {
    await pushRow(row, request);
  }
}

/** Replays one note's pending changes against the server, in a safe order. */
async function pushRow(row: NoteRow, request: Requester): Promise<void> {
  // 1. Permanent delete wins over everything else.
  if (row.pendingDelete === 1) {
    if (row.remoteId) {
      try {
        await request(`/api/notes/${row.remoteId}`, { method: 'DELETE' });
      } catch (error) {
        if (!isNotFound(error)) {
          throw error;
        }
      }
    }
    await hardDelete(row.id);
    return;
  }

  // 2. Ensure the note exists on the server and its content is up to date.
  // `row.updatedAtLocal` is the edit-time snapshot from when this row was read;
  // flag clears are guarded on it so an edit made while a request is in flight
  // stays dirty and is pushed on the next pass.
  let remoteId = row.remoteId;
  if (row.pendingCreate === 1) {
    const created = await request<ServerNote>('/api/notes', {
      method: 'POST',
      body: contentBody(row),
    });
    remoteId = created.id;
    await markCreated(row.id, remoteId, row.updatedAtLocal);
  } else if (row.contentDirty === 1 && remoteId) {
    if (await putOrDropOnMissing(row.id, `/api/notes/${remoteId}`, contentBody(row), request)) {
      await clearFlags(row.id, ['contentDirty'], row.updatedAtLocal);
    } else {
      return; // row was deleted server-side and dropped locally.
    }
  }

  if (!remoteId) {
    return;
  }

  // 3. Replay flag changes (each endpoint is idempotent). Trash/archive before
  //    pin, since both clear the pin server-side.
  if (row.trashedDirty === 1) {
    const path = row.isTrashed === 1 ? `/api/notes/${remoteId}/trash` : `/api/notes/${remoteId}/restore`;
    if (!(await postOrDropOnMissing(row.id, path, request))) {
      return;
    }
    await clearFlags(row.id, ['trashedDirty'], row.updatedAtLocal);
  }

  if (row.archivedDirty === 1) {
    if (
      !(await putOrDropOnMissing(row.id, `/api/notes/${remoteId}/archived`, row.isArchived === 1, request))
    ) {
      return;
    }
    await clearFlags(row.id, ['archivedDirty'], row.updatedAtLocal);
  }

  if (row.pinnedDirty === 1) {
    if (
      !(await putOrDropOnMissing(row.id, `/api/notes/${remoteId}/pinned`, row.isPinned === 1, request))
    ) {
      return;
    }
    await clearFlags(row.id, ['pinnedDirty'], row.updatedAtLocal);
  }
}

function contentBody(row: NoteRow) {
  return {
    title: row.title,
    content: row.content,
    plainText: row.plainText,
    color: row.color,
  };
}

/** PUTs a body; on a 404 the note is gone server-side, so drop it locally. */
async function putOrDropOnMissing(
  localId: string,
  path: string,
  body: unknown,
  request: Requester,
): Promise<boolean> {
  try {
    await request(path, { method: 'PUT', body });
    return true;
  } catch (error) {
    if (isNotFound(error)) {
      await hardDelete(localId);
      return false;
    }
    throw error;
  }
}

async function postOrDropOnMissing(
  localId: string,
  path: string,
  request: Requester,
): Promise<boolean> {
  try {
    await request(path, { method: 'POST' });
    return true;
  } catch (error) {
    if (isNotFound(error)) {
      await hardDelete(localId);
      return false;
    }
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

// --- Pull -------------------------------------------------------------------

async function pullAll(userId: string, request: Requester): Promise<void> {
  const server: ServerNote[] = [];
  for (const view of VIEWS) {
    const page = await request<ServerNote[]>(`/api/notes?view=${view}`);
    server.push(...page);
  }

  const serverIds = new Set(server.map((n) => n.id));
  for (const note of server) {
    await upsertFromServer(userId, note);
  }

  // Any note we hold that the server no longer has (and that isn't a local-only
  // draft or a change waiting to push) was deleted elsewhere — remove it.
  const rows = await getAllRows(userId);
  for (const row of rows) {
    if (row.remoteId && !isRowDirty(row) && !serverIds.has(row.remoteId)) {
      await hardDelete(row.id);
    }
  }
}
