import { Tabs } from 'expo-router';
import { StyleSheet, Text, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

const tabIcons: Record<string, string> = {
  index: '⌂',
  milk: '◒',
  herd: '♧',
  expenses: '₹',
  reports: '▥',
};

export default function TabsLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.backgroundElement, borderTopColor: colors.border },
        tabBarLabelStyle: styles.label,
        tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{tabIcons[route.name] ?? '•'}</Text>,
      })}>
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="milk" options={{ title: 'Milk' }} />
      <Tabs.Screen name="herd" options={{ title: 'Herd' }} />
      <Tabs.Screen name="expenses" options={{ title: 'Expenses' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '600' },
  icon: { fontSize: 21, fontWeight: '700' },
});
