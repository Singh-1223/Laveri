import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { loadMilkSession, saveMilkSession, voidMilkSession } from '@/data/repositories/milk';
import type { MilkAllocationEntry, MilkAnimalEntry } from '@/data/repositories/milk.types';
import { calculateQualityRatePaise, formatMilk, formatMoney, summarizeMilkAllocation } from '@/domain/calculations';
import type { MilkSession } from '@/domain/types';
import { useSession } from '@/features/auth/session-provider';

function todayAtFarm(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(year, month - 1, day + days, 12);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;
}

function parseLitres(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^\d+(\.\d{0,3})?$/.test(normalized)) return Number.NaN;
  return Math.round(Number(normalized) * 1_000);
}

function parseHundredths(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return Number.NaN;
  const result = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(result) ? result : Number.NaN;
}

export default function MilkScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { session } = useSession();
  const [milkDate, setMilkDate] = useState(todayAtFarm);
  const [milkSession, setMilkSession] = useState<MilkSession>('morning');
  const [farmId, setFarmId] = useState<string | null>(null);
  const [entries, setEntries] = useState<MilkAnimalEntry[]>([]);
  const [allocations, setAllocations] = useState<MilkAllocationEntry[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [allocationValues, setAllocationValues] = useState<Record<string, string>>({});
  const [pricingMode, setPricingMode] = useState<'flat' | 'quality'>('flat');
  const [rate, setRate] = useState('');
  const [fat, setFat] = useState('');
  const [snf, setSnf] = useState('');
  const [cmFatPaise, setCmFatPaise] = useState<number | null>(null);
  const [cmSnfPaise, setCmSnfPaise] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    setVoiding(false);
    setVoidReason('');
    try {
      const sync = await getPowerSyncSnapshot();
      setFarmId(sync.farmId);
      if (!sync.farmId) {
        setEntries([]);
        return;
      }

      const snapshot = await loadMilkSession(sync.farmId, milkDate, milkSession);
      setEntries(snapshot.entries);
      setAllocations(snapshot.allocations);
      setValues(Object.fromEntries(snapshot.entries.map((entry) => [entry.animalId, entry.volumeMl === null ? '' : String(entry.volumeMl / 1_000)])));
      setAllocationValues(Object.fromEntries(snapshot.allocations.map((allocation) => [allocation.key, allocation.volumeMl === null ? '' : String(allocation.volumeMl / 1_000)])));
      setPricingMode(snapshot.pricingMode);
      const existingPricing = snapshot.entries.find((entry) => entry.entryId !== null);
      const existingRate = snapshot.entries.find((entry) => entry.ratePaisePerLitre !== null)?.ratePaisePerLitre
        ?? snapshot.allocations.find((allocation) => allocation.ratePaisePerLitre !== null)?.ratePaisePerLitre;
      const ratePaise = existingRate ?? snapshot.suggestedRatePaisePerLitre;
      setRate(ratePaise === null ? '' : String(ratePaise / 100));
      setFat(existingPricing?.fatHundredths === null || existingPricing?.fatHundredths === undefined ? '' : String(existingPricing.fatHundredths / 100));
      setSnf(existingPricing?.snfHundredths === null || existingPricing?.snfHundredths === undefined ? '' : String(existingPricing.snfHundredths / 100));
      setCmFatPaise(existingPricing?.cmFatPaise ?? snapshot.suggestedCmFatPaise);
      setCmSnfPaise(existingPricing?.cmSnfPaise ?? snapshot.suggestedCmSnfPaise);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load milk entries.');
    } finally {
      setLoading(false);
    }
  }, [milkDate, milkSession]);

  useFocusEffect(
    useCallback(() => {
      const timeout = setTimeout(() => void refresh(), 0);
      return () => clearTimeout(timeout);
    }, [refresh]),
  );

  const parsedEntries = useMemo(
    () => entries.map((entry) => ({ entry, volumeMl: parseLitres(values[entry.animalId] ?? '') })),
    [entries, values],
  );
  const totalMl = parsedEntries.reduce((sum, item) => sum + (Number.isFinite(item.volumeMl) && item.volumeMl !== null ? item.volumeMl : 0), 0);
  const invalidVolume = parsedEntries.some((item) => Number.isNaN(item.volumeMl));
  const parsedAllocations = useMemo(
    () => allocations.map((allocation) => ({ allocation, volumeMl: parseLitres(allocationValues[allocation.key] ?? '') })),
    [allocationValues, allocations],
  );
  const invalidAllocation = parsedAllocations.some((item) => Number.isNaN(item.volumeMl));
  const allocationSummary = summarizeMilkAllocation(
    totalMl,
    parsedAllocations
      .filter((item): item is typeof item & { volumeMl: number } => item.volumeMl !== null && Number.isFinite(item.volumeMl))
      .map(({ allocation, volumeMl }) => ({ destination: allocation.destination, volumeMl })),
  );
  const flatRatePaise = /^\d+(\.\d{0,2})?$/.test(rate.trim()) ? Math.round(Number(rate) * 100) : Number.NaN;
  const fatHundredths = parseHundredths(fat);
  const snfHundredths = parseHundredths(snf);
  const qualityConfigured = cmFatPaise !== null && cmSnfPaise !== null;
  const qualityInputsValid = fatHundredths !== null && snfHundredths !== null
    && Number.isSafeInteger(fatHundredths) && Number.isSafeInteger(snfHundredths)
    && fatHundredths <= 1_500 && snfHundredths <= 1_500;
  const qualityRatePaise = pricingMode === 'quality' && qualityConfigured && qualityInputsValid
    ? calculateQualityRatePaise(fatHundredths, snfHundredths, cmFatPaise, cmSnfPaise)
    : Number.NaN;
  const ratePaise = pricingMode === 'flat' ? flatRatePaise : qualityRatePaise;
  const enteredCount = parsedEntries.filter((item) => item.volumeMl !== null && Number.isFinite(item.volumeMl)).length;
  const hasSavedSession = entries.some((entry) => entry.entryId !== null) || allocations.some((allocation) => allocation.allocationId !== null);

  const save = async () => {
    if (!farmId || !session || invalidVolume || invalidAllocation || allocationSummary.exceedsProduction || !Number.isSafeInteger(ratePaise) || ratePaise < 0) return;
    setBusy(true);
    setMessage(null);
    try {
      await saveMilkSession({
        farmId,
        userId: session.user.id,
        milkDate,
        session: milkSession,
        pricingMode,
        flatRatePaisePerLitre: pricingMode === 'flat' ? ratePaise : null,
        fatHundredths: pricingMode === 'quality' ? fatHundredths : null,
        snfHundredths: pricingMode === 'quality' ? snfHundredths : null,
        cmFatPaise: pricingMode === 'quality' ? cmFatPaise : null,
        cmSnfPaise: pricingMode === 'quality' ? cmSnfPaise : null,
        ratePaisePerLitre: ratePaise,
        entries: parsedEntries
          .filter((item): item is typeof item & { volumeMl: number } => item.volumeMl !== null && Number.isFinite(item.volumeMl))
          .map(({ entry, volumeMl }) => ({ animalId: entry.animalId, entryId: entry.entryId, volumeMl })),
        allocations: parsedAllocations
          .filter((item): item is typeof item & { volumeMl: number } => item.volumeMl !== null && Number.isFinite(item.volumeMl) && item.volumeMl > 0)
          .map(({ allocation, volumeMl }) => ({
            allocationId: allocation.allocationId,
            destination: allocation.destination,
            buyerId: allocation.buyerId,
            volumeMl,
          })),
      });
      await refresh();
      setMessage(`${milkSession === 'morning' ? 'Morning' : 'Evening'} milk and allocations saved locally.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save milk entries.');
    } finally {
      setBusy(false);
    }
  };

  const saveDisabled = busy || loading || invalidVolume || invalidAllocation || allocationSummary.exceedsProduction || enteredCount === 0 || !Number.isSafeInteger(ratePaise);

  const confirmVoid = async () => {
    if (!farmId || !session || !voidReason.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      await voidMilkSession({ farmId, userId: session.user.id, milkDate, session: milkSession, reason: voidReason });
      setVoiding(false);
      setVoidReason('');
      await refresh();
      setMessage(`${milkSession === 'morning' ? 'Morning' : 'Evening'} session voided locally. Enter corrected values to replace it.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to void this milk session.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen title="Milk" subtitle="Save the full session locally in one transaction">
      <View style={styles.dateRow}>
        <SmallButton label="‹" onPress={() => setMilkDate((value) => shiftDate(value, -1))} />
        <View style={styles.dateCenter}>
          <Text style={[styles.date, { color: colors.text }]}>{milkDate}</Text>
          {milkDate !== todayAtFarm() ? <Pressable onPress={() => setMilkDate(todayAtFarm())}><Text style={[styles.today, { color: colors.primary }]}>Go to today</Text></Pressable> : null}
        </View>
        <SmallButton label="›" onPress={() => setMilkDate((value) => shiftDate(value, 1))} />
      </View>

      <View style={styles.sessionRow}>
        {(['morning', 'evening'] as const).map((value) => (
          <Pressable key={value} onPress={() => setMilkSession(value)} style={[styles.session, { backgroundColor: milkSession === value ? colors.primary : colors.backgroundSelected }]}>
            <Text style={[styles.sessionText, { color: milkSession === value ? '#FFFFFF' : colors.text }]}>{value === 'morning' ? 'Morning' : 'Evening'}</Text>
          </Pressable>
        ))}
      </View>

      <SectionCard title={pricingMode === 'flat' ? 'Flat rate' : 'Quality rate · FAT + SNF'}>
        <Text style={[styles.helper, { color: colors.textSecondary }]}>The complete pricing formula is copied into every entry so later configuration changes do not alter history.</Text>
        {pricingMode === 'flat' ? (
          <View style={styles.rateRow}>
            <Text style={[styles.currency, { color: colors.text }]}>₹</Text>
            <TextInput accessibilityLabel="Rate per litre" keyboardType="decimal-pad" onChangeText={setRate} placeholder="Rate per litre" placeholderTextColor={colors.textSecondary} style={[styles.rateInput, { color: colors.text, borderColor: colors.border }]} value={rate} />
            <Text style={[styles.unit, { color: colors.textSecondary }]}>/ litre</Text>
          </View>
        ) : (
          <>
            <View style={styles.qualityRow}>
              <QualityField label="FAT %" value={fat} onChangeText={setFat} invalid={Number.isNaN(fatHundredths)} />
              <QualityField label="SNF %" value={snf} onChangeText={setSnf} invalid={Number.isNaN(snfHundredths)} />
            </View>
            {qualityConfigured ? (
              <View style={[styles.formula, { backgroundColor: colors.backgroundSelected }]}>
                <Text style={[styles.helper, { color: colors.textSecondary }]}>CMFAT {formatMoney(cmFatPaise)} · CMSNF {formatMoney(cmSnfPaise)}</Text>
                <Text style={[styles.calculatedRate, { color: colors.text }]}>{Number.isSafeInteger(qualityRatePaise) ? `${formatMoney(qualityRatePaise)} / litre` : 'Enter FAT and SNF'}</Text>
              </View>
            ) : (
              <View style={styles.missingPricing}>
                <Text style={[styles.error, { color: colors.danger }]}>No quality-pricing configuration applies on {milkDate}.</Text>
                <Link href="../pricing" asChild><Pressable><Text style={[styles.pricingLink, { color: colors.primary }]}>Configure milk pricing</Text></Pressable></Link>
              </View>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard title={`Animals (${entries.length})`}>
        {loading ? <ActivityIndicator color={colors.primary} /> : entries.length === 0 ? <EmptyState>No active milking animals. Add a cow in Master data first.</EmptyState> : entries.map((entry) => (
          <View key={entry.animalId} style={[styles.entryRow, { borderTopColor: colors.border }]}>
            <View style={styles.animalCopy}>
              <Text style={[styles.animalName, { color: colors.text }]}>{entry.tag}</Text>
              <Text style={[styles.entryState, { color: colors.textSecondary }]}>{entry.entryId ? 'Saved' : 'Missing entry'}</Text>
            </View>
            <TextInput
              accessibilityLabel={`${entry.tag} litres`}
              keyboardType="decimal-pad"
              onChangeText={(value) => setValues((current) => ({ ...current, [entry.animalId]: value }))}
              placeholder="—"
              placeholderTextColor={colors.textSecondary}
              style={[styles.volumeInput, { color: colors.text, borderColor: Number.isNaN(parseLitres(values[entry.animalId] ?? '')) ? colors.danger : colors.border }]}
              value={values[entry.animalId] ?? ''}
            />
            <Text style={[styles.litre, { color: colors.textSecondary }]}>L</Text>
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Allocation">
        {allocations.map((allocation) => (
          <View key={allocation.key} style={[styles.entryRow, { borderTopColor: colors.border }]}>
            <View style={styles.animalCopy}>
              <Text style={[styles.animalName, { color: colors.text }]}>{allocation.label}</Text>
              <Text style={[styles.entryState, { color: colors.textSecondary }]}>{allocation.allocationId ? 'Saved' : allocation.destination === 'buyer' ? 'Buyer' : 'Internal use'}</Text>
            </View>
            <TextInput
              accessibilityLabel={`${allocation.label} litres`}
              keyboardType="decimal-pad"
              onChangeText={(value) => setAllocationValues((current) => ({ ...current, [allocation.key]: value }))}
              placeholder="—"
              placeholderTextColor={colors.textSecondary}
              style={[styles.volumeInput, { color: colors.text, borderColor: Number.isNaN(parseLitres(allocationValues[allocation.key] ?? '')) ? colors.danger : colors.border }]}
              value={allocationValues[allocation.key] ?? ''}
            />
            <Text style={[styles.litre, { color: colors.textSecondary }]}>L</Text>
          </View>
        ))}
        {allocations.length === 1 ? <Text style={[styles.helper, { color: colors.textSecondary }]}>Add buyers in Master data to allocate milk sales.</Text> : null}
      </SectionCard>

      <View style={[styles.total, { backgroundColor: colors.backgroundSelected }]}>
        <View><Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Produced</Text><Text style={[styles.totalValue, { color: colors.text }]}>{formatMilk(totalMl)}</Text></View>
        <View style={styles.variance}><Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Remaining</Text><Text style={[styles.varianceValue, { color: allocationSummary.exceedsProduction ? colors.danger : colors.text }]}>{formatMilk(Math.abs(allocationSummary.unallocatedMl))}{allocationSummary.unallocatedMl < 0 ? ' over' : ''}</Text></View>
      </View>

      {invalidVolume ? <Text style={[styles.error, { color: colors.danger }]}>Use up to three decimal places for litres.</Text> : null}
      {invalidAllocation ? <Text style={[styles.error, { color: colors.danger }]}>Use up to three decimal places for allocation litres.</Text> : null}
      {pricingMode === 'quality' && (!qualityInputsValid || !qualityConfigured) ? <Text style={[styles.error, { color: colors.danger }]}>Quality mode requires valid FAT, SNF, CMFAT, and CMSNF values.</Text> : null}
      {allocationSummary.exceedsProduction ? <Text style={[styles.error, { color: colors.danger }]}>Allocated milk cannot exceed produced milk.</Text> : null}
      {message ? <Text style={[styles.helper, { color: message.includes('saved') || message.includes('voided') ? colors.primary : colors.danger }]}>{message}</Text> : null}
      <Pressable disabled={saveDisabled} onPress={save} style={({ pressed }) => [styles.save, { backgroundColor: colors.primary }, saveDisabled && styles.disabled, pressed && styles.pressed]}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save {milkSession} session</Text>}
      </Pressable>

      {hasSavedSession ? (
        <SectionCard title="Correct saved session">
          <Text style={[styles.helper, { color: colors.textSecondary }]}>You can edit values above and save again. If the entire session is invalid, void it with a reason and then enter its replacement.</Text>
          {voiding ? (
            <View style={styles.voidEditor}>
              <TextInput accessibilityLabel="Milk session void reason" multiline onChangeText={setVoidReason} placeholder="Reason for voiding this session (required)" placeholderTextColor={colors.textSecondary} style={[styles.voidReasonInput, { color: colors.text, borderColor: colors.danger }]} value={voidReason} />
              <View style={styles.voidActions}>
                <Pressable disabled={busy} onPress={() => { setVoiding(false); setVoidReason(''); }} style={[styles.voidAction, { borderColor: colors.border }]}><Text style={[styles.voidActionText, { color: colors.textSecondary }]}>Cancel</Text></Pressable>
                <Pressable disabled={busy || !voidReason.trim()} onPress={() => void confirmVoid()} style={[styles.voidAction, { backgroundColor: colors.danger }, (busy || !voidReason.trim()) && styles.disabled]}><Text style={styles.saveText}>Confirm void</Text></Pressable>
              </View>
            </View>
          ) : (
            <Pressable disabled={busy} onPress={() => setVoiding(true)} style={[styles.voidSession, { borderColor: colors.danger }]}><Text style={[styles.voidActionText, { color: colors.danger }]}>Void entire {milkSession} session</Text></Pressable>
          )}
        </SectionCard>
      ) : null}
    </AppScreen>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return <Pressable onPress={onPress} style={[styles.smallButton, { backgroundColor: colors.backgroundSelected }]}><Text style={[styles.smallButtonText, { color: colors.text }]}>{label}</Text></Pressable>;
}

function QualityField({ label, value, onChangeText, invalid }: { label: string; value: string; onChangeText: (value: string) => void; invalid: boolean }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return (
    <View style={styles.qualityField}>
      <Text style={[styles.qualityLabel, { color: colors.text }]}>{label}</Text>
      <TextInput accessibilityLabel={label} keyboardType="decimal-pad" onChangeText={onChangeText} placeholder="0.00" placeholderTextColor={colors.textSecondary} style={[styles.qualityInput, { color: colors.text, borderColor: invalid ? colors.danger : colors.border }]} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateCenter: { alignItems: 'center', gap: 3 },
  date: { fontSize: 17, fontWeight: '800' },
  today: { fontSize: 12, fontWeight: '700' },
  smallButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { fontSize: 26, lineHeight: 28 },
  sessionRow: { flexDirection: 'row', gap: 10 },
  session: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sessionText: { fontSize: 15, fontWeight: '700' },
  helper: { fontSize: 13, lineHeight: 19 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currency: { fontSize: 20, fontWeight: '700' },
  rateInput: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 17 },
  unit: { fontSize: 14 },
  qualityRow: { flexDirection: 'row', gap: 10 },
  qualityField: { flex: 1, gap: 6 },
  qualityLabel: { fontSize: 13, fontWeight: '700' },
  qualityInput: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 17 },
  formula: { borderRadius: 12, padding: 12, gap: 4 },
  calculatedRate: { fontSize: 20, fontWeight: '800' },
  missingPricing: { gap: 4 },
  pricingLink: { fontSize: 14, fontWeight: '800' },
  entryRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 8 },
  animalCopy: { flex: 1, gap: 2 },
  animalName: { fontSize: 16, fontWeight: '700' },
  entryState: { fontSize: 12 },
  volumeInput: { width: 96, minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, textAlign: 'right', fontSize: 17 },
  litre: { width: 16, fontSize: 14 },
  total: { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  totalLabel: { fontSize: 13, fontWeight: '600' },
  totalValue: { fontSize: 28, fontWeight: '800' },
  variance: { alignItems: 'flex-end' },
  varianceValue: { fontSize: 18, fontWeight: '800' },
  error: { fontSize: 13, lineHeight: 19 },
  save: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  voidEditor: { gap: 10 },
  voidReasonInput: { minHeight: 76, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top', fontSize: 15 },
  voidActions: { flexDirection: 'row', gap: 10 },
  voidAction: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  voidActionText: { fontSize: 14, fontWeight: '700' },
  voidSession: { minHeight: 46, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
