import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { NestableDraggableFlatList, NestableScrollContainer, ScaleDecorator } from 'react-native-draggable-flatlist';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { getMilkLaunchTarget, loadMilkSession, saveMilkAnimalOrder, saveMilkBuyerOrder, saveMilkSession, voidMilkSession } from '@/data/repositories/milk';
import type { MilkAllocationEntry, MilkAnimalEntry } from '@/data/repositories/milk.types';
import { formatMilk, formatMoney, summarizeMilkAllocation } from '@/domain/calculations';
import { formatFarmDate } from '@/domain/dates';
import type { MilkSession } from '@/domain/types';
import { useSession } from '@/features/auth/session-provider';
import { refreshMilkSessionReminder } from '@/features/reminders/milk-reminders';
import { loadThemePreference, saveThemePreference, type ThemePreference } from '@/features/theme/theme-preference';

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
  const { session, signOut } = useSession();
  const [milkDate, setMilkDate] = useState(todayAtFarm);
  const [milkSession, setMilkSession] = useState<MilkSession>('morning');
  const [farmId, setFarmId] = useState<string | null>(null);
  const [entries, setEntries] = useState<MilkAnimalEntry[]>([]);
  const [allocations, setAllocations] = useState<MilkAllocationEntry[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [allocationValues, setAllocationValues] = useState<Record<string, string>>({});
  const [fat, setFat] = useState('');
  const [snf, setSnf] = useState('');
  const [previousVolumes, setPreviousVolumes] = useState<Record<string, number>>({});
  const [previousAllocationVolumes, setPreviousAllocationVolumes] = useState<Record<string, number>>({});
  const [previousFat, setPreviousFat] = useState<number | null>(null);
  const [previousSnf, setPreviousSnf] = useState<number | null>(null);
  const [verkaTarget, setVerkaTarget] = useState<{ cycleStart: string; cycleEnd: string; suppliedMl: number; targetMl: number } | null>(null);
  const [picker, setPicker] = useState<{ key: string; max: number; initial: number; label: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [unlockedDate, setUnlockedDate] = useState<string | null>(null);
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
      setPreviousVolumes(snapshot.previousVolumesMl);
      setPreviousAllocationVolumes(snapshot.previousAllocationVolumesMl);
      setPreviousFat(snapshot.previousFatHundredths);
      setPreviousSnf(snapshot.previousSnfHundredths);
      setVerkaTarget(snapshot.verkaTarget);
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
  const isLocked = milkDate !== todayAtFarm() && unlockedDate !== milkDate;
  const enteredCount = parsedEntries.filter((item) => item.volumeMl !== null && Number.isFinite(item.volumeMl)).length;
  const hasSavedSession = entries.some((entry) => entry.entryId !== null) || allocations.some((allocation) => allocation.allocationId !== null);
  const verkaDifferenceMl = verkaTarget ? verkaTarget.suppliedMl - verkaTarget.targetMl : null;

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

  const autoSaveReady = !isLocked && !busy && !loading && hydrated && enteredCount > 0
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
    // Keep auto-save after every field, but wait until the user has paused.
    // Starting a SQLite write while they are moving through the next picker
    // makes the long buyer list feel unresponsive on lower-end Android phones.
    const timeout = setTimeout(() => void save(true, autoSaveFingerprint), 1_250);
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

  const saveAnimalOrder = async (orderedEntries: MilkAnimalEntry[]) => {
    if (!farmId || !session) return;
    setBusy(true);
    setMessage(null);
    try {
      setEntries(orderedEntries);
      await saveMilkAnimalOrder({ farmId, userId: session.user.id, animalIds: orderedEntries.map((entry) => entry.animalId) });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to change Milk order.');
    } finally {
      setBusy(false);
    }
  };

  const saveBuyerOrder = async (orderedAllocations: MilkAllocationEntry[]) => {
    if (!farmId || !session) return;
    setBusy(true);
    setMessage(null);
    try {
      setAllocations((current) => [...orderedAllocations, ...current.filter((allocation) => allocation.destination !== 'buyer')]);
      await saveMilkBuyerOrder({ farmId, userId: session.user.id, buyerIds: orderedAllocations.flatMap((allocation) => allocation.buyerId ? [allocation.buyerId] : []) });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to change buyer order.');
    } finally {
      setBusy(false);
    }
  };

  const openPicker = (key: string, max: number, label: string, prior: number | null) => {
    if (isLocked) return;
    const current = key === 'fat' ? fat : key === 'snf' ? snf : values[key] ?? allocationValues[key] ?? '';
    const initial = current ? Number(current) : prior === null ? 0 : prior / (max === 10 ? 100 : 1_000);
    setPicker({ key, max, label, initial: Number.isFinite(initial) ? initial : 0 });
  };

  const selectSuggestion = (value: number) => {
    if (!picker) return;
    const valueText = value.toFixed(1);
    if (picker.key === 'fat') setFat(valueText);
    else if (picker.key === 'snf') setSnf(valueText);
    else if (entries.some((entry) => entry.animalId === picker.key)) setValues((current) => ({ ...current, [picker.key]: valueText }));
    else setAllocationValues((current) => ({ ...current, [picker.key]: valueText }));
    const entryIndex = entries.findIndex((entry) => entry.animalId === picker.key);
    if (entryIndex >= 0 && entryIndex < entries.length - 1) {
      const next = entries[entryIndex + 1];
      const currentValue = Number(values[next.animalId]);
      setPicker({ key: next.animalId, max: 30, label: `${next.tag} litres`, initial: values[next.animalId] !== '' && Number.isFinite(currentValue) ? currentValue : (previousVolumes[next.animalId] ?? 0) / 1_000 });
      return;
    }
    if (entryIndex === entries.length - 1) {
      const currentValue = Number(fat);
      setPicker({ key: 'fat', max: 10, label: 'FAT %', initial: fat !== '' && Number.isFinite(currentValue) ? currentValue : (previousFat ?? 0) / 100 });
      return;
    }
    const buyerRows = allocations.filter((allocation) => allocation.destination === 'buyer');
    const buyerIndex = buyerRows.findIndex((allocation) => allocation.key === picker.key);
    if (buyerIndex >= 0 && buyerIndex < buyerRows.length - 1) {
      const next = buyerRows[buyerIndex + 1];
      const currentValue = Number(allocationValues[next.key]);
      setPicker({ key: next.key, max: 100, label: `${next.label} litres`, initial: allocationValues[next.key] !== '' && Number.isFinite(currentValue) ? currentValue : (previousAllocationVolumes[next.key] ?? 0) / 1_000 });
      return;
    }
    if (buyerIndex === buyerRows.length - 1) {
      setPicker(null);
      return;
    }
    if (picker.key === 'fat') {
      const currentValue = Number(snf);
      setPicker({ key: 'snf', max: 10, label: 'SNF %', initial: snf !== '' && Number.isFinite(currentValue) ? currentValue : (previousSnf ?? 0) / 100 });
      return;
    }
    setPicker(null);
  };

  return (
    <AppScreen scroll={false} title="Milk" action={<View style={styles.headerControls}><Pressable accessibilityLabel="Open Daily Dairy" onPress={() => router.push('/daily-diary' as never)} style={[styles.menuButton, { borderColor: colors.border }]}><Text style={[styles.menuButtonText, { color: colors.text }]}>📖</Text></Pressable><Pressable accessibilityLabel={isLocked ? 'Unlock this Milk date' : 'Milk date is unlocked'} disabled={milkDate === todayAtFarm()} onPress={() => setUnlockedDate(isLocked ? milkDate : null)} style={[styles.menuButton, { borderColor: isLocked ? colors.primary : colors.border }]}><Text style={[styles.menuButtonText, { color: isLocked ? colors.primary : colors.text }]}>{isLocked ? '🔒' : '🔓'}</Text></Pressable><Pressable accessibilityLabel="Open Milk menu" onPress={() => setMenuOpen(true)} style={[styles.menuButton, { borderColor: colors.border }]}><Text style={[styles.menuButtonText, { color: colors.text }]}>•••</Text></Pressable></View>}>
      <MilkMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={(path) => { setMenuOpen(false); router.push(path); }}
        onSignOut={() => {
          setMenuOpen(false);
          Alert.alert(
            'Sign out?',
            'Make sure pending uploads are zero before signing out. You can sign in again with the same Google account to access this farm.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ],
          );
        }}
      />
      <NestableScrollContainer contentContainerStyle={styles.pageContent} style={styles.pageScroll} keyboardShouldPersistTaps="handled">
      <View style={styles.dateRow}>
        <SmallButton label="‹" onPress={() => { setHydrated(false); setUnlockedDate(null); setMilkDate((value) => shiftDate(value, -1)); }} />
        <View style={styles.dateCenter}>
          <Text style={[styles.date, { color: colors.text }]}>{formatFarmDate(milkDate)}</Text>
          {milkDate === todayAtFarm()
            ? <Text style={[styles.today, { color: colors.primary }]}>Today</Text>
            : <Pressable onPress={() => { setHydrated(false); setUnlockedDate(null); setMilkDate(todayAtFarm()); }}><Text style={[styles.today, { color: colors.primary }]}>Go to today</Text></Pressable>}
        </View>
        <SmallButton label="›" onPress={() => { setHydrated(false); setUnlockedDate(null); setMilkDate((value) => shiftDate(value, 1)); }} />
      </View>

      <View style={styles.sessionRow}>
        {(['morning', 'evening'] as const).map((value) => (
          <Pressable key={value} onPress={() => { setHydrated(false); setMilkSession(value); }} style={[styles.session, { backgroundColor: milkSession === value ? colors.primary : colors.backgroundSelected }]}>
            <Text style={[styles.sessionText, { color: milkSession === value ? '#FFFFFF' : colors.text }]}>{value === 'morning' ? 'Morning' : 'Evening'}</Text>
          </Pressable>
        ))}
      </View>
      {isLocked ? <Text style={[styles.helper, { color: colors.textSecondary }]}>This date is locked. Tap the lock icon to temporarily edit it; it locks again when you move to another date.</Text> : null}

      <SectionCard>
        {loading ? <ActivityIndicator color={colors.primary} /> : entries.length === 0 ? <EmptyState>No active milking animals. Add an animal in Master data first.</EmptyState> : <NestableDraggableFlatList
          data={entries}
          keyExtractor={(entry) => entry.animalId}
          scrollEnabled={false}
          activationDistance={32}
          onDragEnd={({ data }) => void saveAnimalOrder(data)}
          renderItem={({ item: entry, drag, isActive }) => <ScaleDecorator><View style={[styles.entryRow, { borderTopColor: colors.border }, isLocked && styles.lockedRow, isActive && { opacity: 0.75 }]}>
            <Pressable accessibilityLabel={`Hold drag handle to reorder ${entry.tag}`} delayLongPress={350} disabled={busy || isLocked} onLongPress={drag} style={[styles.dragHandle, { borderColor: colors.border }]}><Text style={[styles.dragHandleText, { color: colors.textSecondary }]}>↕</Text></Pressable>
            <View style={styles.animalCopy}>
              <Link href={{ pathname: '/animal-profile/[id]', params: { id: entry.animalId } }} asChild><Pressable accessibilityLabel={`Open ${entry.tag} profile`}><Text style={[styles.animalName, { color: colors.primary }]}>{entry.tag}</Text></Pressable></Link>
              {entry.labels.length ? <View style={styles.labelList}>{entry.labels.map((label) => <View key={label.id} style={[styles.labelChip, { backgroundColor: label.color }]}><Text numberOfLines={1} style={styles.labelText}>{label.name}</Text></View>)}</View> : null}
            </View>
            <SuggestionField disabled={isLocked} accessibilityLabel={`${entry.tag} litres`} onPress={() => openPicker(entry.animalId, 30, `${entry.tag} litres`, previousVolumes[entry.animalId] ?? null)} value={values[entry.animalId] ?? ''} placeholder={previousVolumes[entry.animalId] === undefined ? '—' : (previousVolumes[entry.animalId] / 1_000).toFixed(1)} invalid={Number.isNaN(parseLitres(values[entry.animalId] ?? ''))} />
            <Text style={[styles.litre, { color: colors.textSecondary }]}>L</Text>
          </View></ScaleDecorator>}
        />}
      </SectionCard>

      <SectionCard>
        <View style={styles.qualityRow}>
          <QualityField disabled={isLocked} label="FAT %" value={fat} onPress={() => openPicker('fat', 10, 'FAT %', previousFat)} placeholder={previousFat === null ? '0.0' : (previousFat / 100).toFixed(1)} invalid={Number.isNaN(fatHundredths) || (fatHundredths !== null && fatHundredths > 1_500)} />
          <QualityField disabled={isLocked} label="SNF %" value={snf} onPress={() => openPicker('snf', 10, 'SNF %', previousSnf)} placeholder={previousSnf === null ? '0.0' : (previousSnf / 100).toFixed(1)} invalid={Number.isNaN(snfHundredths) || (snfHundredths !== null && snfHundredths > 1_500)} />
        </View>
      </SectionCard>

      <SectionCard>
        {allocations.filter((allocation) => allocation.destination === 'buyer').length ? <NestableDraggableFlatList
          data={allocations.filter((allocation) => allocation.destination === 'buyer')}
          keyExtractor={(allocation) => allocation.key}
          scrollEnabled={false}
          activationDistance={32}
          onDragEnd={({ data }) => void saveBuyerOrder(data)}
          renderItem={({ item: allocation, drag, isActive }) => <ScaleDecorator><View style={[styles.entryRow, { borderTopColor: colors.border }, isLocked && styles.lockedRow, isActive && { opacity: 0.75 }]}>
            <Pressable accessibilityLabel={`Hold drag handle to reorder ${allocation.label}`} delayLongPress={350} disabled={busy || isLocked} onLongPress={drag} style={[styles.dragHandle, { borderColor: colors.border }]}><Text style={[styles.dragHandleText, { color: colors.textSecondary }]}>↕</Text></Pressable>
            <View style={styles.animalCopy}>
              {allocation.buyerId ? <Link href={{ pathname: '/buyer-account/[id]', params: { id: allocation.buyerId } }} asChild><Pressable accessibilityLabel={`Open ${allocation.label} account`}><Text style={[styles.animalName, { color: colors.primary }]}>{allocation.label}</Text></Pressable></Link> : <Text style={[styles.animalName, { color: colors.text }]}>{allocation.label}</Text>}
              <Text style={[styles.entryState, { color: allocation.ratePaisePerLitre === null && allocation.label.trim().toLocaleLowerCase() !== 'verka' ? colors.danger : colors.textSecondary }]}>{allocation.label.trim().toLocaleLowerCase() === 'verka' ? 'Verka rate finalized after billing cycle' : allocation.ratePaisePerLitre === null ? 'Set rate in Master data' : `${formatMoney(allocation.ratePaisePerLitre)} / L`}</Text>
            </View>
            <SuggestionField disabled={isLocked} accessibilityLabel={`${allocation.label} litres`} onPress={() => openPicker(allocation.key, 100, `${allocation.label} litres`, previousAllocationVolumes[allocation.key] ?? null)} value={allocationValues[allocation.key] ?? ''} placeholder={previousAllocationVolumes[allocation.key] === undefined ? '—' : (previousAllocationVolumes[allocation.key] / 1_000).toFixed(1)} invalid={Number.isNaN(parseLitres(allocationValues[allocation.key] ?? ''))} />
            <Text style={[styles.litre, { color: colors.textSecondary }]}>L</Text>
          </View></ScaleDecorator>}
        /> : <Text style={[styles.helper, { color: colors.textSecondary }]}>Add buyers in Master data to allocate milk sales.</Text>}
      </SectionCard>

      {verkaTarget && verkaDifferenceMl !== null ? <SectionCard title="Verka 100 kg target">
        <Text style={[styles.helper, { color: colors.textSecondary }]}>{formatFarmDate(verkaTarget.cycleStart)} – {formatFarmDate(verkaTarget.cycleEnd)} · saved Verka allocations only</Text>
        <Text style={[styles.verkaValue, { color: colors.text }]}>Supplied {formatMilk(verkaTarget.suppliedMl)} / target {formatMilk(verkaTarget.targetMl)}</Text>
        <Text style={[styles.helper, { color: verkaDifferenceMl >= 0 ? colors.primary : colors.danger }]}>{verkaDifferenceMl >= 0 ? `${formatMilk(verkaDifferenceMl)} above target` : `${formatMilk(Math.abs(verkaDifferenceMl))} short of target`}</Text>
      </SectionCard> : null}

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
      <SuggestionPicker picker={picker} onClose={() => setPicker(null)} onSelect={selectSuggestion} />
      </NestableScrollContainer>
    </AppScreen>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return <Pressable onPress={onPress} style={[styles.smallButton, { backgroundColor: colors.backgroundSelected }]}><Text style={[styles.smallButtonText, { color: colors.text }]}>{label}</Text></Pressable>;
}

function SuggestionField({ accessibilityLabel, disabled, onPress, value, placeholder, invalid }: { accessibilityLabel: string; disabled?: boolean; onPress: () => void; value: string; placeholder: string; invalid: boolean }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return <Pressable accessibilityLabel={accessibilityLabel} disabled={disabled} onPress={onPress} style={[styles.volumeInput, { borderColor: invalid ? colors.danger : colors.border }, disabled && styles.lockedRow]}><Text style={[styles.volumeText, { color: value ? colors.primary : colors.textSecondary }]}>{value || placeholder}</Text></Pressable>;
}

function QualityField({ disabled, label, value, onPress, placeholder, invalid }: { disabled?: boolean; label: string; value: string; onPress: () => void; placeholder: string; invalid: boolean }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return (
    <View style={styles.qualityField}>
      <Text style={[styles.qualityLabel, { color: colors.text }]}>{label}</Text>
      <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.qualityInput, { borderColor: invalid ? colors.danger : colors.border }, disabled && styles.lockedRow]}><Text style={[styles.volumeText, { color: value ? colors.primary : colors.textSecondary }]}>{value || placeholder}</Text></Pressable>
    </View>
  );
}

