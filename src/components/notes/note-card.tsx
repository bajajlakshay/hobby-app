import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { NoteColoredTextColor } from '@/constants/notes';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseBlocks, type Note } from '@/services/notes/types';

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

  const blocks = parseBlocks(note.content);
  const hasDrawing = blocks.some((b) => b.type === 'drawing');
  const preview = note.plainText.trim();
  const hasTitle = note.title.trim().length > 0;

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
            <ThemedText style={[styles.pin, { opacity: note.isPinned ? 1 : 0.3 }]}>📌</ThemedText>
          </Pressable>
        )}
      </View>

      {preview.length > 0 && (
        <ThemedText type="small" style={{ color: mutedColor }} numberOfLines={6}>
          {preview}
        </ThemedText>
      )}

      {hasDrawing && (
        <ThemedText type="small" style={[styles.handwriting, { color: mutedColor }]}>
          ✎ Handwriting
        </ThemedText>
      )}

      {!hasTitle && preview.length === 0 && !hasDrawing && (
        <ThemedText type="small" style={{ color: mutedColor, fontStyle: 'italic' }}>
          Empty note
        </ThemedText>
      )}
    </Pressable>
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
  pin: {
    fontSize: 16,
  },
  handwriting: {
    marginTop: Spacing.one,
  },
});
