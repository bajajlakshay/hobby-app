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

/**
 * The coordinate space a drawing was authored in. Strokes are stored in these
 * units and rendered through an SVG viewBox, so a drawing made on one device
 * scales correctly on any other screen size.
 */
export interface DrawingCanvasInfo {
  width: number;
  height: number;
  /** Background the strokes were drawn on, frozen at authoring time (WYSIWYG). */
  background?: string;
}

/** A drawing note: a full-page handwriting pad. */
export interface DrawingNoteDoc {
  kind: 'drawing';
  strokes: Stroke[];
  /** Absent on drawings saved by older app versions (raw device pixels). */
  canvas?: DrawingCanvasInfo;
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
        const canvas = parseCanvasInfo(obj.canvas);
        return {
          kind: 'drawing',
          strokes: Array.isArray(obj.strokes) ? (obj.strokes as Stroke[]) : [],
          ...(canvas ? { canvas } : {}),
        };
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

function parseCanvasInfo(value: unknown): DrawingCanvasInfo | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const c = value as Record<string, unknown>;
  if (typeof c.width !== 'number' || typeof c.height !== 'number' || c.width <= 0 || c.height <= 0) {
    return null;
  }
  return {
    width: c.width,
    height: c.height,
    ...(typeof c.background === 'string' ? { background: c.background } : {}),
  };
}

/** The kind of a stored note, for list rendering. */
export function noteKind(content: string): NoteKind {
  return parseNote(content).kind;
}
