import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';

import { DrawingCanvas } from '@/components/notes/drawing-canvas';
import { ThemedText } from '@/components/themed-text';
import { confirmDestructive } from '@/components/ui/confirm';
import { Icon } from '@/components/ui/icon';
import { NoteColoredTextColor, NoteColors, PenColors, PenWidths } from '@/constants/notes';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNotesApi } from '@/services/notes/notes-api';
import {
  parseNote,
  type DrawingCanvasInfo,
  type NoteDoc,
  type NoteKind,
  type SaveNotePayload,
  type Stroke,
} from '@/services/notes/types';

/** Autosave delay after the last keystroke; writes are local, so this is cheap. */
const AUTOSAVE_MS = 800;

function makePayload(
  kind: NoteKind,
  title: string,
  text: string,
  strokes: Stroke[],
  canvas: DrawingCanvasInfo | null,
  color: string | null,
  tags: string[],
): SaveNotePayload {
  const doc: NoteDoc =
    kind === 'text'
      ? { kind: 'text', text, tags }
      : { kind: 'drawing', strokes, ...(canvas ? { canvas } : {}), tags };
  return {
    title: title.trim(),
    content: JSON.stringify(doc),
    plainText: kind === 'text' ? text.trim() : '',
    color,
  };
}

function payloadIsEmpty(payload: SaveNotePayload): boolean {
  if (payload.title.length > 0) {
    return false;
  }
  const doc = parseNote(payload.content);
  return doc.kind === 'text' ? doc.text.trim().length === 0 : doc.strokes.length === 0;
}

