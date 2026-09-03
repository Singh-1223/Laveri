import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="master-data" options={{ title: 'Master data', headerShown: true }} />
      <Stack.Screen name="buyer-account/[id]" options={{ title: 'Buyer account', headerShown: true }} />
      <Stack.Screen name="pricing" options={{ title: 'Milk pricing', headerShown: true }} />
      <Stack.Screen name="reminders" options={{ title: 'Milk reminders', headerShown: true }} />
      <Stack.Screen name="sync-status" options={{ title: 'Sync status', headerShown: true }} />
      <Stack.Screen name="corrections" options={{ title: 'Correction history', headerShown: true }} />
    </Stack>
  );
}
