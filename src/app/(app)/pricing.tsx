import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { AppScreen, SectionCard } from '@/components/app-screen';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { listCalculatorHistory, saveCalculatorHistory } from '@/data/repositories/pricing';
import type { CalculatorHistoryRow } from '@/data/repositories/pricing.types';
import { formatMoney } from '@/domain/calculations';
import { formatFarmDate } from '@/domain/dates';
import { useSession } from '@/features/auth/session-provider';

function parseNumber(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(\.\d{0,3})?$/.test(normalized)) return null;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

export default function PricingScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { session } = useSession();
  const [fat, setFat] = useState('');
  const [snf, setSnf] = useState('');
  const [cmFat, setCmFat] = useState('');
  const [smFat, setSmFat] = useState('');
  const [history, setHistory] = useState<CalculatorHistoryRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fatValue = parseNumber(fat);
  const snfValue = parseNumber(snf);
  const cmFatValue = parseNumber(cmFat);
  const smFatValue = parseNumber(smFat);
  const calculatedPaise = useMemo(() => {
    if ([fatValue, snfValue, cmFatValue, smFatValue].some((value) => value === null)) return null;
    return Math.round((((fatValue! * cmFatValue!) / 100) + ((snfValue! * smFatValue!) / 100)) * 100);
  }, [cmFatValue, fatValue, smFatValue, snfValue]);

  const refreshHistory = useCallback(async () => {
    const sync = await getPowerSyncSnapshot();
    if (!sync.farmId) return;
    setHistory(await listCalculatorHistory(sync.farmId));
  }, []);
  useFocusEffect(useCallback(() => { void refreshHistory(); }, [refreshHistory]));

  const saveCalculation = async () => {
    if (!session || calculatedPaise === null || [fatValue, snfValue, cmFatValue, smFatValue].some((value) => value === null)) return;
    setSaving(true);
    setMessage(null);
    try {
      const sync = await getPowerSyncSnapshot();
      if (!sync.farmId) throw new Error('Set up the farm before saving calculator history.');
      await saveCalculatorHistory({
        farmId: sync.farmId,
        userId: session.user.id,
        fatThousandths: Math.round(fatValue! * 1_000),
        snfThousandths: Math.round(snfValue! * 1_000),
        cmFatPaise: Math.round(cmFatValue!),
        cmSnfPaise: Math.round(smFatValue!),
        resultPaisePerLitre: calculatedPaise,
      });
      setMessage('Calculation saved to history.');
      await refreshHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save this calculation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen title="Price calculator" subtitle="A reference calculator; buyer rates are set separately in Master data.">
      <SectionCard title="Milk quality inputs">
        <View style={styles.row}>
          <Field label="FAT %" value={fat} onChangeText={setFat} placeholder="Example: 4.2" invalid={fat.length > 0 && fatValue === null} />
          <Field label="SNF %" value={snf} onChangeText={setSnf} placeholder="Example: 8.5" invalid={snf.length > 0 && snfValue === null} />
        </View>
      </SectionCard>
      <SectionCard title="Coefficients">
        <Field label="CMFAT coefficient" value={cmFat} onChangeText={setCmFat} placeholder="Example: 415" invalid={cmFat.length > 0 && cmFatValue === null} />
        <Field label="CMSNF coefficient" value={smFat} onChangeText={setSmFat} placeholder="Example: 287" invalid={smFat.length > 0 && smFatValue === null} />
      </SectionCard>
      <SectionCard title="Calculated price">
        <Text style={[styles.result, { color: colors.text }]}>{calculatedPaise === null ? 'Enter FAT, SNF, CMFAT, and CMSNF.' : `${formatMoney(calculatedPaise)} / L`}</Text>
        <Text style={[styles.helper, { color: colors.textSecondary }]}>Formula: ((FAT × CMFAT) / 100) + ((SNF × CMSNF) / 100).</Text>
        <Pressable accessibilityLabel="Save calculation to history" disabled={saving || calculatedPaise === null} onPress={() => void saveCalculation()} style={[styles.save, { backgroundColor: colors.primary }, (saving || calculatedPaise === null) && styles.disabled]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save calculation</Text>}</Pressable>
        {message ? <Text style={[styles.helper, { color: colors.textSecondary }]}>{message}</Text> : null}
      </SectionCard>
      <SectionCard title={`Calculation history (${history.length})`}>
        {history.length ? history.map((entry) => <View key={entry.id} style={[styles.historyRow, { borderBottomColor: colors.border }]}><Text style={[styles.historyResult, { color: colors.text }]}>{formatMoney(entry.resultPaisePerLitre)} / L</Text><Text style={[styles.helper, { color: colors.textSecondary }]}>{formatFarmDate(entry.createdAt)} · FAT {formatThousandths(entry.fatThousandths)}% · SNF {formatThousandths(entry.snfThousandths)}%</Text><Text style={[styles.helper, { color: colors.textSecondary }]}>CMFAT ₹{formatPaise(entry.cmFatPaise)} · CMSNF ₹{formatPaise(entry.cmSnfPaise)}</Text></View>) : <Text style={[styles.helper, { color: colors.textSecondary }]}>Saved calculations will appear here.</Text>}
      </SectionCard>
    </AppScreen>
  );
}

function formatThousandths(value: number) { return (value / 1_000).toFixed(3).replace(/\.0+$/, ''); }
function formatPaise(value: number) { return String(value); }

function Field({ label, value, onChangeText, placeholder, invalid, numeric }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; invalid: boolean; numeric?: boolean }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput accessibilityLabel={label} keyboardType={numeric ? 'decimal-pad' : 'numbers-and-punctuation'} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, borderColor: invalid ? colors.danger : colors.border }]} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  helper: { fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, gap: 6 },
  label: { fontSize: 14, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 16 },
  result: { fontSize: 28, fontWeight: '800' },
  save: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', minHeight: 48 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  historyRow: { borderBottomWidth: StyleSheet.hairlineWidth, gap: 3, paddingVertical: 10 },
  historyResult: { fontSize: 17, fontWeight: '800' },
});
