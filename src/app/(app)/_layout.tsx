import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="note/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="task/[id]" options={{ presentation: 'card' }} />
    </Stack>
  );
}
