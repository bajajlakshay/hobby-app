/** A point in a handwriting stroke, in the drawing block's local coordinates. */
export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  color: string;
  width: number;
  points: Point[];
}

export interface TextBlock {
  id: string;
  type: 'text';
  text: string;
}

export interface DrawingBlock {
  id: string;
  type: 'drawing';
  height: number;
  strokes: Stroke[];
}

export type NoteBlock = TextBlock | DrawingBlock;

/** Note as returned by the backend (content is a JSON-encoded NoteBlock[]). */
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

/** Parses a note's stored content into blocks, tolerating bad/empty data. */
export function parseBlocks(content: string): NoteBlock[] {
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? (parsed as NoteBlock[]) : [];
  } catch {
    return [];
  }
}

/** Flattens typed text from blocks for the searchable plainText field. */
export function blocksToPlainText(blocks: NoteBlock[]): string {
  return blocks
    .filter((b): b is TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}