function SuggestionPicker({ picker, onClose, onSelect }: { picker: { key: string; max: number; initial: number; label: string } | null; onClose: () => void; onSelect: (value: number) => void }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  if (!picker) return null;
  return <Modal transparent animationType="none" visible onRequestClose={onClose}><View style={styles.pickerOverlay}><View style={[styles.pickerPanel, { backgroundColor: colors.backgroundElement }]}><View style={styles.pickerHeader}><Text numberOfLines={1} style={[styles.pickerTitle, { color: colors.text }]}>{picker.label}</Text><Pressable accessibilityLabel="Close suggestions" hitSlop={8} onPress={onClose} style={styles.closeButton}><Text style={[styles.closeText, { color: colors.primary }]}>Close</Text></Pressable></View><SuggestionGrid key={picker.key} colors={colors} picker={picker} onSelect={onSelect} /></View></View></Modal>;
}

function SuggestionGrid({ colors, picker, onSelect }: { colors: typeof Colors[keyof typeof Colors]; picker: { max: number; initial: number }; onSelect: (value: number) => void }) {
  const maxStart = Math.max(0, picker.max - 2);
  const [start, setStart] = useState(() => Math.max(0, Math.min(maxStart, Math.floor(picker.initial) - 1)));
  const unit = picker.max === 10 ? '%' : 'L';
  return <><View style={styles.pickerNavigation}><Pressable accessibilityLabel="Previous suggestion range" disabled={start === 0} onPress={() => setStart((value) => Math.max(0, value - 1))}><Text style={[styles.pickerNavigationText, { color: colors.primary }, start === 0 && styles.disabled]}>‹ Previous</Text></Pressable><Text style={[styles.pickerHint, { color: colors.textSecondary }]}>{start.toFixed(0)}–{Math.min(picker.max, start + 2).toFixed(0)} {unit}</Text><Pressable accessibilityLabel="Next suggestion range" disabled={start === maxStart} onPress={() => setStart((value) => Math.min(maxStart, value + 1))}><Text style={[styles.pickerNavigationText, { color: colors.primary }, start === maxStart && styles.disabled]}>Next ›</Text></Pressable></View><View>{Array.from({ length: 10 }, (_, decimal) => <View key={decimal} style={styles.pickerRow}>{[start, start + 1, start + 2].map((whole) => { const value = whole + decimal / 10; const selected = Math.abs(value - picker.initial) < 0.01; return <Pressable key={whole} onPress={() => onSelect(value)} style={[styles.pickerValue, { borderTopColor: colors.border }, selected && { backgroundColor: colors.backgroundSelected }]}><Text style={[styles.pickerValueText, { color: selected ? colors.primary : colors.text }]}>{value.toFixed(1)}</Text></Pressable>; })}</View>)}</View></>;
}

