import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Directory } from 'expo-file-system';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { DateField } from '@/components/date-field';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { createBuyerBill, createBuyerPayment, deleteBuyerBill, loadBuyerAccount } from '@/data/repositories/buyer-account';
import type { BuyerAccountSnapshot } from '@/data/repositories/buyer-account.types';
import { requireSupabase } from '@/data/supabase/client';
import { formatMilk, formatMoney } from '@/domain/calculations';
import { formatFarmDate, shiftTenDayCycle, tenDayCycleEnd, tenDayCycleStart } from '@/domain/dates';
import { useSession } from '@/features/auth/session-provider';

const today = () => new Date().toISOString().slice(0, 10);
const isImageFile = (name: string) => /\.(avif|bmp|gif|heic|jpe?g|png|webp)$/i.test(name);

export default function BuyerAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { session } = useSession(); const colors = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [account, setAccount] = useState<BuyerAccountSnapshot | null>(null); const [farmId, setFarmId] = useState<string | null>(null); const [amount, setAmount] = useState(''); const [date, setDate] = useState(today); const [mode, setMode] = useState<'cash' | 'online' | 'other'>('cash'); const [busy, setBusy] = useState(false); const [exporting, setExporting] = useState(false); const [message, setMessage] = useState<string | null>(null); const [cycleStart, setCycleStart] = useState(tenDayCycleStart(today())); const [billImageUrls, setBillImageUrls] = useState<Record<string, string>>({});
  const refresh = useCallback(async () => { const sync = await getPowerSyncSnapshot(); setFarmId(sync.farmId); if (!sync.farmId || !id) return; const nextAccount = await loadBuyerAccount(sync.farmId, id); setAccount(nextAccount); const imageBills = nextAccount.bills.filter((bill) => isImageFile(bill.fileName)); const links = await Promise.all(imageBills.map(async (bill) => { const result = await requireSupabase().storage.from('buyer-bill-files').createSignedUrl(bill.storagePath, 600); return [bill.id, result.data?.signedUrl] as const; })); setBillImageUrls(Object.fromEntries(links.filter((entry): entry is readonly [string, string] => Boolean(entry[1])))); }, [id]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const totals = useMemo(() => ({ sales: account?.sales.reduce((sum, row) => sum + row.amountPaise, 0) ?? 0, paid: account?.payments.reduce((sum, row) => sum + row.amountPaise, 0) ?? 0 }), [account]);
  const cycleSales = useMemo(() => { const byDate = new Map<string, { morningMl: number; eveningMl: number }>(); for (const row of account?.sales ?? []) { if (tenDayCycleStart(row.milkDate) !== cycleStart) continue; const current = byDate.get(row.milkDate) ?? { morningMl: 0, eveningMl: 0 }; if (row.session === 'morning') current.morningMl += row.volumeMl; else current.eveningMl += row.volumeMl; byDate.set(row.milkDate, current); } return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)); }, [account?.sales, cycleStart]);
  const save = async () => { const paise = Math.round(Number(amount) * 100); if (!farmId || !session || !id || !Number.isSafeInteger(paise) || paise <= 0) return; setBusy(true); try { await createBuyerPayment({ farmId, userId: session.user.id, buyerId: id, paymentDate: date, amountPaise: paise, mode }); setAmount(''); await refresh(); } finally { setBusy(false); } };
  const cycleEndDate = tenDayCycleEnd(cycleStart);
  const uploadBill = async () => { try { const sync = await getPowerSyncSnapshot(); if (!sync.farmId || !session || !id) return; const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true }); if (result.canceled) return; const asset = result.assets[0]; const path = `${sync.farmId}/${id}/${Date.now()}-${asset.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`; const file = await fetch(asset.uri); const upload = await requireSupabase().storage.from('buyer-bill-files').upload(path, await file.arrayBuffer(), { contentType: asset.mimeType ?? 'application/octet-stream' }); if (upload.error) throw upload.error; await createBuyerBill({ farmId: sync.farmId, userId: session.user.id, buyerId: id, billDate: cycleStart, storagePath: path, fileName: asset.name }); await refresh(); setMessage('Bill added to this 10-day period.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to upload bill.'); } };
  const openBill = async (storagePath: string) => { const result = await requireSupabase().storage.from('buyer-bill-files').createSignedUrl(storagePath, 600); if (result.data?.signedUrl) await Linking.openURL(result.data.signedUrl); };
  const removeBill = async (bill: NonNullable<BuyerAccountSnapshot>['bills'][number]) => { try { if (!farmId || !session) return; const result = await requireSupabase().storage.from('buyer-bill-files').remove([bill.storagePath]); if (result.error) throw result.error; await deleteBuyerBill({ farmId, userId: session.user.id, id: bill.id }); await refresh(); setMessage('Bill deleted.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to delete bill.'); } };
  const exportCycleCsv = async () => {
    if (!account) return;
    setExporting(true); setMessage(null);
    try {
      const directory = await Directory.pickDirectoryAsync();
      const file = directory.createFile(`${safeFileName(account.buyer.name)}-milk-${cycleStart}-to-${cycleEndDate}.csv`, 'text/csv');
      file.write(`\uFEFF${buildBuyerCycleCsv(account.buyer.name, cycleStart, cycleEndDate, cycleSales)}`);
      setMessage(`CSV exported as ${file.name}. Attach it with the buyer bill in your comparison tool.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to export the buyer milk report.'); }
    finally { setExporting(false); }
  };
  return <AppScreen title={account?.buyer.name ?? 'Buyer account'} subtitle="Milk sales, payments, and pending balance">
    <SectionCard title="Account summary"><Text style={{ color: colors.text }}>Rate: {account?.buyer.defaultRatePaisePerLitre === null ? 'Not set' : `${formatMoney(account?.buyer.defaultRatePaisePerLitre ?? 0)}/L`}</Text><Text style={{ color: colors.text }}>Pending: {formatMoney(totals.sales - totals.paid)}</Text></SectionCard>
    <SectionCard title="Record payment"><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount ₹" placeholderTextColor={colors.textSecondary} style={{ borderWidth: 1, borderColor: colors.border, color: colors.text, borderRadius: 10, padding: 12 }}/><DateField label="Payment date" onChange={setDate} value={date} /><View style={{ flexDirection: 'row', gap: 8 }}>{(['cash', 'online', 'other'] as const).map((value) => <Pressable key={value} onPress={() => setMode(value)} style={{ padding: 10, borderRadius: 10, backgroundColor: mode === value ? colors.primary : colors.backgroundSelected }}><Text style={{ color: mode === value ? '#fff' : colors.text }}>{value}</Text></Pressable>)}</View><Pressable disabled={busy || !amount} onPress={() => void save()} style={{ padding: 14, borderRadius: 10, backgroundColor: colors.primary }}><Text style={{ color: '#fff', textAlign: 'center' }}>{busy ? 'Saving…' : 'Add payment'}</Text></Pressable></SectionCard>
    <SectionCard title="10-day milk"><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Pressable onPress={() => setCycleStart((value) => shiftTenDayCycle(value, -1))}><Text style={{ color: colors.primary }}>‹ Previous</Text></Pressable><Text style={{ color: colors.text }}>{formatFarmDate(cycleStart)} – {formatFarmDate(cycleEndDate)}</Text><Pressable onPress={() => setCycleStart((value) => shiftTenDayCycle(value, 1))}><Text style={{ color: colors.primary }}>Next ›</Text></Pressable></View><Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Total Milk: {formatMilk(cycleSales.reduce((sum, [, volumes]) => sum + volumes.morningMl + volumes.eveningMl, 0))}</Text>{cycleSales.length ? cycleSales.map(([milkDate, volumes]) => <Text key={milkDate} style={{ color: colors.text }}>{formatFarmDate(milkDate)} · M - {formatMilk(volumes.morningMl)} | E - {formatMilk(volumes.eveningMl)}</Text>) : <EmptyState>No milk sales in this period.</EmptyState>}<Pressable disabled={exporting} onPress={() => void exportCycleCsv()} style={{ opacity: exporting ? 0.6 : 1, padding: 12, borderRadius: 10, backgroundColor: colors.primary }}><Text style={{ color: '#fff', textAlign: 'center' }}>{exporting ? 'Exporting…' : 'Choose folder and export CSV'}</Text></Pressable>{message ? <Text style={{ color: colors.textSecondary }}>{message}</Text> : null}</SectionCard>
    <SectionCard title="Bill uploads"><Text style={{ color: colors.textSecondary }}>Attach an image or PDF bill to the currently selected 10-day period.</Text><Pressable onPress={() => void uploadBill()} style={{ padding: 12, borderRadius: 10, backgroundColor: colors.primary }}><Text style={{ color: '#fff', textAlign: 'center' }}>Upload bill image or PDF</Text></Pressable>{account?.bills.filter((bill) => bill.billDate >= cycleStart && bill.billDate <= cycleEndDate).length ? account.bills.filter((bill) => bill.billDate >= cycleStart && bill.billDate <= cycleEndDate).map((bill) => <View key={bill.id} style={[styles.billRow, { borderBottomColor: colors.border }]}><Text style={{ color: colors.textSecondary }}>{formatFarmDate(bill.billDate)} ·</Text>{isImageFile(bill.fileName) ? <Pressable accessibilityLabel={`Open ${bill.fileName}`} onPress={() => void openBill(bill.storagePath)}>{billImageUrls[bill.id] ? <Image source={{ uri: billImageUrls[bill.id] }} style={styles.billThumbnail} /> : <View style={[styles.billThumbnail, styles.thumbnailPlaceholder, { backgroundColor: colors.backgroundSelected }]}><Text style={{ color: colors.textSecondary }}>Image</Text></View>}</Pressable> : <Pressable onPress={() => void openBill(bill.storagePath)} style={styles.billDocument}><Text numberOfLines={1} style={{ color: colors.primary }}>{bill.fileName}</Text></Pressable>}<Pressable onPress={() => Alert.alert('Delete bill?', bill.fileName, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void removeBill(bill) }])}><Text style={{ color: colors.danger }}>Delete</Text></Pressable></View>) : <EmptyState>No bills attached to this 10-day period.</EmptyState>}</SectionCard>
    <SectionCard title="Payments">{account?.payments.length ? account.payments.map((row) => <Text key={row.id} style={{ color: colors.text }}>{formatFarmDate(row.paymentDate)} · {formatMoney(row.amountPaise)} · {row.mode}</Text>) : <EmptyState>No payments yet.</EmptyState>}</SectionCard>
  </AppScreen>;
}

function buildBuyerCycleCsv(buyerName: string, cycleStart: string, cycleEnd: string, sales: [string, { morningMl: number; eveningMl: number }][]) {
  const header = ['buyer', 'shift_start', 'shift_end', 'date', 'morning_litres', 'evening_litres', 'total_litres'];
  const rows = sales.slice().reverse().map(([date, volumes]) => [buyerName, cycleStart, cycleEnd, date, volumes.morningMl / 1_000, volumes.eveningMl / 1_000, (volumes.morningMl + volumes.eveningMl) / 1_000]);
  const totals = sales.reduce((total, [, volumes]) => ({ morningMl: total.morningMl + volumes.morningMl, eveningMl: total.eveningMl + volumes.eveningMl }), { morningMl: 0, eveningMl: 0 });
  rows.push([buyerName, cycleStart, cycleEnd, 'Total', totals.morningMl / 1_000, totals.eveningMl / 1_000, (totals.morningMl + totals.eveningMl) / 1_000]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value: string | number) { const text = String(value); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function safeFileName(value: string) { return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-') || 'buyer'; }

const styles = StyleSheet.create({
  billRow: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 10, paddingVertical: 8 },
  billThumbnail: { borderRadius: 7, height: 54, width: 54 },
  thumbnailPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  billDocument: { flex: 1 },
});
