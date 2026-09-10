import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { listHouseholdMonths, saveHouseholdMonth } from '@/data/repositories/household-consumption';
import type { HouseholdMonth } from '@/data/repositories/household-consumption.types';
import { formatMilk, formatMoney } from '@/domain/calculations';
import { useSession } from '@/features/auth/session-provider';

type MonthDraft = { rate: string; payment: string };

function storedDraft(row: HouseholdMonth): MonthDraft {
  return {
    rate: row.ratePaisePerLitre === null ? '' : String(row.ratePaisePerLitre / 100),
    payment: row.selfPaymentPaise ? String(row.selfPaymentPaise / 100) : '',
  };
}

function monthTitle(monthKey: string) {
  return new Date(`${monthKey}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function HouseholdConsumptionScreen() {
  const colors = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const { session } = useSession();
  const [farmId, setFarmId] = useState<string | null>(null);
  const [months, setMonths] = useState<HouseholdMonth[]>([]);
  const [drafts, setDrafts] = useState<Record<string, MonthDraft>>({});
  const [editingMonthKey, setEditingMonthKey] = useState<string | null>(null);
  const [savingMonthKey, setSavingMonthKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const load = useCallback(async () => {
    const sync = await getPowerSyncSnapshot();
    setFarmId(sync.farmId);
    if (!sync.farmId) return;
    const rows = await listHouseholdMonths(sync.farmId);
    setMonths(rows);
    setDrafts(Object.fromEntries(rows.map((row) => [row.monthKey, storedDraft(row)])));
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const selectedMonths = months.filter((row) => Number(row.monthKey.slice(0, 4)) === selectedYear);
  const canMoveForward = selectedYear < new Date().getFullYear();

  const updateDraft = (monthKey: string, patch: Partial<MonthDraft>) => {
    setDrafts((current) => ({ ...current, [monthKey]: { ...(current[monthKey] ?? { rate: '', payment: '' }), ...patch } }));
  };

  const save = async (row: HouseholdMonth) => {
    if (!farmId || !session) return;
    const draft = drafts[row.monthKey] ?? { rate: '', payment: '' };
    const rate = draft.rate.trim() ? Math.round(Number(draft.rate) * 100) : null;
    const payment = draft.payment.trim() ? Math.round(Number(draft.payment) * 100) : 0;
    if ((rate !== null && (!Number.isSafeInteger(rate) || rate < 0)) || !Number.isSafeInteger(payment) || payment < 0) {
      setMessage('Enter valid non-negative rate and self-payment amounts.');
      return;
    }
    setSavingMonthKey(row.monthKey);
    try {
      await saveHouseholdMonth({ farmId, userId: session.user.id, monthKey: row.monthKey, ratePaisePerLitre: rate, selfPaymentPaise: payment });
      setEditingMonthKey(null);
      setMessage('Monthly household details saved.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save monthly household details.');
    } finally {
      setSavingMonthKey(null);
    }
  };

  return (
    <AppScreen title="Household consumption" subtitle="Monthly totals from Milk Entry">
      <SectionCard title="Monthly consumption">
        <View style={styles.yearNavigation}>
          <Pressable accessibilityLabel="Previous year" onPress={() => { setEditingMonthKey(null); setSelectedYear((year) => year - 1); }} style={[styles.yearButton, { borderColor: colors.border }]}><Text style={{ color: colors.primary }}>‹ Previous</Text></Pressable>
          <Text style={[styles.yearTitle, { color: colors.text }]}>{selectedYear}</Text>
          <Pressable accessibilityLabel="Next year" disabled={!canMoveForward} onPress={() => { setEditingMonthKey(null); setSelectedYear((year) => year + 1); }} style={[styles.yearButton, { borderColor: colors.border }, !canMoveForward && styles.disabled]}><Text style={{ color: colors.primary }}>Next ›</Text></Pressable>
        </View>
        {selectedMonths.length ? selectedMonths.map((row) => {
          const draft = drafts[row.monthKey] ?? storedDraft(row);
          const isSaved = row.settingsId !== null;
          const isEditing = !isSaved || editingMonthKey === row.monthKey;
          const typedRate = draft.rate.trim() ? Math.round(Number(draft.rate) * 100) : null;
          const effectiveRate = isEditing && typedRate !== null && Number.isSafeInteger(typedRate) && typedRate >= 0 ? typedRate : row.ratePaisePerLitre;
          const amount = effectiveRate === null ? null : Math.round((row.consumedMl * effectiveRate) / 1_000);
          const saving = savingMonthKey === row.monthKey;
          return (
            <View key={row.monthKey} style={[styles.monthCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.monthHeader}>
                <Text style={[styles.monthTitle, { color: colors.text }]}>{monthTitle(row.monthKey)}</Text>
                {isSaved && !isEditing ? <Pressable accessibilityLabel={`Edit ${monthTitle(row.monthKey)}`} onPress={() => { setDrafts((current) => ({ ...current, [row.monthKey]: storedDraft(row) })); setEditingMonthKey(row.monthKey); }} style={[styles.editButton, { borderColor: colors.primary }]}><Text style={[styles.editText, { color: colors.primary }]}>Edit</Text></Pressable> : null}
              </View>
              <View style={styles.summaryRow}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total milk consumed</Text><Text style={[styles.summaryValue, { color: colors.text }]}>{formatMilk(row.consumedMl)}</Text></View>
              <View style={styles.summaryRow}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total amount</Text><Text style={[styles.summaryValue, { color: colors.text }]}>{amount === null ? 'Set monthly rate' : formatMoney(amount)}</Text></View>

              {isEditing ? <View style={styles.editor}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Milk rate (₹ / L)</Text>
                <TextInput value={draft.rate} onChangeText={(rate) => updateDraft(row.monthKey, { rate })} placeholder="Milk rate ₹ / L" placeholderTextColor={colors.textSecondary} keyboardType="decimal-pad" style={[styles.input, { borderColor: colors.border, color: colors.text }]} />
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Self payment (₹)</Text>
                <TextInput value={draft.payment} onChangeText={(payment) => updateDraft(row.monthKey, { payment })} placeholder="Self payment ₹" placeholderTextColor={colors.textSecondary} keyboardType="decimal-pad" style={[styles.input, { borderColor: colors.border, color: colors.text }]} />
                <View style={styles.actions}>
                  {isSaved ? <Pressable disabled={saving} onPress={() => { setDrafts((current) => ({ ...current, [row.monthKey]: storedDraft(row) })); setEditingMonthKey(null); }} style={[styles.cancelButton, { borderColor: colors.border }]}><Text style={{ color: colors.text }}>Cancel</Text></Pressable> : null}
                  <Pressable disabled={saving} onPress={() => void save(row)} style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.disabled]}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save month'}</Text></Pressable>
                </View>
              </View> : <View style={[styles.summaryRow, styles.paymentRow, { borderTopColor: colors.border }]}><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Self payment</Text><Text style={[styles.summaryValue, { color: colors.text }]}>{row.selfPaymentPaise ? formatMoney(row.selfPaymentPaise) : 'Not recorded'}</Text></View>}
            </View>
          );
        }) : <EmptyState>No household consumption has been recorded in {selectedYear}.</EmptyState>}
        {message ? <Text style={{ color: colors.textSecondary }}>{message}</Text> : null}
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  yearNavigation: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  yearButton: { borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  yearTitle: { fontSize: 20, fontWeight: '800' },
  monthCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 10, padding: 14 },
  monthHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  monthTitle: { flex: 1, fontSize: 18, fontWeight: '800' },
  editButton: { borderRadius: 9, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  editText: { fontSize: 14, fontWeight: '800' },
  summaryRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 15, fontWeight: '700', textAlign: 'right' },
  paymentRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  editor: { gap: 7, marginTop: 2 },
  inputLabel: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  input: { borderRadius: 10, borderWidth: 1, fontSize: 16, minHeight: 46, paddingHorizontal: 11 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 5 },
  cancelButton: { alignItems: 'center', borderRadius: 10, borderWidth: 1, justifyContent: 'center', minHeight: 46, paddingHorizontal: 16 },
  saveButton: { alignItems: 'center', borderRadius: 10, flex: 1, justifyContent: 'center', minHeight: 46 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.55 },
});
