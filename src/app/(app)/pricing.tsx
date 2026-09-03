import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { DateField } from '@/components/date-field';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { loadPricingSettings, saveMilkPricingConfig, setMilkPricingMode } from '@/data/repositories/pricing';
import type { MilkPricingConfigRow, MilkPricingMode } from '@/data/repositories/pricing.types';
import { formatMoney } from '@/domain/calculations';
import { formatFarmDate } from '@/domain/dates';
import { useSession } from '@/features/auth/session-provider';

function todayAtFarm() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function parseRupees(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const paise = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(paise) ? paise : null;
}

export default function PricingScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { session } = useSession();
  const [farmId, setFarmId] = useState<string | null>(null);
  const [mode, setMode] = useState<MilkPricingMode>('flat');
  const [effectiveFrom, setEffectiveFrom] = useState(todayAtFarm);
  const [flatRate, setFlatRate] = useState('');
  const [cmFat, setCmFat] = useState('');
  const [cmSnf, setCmSnf] = useState('');
  const [configs, setConfigs] = useState<MilkPricingConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const sync = await getPowerSyncSnapshot();
      setFarmId(sync.farmId);
      if (!sync.farmId) {
        setConfigs([]);
        return;
      }
      const snapshot = await loadPricingSettings(sync.farmId);
      setMode(snapshot.mode);
      setConfigs(snapshot.configs);
      const current = snapshot.configs.find((config) => config.mode === snapshot.mode && config.effectiveFrom <= todayAtFarm());
      if (current?.flatRatePaisePerLitre !== null && current?.flatRatePaisePerLitre !== undefined) setFlatRate(String(current.flatRatePaisePerLitre / 100));
      if (current?.cmFatPaise !== null && current?.cmFatPaise !== undefined) setCmFat(String(current.cmFatPaise / 100));
      if (current?.cmSnfPaise !== null && current?.cmSnfPaise !== undefined) setCmSnf(String(current.cmSnfPaise / 100));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load milk pricing.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const timeout = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timeout);
  }, [refresh]));

  const flatRatePaise = parseRupees(flatRate);
  const cmFatPaise = parseRupees(cmFat);
  const cmSnfPaise = parseRupees(cmSnf);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom);
  const validValues = mode === 'flat' ? flatRatePaise !== null : cmFatPaise !== null && cmSnfPaise !== null;
  const visibleConfigs = useMemo(() => configs.filter((config) => config.mode === mode), [configs, mode]);

  const chooseMode = (nextMode: MilkPricingMode) => {
    setMode(nextMode);
    const current = configs.find((config) => config.mode === nextMode && config.effectiveFrom <= effectiveFrom);
    if (nextMode === 'flat') {
      setFlatRate(current?.flatRatePaisePerLitre === null || current?.flatRatePaisePerLitre === undefined ? '' : String(current.flatRatePaisePerLitre / 100));
    } else {
      setCmFat(current?.cmFatPaise === null || current?.cmFatPaise === undefined ? '' : String(current.cmFatPaise / 100));
      setCmSnf(current?.cmSnfPaise === null || current?.cmSnfPaise === undefined ? '' : String(current.cmSnfPaise / 100));
    }
  };

  const save = async () => {
    if (!farmId || !session || !validDate || !validValues) return;
    setBusy(true);
    setMessage(null);
    try {
      await saveMilkPricingConfig({
        farmId,
        userId: session.user.id,
        mode,
        effectiveFrom,
        flatRatePaisePerLitre: mode === 'flat' ? flatRatePaise : null,
        cmFatPaise: mode === 'quality' ? cmFatPaise : null,
        cmSnfPaise: mode === 'quality' ? cmSnfPaise : null,
      });
      await setMilkPricingMode({ farmId, userId: session.user.id, mode });
      await refresh();
      setMessage(`${mode === 'flat' ? 'Flat rate' : 'Quality pricing'} saved locally and selected for new milk sessions.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save milk pricing.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen title="Milk pricing" subtitle="Choose the farm-wide formula used for new sessions">
      <SectionCard title="Pricing mode">
        <Text style={[styles.helper, { color: colors.textSecondary }]}>Old milk entries keep their original rate snapshots when this setting changes.</Text>
        <View style={styles.modeRow}>
          {(['flat', 'quality'] as const).map((value) => (
            <Pressable key={value} onPress={() => chooseMode(value)} style={[styles.modeButton, { backgroundColor: mode === value ? colors.primary : colors.backgroundSelected }]}>
              <Text style={[styles.modeText, { color: mode === value ? '#FFFFFF' : colors.text }]}>{value === 'flat' ? 'Flat rate' : 'FAT + SNF'}</Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      <SectionCard title={mode === 'flat' ? 'Flat-rate configuration' : 'Quality configuration'}>
        <DateField label="Effective from" onChange={setEffectiveFrom} value={effectiveFrom} />
        {mode === 'flat' ? (
          <Field label="Rate per litre (₹)" value={flatRate} onChangeText={setFlatRate} placeholder="Example: 42.50" invalid={flatRate.length > 0 && flatRatePaise === null} numeric />
        ) : (
          <>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>The milk screen calculates: FAT% × CMFAT ÷ 100 + SNF% × CMSNF ÷ 100.</Text>
            <Field label="CMFAT coefficient (₹)" value={cmFat} onChangeText={setCmFat} placeholder="Example: 600" invalid={cmFat.length > 0 && cmFatPaise === null} numeric />
            <Field label="CMSNF coefficient (₹)" value={cmSnf} onChangeText={setCmSnf} placeholder="Example: 200" invalid={cmSnf.length > 0 && cmSnfPaise === null} numeric />
          </>
        )}
        {message ? <Text style={[styles.helper, { color: message.includes('saved') ? colors.primary : colors.danger }]}>{message}</Text> : null}
        <Pressable disabled={busy || loading || !validDate || !validValues} onPress={() => void save()} style={[styles.save, { backgroundColor: colors.primary }, (busy || loading || !validDate || !validValues) && styles.disabled]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save and use this pricing</Text>}
        </Pressable>
      </SectionCard>

      <SectionCard title={`${mode === 'flat' ? 'Flat' : 'Quality'} history (${visibleConfigs.length})`}>
        {loading ? <ActivityIndicator color={colors.primary} /> : visibleConfigs.length === 0 ? <EmptyState>No configuration saved for this mode.</EmptyState> : visibleConfigs.map((config) => (
          <View key={config.id} style={[styles.history, { borderTopColor: colors.border }]}>
            <View>
              <Text style={[styles.historyTitle, { color: colors.text }]}>From {formatFarmDate(config.effectiveFrom)}</Text>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>{config.effectiveTo ? `Until ${formatFarmDate(config.effectiveTo)}` : 'No end date'}</Text>
            </View>
            <Text style={[styles.historyValue, { color: colors.text }]}>{pricingLabel(config)}</Text>
          </View>
        ))}
      </SectionCard>
    </AppScreen>
  );
}

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

function pricingLabel(config: MilkPricingConfigRow) {
  if (config.mode === 'flat') return `${formatMoney(config.flatRatePaisePerLitre ?? 0)}/L`;
  return `FAT ${formatMoney(config.cmFatPaise ?? 0)} · SNF ${formatMoney(config.cmSnfPaise ?? 0)}`;
}

const styles = StyleSheet.create({
  helper: { fontSize: 13, lineHeight: 19 },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeButton: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modeText: { fontSize: 15, fontWeight: '800' },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 16 },
  save: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  history: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  historyTitle: { fontSize: 14, fontWeight: '800' },
  historyValue: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '700', textAlign: 'right' },
});
