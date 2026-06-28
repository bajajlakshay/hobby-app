/** Background palette for notes. `null` means the default theme background. */
export const NoteColors: (string | null)[] = [
  null,
  '#FDE68A', // yellow
  '#FBCFE8', // pink
  '#BBF7D0', // green
  '#BFDBFE', // blue
  '#DDD6FE', // purple
  '#FED7AA', // orange
];

/** Dark, high-contrast text used on top of the pastel note colors. */
export const NoteColoredTextColor = '#1F2937';

/** Pen colors available in the drawing toolbar. */
export const PenColors: string[] = ['#111827', '#FFFFFF', '#EF4444', '#3B82F6', '#10B981', '#F59E0B'];

/** Pen stroke widths available in the drawing toolbar. */
export const PenWidths: number[] = [2, 4, 8];
