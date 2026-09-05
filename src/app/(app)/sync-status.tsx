import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { Colors } from '@/constants/theme';
import { connectPowerSync, getPowerSyncSnapshot } from '@/data/powersync/platform';
import type { PowerSyncSnapshot } from '@/data/powersync/types';

export default function SyncStatusScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [snapshot, setSnapshot] = useState<PowerSyncSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await getPowerSyncSnapshot());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read synchronization status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    const poll = () => { if (active) void refresh(); };
    poll();
    const interval = setInterval(poll, 3_000);
    return () => { active = false; clearInterval(interval); };
  }, [refresh]));

  const syncNow = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await connectPowerSync();
      const updated = await getPowerSyncSnapshot();
      setSnapshot(updated);
      setMessage(updated.error
        ? 'A queued record is still being rejected. Read the Sync issue above before trying again.'
        : 'Synchronization is active. Pending records upload automatically when the network is available.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to start synchronization.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppScreen title="Sync status" subtitle="Local saves remain available while the network is offline">
      <View style={styles.metrics}>
        <Metric label="Connection" value={snapshot?.connected ? 'Online' : 'Offline'} />
        <Metric label="Pending uploads" value={String(snapshot?.pendingUploads ?? 0)} />
        <Metric label="First download" value={snapshot?.hasSynced ? 'Complete' : 'Waiting'} />
        <Metric label="Last sync" value={formatTimestamp(snapshot?.lastSyncedAt ?? null)} />
      </View>

      {snapshot?.error ? <Text style={[styles.error, { color: colors.danger }]}>{snapshot.error}</Text> : null}
      {message ? <Text style={[styles.message, { color: !snapshot?.error && message.includes('active') ? colors.primary : colors.danger }]}>{message}</Text> : null}
      <Pressable disabled={loading} onPress={() => void syncNow()} style={[styles.button, { backgroundColor: colors.primary }, loading && styles.disabled]}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Sync now</Text>}
      </Pressable>

      <SectionCard title={`Unresolved conflicts (${snapshot?.conflicts.length ?? 0})`}>
        {!snapshot || snapshot.conflicts.length === 0 ? <EmptyState>No stale-edit conflicts are waiting for review.</EmptyState> : snapshot.conflicts.map((conflict) => (
          <View key={conflict.id} style={[styles.conflict, { borderTopColor: colors.border }]}>
            <Text style={[styles.conflictTitle, { color: colors.text }]}>{humanize(conflict.table_name)} · {conflict.operation}</Text>
            <Text style={[styles.error, { color: colors.danger }]}>{conflict.message}</Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>{formatTimestamp(conflict.created_at)} · record {conflict.record_id}</Text>
          </View>
        ))}
      </SectionCard>
    </AppScreen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return <View style={[styles.metric, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}><Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text><Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text></View>;
}

function formatTimestamp(value: string | null) {
  if (!value) return 'Not yet';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '48%', flexGrow: 1, minHeight: 84, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, justifyContent: 'space-between' },
  metricLabel: { fontSize: 12, fontWeight: '700' },
  metricValue: { fontSize: 16, fontWeight: '800' },
  error: { fontSize: 13, lineHeight: 19 },
  message: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  button: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  conflict: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 4 },
  conflictTitle: { fontSize: 14, fontWeight: '800' },
  meta: { fontSize: 11, lineHeight: 17 },
});
