import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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

import { ThemedText } from '@/components/themed-text';
import { confirmDestructive } from '@/components/ui/confirm';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTasksApi, getLocalReminder, setLocalReminder } from '@/services/tasks/tasks-api';
import type { ChecklistItem, SaveTaskPayload } from '@/services/tasks/types';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Autosave delay. Tasks save to the server, so give typing a little more room. */
const AUTOSAVE_MS = 1200;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const makePayload = (t: string, it: ChecklistItem[], rem: string | null): SaveTaskPayload => ({
  title: t.trim(),
  items: it
    .filter((i) => i.text.trim().length > 0)
    .map((i) => ({ id: i.id, text: i.text.trim(), isCompleted: i.isCompleted })),
  reminderAt: rem,
});

function payloadIsEmpty(payload: SaveTaskPayload): boolean {
  return payload.title.length === 0 && payload.items.length === 0;
}

export default function TaskEditorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const api = useTasksApi();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const [title, setTitle] = useState('');
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [reminderAt, setReminderAt] = useState<string | null>(null);

  // --- persistence ----------------------------------------------------------
  // Tasks save to the server (unlike notes there's no offline store), so saves
  // are serialized, retried on the next edit, and surfaced when they fail.
  const taskIdRef = useRef<string | null>(isNew ? null : id);
  const lastSavedRef = useRef<string | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const discardRef = useRef(false);

  const payload = makePayload(title, items, reminderAt);
  const payloadRef = useRef(payload);

  const doSave = async (
    currentPayload: SaveTaskPayload,
    onSuccess?: () => void
  ) => {
    if (saveStatus === 'saving') return;
    setSaveStatus('saving');
    try {
      if (isNew && !taskIdRef.current) {
        if (payloadIsEmpty(currentPayload)) {
          setSaveStatus('idle');
          return;
        }
        const created = await api.create(currentPayload);
        taskIdRef.current = created.id;
      } else if (taskIdRef.current) {
        await api.update(taskIdRef.current, currentPayload);
      }
      lastSavedRef.current = JSON.stringify(currentPayload);
      setSaveStatus('saved');
      onSuccess?.();
    } catch (error) {
      setSaveStatus('error');
      throw error;
    }
  };

  const saveNow = useCallback(async (): Promise<void> => {
    const run = async () => {
      if (discardRef.current) {
        return;
      }
      const current = payloadRef.current;
      const serialized = JSON.stringify(current);
      if (serialized === lastSavedRef.current) {
        return;
      }
      await doSave(current);
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

  useEffect(() => {
    if (isNew) {
      return;
    }
    let active = true;
    (async () => {
      try {
        const task = await api.get(id);
        if (!active) {
          return;
        }
        setTitle(task.title);
        setItems(task.items);
        lastSavedRef.current = JSON.stringify(makePayload(task.title, task.items, task.reminderAt));
        
        // Also ensure local notification state matches backend if available
        if (task.reminderAt) {
          setReminderAt(task.reminderAt);
          await setLocalReminder(id, new Date(task.reminderAt), task.title);
        } else {
          const r = await getLocalReminder(id);
          setReminderAt(r);
        }
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
    const handle = setTimeout(() => saveNowRef.current().catch(() => {}), AUTOSAVE_MS);
    return () => clearTimeout(handle);
  }, [serialized, loading]);

  // Best-effort flush when the system back gesture bypasses our back button.
  useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      saveNowRef.current().catch(() => {});
    });
  }, [navigation]);

  const done = items.filter((i) => i.isCompleted).length;
  const total = items.length;
  const ratio = total > 0 ? done / total : 0;

  const addItem = () =>
    setItems((xs) => [...xs, { id: uid(), text: '', isCompleted: false }]);

  const toggleItem = (itemId: string) =>
    setItems((xs) =>
      xs.map((i) => (i.id === itemId ? { ...i, isCompleted: !i.isCompleted } : i)),
    );

  const updateItem = (itemId: string, text: string) =>
    setItems((xs) => xs.map((i) => (i.id === itemId ? { ...i, text } : i)));

  const removeItem = (itemId: string) =>
    setItems((xs) => xs.filter((i) => i.id !== itemId));

  const goBackSaving = useCallback(async () => {
    try {
      await saveNow();
      router.back();
    } catch {
      // The save failed (most likely offline). Let the user decide instead of
      // silently dropping their edits.
      const discard = await confirmDestructive({
        title: 'Couldn’t save changes',
        message: 'You appear to be offline. Leave anyway and lose the latest edits?',
        confirmLabel: 'Discard changes',
      });
      if (discard) {
        discardRef.current = true;
        router.back();
      }
    }
  }, [saveNow, router]);

  const deleteTask = async () => {
    if (!taskIdRef.current) {
      router.back();
      return;
    }
    const confirmed = await confirmDestructive({
      title: 'Delete this task?',
      message: 'The whole checklist will be permanently deleted.',
      confirmLabel: 'Delete',
    });
    if (!confirmed) {
      return;
    }
    discardRef.current = true;
    try {
      await api.remove(taskIdRef.current);
      router.back();
    } catch {
      discardRef.current = false;
      setSaveStatus('error');
    }
  };

  const scheduleReminder = async (minutes: number) => {
    if (!taskIdRef.current) return;
    const d = new Date();
    d.setMinutes(d.getMinutes() + minutes);
    await setLocalReminder(taskIdRef.current, d, title);
    setReminderAt(d.toISOString());
    // Auto-save so the backend knows about the reminder immediately
    await doSave(makePayload(title, items, d.toISOString()));
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <View style={styles.toolbar}>
        <Pressable hitSlop={8} onPress={goBackSaving} style={styles.toolButton}>
          <Icon name="back" size={22} color={theme.text} />
        </Pressable>

        <View style={styles.toolbarActions}>
          <SaveIndicator status={saveStatus} />
          <Pressable hitSlop={8} onPress={deleteTask} style={styles.toolButton}>
            <Icon name="trash" size={20} color={theme.text} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Task title"
            placeholderTextColor={theme.textSecondary}
            style={[styles.title, { color: theme.text }]}
            multiline
          />

          {!isNew && (
            <View style={styles.reminderRow}>
              {reminderAt ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Reminder set for: {new Date(reminderAt).toLocaleString()}
                </ThemedText>
              ) : (
                <>
                  <Pressable onPress={() => scheduleReminder(1)} style={styles.chip}>
                    <ThemedText type="small" themeColor="textSecondary">Remind in 1m (Test)</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => scheduleReminder(60)} style={styles.chip}>
                    <ThemedText type="small" themeColor="textSecondary">Remind in 1h</ThemedText>
                  </Pressable>
                </>
              )}
            </View>
          )}

          {total > 0 && (
            <View style={styles.progressRow}>
              <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
                <View
                  style={[
                    styles.fill,
                    { width: `${ratio * 100}%`, backgroundColor: done === total ? '#10B981' : '#208AEF' },
                  ]}
                />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {done}/{total} done
              </ThemedText>
            </View>
          )}

          <View style={styles.items}>
            {items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Pressable
                  hitSlop={6}
                  onPress={() => toggleItem(item.id)}
                  style={[
                    styles.checkbox,
                    {
                      borderColor: item.isCompleted ? '#10B981' : theme.backgroundSelected,
                      backgroundColor: item.isCompleted ? '#10B981' : 'transparent',
                    },
                  ]}>
                  {item.isCompleted && <ThemedText style={styles.check}>✓</ThemedText>}
                </Pressable>

                <TextInput
                  value={item.text}
                  onChangeText={(text) => updateItem(item.id, text)}
                  placeholder="List item"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.itemText,
                    {
                      color: item.isCompleted ? theme.textSecondary : theme.text,
                      textDecorationLine: item.isCompleted ? 'line-through' : 'none',
                    },
                  ]}
                  multiline
                />

                <Pressable hitSlop={6} onPress={() => removeItem(item.id)} style={styles.toolButton}>
                  <Icon name="close" size={16} color={theme.textSecondary} />
                </Pressable>
              </View>
            ))}
          </View>

          <Pressable hitSlop={6} onPress={addItem} style={styles.addRow}>
            <Icon name="add" size={16} color="#208AEF" />
            <ThemedText type="smallBold" style={{ color: '#208AEF' }}>
              Add item
            </ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') {
    return null;
  }
  const label = status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Couldn’t save';
  return (
    <ThemedText
      type="small"
      themeColor="textSecondary"
      style={status === 'error' && styles.saveError}>
      {label}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
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
  saveError: {
    color: '#EF4444',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    paddingVertical: Spacing.one,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  items: {
    gap: Spacing.two,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 16,
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    paddingVertical: Spacing.one,
  },
  addRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
});
