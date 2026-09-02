import { StyleSheet, Text, useColorScheme } from 'react-native';

import { AppScreen, SectionCard } from '@/components/app-screen';
import { Colors } from '@/constants/theme';

export function FeaturePlaceholder({ title, subtitle, next }: { title: string; subtitle: string; next: string }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return (
    <AppScreen title={title} subtitle={subtitle}>
      <SectionCard title="Coming in this MVP">
        <Text style={[styles.copy, { color: colors.textSecondary }]}>{next}</Text>
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  copy: { fontSize: 15, lineHeight: 22 },
});
