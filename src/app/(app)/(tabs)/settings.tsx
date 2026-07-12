import Constants from 'expo-constants';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { confirmDestructive } from '@/components/ui/confirm';
import { Icon, type IconName } from '@/components/ui/icon';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/services/auth/session-context';
import { useNotesApi } from '@/services/notes/notes-api';

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, signOut } = useSession();
  const notes = useNotesApi();
  const [signingOut, setSigningOut] = useState(false);

  const syncLabel = !notes.isOnline
    ? 'Offline'
    : notes.isSyncing
      ? 'Syncing…'
      : notes.pendingCount > 0
        ? `${notes.pendingCount} change${notes.pendingCount === 1 ? '' : 's'} to sync`
        : 'Up to date';

  const onEmptyTrash = async () => {
    const confirmed = await confirmDestructive({
      title: 'Empty trash?',
      message: 'All notes in the trash will be permanently deleted.',
      confirmLabel: 'Empty trash',
    });
    if (confirmed) {
      await notes.emptyTrash();
    }
  };

  const onSignOut = async () => {
    const confirmed = await confirmDestructive({
      title: 'Sign out?',
      message:
        notes.pendingCount > 0
          ? `You have ${notes.pendingCount} unsynced change${notes.pendingCount === 1 ? '' : 's'} that will stay on this device.`
          : undefined,
      confirmLabel: 'Sign out',
    });
    if (!confirmed) {
      return;
    }
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <ThemedText type="subtitle">Settings</ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Account">
          <Row icon="person" label={user?.email ?? '—'} />
        </Section>

        <Section title="Sync">
          <Row icon={notes.isOnline ? 'sync' : 'offline'} label={syncLabel} />
          <RowButton
            icon="sync"
            label="Sync now"
            disabled={!notes.isOnline || notes.isSyncing}
            onPress={() => void notes.sync()}
          />
        </Section>

        <Section title="Notes">
          <RowButton icon="trash" label="Empty trash" destructive onPress={onEmptyTrash} />
        </Section>

        <Section title="Session">
          <RowButton
            icon="logout"
            label={signingOut ? 'Signing out…' : 'Sign out'}
            destructive
            disabled={signingOut}
            onPress={onSignOut}
          />
        </Section>

        <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
          HobbyApp {Constants.expoConfig?.version ?? ''}
        </ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>{children}</View>
    </View>
  );
}

function Row({ icon, label }: { icon: IconName; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={18} color={theme.textSecondary} />
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
    </View>
  );
}

function RowButton({
  icon,
  label,
  onPress,
  destructive,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const color = destructive ? '#EF4444' : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, (pressed || disabled) && styles.rowPressed]}>
      <Icon name={icon} size={18} color={disabled ? theme.textSecondary : color} />
      <ThemedText style={[styles.rowLabel, { color: disabled ? theme.textSecondary : color }]}>
        {label}
      </ThemedText>
    </Pressable>
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
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowLabel: {
    flex: 1,
  },
  version: {
    textAlign: 'center',
    paddingTop: Spacing.two,
  },
});
