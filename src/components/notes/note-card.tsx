import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { pointsToPath } from '@/components/notes/drawing-canvas';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { NoteColoredTextColor } from '@/constants/notes';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseNote, type DrawingNoteDoc, type Note } from '@/services/notes/types';

const THUMBNAIL_HEIGHT = 96;
/** Cap the strokes rendered per card so long drawings don't slow the list. */
const THUMBNAIL_MAX_STROKES = 200;

type NoteCardProps = {
  note: Note;
  onPress: () => void;
  onTogglePin?: () => void;
  showPin?: boolean;
};

export function NoteCard({ note, onPress, onTogglePin, showPin = true }: NoteCardProps) {
  const theme = useTheme();

  const backgroundColor = note.color ?? theme.backgroundElement;
  const textColor = note.color ? NoteColoredTextColor : theme.text;
  const mutedColor = note.color ? NoteColoredTextColor : theme.textSecondary;

  const doc = parseNote(note.content);
  const hasTitle = note.title.trim().length > 0;
  const preview = doc.kind === 'text' ? doc.text.trim() : '';
  const isEmpty =
    !hasTitle && (doc.kind === 'text' ? preview.length === 0 : doc.strokes.length === 0);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor }, pressed && styles.pressed]}>
      <View style={styles.headerRow}>
        {hasTitle ? (
          <ThemedText type="smallBold" style={[styles.title, { color: textColor }]} numberOfLines={2}>
            {note.title}
          </ThemedText>
        ) : (
          <View style={styles.title} />
        )}
        {showPin && (
          <Pressable hitSlop={8} onPress={onTogglePin}>
            <Icon
              name="pin"
              size={16}
              color={textColor}
              style={{ opacity: note.isPinned ? 1 : 0.3 }}
            />
          </Pressable>
        )}
      </View>

      {doc.kind === 'text' && preview.length > 0 && (
        <ThemedText
          type="small"
          style={{ color: mutedColor, opacity: note.color ? 0.75 : 1 }}
          numberOfLines={6}>
          {preview}
        </ThemedText>
      )}

      {doc.kind === 'drawing' && doc.strokes.length > 0 && <DrawingThumbnail doc={doc} />}

      {isEmpty && (
        <ThemedText type="small" style={{ color: mutedColor, fontStyle: 'italic' }}>
          Empty note
        </ThemedText>
      )}
    </Pressable>
  );
}

/** Miniature render of a drawing's strokes, scaled via the SVG viewBox. */
function DrawingThumbnail({ doc }: { doc: DrawingNoteDoc }) {
  const theme = useTheme();

  let viewBox: string;
  if (doc.canvas) {
    viewBox = `0 0 ${doc.canvas.width} ${doc.canvas.height}`;
  } else {
    // Legacy drawing without a stored canvas: frame the stroke bounds instead.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const stroke of doc.strokes) {
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    const pad = 16;
    viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  }

  return (
    <View
      style={[
        styles.thumbnail,
        { backgroundColor: doc.canvas?.background ?? theme.backgroundElement },
      ]}>
      <Svg
        width="100%"
        height={THUMBNAIL_HEIGHT}
        viewBox={viewBox}
        preserveAspectRatio={doc.canvas ? 'xMidYMin slice' : 'xMidYMid meet'}>
        {doc.strokes.slice(0, THUMBNAIL_MAX_STROKES).map((stroke, index) => (
          <Path
            key={index}
            d={pointsToPath(stroke.points)}
            stroke={stroke.color}
            strokeWidth={stroke.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
  thumbnail: {
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
});
