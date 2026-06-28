import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DrawingCanvas } from '@/components/notes/drawing-canvas';
import { ThemedText } from '@/components/themed-text';
import { NoteColoredTextColor, NoteColors, PenColors, PenWidths } from '@/constants/notes';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNotesApi } from '@/services/notes/notes-api';
import {
  blocksToPlainText,
  parseBlocks,
  type DrawingBlock,
  type NoteBlock,
  type Stroke,
  type TextBlock,
} from '@/services/notes/types';

const DRAWING_HEIGHT = 240;
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function NoteEditorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const api = useNotesApi();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const [noteId, setNoteId] = useState<string | null>(isNew ? null : id);
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<NoteBlock[]>([{ id: uid(), type: 'text', text: '' }]);
  const [color, setColor] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [isTrashed, setIsTrashed] = useState(false);

  const [loading, setLoading] = useState(!isNew);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [showColors, setShowColors] = useState(false);
  const [penColor, setPenColor] = useState<string>(theme.text);
  const [penWidth, setPenWidth] = useState(PenWidths[1]);

  useEffect(() => {
    if (isNew) {
      return;
    }
    let active = true;
    (async () => {
      try {
        const note = await api.get(id);
        if (!active) {
          return;
        }
        setTitle(note.title);
        const parsed = parseBlocks(note.content);
        setBlocks(parsed.length > 0 ? parsed : [{ id: uid(), type: 'text', text: '' }]);
        setColor(note.color);
        setIsPinned(note.isPinned);
        setIsArchived(note.isArchived);
        setIsTrashed(note.isTrashed);
      } catch {
        router.back();
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [api, id, isNew, router]);

  const contentColor = color ? NoteColoredTextColor : theme.text;
  const backgroundColor = color ?? theme.background;
  const hasDrawing = blocks.some((b) => b.type === 'drawing');

  const isEmpty = useMemo(
    () =>
      title.trim().length === 0 &&
      blocks.every(
        (b) =>
          (b.type === 'text' && b.text.trim().length === 0) ||
          (b.type === 'drawing' && b.strokes.length === 0),
      ),
    [title, blocks],
  );

  // --- block editing ---
  const updateText = (blockId: string, text: string) =>
    setBlocks((bs) => bs.map((b) => (b.id === blockId && b.type === 'text' ? { ...b, text } : b)));

  const updateStrokes = (blockId: string, strokes: Stroke[]) =>
    setBlocks((bs) =>
      bs.map((b) => (b.id === blockId && b.type === 'drawing' ? { ...b, strokes } : b)),
    );

  const removeBlock = (blockId: string) =>
    setBlocks((bs) => bs.filter((b) => b.id !== blockId));

  const addTextBlock = () =>
    setBlocks((bs) => [...bs, { id: uid(), type: 'text', text: '' }]);

  const addDrawingBlock = () =>
    setBlocks((bs) => [...bs, { id: uid(), type: 'drawing', height: DRAWING_HEIGHT, strokes: [] }]);

  const undoStroke = (blockId: string) =>
    setBlocks((bs) =>
      bs.map((b) =>
        b.id === blockId && b.type === 'drawing'
          ? { ...b, strokes: b.strokes.slice(0, -1) }
          : b,
      ),
    );

  // --- persistence ---
  const buildPayload = useCallback(
    () => ({
      title: title.trim(),
      content: JSON.stringify(blocks),
      plainText: blocksToPlainText(blocks),
      color,
    }),
    [title, blocks, color],
  );

  const ensureSaved = useCallback(async (): Promise<string | null> => {
    const payload = buildPayload();
    if (noteId) {
      await api.update(noteId, payload);
      return noteId;
    }
    if (isEmpty) {
      return null;
    }
    const created = await api.create(payload);
    setNoteId(created.id);
    return created.id;
  }, [api, buildPayload, isEmpty, noteId]);

  const goBackSaving = useCallback(async () => {
    try {
      await ensureSaved();
    } catch {
      // Surface nothing here; navigation still proceeds.
    } finally {
      router.back();
    }
  }, [ensureSaved, router]);

  const togglePin = async () => {
    const savedId = await ensureSaved();
    if (!savedId) {
      return;
    }
    const updated = await api.setPinned(savedId, !isPinned);
    setIsPinned(updated.isPinned);
  };

  const archive = async () => {
    const savedId = await ensureSaved();
    if (savedId) {
      await api.setArchived(savedId, true);
    }
    router.back();
  };

  const trash = async () => {
    const savedId = await ensureSaved();
    if (savedId) {
      await api.trash(savedId);
    }
    router.back();
  };

  const restore = async () => {
    if (noteId) {
      await api.restore(noteId);
    }
    router.back();
  };

  const deletePermanently = async () => {
    if (noteId) {
      await api.remove(noteId);
    }
    router.back();
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, styles.center, { backgroundColor }]}>
        <ActivityIndicator color={theme.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor }]} edges={['top', 'bottom']}>
      <View style={styles.toolbar}>
        <Pressable hitSlop={8} onPress={goBackSaving}>
          <ThemedText style={[styles.toolIcon, { color: contentColor }]}>‹</ThemedText>
        </Pressable>

        <View style={styles.toolbarActions}>
          {isTrashed ? (
            <>
              <ToolButton label="Restore" color={contentColor} onPress={restore} />
              <ToolButton label="Delete" color="#EF4444" onPress={deletePermanently} />
            </>
          ) : (
            <>
              <Pressable hitSlop={8} onPress={togglePin}>
                <ThemedText style={[styles.toolEmoji, { opacity: isPinned ? 1 : 0.4 }]}>📌</ThemedText>
              </Pressable>
              <Pressable hitSlop={8} onPress={() => setShowColors((s) => !s)}>
                <ThemedText style={styles.toolEmoji}>🎨</ThemedText>
              </Pressable>
              <Pressable hitSlop={8} onPress={archive}>
                <ThemedText style={styles.toolEmoji}>{isArchived ? '🗄️' : '📥'}</ThemedText>
              </Pressable>
              <Pressable hitSlop={8} onPress={trash}>
                <ThemedText style={styles.toolEmoji}>🗑️</ThemedText>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {showColors && (
        <View style={styles.swatchRow}>
          {NoteColors.map((c, i) => (
            <Pressable
              key={i}
              onPress={() => setColor(c)}
              style={[
                styles.swatch,
                { backgroundColor: c ?? theme.backgroundElement, borderColor: theme.backgroundSelected },
                color === c && styles.swatchSelected,
              ]}>
              {c === null && (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  ∅
                </ThemedText>
              )}
            </Pressable>
          ))}
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          scrollEnabled={scrollEnabled}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor={color ? '#6B7280' : theme.textSecondary}
            style={[styles.title, { color: contentColor }]}
            multiline
          />

          {blocks.map((block) =>
            block.type === 'text' ? (
              <TextBlockEditor
                key={block.id}
                block={block}
                color={contentColor}
                placeholderColor={color ? '#6B7280' : theme.textSecondary}
                onChange={(text) => updateText(block.id, text)}
                onRemove={blocks.length > 1 ? () => removeBlock(block.id) : undefined}
              />
            ) : (
              <DrawingBlockEditor
                key={block.id}
                block={block}
                penColor={penColor}
                penWidth={penWidth}
                onStrokes={(strokes) => updateStrokes(block.id, strokes)}
                onActiveChange={(active) => setScrollEnabled(!active)}
                onUndo={() => undoStroke(block.id)}
                onRemove={() => removeBlock(block.id)}
              />
            ),
          )}

          <View style={styles.addRow}>
            <ToolButton label="＋ Text" color={contentColor} onPress={addTextBlock} />
            <ToolButton label="＋ Drawing" color={contentColor} onPress={addDrawingBlock} />
          </View>

          {hasDrawing && (
            <View style={styles.penBar}>
              <View style={styles.penGroup}>
                {PenColors.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setPenColor(c)}
                    style={[
                      styles.penColor,
                      { backgroundColor: c, borderColor: theme.backgroundSelected },
                      penColor === c && styles.penSelected,
                    ]}
                  />
                ))}
              </View>
              <View style={styles.penGroup}>
                {PenWidths.map((w) => (
                  <Pressable
                    key={w}
                    onPress={() => setPenWidth(w)}
                    style={[
                      styles.penWidth,
                      { borderColor: theme.backgroundSelected },
                      penWidth === w && { backgroundColor: theme.backgroundSelected },
                    ]}>
                    <View style={{ width: w * 2, height: w * 2, borderRadius: w, backgroundColor: contentColor }} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TextBlockEditor({
  block,
  color,
  placeholderColor,
  onChange,
  onRemove,
}: {
  block: TextBlock;
  color: string;
  placeholderColor: string;
  onChange: (text: string) => void;
  onRemove?: () => void;
}) {
  return (
    <View style={styles.block}>
      <TextInput
        value={block.text}
        onChangeText={onChange}
        placeholder="Note"
        placeholderTextColor={placeholderColor}
        style={[styles.bodyText, { color }]}
        multiline
      />
      {onRemove && (
        <Pressable hitSlop={6} onPress={onRemove} style={styles.blockRemove}>
          <ThemedText type="small" style={{ color: placeholderColor }}>
            Remove text
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

function DrawingBlockEditor({
  block,
  penColor,
  penWidth,
  onStrokes,
  onActiveChange,
  onUndo,
  onRemove,
}: {
  block: DrawingBlock;
  penColor: string;
  penWidth: number;
  onStrokes: (strokes: Stroke[]) => void;
  onActiveChange: (active: boolean) => void;
  onUndo: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.block}>
      <DrawingCanvas
        strokes={block.strokes}
        onChange={onStrokes}
        color={penColor}
        strokeWidth={penWidth}
        height={block.height}
        onActiveChange={onActiveChange}
      />
      <View style={styles.drawingActions}>
        <ToolButton label="Undo" color={theme.textSecondary} onPress={onUndo} />
        <ToolButton label="Clear" color={theme.textSecondary} onPress={() => onStrokes([])} />
        <ToolButton label="Remove" color={theme.textSecondary} onPress={onRemove} />
      </View>
    </View>
  );
}

function ToolButton({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable hitSlop={6} onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  toolIcon: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: 600,
  },
  toolEmoji: {
    fontSize: 20,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: '#208AEF',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    paddingVertical: Spacing.one,
  },
  block: {
    gap: Spacing.one,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 28,
  },
  blockRemove: {
    alignSelf: 'flex-start',
  },
  drawingActions: {
    flexDirection: 'row',
    gap: Spacing.four,
    paddingTop: Spacing.one,
  },
  addRow: {
    flexDirection: 'row',
    gap: Spacing.four,
    paddingTop: Spacing.two,
  },
  penBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  penGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  penColor: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
  },
  penSelected: {
    borderWidth: 3,
    borderColor: '#208AEF',
  },
  penWidth: {
    width: 32,
    height: 32,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
