import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTasksApi } from '@/services/tasks/tasks-api';
import type { Task } from '@/services/tasks/types';

export default function TasksListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const api = useTasksApi();

  const [search, setSearch] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (opts?: { refreshing?: boolean }) => {
      if (opts?.refreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        setTasks(await api.list(search));
      } catch {
        setTasks([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api, search],
  );

  useEffect(() => {
    const handle = setTimeout(() => void load(), 250);
    return () => clearTimeout(handle);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <ThemedText type="subtitle">Tasks</ThemedText>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search tasks"
        placeholderTextColor={theme.textSecondary}
        style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        autoCapitalize="none"
        returnKeyType="search"
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.text} />
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ refreshing: true })}
              tintColor={theme.text}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <ThemedText themeColor="textSecondary">No tasks yet. Tap + to create one.</ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <TaskRow task={item} onPress={() => router.push(`/task/${item.id}`)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
        />
      )}

      <Pressable
        onPress={() => router.push('/task/new')}
        style={[styles.fab, { backgroundColor: '#208AEF' }]}>
        <ThemedText style={styles.fabIcon}>＋</ThemedText>
      </Pressable>
    </SafeAreaView>
  );
}

function TaskRow({ task, onPress }: { task: Task; onPress: () => void }) {
  const theme = useTheme();
  const done = task.completedCount;
  const total = task.totalCount;
  const ratio = total > 0 ? done / total : 0;
  const allDone = total > 0 && done === total;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold" numberOfLines={2}>
        {task.title.trim().length > 0 ? task.title : 'Untitled task'}
      </ThemedText>

      <View style={styles.progressRow}>
        <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
          <View
            style={[
              styles.fill,
              { width: `${ratio * 100}%`, backgroundColor: allDone ? '#10B981' : '#208AEF' },
            ]}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {done}/{total}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  search: {
    marginHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  list: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.six,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  pressed: { opacity: 0.8 },
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
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: BottomTabInset + Spacing.three,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: 600,
  },
});
