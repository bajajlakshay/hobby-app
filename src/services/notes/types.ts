/** A point in a handwriting stroke, in the canvas's local coordinates. */
export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  color: string;
  width: number;
  points: Point[];
}

/** A note is one of two kinds, chosen when it's created. */
export type NoteKind = 'text' | 'drawing';

/** A typed note: a plain-text body. */
export interface TextNoteDoc {
  kind: 'text';
  text: string;
}

/** A drawing note: a full-page handwriting pad. */
export interface DrawingNoteDoc {
  kind: 'drawing';
  strokes: Stroke[];
}

export type NoteDoc = TextNoteDoc | DrawingNoteDoc;

/** Note as returned by the backend (content is the JSON-encoded NoteDoc). */
export interface Note {
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

export type NoteView = 'Active' | 'Archived' | 'Trash';

export interface SaveNotePayload {
  title: string;
  content: string;
  plainText: string;
  color: string | null;
}

/**
 * Parses a note's stored content into a {@link NoteDoc}. Understands the current
 * `{ kind, ... }` shape and the legacy block-array format (for older notes),
 * always returning a valid doc (defaults to an empty text note).
 */
export function parseNote(content: string): NoteDoc {
  try {
    const parsed = JSON.parse(content) as unknown;

    // Current format: a tagged object.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      if (obj.kind === 'drawing') {
        return { kind: 'drawing', strokes: Array.isArray(obj.strokes) ? (obj.strokes as Stroke[]) : [] };
      }
      if (obj.kind === 'text') {
        // `text` is the current field; `markdown` is read for older notes.
        const body = typeof obj.text === 'string'
          ? obj.text
          : typeof obj.markdown === 'string'
            ? obj.markdown
            : '';
        return { kind: 'text', text: body };
      }
    }

    // Legacy format: an array of { type: 'text' | 'drawing' } blocks.
    if (Array.isArray(parsed)) {
      const strokes: Stroke[] = [];
      const texts: string[] = [];
      for (const block of parsed as Record<string, unknown>[]) {
        if (block?.type === 'drawing' && Array.isArray(block.strokes)) {
          strokes.push(...(block.strokes as Stroke[]));
        } else if (block?.type === 'text' && typeof block.text === 'string') {
          texts.push(block.text);
        }
      }
      if (strokes.length > 0) {
        return { kind: 'drawing', strokes };
      }
      return { kind: 'text', text: texts.join('\n\n') };
    }
  } catch {
    // fall through to default
  }
  return { kind: 'text', text: '' };
}

/** The kind of a stored note, for list rendering. */
export function noteKind(content: string): NoteKind {
  return parseNote(content).kind;
}
