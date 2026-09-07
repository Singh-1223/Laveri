import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { DateField } from '@/components/date-field';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { createBuyerPayment, loadBuyerAccount } from '@/data/repositories/buyer-account';
import type { BuyerAccountSnapshot } from '@/data/repositories/buyer-account.types';
import { formatMilk, formatMoney } from '@/domain/calculations';
import { formatFarmDate } from '@/domain/dates';
import { useSession } from '@/features/auth/session-provider';

const today = () => new Date().toISOString().slice(0, 10);
function cycleFor(value: string) { const date = new Date(`${value}T12:00:00`); const day = date.getDate(); date.setDate(day <= 10 ? 1 : day <= 20 ? 11 : 21); return date.toISOString().slice(0, 10); }
function shiftCycle(value: string, direction: -1 | 1) { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + direction * 11); return cycleFor(date.toISOString().slice(0, 10)); }
function cycleEnd(value: string) { const [year, month, day] = value.split('-').map(Number); const endDay = day === 1 ? 10 : day === 11 ? 20 : new Date(year, month, 0).getDate(); return `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`; }

export default function BuyerAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { session } = useSession(); const colors = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [account, setAccount] = useState<BuyerAccountSnapshot | null>(null); const [farmId, setFarmId] = useState<string | null>(null); const [amount, setAmount] = useState(''); const [date, setDate] = useState(today); const [mode, setMode] = useState<'cash' | 'online' | 'other'>('cash'); const [busy, setBusy] = useState(false); const [cycleStart, setCycleStart] = useState(cycleFor(today()));
  const refresh = useCallback(async () => { const sync = await getPowerSyncSnapshot(); setFarmId(sync.farmId); if (sync.farmId && id) setAccount(await loadBuyerAccount(sync.farmId, id)); }, [id]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const totals = useMemo(() => ({ sales: account?.sales.reduce((sum, row) => sum + row.amountPaise, 0) ?? 0, paid: account?.payments.reduce((sum, row) => sum + row.amountPaise, 0) ?? 0 }), [account]);
  const cycleSales = useMemo(() => { const byDate = new Map<string, { morningMl: number; eveningMl: number }>(); for (const row of account?.sales ?? []) { if (cycleFor(row.milkDate) !== cycleStart) continue; const current = byDate.get(row.milkDate) ?? { morningMl: 0, eveningMl: 0 }; if (row.session === 'morning') current.morningMl += row.volumeMl; else current.eveningMl += row.volumeMl; byDate.set(row.milkDate, current); } return [...byDate.entries()].sort(([left], [right]) => right.localeCompare(left)); }, [account?.sales, cycleStart]);
  const save = async () => { const paise = Math.round(Number(amount) * 100); if (!farmId || !session || !id || !Number.isSafeInteger(paise) || paise <= 0) return; setBusy(true); try { await createBuyerPayment({ farmId, userId: session.user.id, buyerId: id, paymentDate: date, amountPaise: paise, mode }); setAmount(''); await refresh(); } finally { setBusy(false); } };
  const cycleEndDate = cycleEnd(cycleStart);
  return <AppScreen title={account?.buyer.name ?? 'Buyer account'} subtitle="Milk sales, payments, and pending balance">
    <SectionCard title="Account summary"><Text style={{ color: colors.text }}>Rate: {account?.buyer.defaultRatePaisePerLitre === null ? 'Not set' : `${formatMoney(account?.buyer.defaultRatePaisePerLitre ?? 0)}/L`}</Text><Text style={{ color: colors.text }}>Pending: {formatMoney(totals.sales - totals.paid)}</Text></SectionCard>
    <SectionCard title="Record payment"><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount ₹" placeholderTextColor={colors.textSecondary} style={{ borderWidth: 1, borderColor: colors.border, color: colors.text, borderRadius: 10, padding: 12 }}/><DateField label="Payment date" onChange={setDate} value={date} /><View style={{ flexDirection: 'row', gap: 8 }}>{(['cash', 'online', 'other'] as const).map((value) => <Pressable key={value} onPress={() => setMode(value)} style={{ padding: 10, borderRadius: 10, backgroundColor: mode === value ? colors.primary : colors.backgroundSelected }}><Text style={{ color: mode === value ? '#fff' : colors.text }}>{value}</Text></Pressable>)}</View><Pressable disabled={busy || !amount} onPress={() => void save()} style={{ padding: 14, borderRadius: 10, backgroundColor: colors.primary }}><Text style={{ color: '#fff', textAlign: 'center' }}>{busy ? 'Saving…' : 'Add payment'}</Text></Pressable></SectionCard>
    <SectionCard title="10-day milk"><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Pressable onPress={() => setCycleStart((value) => shiftCycle(value, -1))}><Text style={{ color: colors.primary }}>‹ Previous</Text></Pressable><Text style={{ color: colors.text }}>{formatFarmDate(cycleStart)} – {formatFarmDate(cycleEndDate)}</Text><Pressable onPress={() => setCycleStart((value) => shiftCycle(value, 1))}><Text style={{ color: colors.primary }}>Next ›</Text></Pressable></View>{cycleSales.length ? cycleSales.map(([milkDate, volumes]) => <Text key={milkDate} style={{ color: colors.text }}>{formatFarmDate(milkDate)} · M - {formatMilk(volumes.morningMl)} | E - {formatMilk(volumes.eveningMl)}</Text>) : <EmptyState>No milk sales in this period.</EmptyState>}</SectionCard>
    <SectionCard title="Payments">{account?.payments.length ? account.payments.map((row) => <Text key={row.id} style={{ color: colors.text }}>{formatFarmDate(row.paymentDate)} · {formatMoney(row.amountPaise)} · {row.mode}</Text>) : <EmptyState>No payments yet.</EmptyState>}</SectionCard>
  </AppScreen>;
}
