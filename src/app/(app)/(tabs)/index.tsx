import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { NoteCard } from '@/components/notes/note-card';
import { Icon } from '@/components/ui/icon';
import { BlurLoader } from '@/components/ui/blur-loader';
import { BottomTabInset, BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNotesApi } from '@/services/notes/notes-api';
import { parseNote, type Note, type NoteKind, type NoteView } from '@/services/notes/types';

const VIEWS: NoteView[] = ['Active', 'Archived', 'Trash'];

/** Small header pill reflecting connectivity and unsynced changes. */
function SyncStatus({
  isOnline,
  isSyncing,
  pending,
}: {
  isOnline: boolean;
  isSyncing: boolean;
  pending: number;
}) {
  const theme = useTheme();
  if (isOnline && !isSyncing && pending === 0) {
    return null;
  }

  const label = !isOnline
    ? pending > 0
      ? `Offline · ${pending} change${pending === 1 ? '' : 's'} saved on device`
      : 'Offline · changes are saved on device'
    : isSyncing
      ? 'Syncing…'
      : `${pending} change${pending === 1 ? '' : 's'} to sync`;

  return (
    <View style={[styles.syncPill, { backgroundColor: theme.backgroundElement }]}>
      <Icon name={isOnline ? 'sync' : 'offline'} size={13} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

export default function NotesListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const api = useNotesApi();

  const [view, setView] = useState<NoteView>('Active');
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Show the full-screen spinner only for the very first load; later reloads
  // (search, view change, background sync) swap the list silently.
  const loadedOnce = useRef(false);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const n of notes) {
      const doc = parseNote(n.content);
      doc.tags?.forEach(t => tags.add(t));
    }
    return Array.from(tags).sort();
  }, [notes]);

  const filteredNotes = useMemo(() => {
    if (!selectedTag) return notes;
    return notes.filter(n => {
      const doc = parseNote(n.content);
      return doc.tags?.includes(selectedTag);
    });
  }, [notes, selectedTag]);

  function createNote(kind: NoteKind) {
    setShowCreate(false);
    router.push({ pathname: '/note/[id]', params: { id: 'new', kind } });
  }

  const load = useCallback(
    async (opts?: { refreshing?: boolean }) => {
      if (opts?.refreshing) {
        setRefreshing(true);
      } else if (!loadedOnce.current) {
        setLoading(true);
      }
      try {
        setNotes(await api.list(view, search));
      } catch {
        setNotes([]);
      } finally {
        loadedOnce.current = true;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api, view, search],
  );

  // Debounce search + react to view changes (also covers the initial load and
  // reloads after a background sync bumps the data version).
  useEffect(() => {
    const handle = setTimeout(() => void load(), 250);
    return () => clearTimeout(handle);
  }, [load]);

  // Reload when returning from the editor. The first focus coincides with the
  // initial load above, so skip it to avoid a duplicate query.
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await api.sync();
    await load({ refreshing: true });
  }, [api, load]);

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
        <SyncStatus
          isOnline={api.isOnline}
          isSyncing={api.isSyncing}
          pending={api.pendingCount}
        />
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search notes"
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

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
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
        </ScrollView>
      </View>

      {allTags.length > 0 && (
        <View style={styles.tagsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
            <Pressable
              onPress={() => setSelectedTag(null)}
              style={[
                styles.chip,
                { backgroundColor: selectedTag === null ? theme.primary : theme.backgroundElement },
              ]}>
              <ThemedText
                type="small"
                style={{ color: selectedTag === null ? theme.onPrimary : theme.textSecondary }}>
                All Tags
              </ThemedText>
            </Pressable>
            {allTags.map(tag => {
              const active = tag === selectedTag;
              return (
                <Pressable
                  key={tag}
                  onPress={() => setSelectedTag(tag)}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? theme.primary : theme.backgroundElement },
                  ]}>
                  <ThemedText
                    type="small"
                    style={{ color: active ? theme.onPrimary : theme.textSecondary }}>
                    #{tag}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Overlay loader when initially loading */}
      {loading && <BlurLoader />}

      <FlatList
          data={filteredNotes}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
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

      {showCreate && (
        <Pressable style={styles.dismissOverlay} onPress={() => setShowCreate(false)} />
      )}

      {showCreate && (
        <View style={styles.createMenu}>
          <Pressable
            onPress={() => createNote('text')}
            style={[styles.createOption, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="textNote" size={18} color={theme.text} />
            <ThemedText type="smallBold" style={{ color: theme.text }}>
              Text note
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => createNote('drawing')}
            style={[styles.createOption, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="drawing" size={18} color={theme.text} />
            <ThemedText type="smallBold" style={{ color: theme.text }}>
              Drawing
            </ThemedText>
          </Pressable>
        </View>
      )}

      <Pressable
        onPress={() => setShowCreate((s) => !s)}
        style={({ pressed }) => [
          styles.fab, 
          { backgroundColor: theme.primary },
          pressed && styles.fabPressed
        ]}>
        <Icon name={showCreate ? 'close' : 'add'} size={26} color={theme.onPrimary} />
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
    gap: Spacing.one,
  },
  search: {
    marginHorizontal: Spacing.four,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    fontSize: 16,
    borderWidth: 1,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  tagsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
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
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.five,
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
    backgroundColor: '#6750A4', // Hardcoded primary for fast fix, or we can use theme color in component
    ...Shadows.light.large,
  },
  fabPressed: {
    opacity: 0.85,
  },
  dismissOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  createMenu: {
    position: 'absolute',
    right: Spacing.four,
    bottom: BottomTabInset + Spacing.three + 56 + Spacing.three,
    gap: Spacing.two,
    alignItems: 'flex-end',
  },
  createOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
