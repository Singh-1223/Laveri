import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { listCorrectionEvents } from '@/data/repositories/corrections';
import type { CorrectionAction, CorrectionEntity, CorrectionEventRow } from '@/data/repositories/corrections.types';
import { formatMilk } from '@/domain/calculations';

type ActionFilter = 'all' | CorrectionAction;

const ignoredFields = new Set(['created_at', 'updated_at', 'created_by', 'updated_by', 'version']);

export default function CorrectionsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [events, setEvents] = useState<CorrectionEventRow[]>([]);
  const [filter, setFilter] = useState<ActionFilter>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sync = await getPowerSyncSnapshot();
      setEvents(sync.farmId ? await listCorrectionEvents(sync.farmId) : []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load correction history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const timeout = setTimeout(() => void refresh(), 0);
      return () => clearTimeout(timeout);
    }, [refresh]),
  );

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return events.filter((event) => {
      if (filter !== 'all' && event.action !== filter) return false;
      if (!query) return true;
      return [entityLabel(event.entityType), event.action, event.reason, event.recordId, event.createdByLabel]
        .some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [events, filter, search]);

  return (
    <AppScreen title="Correction history" subtitle="Immutable before-and-after records saved locally and synchronized">
      <TextInput accessibilityLabel="Search correction history" onChangeText={setSearch} placeholder="Search type, action, reason, or user" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={search} />
      <View style={styles.filters}>
        {(['all', 'update', 'deactivate', 'reactivate', 'void'] as const).map((value) => (
          <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filter, { backgroundColor: filter === value ? colors.primary : colors.backgroundSelected }]}>
            <Text style={{ color: filter === value ? '#FFFFFF' : colors.text, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{value}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <SectionCard title={`Changes (${visible.length})`}>
        {loading ? <ActivityIndicator color={colors.primary} /> : events.length === 0 ? <EmptyState>No corrections have been recorded yet.</EmptyState> : visible.length === 0 ? <EmptyState>No changes match this filter.</EmptyState> : visible.map((event) => {
          const expanded = expandedId === event.id;
          return (
            <View key={event.id} style={[styles.event, { borderTopColor: colors.border }]}>
              <Pressable onPress={() => setExpandedId(expanded ? null : event.id)} style={styles.eventHeader}>
                <View style={styles.eventCopy}>
                  <Text style={[styles.eventTitle, { color: colors.text }]}>{entityLabel(event.entityType)} · {actionLabel(event.action)}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>{formatTimestamp(event.occurredAt)} · {event.createdByLabel}</Text>
                  {event.reason ? <Text style={[styles.reason, { color: colors.danger }]}>Reason: {event.reason}</Text> : null}
                </View>
                <Text style={[styles.expand, { color: colors.primary }]}>{expanded ? 'Hide' : 'Review'}</Text>
              </Pressable>
              {expanded ? <ChangeDetails event={event} /> : null}
            </View>
          );
        })}
      </SectionCard>
    </AppScreen>
  );
}

function ChangeDetails({ event }: { event: CorrectionEventRow }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const before = parseSnapshot(event.beforeData);
  const after = parseSnapshot(event.afterData);

  if (event.entityType === 'milk_session') {
    const beforeSummary = summarizeMilkSnapshot(before);
    const afterSummary = summarizeMilkSnapshot(after);
    return (
      <View style={[styles.details, { backgroundColor: colors.backgroundSelected }]}>
        <Text style={[styles.detailHeading, { color: colors.text }]}>Session totals</Text>
        <Text style={[styles.detailLine, { color: colors.textSecondary }]}>Before: {formatMilk(beforeSummary.producedMl)} produced · {formatMilk(beforeSummary.allocatedMl)} allocated</Text>
        <Text style={[styles.detailLine, { color: colors.textSecondary }]}>After: {formatMilk(afterSummary.producedMl)} produced · {formatMilk(afterSummary.allocatedMl)} allocated</Text>
      </View>
    );
  }

  const changes = changedFields(before, after);
  return (
    <View style={[styles.details, { backgroundColor: colors.backgroundSelected }]}>
      {changes.length === 0 ? <Text style={[styles.detailLine, { color: colors.textSecondary }]}>No field differences could be displayed.</Text> : changes.map((change) => (
        <View key={change.field} style={styles.changeRow}>
          <Text style={[styles.detailHeading, { color: colors.text }]}>{humanize(change.field)}</Text>
          <Text style={[styles.detailLine, { color: colors.textSecondary }]}>{displayValue(change.before)} → {displayValue(change.after)}</Text>
        </View>
      ))}
    </View>
  );
}

function parseSnapshot(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function changedFields(before: unknown, after: unknown) {
  if (!isRecord(before) || !isRecord(after)) return [];
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...fields]
    .filter((field) => !ignoredFields.has(field) && JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .map((field) => ({ field, before: before[field], after: after[field] }));
}

function summarizeMilkSnapshot(value: unknown) {
  if (!isRecord(value)) return { producedMl: 0, allocatedMl: 0 };
  const entries = Array.isArray(value.entries) ? value.entries : [];
  const allocations = Array.isArray(value.allocations) ? value.allocations : [];
  return {
    producedMl: entries.reduce((sum, row) => sum + numericField(row, 'volume_ml'), 0),
    allocatedMl: allocations.reduce((sum, row) => sum + numericField(row, 'volume_ml'), 0),
  };
}

function numericField(value: unknown, field: string) {
  return isRecord(value) && typeof value[field] === 'number' ? value[field] : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (value === 0 || value === 1) return String(value);
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function entityLabel(entity: CorrectionEntity) {
  const labels: Record<CorrectionEntity, string> = {
    farm_settings: 'Farm settings',
    milk_pricing_configs: 'Milk pricing',
    animals: 'Animal',
    buyers: 'Buyer',
    items: 'Item',
    milk_session: 'Milk session',
    feed_transactions: 'Feed record',
    treatments: 'Treatment',
    product_transactions: 'Product record',
    heat_events: 'Heat event',
  };
  return labels[entity];
}

function actionLabel(action: CorrectionAction) {
  if (action === 'update') return 'Edited';
  if (action === 'deactivate') return 'Deactivated';
  if (action === 'reactivate') return 'Reactivated';
  return 'Voided';
}

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

const styles = StyleSheet.create({
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filter: { minHeight: 36, borderRadius: 18, justifyContent: 'center', paddingHorizontal: 12 },
  error: { fontSize: 14, lineHeight: 20 },
  event: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 10 },
  eventHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eventCopy: { flex: 1, gap: 3 },
  eventTitle: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 12, lineHeight: 17 },
  reason: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  expand: { fontSize: 13, fontWeight: '800' },
  details: { borderRadius: 12, padding: 12, gap: 8 },
  changeRow: { gap: 2 },
  detailHeading: { fontSize: 13, fontWeight: '800' },
  detailLine: { fontSize: 12, lineHeight: 18 },
});
