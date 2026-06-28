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
import { NoteCard } from '@/components/notes/note-card';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNotesApi } from '@/services/notes/notes-api';
import type { Note, NoteView } from '@/services/notes/types';

const VIEWS: NoteView[] = ['Active', 'Archived', 'Trash'];

export default function NotesListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const api = useNotesApi();

  const [view, setView] = useState<NoteView>('Active');
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
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
        setNotes(await api.list(view, search));
      } catch {
        setNotes([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api, view, search],
  );

  // Debounce search + react to view changes.
  useEffect(() => {
    const handle = setTimeout(() => void load(), 250);
    return () => clearTimeout(handle);
  }, [load]);

  // Reload when returning from the editor.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function togglePin(note: Note) {
    try {
      await api.setPinned(note.id, !note.isPinned);
      await load();
    } catch {
      // Ignore; next refresh reconciles.
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <ThemedText type="subtitle">Notes</ThemedText>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search notes"
        placeholderTextColor={theme.textSecondary}
        style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        autoCapitalize="none"
        returnKeyType="search"
      />

      <View style={styles.filters}>
        {VIEWS.map((v) => {
          const active = v === view;
          return (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              style={[
                styles.chip,
                { backgroundColor: active ? theme.text : theme.backgroundElement },
              ]}>
              <ThemedText
                type="small"
                style={{ color: active ? theme.background : theme.textSecondary }}>
                {v}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.text} />
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load({ refreshing: true })} tintColor={theme.text} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <ThemedText themeColor="textSecondary">
                {view === 'Trash' ? 'Trash is empty.' : 'No notes yet. Tap + to create one.'}
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              showPin={view !== 'Trash'}
              onPress={() => router.push(`/note/${item.id}`)}
              onTogglePin={() => togglePin(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
        />
      )}

      <Pressable
        onPress={() => router.push('/note/new')}
        style={[styles.fab, { backgroundColor: '#208AEF' }]}>
        <ThemedText style={styles.fabIcon}>＋</ThemedText>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
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
  filters: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
  },
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
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
