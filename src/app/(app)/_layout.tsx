import { Stack } from 'expo-router';

import { NotesProvider } from '@/services/notes/notes-provider';

export default function AppLayout() {
  return (
    <NotesProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="note/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="task/[id]" options={{ presentation: 'card' }} />
      </Stack>
    </NotesProvider>
  );
}
