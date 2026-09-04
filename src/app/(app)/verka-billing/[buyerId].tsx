import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { DateField } from '@/components/date-field';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { loadVerkaCycles, saveVerkaCycle } from '@/data/repositories/verka-billing';
import type { VerkaCycle, VerkaCycleSnapshot } from '@/data/repositories/verka-billing.types';
import { requireSupabase } from '@/data/supabase/client';
import { formatFarmDate } from '@/domain/dates';
import { formatMilk, formatMoney } from '@/domain/calculations';
import { useSession } from '@/features/auth/session-provider';

type BillFile = { path: string; name: string };

const today = () => new Date().toISOString().slice(0, 10);

function toMl(value: string) {
  if (!value.trim()) return null;
  const litres = Number(value);
  return Number.isFinite(litres) && litres >= 0 ? Math.round(litres * 1000) : null;
}

function asLitres(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value / 1000);
}

export default function VerkaBillingScreen() {
  const { buyerId } = useLocalSearchParams<{ buyerId: string }>();
  const { session } = useSession();
  const colors = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [farmId, setFarmId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<VerkaCycleSnapshot | null>(null);
  const [editingCycleId, setEditingCycleId] = useState<string | undefined>();
  const [cycleStart, setCycleStart] = useState(today);
  const [cycleEnd, setCycleEnd] = useState(today);
  const [rate, setRate] = useState('');
  const [commission, setCommission] = useState('');
  const [increment, setIncrement] = useState('');
  const [deduction, setDeduction] = useState('');
  const [notes, setNotes] = useState('');
  const [billMorning, setBillMorning] = useState('');
  const [billEvening, setBillEvening] = useState('');
  const [billTotal, setBillTotal] = useState('');
  const [bill, setBill] = useState<BillFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const powerSync = await getPowerSyncSnapshot();
    setFarmId(powerSync.farmId);
    if (powerSync.farmId && buyerId) setSnapshot(await loadVerkaCycles(powerSync.farmId, buyerId));
  }, [buyerId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const appMilk = useMemo(() => {
    const sales = (snapshot?.sales ?? []).filter((sale) => sale.milkDate >= cycleStart && sale.milkDate <= cycleEnd);
    const morningMl = sales.filter((sale) => sale.session === 'morning').reduce((sum, sale) => sum + sale.volumeMl, 0);
    const eveningMl = sales.filter((sale) => sale.session === 'evening').reduce((sum, sale) => sum + sale.volumeMl, 0);
    return { morningMl, eveningMl, totalMl: morningMl + eveningMl };
  }, [cycleEnd, cycleStart, snapshot]);

  const clearForm = () => {
    setEditingCycleId(undefined);
    setCycleStart(today()); setCycleEnd(today()); setRate(''); setCommission(''); setIncrement(''); setDeduction('');
    setNotes(''); setBillMorning(''); setBillEvening(''); setBillTotal(''); setBill(null); setMessage(null);
  };

  const attachBill = async () => {
    if (!farmId || !buyerId) return;
    try {
      setBusy(true); setMessage(null);
      const picked = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error('Choose a bill smaller than 10 MB.');
      const path = `${farmId}/${buyerId}/${Date.now()}-${asset.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const response = await fetch(asset.uri);
      const upload = await requireSupabase().storage.from('verka-bills').upload(path, await response.arrayBuffer(), { contentType: asset.mimeType ?? 'application/octet-stream' });
      if (upload.error) throw upload.error;
      setBill({ path, name: asset.name });
      setMessage('Bill attached. Save the billing cycle to keep it.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not attach the bill.');
    } finally { setBusy(false); }
  };

  const openBill = async (path: string) => {
    try {
      const result = await requireSupabase().storage.from('verka-bills').createSignedUrl(path, 600);
      if (result.error) throw result.error;
      if (result.data.signedUrl) await Linking.openURL(result.data.signedUrl);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not open the bill.'); }
  };

  const editCycle = (cycle: VerkaCycle) => {
    setEditingCycleId(cycle.id); setCycleStart(cycle.cycleStart); setCycleEnd(cycle.cycleEnd);
    setRate(cycle.finalRatePaisePerLitre ? String(cycle.finalRatePaisePerLitre / 100) : '');
    setCommission(cycle.commissionPaise ? String(cycle.commissionPaise / 100) : '');
    setIncrement(cycle.incrementPaise ? String(cycle.incrementPaise / 100) : '');
    setDeduction(cycle.deductionPaise ? String(cycle.deductionPaise / 100) : '');
    setNotes(cycle.notes ?? ''); setBillMorning(asLitres(cycle.billMorningMl)); setBillEvening(asLitres(cycle.billEveningMl)); setBillTotal(asLitres(cycle.billTotalMl));
    setBill(cycle.billPath ? { path: cycle.billPath, name: cycle.billName ?? 'Attached bill' } : null);
    setMessage('Editing saved cycle. Saving will update this same billing period.');
  };

  const save = async () => {
    const rateValue = Number(rate);
    if (!farmId || !buyerId || !session || !Number.isFinite(rateValue) || rateValue < 0) { setMessage('Enter a valid final rate before saving.'); return; }
    try {
      setBusy(true); setMessage(null);
      await saveVerkaCycle({ id: editingCycleId, farmId, buyerId, userId: session.user.id, cycleStart, cycleEnd, finalRatePaisePerLitre: Math.round(rateValue * 100), commissionPaise: Math.round((Number(commission) || 0) * 100), incrementPaise: Math.round((Number(increment) || 0) * 100), deductionPaise: Math.round((Number(deduction) || 0) * 100), notes: notes.trim() || undefined, billPath: bill?.path, billName: bill?.name, billMorningMl: toMl(billMorning), billEveningMl: toMl(billEvening), billTotalMl: toMl(billTotal) });
      await load(); setMessage(editingCycleId ? 'Billing cycle updated.' : 'Billing cycle saved.'); setEditingCycleId(undefined);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save the billing cycle.'); }
    finally { setBusy(false); }
  };

  const billMl = { morning: toMl(billMorning), evening: toMl(billEvening), total: toMl(billTotal) };
  const expectedAmount = Math.round((appMilk.totalMl / 1000) * (Number(rate) || 0) * 100);
  const input = (value: string, onChangeText: (value: string) => void, placeholder: string) => <TextInput style={[styles.input, { borderColor: colors.border, color: colors.text }]} value={value} onChangeText={onChangeText} keyboardType="decimal-pad" placeholder={placeholder} placeholderTextColor={colors.textSecondary} />;

  return <AppScreen title="Verka billing"><SectionCard title={editingCycleId ? 'Edit billing cycle' : 'New billing cycle'}>
    <DateField label="Cycle start" value={cycleStart} onChange={setCycleStart} /><DateField label="Cycle end" value={cycleEnd} onChange={setCycleEnd} />
    {input(rate, setRate, 'Final rate ₹ / litre')}
    <View style={styles.summary}><Text style={{ color: colors.text }}>App milk for this period</Text><Text style={{ color: colors.textSecondary }}>Morning {formatMilk(appMilk.morningMl)} · Evening {formatMilk(appMilk.eveningMl)} · Total {formatMilk(appMilk.totalMl)}</Text><Text style={{ color: colors.textSecondary }}>Expected value: {formatMoney(expectedAmount)}</Text></View>
    <Text style={[styles.label, { color: colors.text }]}>Bill milk (optional, litres)</Text>
    {input(billMorning, setBillMorning, 'Bill morning milk')}{input(billEvening, setBillEvening, 'Bill evening milk')}{input(billTotal, setBillTotal, 'Bill total milk')}
    <Text style={{ color: colors.textSecondary }}>Difference: morning {formatMilk((billMl.morning ?? 0) - appMilk.morningMl)} · evening {formatMilk((billMl.evening ?? 0) - appMilk.eveningMl)} · total {formatMilk((billMl.total ?? 0) - appMilk.totalMl)}</Text>
    {input(commission, setCommission, 'Commission ₹ (optional)')}{input(increment, setIncrement, 'Increment ₹ (optional)')}{input(deduction, setDeduction, 'Deduction ₹ (optional)')}
    <TextInput style={[styles.input, { borderColor: colors.border, color: colors.text }]} value={notes} onChangeText={setNotes} multiline placeholder="Notes (optional)" placeholderTextColor={colors.textSecondary} />
    <Pressable disabled={busy} onPress={() => void attachBill()}><Text style={{ color: colors.primary }}>{bill ? `Attached: ${bill.name}` : 'Attach PDF or image bill'}</Text></Pressable>
    {bill ? <Pressable disabled={busy} onPress={() => void openBill(bill.path)}><Text style={{ color: colors.primary }}>Open attached bill</Text></Pressable> : null}
    {message ? <Text style={{ color: colors.textSecondary }}>{message}</Text> : null}
    <View style={styles.actions}>{editingCycleId ? <Pressable disabled={busy} onPress={clearForm}><Text style={{ color: colors.primary }}>Cancel edit</Text></Pressable> : null}<Pressable disabled={busy} onPress={() => void save()} style={[styles.save, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}><Text style={styles.saveText}>{busy ? 'Saving…' : editingCycleId ? 'Update billing' : 'Save billing'}</Text></Pressable></View>
  </SectionCard><SectionCard title="Saved cycles">{snapshot?.cycles.length ? snapshot.cycles.map((cycle) => <View key={cycle.id} style={[styles.cycle, { borderColor: colors.border }]}><Text style={{ color: colors.text }}>{formatFarmDate(cycle.cycleStart)} – {formatFarmDate(cycle.cycleEnd)}</Text><Text style={{ color: colors.textSecondary }}>Rate ₹{((cycle.finalRatePaisePerLitre ?? 0) / 100).toFixed(2)} / litre</Text><View style={styles.actions}><Pressable onPress={() => editCycle(cycle)}><Text style={{ color: colors.primary }}>Edit cycle</Text></Pressable>{cycle.billPath ? <Pressable onPress={() => void openBill(cycle.billPath!)}><Text style={{ color: colors.primary }}>Open bill</Text></Pressable> : null}</View></View>) : <EmptyState>No saved cycles yet.</EmptyState>}</SectionCard></AppScreen>;
}

const styles = StyleSheet.create({
  actions: { alignItems: 'center', flexDirection: 'row', gap: 16, justifyContent: 'space-between' },
  cycle: { borderBottomWidth: StyleSheet.hairlineWidth, gap: 4, paddingVertical: 12 },
  input: { borderWidth: 1, borderRadius: 10, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10 },
  label: { fontWeight: '700' },
  save: { borderRadius: 10, flex: 1, padding: 14 },
  saveText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  summary: { gap: 4 },
});