function MilkMenu({ open, onClose, onNavigate, onSignOut }: { open: boolean; onClose: () => void; onNavigate: (path: '/master-data' | '/pricing' | '/corrections' | '/reminders') => void; onSignOut: () => void }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  useEffect(() => { if (open) void loadThemePreference().then(setThemePreference); }, [open]);
  const options: { label: string; detail: string; path: '/master-data' | '/pricing' | '/corrections' | '/reminders' }[] = [
    { label: 'Manage master data', detail: 'Animals, buyers, feed, medicine, and products', path: '/master-data' },
    { label: 'Price calculator', detail: 'Calculate a reference price from FAT and SNF', path: '/pricing' },
    { label: 'Correction history', detail: 'Review saved edits, voids, and changes', path: '/corrections' },
  ];
  return (
    <Modal transparent animationType="slide" visible={open} onRequestClose={onClose}>
      <View style={styles.menuOverlay}>
        <Pressable accessibilityLabel="Close Milk menu" onPress={onClose} style={StyleSheet.absoluteFill} />
          <View style={[styles.menuPanel, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.menuHeader}><Text style={[styles.menuTitle, { color: colors.text }]}>Milk menu</Text><Pressable onPress={onClose}><Text style={[styles.closeText, { color: colors.primary }]}>Close</Text></Pressable></View>
          {options.map((option) => <Pressable key={option.path} onPress={() => onNavigate(option.path)} style={[styles.menuItem, { borderTopColor: colors.border }]}><Text style={[styles.menuItemTitle, { color: colors.text }]}>{option.label}</Text><Text style={[styles.menuItemDetail, { color: colors.textSecondary }]}>{option.detail}</Text></Pressable>)}
          <View style={[styles.menuItem, { borderTopColor: colors.border }]}><Text style={[styles.menuItemTitle, { color: colors.text }]}>Theme</Text><Text style={[styles.menuItemDetail, { color: colors.textSecondary }]}>Choose how the app looks on this device</Text><View style={styles.themeOptions}>{(['system', 'light', 'dark'] as const).map((option) => <Pressable key={option} onPress={() => { setThemePreference(option); void saveThemePreference(option); }} style={[styles.themeOption, { backgroundColor: themePreference === option ? colors.primary : colors.backgroundSelected }]}><Text style={{ color: themePreference === option ? '#FFFFFF' : colors.text }}>{option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}</Text></Pressable>)}</View></View>
          <Pressable onPress={onSignOut} style={[styles.menuItem, { borderTopColor: colors.border }]}><Text style={[styles.menuItemTitle, { color: colors.danger }]}>Sign out</Text><Text style={[styles.menuItemDetail, { color: colors.textSecondary }]}>Sign out of this Google account on this device</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pageScroll: { flex: 1 },
  pageContent: { gap: 16, paddingBottom: 28 },
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
  headerControls: { flexDirection: 'row', gap: 8 },
  helper: { fontSize: 13, lineHeight: 19 },
  verkaValue: { fontSize: 16, fontWeight: '800' },
  qualityRow: { flexDirection: 'row', gap: 10 },
  qualityField: { flex: 1, gap: 6 },
  qualityLabel: { fontSize: 13, fontWeight: '700' },
  qualityInput: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, fontSize: 17 },
  entryRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 8 },
  dragHandle: { alignItems: 'center', borderWidth: 1, borderRadius: 10, justifyContent: 'center', minHeight: 44, width: 32 },
  dragHandleText: { fontSize: 20, fontWeight: '800' },
  lockedRow: { opacity: 0.55 },
  animalCopy: { flex: 1, gap: 2 },
  animalName: { fontSize: 16, fontWeight: '700' },
  labelList: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, maxHeight: 36, overflow: 'hidden' },
  labelChip: { maxWidth: 90, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  labelText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  orderControls: { gap: 3 },
  orderButton: { width: 26, height: 21, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  orderButtonText: { fontSize: 14, fontWeight: '800', lineHeight: 16 },
  entryState: { fontSize: 12 },
  volumeInput: { width: 52, minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, textAlign: 'right', fontSize: 17 },
  volumeText: { fontSize: 17, textAlign: 'right', lineHeight: 44 },
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
  themeOptions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  themeOption: { alignItems: 'center', borderRadius: 9, flex: 1, paddingVertical: 9 },
  pickerOverlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  pickerPanel: { alignSelf: 'center', width: '100%', maxWidth: 420, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 18, paddingBottom: 24 },
  pickerHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  pickerTitle: { flex: 1, flexShrink: 1, fontSize: 22, fontWeight: '800' },
  closeButton: { minWidth: 46, alignItems: 'flex-end' },
  pickerNavigation: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  pickerNavigationText: { fontSize: 14, fontWeight: '800' },
  pickerHint: { fontSize: 13, lineHeight: 18 },
  pickerRow: { flexDirection: 'row' },
  pickerValue: { flex: 1, height: 46, justifyContent: 'center', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  pickerValueText: { fontSize: 19, fontWeight: '700' },
});
