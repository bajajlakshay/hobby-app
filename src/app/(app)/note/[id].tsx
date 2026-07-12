import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Platform,
  Pressable,
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
import { parseNote, type NoteDoc, type NoteKind, type Stroke } from '@/services/notes/types';

export default function NoteEditorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const api = useNotesApi();
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: string }>();
  const isNew = id === 'new';

  const [noteId, setNoteId] = useState<string | null>(isNew ? null : id);
  const [kind, setKind] = useState<NoteKind>(kindParam === 'drawing' ? 'drawing' : 'text');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [isTrashed, setIsTrashed] = useState(false);

  const [loading, setLoading] = useState(!isNew);
  const [showColors, setShowColors] = useState(false);

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
        const doc = parseNote(note.content);
        setKind(doc.kind);
        if (doc.kind === 'text') {
          setText(doc.text);
        } else {
          setStrokes(doc.strokes);
        }
        setTitle(note.title);
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
  const placeholderColor = color ? '#6B7280' : theme.textSecondary;
  const backgroundColor = color ?? theme.background;

  const isEmpty = useMemo(() => {
    if (title.trim().length > 0) {
      return false;
    }
    return kind === 'text' ? text.trim().length === 0 : strokes.length === 0;
  }, [title, kind, text, strokes]);

  // --- persistence ---
  const buildPayload = useCallback(() => {
    const doc: NoteDoc = kind === 'text' ? { kind: 'text', text } : { kind: 'drawing', strokes };
    return {
      title: title.trim(),
      content: JSON.stringify(doc),
      plainText: kind === 'text' ? text.trim() : '',
      color,
    };
  }, [kind, text, strokes, title, color]);

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

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor={placeholderColor}
        style={[styles.title, { color: contentColor }]}
        multiline
      />

      {kind === 'text' ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Start writing…"
            placeholderTextColor={placeholderColor}
            style={[styles.body, { color: contentColor }]}
            multiline
            textAlignVertical="top"
          />
        </KeyboardAvoidingView>
      ) : (
        <DrawingNoteBody
          strokes={strokes}
          onChangeStrokes={setStrokes}
          contentColor={contentColor}
          dividerColor={theme.backgroundSelected}
        />
      )}
    </SafeAreaView>
  );
}

// --- Drawing note: full-page pad --------------------------------------------

function DrawingNoteBody({
  strokes,
  onChangeStrokes,
  contentColor,
  dividerColor,
}: {
  strokes: Stroke[];
  onChangeStrokes: (strokes: Stroke[]) => void;
  contentColor: string;
  dividerColor: string;
}) {
  const theme = useTheme();
  const [penColor, setPenColor] = useState<string>(PenColors[0]);
  const [penWidth, setPenWidth] = useState<number>(PenWidths[1]);
  const [canvasHeight, setCanvasHeight] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setCanvasHeight(e.nativeEvent.layout.height);

  return (
    <View style={styles.flex}>
      <View style={styles.canvasArea} onLayout={onLayout}>
        {canvasHeight > 0 && (
          <DrawingCanvas
            strokes={strokes}
            onChange={onChangeStrokes}
            color={penColor}
            strokeWidth={penWidth}
            height={canvasHeight}
          />
        )}
      </View>

      <View style={[styles.penBar, { borderTopColor: dividerColor }]}>
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
        <View style={styles.penGroup}>
          <ToolButton
            label="Undo"
            color={theme.textSecondary}
            onPress={() => onChangeStrokes(strokes.slice(0, -1))}
          />
          <ToolButton label="Clear" color={theme.textSecondary} onPress={() => onChangeStrokes([])} />
        </View>
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
  title: {
    fontSize: 24,
    fontWeight: 700,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one,
  },
  body: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  canvasArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  penBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
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
