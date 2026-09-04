import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { getMilkLaunchTarget, loadMilkSession, saveMilkSession, voidMilkSession } from '@/data/repositories/milk';
import type { MilkAllocationEntry, MilkAnimalEntry } from '@/data/repositories/milk.types';
import { formatMilk, formatMoney, summarizeMilkAllocation } from '@/domain/calculations';
import { formatFarmDate } from '@/domain/dates';
import type { MilkSession } from '@/domain/types';
import { useSession } from '@/features/auth/session-provider';
import { refreshMilkSessionReminder } from '@/features/reminders/milk-reminders';

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
  const router = useRouter();
  const { session } = useSession();
  const [milkDate, setMilkDate] = useState(todayAtFarm);
  const [milkSession, setMilkSession] = useState<MilkSession>('morning');
  const [farmId, setFarmId] = useState<string | null>(null);
  const [entries, setEntries] = useState<MilkAnimalEntry[]>([]);
  const [allocations, setAllocations] = useState<MilkAllocationEntry[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [allocationValues, setAllocationValues] = useState<Record<string, string>>({});
  const [fat, setFat] = useState('');
  const [snf, setSnf] = useState('');
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const lastAutoSaveFingerprint = useRef<string | null>(null);
  const hasChosenLaunchTarget = useRef(false);

  const refresh = useCallback(async () => {
    setHydrated(false);
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

      if (!hasChosenLaunchTarget.current) {
        const target = await getMilkLaunchTarget(sync.farmId);
        hasChosenLaunchTarget.current = true;
        if (target.milkDate !== milkDate || target.session !== milkSession) {
          setMilkDate(target.milkDate);
          setMilkSession(target.session);
          return;
        }
      }

      const snapshot = await loadMilkSession(sync.farmId, milkDate, milkSession);
      setEntries(snapshot.entries);
      setAllocations(snapshot.allocations);
      setValues(Object.fromEntries(snapshot.entries.map((entry) => [entry.animalId, entry.volumeMl === null ? '' : String(entry.volumeMl / 1_000)])));
      setAllocationValues(Object.fromEntries(snapshot.allocations.map((allocation) => [allocation.key, allocation.volumeMl === null ? '' : String(allocation.volumeMl / 1_000)])));
      const existingPricing = snapshot.entries.find((entry) => entry.entryId !== null);
      setFat(existingPricing?.fatHundredths === null || existingPricing?.fatHundredths === undefined ? '' : String(existingPricing.fatHundredths / 100));
      setSnf(existingPricing?.snfHundredths === null || existingPricing?.snfHundredths === undefined ? '' : String(existingPricing.snfHundredths / 100));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load milk entries.');
    } finally {
      setLoading(false);
      setHydrated(true);
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
  const buyerAllocations = parsedAllocations.filter((item) => item.allocation.destination === 'buyer');
  const allocationSummary = summarizeMilkAllocation(
    totalMl,
    buyerAllocations
      .filter((item): item is typeof item & { volumeMl: number } => item.volumeMl !== null && Number.isFinite(item.volumeMl))
      .map(({ allocation, volumeMl }) => ({ destination: allocation.destination, volumeMl })),
  );
  const householdMl = Math.max(0, allocationSummary.unallocatedMl);
  const fatHundredths = parseHundredths(fat);
  const snfHundredths = parseHundredths(snf);
  const dailyQualityValid = [fatHundredths, snfHundredths].every((value) => value === null || (Number.isSafeInteger(value) && value >= 0 && value <= 1_500));
  const buyerRateMissing = buyerAllocations.some((item) => item.volumeMl !== null && item.volumeMl > 0 && item.allocation.ratePaisePerLitre === null && item.allocation.label.trim().toLocaleLowerCase() !== 'verka');
  const enteredCount = parsedEntries.filter((item) => item.volumeMl !== null && Number.isFinite(item.volumeMl)).length;
  const hasSavedSession = entries.some((entry) => entry.entryId !== null) || allocations.some((allocation) => allocation.allocationId !== null);

  const save = async (automatic = false, fingerprint?: string) => {
    if (!farmId || !session || invalidVolume || invalidAllocation || !dailyQualityValid || allocationSummary.exceedsProduction || buyerRateMissing) return;
    setBusy(true);
    setMessage(null);
    try {
      await saveMilkSession({
        farmId,
        userId: session.user.id,
        milkDate,
        session: milkSession,
        pricingMode: 'flat',
        flatRatePaisePerLitre: 0,
        fatHundredths,
        snfHundredths,
        cmFatPaise: null,
        cmSnfPaise: null,
        ratePaisePerLitre: 0,
        entries: parsedEntries
          .filter((item): item is typeof item & { volumeMl: number } => item.volumeMl !== null && Number.isFinite(item.volumeMl))
          .map(({ entry, volumeMl }) => ({ animalId: entry.animalId, entryId: entry.entryId, volumeMl })),
        allocations: buyerAllocations
          .filter((item): item is typeof item & { volumeMl: number } => item.volumeMl !== null && Number.isFinite(item.volumeMl) && item.volumeMl > 0)
          .map(({ allocation, volumeMl }) => ({
            allocationId: allocation.allocationId,
            destination: allocation.destination,
            buyerId: allocation.buyerId,
            volumeMl,
            ratePaisePerLitre: allocation.ratePaisePerLitre ?? 0,
          }))
          .concat(householdMl > 0 ? [{
            allocationId: allocations.find((allocation) => allocation.destination === 'household')?.allocationId ?? null,
            destination: 'household' as const,
            buyerId: null,
            volumeMl: householdMl,
            ratePaisePerLitre: 0,
          }] : []),
        clearedAnimalIds: parsedEntries
          .filter((item) => item.volumeMl === null)
          .map((item) => item.entry.animalId),
        deletedAllocationIds: parsedAllocations
          .filter((item) => item.allocation.allocationId !== null && (
            (item.allocation.destination === 'buyer' && (item.volumeMl === null || !Number.isFinite(item.volumeMl) || item.volumeMl <= 0))
            || (item.allocation.destination === 'household' && householdMl === 0)
          ))
          .map((item) => item.allocation.allocationId as string),
      });
      if (milkDate === todayAtFarm()) {
        const sessionComplete = parsedEntries.length > 0 && parsedEntries.every((item) => item.volumeMl !== null && Number.isFinite(item.volumeMl));
        await refreshMilkSessionReminder(milkSession, sessionComplete);
      }
      if (!automatic) await refresh();
      setMessage(`${milkSession === 'morning' ? 'Morning' : 'Evening'} milk and allocations saved locally${automatic ? ' automatically.' : '.'}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save milk entries.');
    } finally {
      if (automatic && fingerprint) lastAutoSaveFingerprint.current = fingerprint;
      setBusy(false);
    }
  };

  const autoSaveReady = !busy && !loading && hydrated && enteredCount > 0
    && !invalidVolume && !invalidAllocation && dailyQualityValid && !allocationSummary.exceedsProduction && !buyerRateMissing;
  const autoSaveFingerprint = useMemo(() => JSON.stringify({
    allocationValues,
    fat,
    milkDate,
    milkSession,
    snf,
    values,
  }), [allocationValues, fat, milkDate, milkSession, snf, values]);

  // `save` intentionally uses this render's snapshot. Adding it as a dependency
  // would reschedule after its own busy-state updates and repeatedly save unchanged data.
  useEffect(() => {
    if (!autoSaveReady || lastAutoSaveFingerprint.current === autoSaveFingerprint) return;
    const timeout = setTimeout(() => void save(true, autoSaveFingerprint), 650);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allocationSummary.exceedsProduction,
    autoSaveReady,
    autoSaveFingerprint,
  ]);

  const confirmVoid = async () => {
    if (!farmId || !session || !voidReason.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      await voidMilkSession({ farmId, userId: session.user.id, milkDate, session: milkSession, reason: voidReason });
      if (milkDate === todayAtFarm()) await refreshMilkSessionReminder(milkSession, false);
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
    <AppScreen title="Milk" action={<Pressable accessibilityLabel="Open Milk menu" onPress={() => setMenuOpen(true)} style={[styles.menuButton, { borderColor: colors.border }]}><Text style={[styles.menuButtonText, { color: colors.text }]}>•••</Text></Pressable>}>
      <MilkMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={(path) => { setMenuOpen(false); router.push(path); }} />
      <View style={styles.dateRow}>
        <SmallButton label="‹" onPress={() => { setHydrated(false); setMilkDate((value) => shiftDate(value, -1)); }} />
        <View style={styles.dateCenter}>
          <Text style={[styles.date, { color: colors.text }]}>{formatFarmDate(milkDate)}</Text>
          {milkDate === todayAtFarm()
            ? <Text style={[styles.today, { color: colors.primary }]}>Today</Text>
            : <Pressable onPress={() => { setHydrated(false); setMilkDate(todayAtFarm()); }}><Text style={[styles.today, { color: colors.primary }]}>Go to today</Text></Pressable>}
        </View>
        <SmallButton label="›" onPress={() => { setHydrated(false); setMilkDate((value) => shiftDate(value, 1)); }} />
      </View>

      <View style={styles.sessionRow}>
        {(['morning', 'evening'] as const).map((value) => (
          <Pressable key={value} onPress={() => { setHydrated(false); setMilkSession(value); }} style={[styles.session, { backgroundColor: milkSession === value ? colors.primary : colors.backgroundSelected }]}>
            <Text style={[styles.sessionText, { color: milkSession === value ? '#FFFFFF' : colors.text }]}>{value === 'morning' ? 'Morning' : 'Evening'}</Text>
          </Pressable>
        ))}
      </View>

      <SectionCard>
        {loading ? <ActivityIndicator color={colors.primary} /> : entries.length === 0 ? <EmptyState>No active milking animals. Add a cow in Master data first.</EmptyState> : entries.map((entry) => (
          <View key={entry.animalId} style={[styles.entryRow, { borderTopColor: colors.border }]}>
            <View style={styles.animalCopy}>
              <Text style={[styles.animalName, { color: colors.text }]}>{entry.tag}</Text>
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

      <SectionCard>
        <View style={styles.qualityRow}>
          <QualityField label="FAT %" value={fat} onChangeText={setFat} invalid={Number.isNaN(fatHundredths) || (fatHundredths !== null && fatHundredths > 1_500)} />
          <QualityField label="SNF %" value={snf} onChangeText={setSnf} invalid={Number.isNaN(snfHundredths) || (snfHundredths !== null && snfHundredths > 1_500)} />
        </View>
      </SectionCard>

      <SectionCard>
        {allocations.filter((allocation) => allocation.destination === 'buyer').map((allocation) => (
          <View key={allocation.key} style={[styles.entryRow, { borderTopColor: colors.border }]}>
            <View style={styles.animalCopy}>
              <Text style={[styles.animalName, { color: colors.text }]}>{allocation.label}</Text>
              <Text style={[styles.entryState, { color: allocation.ratePaisePerLitre === null && allocation.label.trim().toLocaleLowerCase() !== 'verka' ? colors.danger : colors.textSecondary }]}>{allocation.label.trim().toLocaleLowerCase() === 'verka' ? 'Verka rate finalized after billing cycle' : allocation.ratePaisePerLitre === null ? 'Set rate in Master data' : `${formatMoney(allocation.ratePaisePerLitre)} / L`}</Text>
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
        {allocations.filter((allocation) => allocation.destination === 'buyer').length === 0 ? <Text style={[styles.helper, { color: colors.textSecondary }]}>Add buyers in Master data to allocate milk sales.</Text> : null}
      </SectionCard>

      <View style={[styles.total, { backgroundColor: colors.backgroundSelected }]}>
        <View><Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Produced</Text><Text style={[styles.totalValue, { color: colors.text }]}>{formatMilk(totalMl)}</Text></View>
        <View style={styles.variance}><Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Household consumption</Text><Text style={[styles.varianceValue, { color: allocationSummary.exceedsProduction ? colors.danger : colors.text }]}>{allocationSummary.exceedsProduction ? `${formatMilk(Math.abs(allocationSummary.unallocatedMl))} over` : formatMilk(householdMl)}</Text></View>
      </View>

      {invalidVolume ? <Text style={[styles.error, { color: colors.danger }]}>Use up to three decimal places for litres.</Text> : null}
      {invalidAllocation ? <Text style={[styles.error, { color: colors.danger }]}>Use up to three decimal places for allocation litres.</Text> : null}
      {!dailyQualityValid ? <Text style={[styles.error, { color: colors.danger }]}>FAT and SNF must be between 0 and 15 with up to two decimal places.</Text> : null}
      {buyerRateMissing ? <Text style={[styles.error, { color: colors.danger }]}>Set a fixed per-litre rate for every buyer in Master data before allocating milk to them.</Text> : null}
      {allocationSummary.exceedsProduction ? <Text style={[styles.error, { color: colors.danger }]}>Allocated milk cannot exceed produced milk.</Text> : null}
      {message ? <Text style={[styles.helper, { color: message.includes('saved') || message.includes('voided') ? colors.primary : colors.danger }]}>{message}</Text> : null}
      {busy ? <View style={[styles.autoSave, { backgroundColor: colors.backgroundSelected }]}><ActivityIndicator color={colors.primary} /><Text style={[styles.helper, { color: colors.textSecondary }]}>Saving changes locally…</Text></View> : null}

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

function MilkMenu({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (path: '/master-data' | '/pricing' | '/corrections' | '/reminders') => void }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const options: { label: string; detail: string; path: '/master-data' | '/pricing' | '/corrections' | '/reminders' }[] = [
    { label: 'Manage master data', detail: 'Animals, buyers, feed, medicine, and products', path: '/master-data' },
    { label: 'Price calculator', detail: 'Calculate a reference price from FAT and SNF', path: '/pricing' },
    { label: 'Correction history', detail: 'Review saved edits, voids, and changes', path: '/corrections' },
    { label: 'Milk reminder settings', detail: 'Set Morning and Evening reminders on this phone', path: '/reminders' },
  ];
  return (
    <Modal transparent animationType="slide" visible={open} onRequestClose={onClose}>
      <View style={styles.menuOverlay}>
        <Pressable accessibilityLabel="Close Milk menu" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.menuPanel, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.menuHeader}><Text style={[styles.menuTitle, { color: colors.text }]}>Milk menu</Text><Pressable onPress={onClose}><Text style={[styles.closeText, { color: colors.primary }]}>Close</Text></Pressable></View>
          {options.map((option) => <Pressable key={option.path} onPress={() => onNavigate(option.path)} style={[styles.menuItem, { borderTopColor: colors.border }]}><Text style={[styles.menuItemTitle, { color: colors.text }]}>{option.label}</Text><Text style={[styles.menuItemDetail, { color: colors.textSecondary }]}>{option.detail}</Text></Pressable>)}
        </View>
      </View>
    </Modal>
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
  menuButton: { minHeight: 32, minWidth: 46, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  menuButtonText: { fontSize: 17, lineHeight: 16, fontWeight: '900', letterSpacing: 1 },
  helper: { fontSize: 13, lineHeight: 19 },
  qualityRow: { flexDirection: 'row', gap: 10 },
  qualityField: { flex: 1, gap: 6 },
  qualityLabel: { fontSize: 13, fontWeight: '700' },
  qualityInput: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 17 },
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
  autoSave: { minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  voidEditor: { gap: 10 },
  voidReasonInput: { minHeight: 76, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top', fontSize: 15 },
  voidActions: { flexDirection: 'row', gap: 10 },
  voidAction: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  voidActionText: { fontSize: 14, fontWeight: '700' },
  voidSession: { minHeight: 46, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuOverlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-start' },
  menuPanel: { width: '86%', maxWidth: 420, minHeight: '100%', borderRightWidth: StyleSheet.hairlineWidth, paddingTop: 58, paddingHorizontal: 20 },
  menuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 18 },
  menuTitle: { fontSize: 24, fontWeight: '800' },
  closeText: { fontSize: 14, fontWeight: '800' },
  menuItem: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 16, gap: 4 },
  menuItemTitle: { fontSize: 16, fontWeight: '800' },
  menuItemDetail: { fontSize: 13, lineHeight: 18 },
});
