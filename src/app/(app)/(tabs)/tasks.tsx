import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { BlurLoader } from '@/components/ui/blur-loader';
import { BottomTabInset, BorderRadius, Shadows, Spacing } from '@/constants/theme';
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
  // Tasks are online-only, so a failed load must look different from an empty
  // list. Stale results are kept on screen while the banner shows.
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(
    async (opts?: { refreshing?: boolean }) => {
      if (opts?.refreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        setTasks(await api.list(search));
        setLoadFailed(false);
      } catch {
        setLoadFailed(true);
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

  // Reload when returning from the editor; the first focus coincides with the
  // initial load above, so skip it to avoid a duplicate request.
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
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
        style={[
          styles.search, 
          { 
            color: theme.text, 
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundElement,
          }
        ]}
        autoCapitalize="none"
        returnKeyType="search"
      />

      {loadFailed && (
        <View style={[styles.errorBanner, { backgroundColor: theme.backgroundElement }]}>
          <Icon name="offline" size={16} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
            Couldn’t load tasks — check your connection.
          </ThemedText>
          <Pressable hitSlop={8} onPress={() => void load()}>
            <ThemedText type="smallBold" style={{ color: '#208AEF' }}>
              Retry
            </ThemedText>
          </Pressable>
        </View>
      )}

      {loading && <BlurLoader />}

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
            loadFailed ? null : (
              <View style={styles.center}>
                <ThemedText themeColor="textSecondary">No tasks yet. Tap + to create one.</ThemedText>
              </View>
            )
          }
          renderItem={({ item }) => (
            <TaskRow task={item} onPress={() => router.push(`/task/${item.id}`)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
        />

      <Pressable
        onPress={() => router.push('/task/new')}
        style={({ pressed }) => [
          styles.fab, 
          { backgroundColor: theme.primary },
          pressed && styles.fabPressed
        ]}>
        <Icon name="add" size={26} color={theme.onPrimary} />
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
    <Card elevationLevel="small" style={{ padding: 0, backgroundColor: theme.card }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
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
                { width: `${ratio * 100}%`, backgroundColor: allDone ? '#10B981' : theme.primary },
              ]}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {done}/{total}
          </ThemedText>
        </View>
      </Pressable>
    </Card>
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
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    fontSize: 16,
    borderWidth: 1,
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  errorText: {
    flex: 1,
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
    backgroundColor: '#6750A4',
    ...Shadows.light.large,
  },
  fabPressed: {
    opacity: 0.85,
  },
});
