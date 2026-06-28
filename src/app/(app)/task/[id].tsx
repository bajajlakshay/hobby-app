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

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTasksApi } from '@/services/tasks/tasks-api';
import type { ChecklistItem } from '@/services/tasks/types';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function TaskEditorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const api = useTasksApi();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const [taskId, setTaskId] = useState<string | null>(isNew ? null : id);
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(!isNew);

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

  const done = items.filter((i) => i.isCompleted).length;
  const total = items.length;
  const ratio = total > 0 ? done / total : 0;

  const isEmpty = useMemo(
    () => title.trim().length === 0 && items.every((i) => i.text.trim().length === 0),
    [title, items],
  );

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

  const buildPayload = useCallback(
    () => ({
      title: title.trim(),
      items: items
        .filter((i) => i.text.trim().length > 0)
        .map((i) => ({ id: i.id, text: i.text.trim(), isCompleted: i.isCompleted })),
    }),
    [title, items],
  );

  const ensureSaved = useCallback(async (): Promise<string | null> => {
    const payload = buildPayload();
    if (taskId) {
      await api.update(taskId, payload);
      return taskId;
    }
    if (isEmpty) {
      return null;
    }
    const created = await api.create(payload);
    setTaskId(created.id);
    return created.id;
  }, [api, buildPayload, isEmpty, taskId]);

  const goBackSaving = useCallback(async () => {
    try {
      await ensureSaved();
    } catch {
      // Navigation proceeds regardless.
    } finally {
      router.back();
    }
  }, [ensureSaved, router]);

  const deleteTask = async () => {
    if (taskId) {
      await api.remove(taskId);
    }
    router.back();
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
        <Pressable hitSlop={8} onPress={goBackSaving}>
          <ThemedText style={styles.back}>‹</ThemedText>
        </Pressable>
        <Pressable hitSlop={8} onPress={deleteTask}>
          <ThemedText style={styles.toolEmoji}>🗑️</ThemedText>
        </Pressable>
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

                <Pressable hitSlop={6} onPress={() => removeItem(item.id)}>
                  <ThemedText style={[styles.remove, { color: theme.textSecondary }]}>✕</ThemedText>
                </Pressable>
              </View>
            ))}
          </View>

          <Pressable hitSlop={6} onPress={addItem} style={styles.addRow}>
            <ThemedText type="smallBold" style={{ color: '#208AEF' }}>
              ＋ Add item
            </ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  back: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: 600,
  },
  toolEmoji: {
    fontSize: 20,
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
  remove: {
    fontSize: 16,
    paddingHorizontal: Spacing.one,
  },
  addRow: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
  },
});
