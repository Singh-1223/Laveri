import { Link, useFocusEffect } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import type { PowerSyncSnapshot } from '@/data/powersync/types';

type AppScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
  scroll?: boolean;
}>;

export function AppScreen({ title, subtitle, action, scroll = true, children }: AppScreenProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const content = (
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        </View>
        <View style={styles.headerActions}>
          {action}
          <SyncPill />
        </View>
      </View>
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height' })} style={styles.keyboardAvoiding}>
        {scroll ? <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.scroll} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">{content}</ScrollView> : content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SyncPill() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [snapshot, setSnapshot] = useState<PowerSyncSnapshot | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = () => void getPowerSyncSnapshot().then((next) => {
      if (active) setSnapshot(next);
    }).catch(() => undefined);
    refresh();
    const interval = setInterval(refresh, 5_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []));

  if (!snapshot?.farmId) return null;
  const failed = Boolean(snapshot.error) || snapshot.conflicts.length > 0;
  const pending = snapshot.pendingUploads > 0 || !snapshot.connected;
  const label = failed ? 'Sync issue' : pending ? `${snapshot.pendingUploads} pending` : 'Synced';
  const color = failed ? colors.danger : pending ? '#A66B00' : colors.primary;

  return (
    <Link href="/sync-status" asChild>
      <Pressable accessibilityLabel={`Synchronization status: ${label}`} style={StyleSheet.flatten([styles.syncPill, { borderColor: color }])}>
        <View style={[styles.syncDot, { backgroundColor: color }]} />
        <Text style={[styles.syncText, { color }]}>{label}</Text>
      </Pressable>
    </Link>
  );
}

export function SectionCard({ title, children }: PropsWithChildren<{ title?: string }>) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
      {title ? <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function EmptyState({ children }: PropsWithChildren) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return <Text style={[styles.empty, { color: colors.textSecondary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboardAvoiding: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingBottom: 28, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, paddingTop: 12 },
  headerText: { flex: 1, gap: 4 },
  headerActions: { alignItems: 'flex-end', gap: 8 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 15, lineHeight: 21 },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  empty: { fontSize: 15, lineHeight: 22 },
  syncPill: { minHeight: 32, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  syncDot: { width: 7, height: 7, borderRadius: 4 },
  syncText: { fontSize: 11, fontWeight: '800' },
});