export default function NoteEditorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const api = useNotesApi();
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: string }>();
  const isNew = id === 'new';

  const [noteId, setNoteId] = useState<string | null>(isNew ? null : id);
  const [kind, setKind] = useState<NoteKind>(kindParam === 'drawing' ? 'drawing' : 'text');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [canvasInfo, setCanvasInfo] = useState<DrawingCanvasInfo | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [tagsText, setTagsText] = useState<string>('');
  const [isPinned, setIsPinned] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [isTrashed, setIsTrashed] = useState(false);

  const [loading, setLoading] = useState(!isNew);
  const [showColors, setShowColors] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  // --- persistence ----------------------------------------------------------
  // Saves are serialized through a chain (so a slow create can't race a second
  // create) and skipped when nothing changed since the last successful save.
  const noteIdRef = useRef<string | null>(isNew ? null : id);
  const lastSavedRef = useRef<string | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const discardRef = useRef(false);

  const tagsArray = tagsText.split(',').map(t => t.trim()).filter(Boolean);
  const payload = makePayload(kind, title, text, strokes, canvasInfo, color, tagsArray);
  const payloadRef = useRef(payload);

  const saveNow = useCallback((): Promise<void> => {
    const run = async () => {
      if (discardRef.current) {
        return;
      }
      const current = payloadRef.current;
      const serialized = JSON.stringify(current);
      if (serialized === lastSavedRef.current) {
        return;
      }
      if (noteIdRef.current) {
        await api.update(noteIdRef.current, current);
      } else {
        if (payloadIsEmpty(current)) {
          return;
        }
        const created = await api.create(current);
        noteIdRef.current = created.id;
        setNoteId(created.id);
      }
      lastSavedRef.current = serialized;
    };
    const next = saveChainRef.current.then(run, run);
    saveChainRef.current = next.catch(() => {});
    return next;
  }, [api]);

  const saveNowRef = useRef(saveNow);
  useEffect(() => {
    payloadRef.current = payload;
    saveNowRef.current = saveNow;
  });

  // Load an existing note.
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
          setCanvasInfo(doc.canvas ?? null);
        }
        setTagsText((doc.tags ?? []).join(', '));
        setTitle(note.title);
        setColor(note.color);
        setIsPinned(note.isPinned);
        setIsArchived(note.isArchived);
        setIsTrashed(note.isTrashed);
        // Seed the dirty check so autosave doesn't rewrite an unchanged note.
        lastSavedRef.current = JSON.stringify(
          makePayload(
            doc.kind,
            note.title,
            doc.kind === 'text' ? doc.text : '',
            doc.kind === 'drawing' ? doc.strokes : [],
            doc.kind === 'drawing' ? (doc.canvas ?? null) : null,
            note.color,
            doc.tags ?? []
          ),
        );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  // Debounced autosave on any edit.
  const serialized = JSON.stringify(payload);
  useEffect(() => {
    if (loading || serialized === lastSavedRef.current) {
      return;
    }
    const handle = setTimeout(() => void saveNowRef.current(), AUTOSAVE_MS);
    return () => clearTimeout(handle);
  }, [serialized, loading]);

  // The system back gesture/button bypasses our back button — flush unsaved
  // edits as the screen goes away. The write is local SQLite, so it completes
  // even after the screen unmounts.
  useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      void saveNowRef.current();
    });
  }, [navigation]);

  const contentColor = color ? NoteColoredTextColor : theme.text;
  const placeholderColor = color ? '#6B7280' : theme.textSecondary;
  const backgroundColor = color ?? theme.background;

  const ensureSaved = useCallback(async (): Promise<string | null> => {
    await saveNow();
    return noteIdRef.current;
  }, [saveNow]);

  const goBackSaving = useCallback(async () => {
    try {
      await ensureSaved();
    } catch {
      // Local write failed; nothing more we can do — navigation still proceeds.
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
    if (!noteId) {
      router.back();
      return;
    }
    const confirmed = await confirmDestructive({
      title: 'Delete note forever?',
      message: 'This can’t be undone.',
      confirmLabel: 'Delete',
    });
    if (!confirmed) {
      return;
    }
    discardRef.current = true;
    await api.remove(noteId);
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
        <Pressable hitSlop={8} onPress={goBackSaving} style={styles.toolButton}>
          <Icon name="back" size={22} color={contentColor} />
        </Pressable>

        <View style={styles.toolbarActions}>
          {isTrashed ? (
            <>
              <ToolButton label="Restore" color={contentColor} onPress={restore} />
              <ToolButton label="Delete" color="#EF4444" onPress={deletePermanently} />
            </>
          ) : (
            <>
              {kind === 'text' && (
                <Pressable hitSlop={8} onPress={() => setIsPreview((s) => !s)} style={styles.toolButton}>
                  <Icon name={isPreview ? 'edit' : 'eye'} size={20} color={contentColor} />
                </Pressable>
              )}
              <Pressable hitSlop={8} onPress={togglePin} style={styles.toolButton}>
                <Icon name="pin" size={20} color={contentColor} style={{ opacity: isPinned ? 1 : 0.35 }} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => setShowColors((s) => !s)} style={styles.toolButton}>
                <Icon name="palette" size={20} color={contentColor} />
              </Pressable>
              <Pressable hitSlop={8} onPress={archive} style={styles.toolButton}>
                <Icon name={isArchived ? 'unarchive' : 'archive'} size={20} color={contentColor} />
              </Pressable>
              <Pressable hitSlop={8} onPress={trash} style={styles.toolButton}>
                <Icon name="trash" size={20} color={contentColor} />
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

      <TextInput
        value={tagsText}
        onChangeText={setTagsText}
        placeholder="Tags (comma separated)"
        placeholderTextColor={placeholderColor}
        style={[styles.tagsInput, { color: contentColor }]}
      />

      {kind === 'text' ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {isPreview ? (
            <ScrollView style={styles.previewContainer} contentContainerStyle={styles.previewContent}>
              <Markdown style={{ body: { color: contentColor, fontSize: 16 } }}>
                {text || '*No content to preview*'}
              </Markdown>
            </ScrollView>
          ) : (
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Start writing…"
              placeholderTextColor={placeholderColor}
              style={[styles.body, { color: contentColor }]}
              multiline
              textAlignVertical="top"
            />
          )}
        </KeyboardAvoidingView>
      ) : (
        <DrawingNoteBody
          strokes={strokes}
          onChangeStrokes={setStrokes}
          canvasInfo={canvasInfo}
          onAdoptCanvas={(size) =>
            setCanvasInfo({ ...size, background: theme.backgroundElement })
          }
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
  canvasInfo,
  onAdoptCanvas,
  contentColor,
  dividerColor,
}: {
  strokes: Stroke[];
  onChangeStrokes: (strokes: Stroke[]) => void;
  canvasInfo: DrawingCanvasInfo | null;
  onAdoptCanvas: (size: { width: number; height: number }) => void;
  contentColor: string;
  dividerColor: string;
}) {
  const theme = useTheme();
  const [penColor, setPenColor] = useState<string>(PenColors[0]);
  const [penWidth, setPenWidth] = useState<number>(PenWidths[1]);
  const [canvasHeight, setCanvasHeight] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setCanvasHeight(e.nativeEvent.layout.height);

  const clearAll = async () => {
    if (strokes.length === 0) {
      return;
    }
    const confirmed = await confirmDestructive({
      title: 'Clear the whole drawing?',
      confirmLabel: 'Clear',
    });
    if (confirmed) {
      onChangeStrokes([]);
    }
  };

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
            canvas={canvasInfo}
            onAdoptCanvas={onAdoptCanvas}
            background={canvasInfo?.background}
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
          <Pressable
            hitSlop={6}
            onPress={() => onChangeStrokes(strokes.slice(0, -1))}
            style={styles.toolButton}>
            <Icon name="undo" size={20} color={theme.textSecondary} />
          </Pressable>
          <ToolButton label="Clear" color={theme.textSecondary} onPress={clearAll} />
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
  toolButton: {
    padding: Spacing.half,
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
    fontWeight: '700',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one,
  },
  tagsInput: {
    fontSize: 14,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    fontStyle: 'italic',
  },
  body: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  previewContainer: {
    flex: 1,
  },
  previewContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
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
