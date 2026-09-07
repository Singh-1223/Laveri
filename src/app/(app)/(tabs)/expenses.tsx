import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { DateField } from '@/components/date-field';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { createItem, listMasterData } from '@/data/repositories/master-data';
import type { AnimalRow, ItemRow } from '@/data/repositories/master-data.types';
import {
  createFeedTransaction,
  createHeatEvent,
  createProductTransaction,
  createTreatment,
  listRecentOperations,
  updateFeedTransaction,
  updateHeatEvent,
  updateProductTransaction,
  updateTreatment,
  voidOperation,
} from '@/data/repositories/operations';
import type { OperationHistoryRow, OperationKind } from '@/data/repositories/operations.types';
import { formatMoney } from '@/domain/calculations';
import { formatFarmDate } from '@/domain/dates';
import { useSession } from '@/features/auth/session-provider';

function todayAtFarm() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function parseDecimal(value: string, scale: number) {
  const normalized = value.trim();
  if (!/^\d+(\.\d{0,3})?$/.test(normalized)) return Number.NaN;
  return Math.round(Number(normalized) * scale);
}

type HistoryFilter = 'all' | OperationKind;

export default function ExpensesScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { session } = useSession();
  const [kind, setKind] = useState<OperationKind>('feed');
  const [farmId, setFarmId] = useState<string | null>(null);
  const [animals, setAnimals] = useState<AnimalRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [history, setHistory] = useState<OperationHistoryRow[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('feed');
  const [historySearch, setHistorySearch] = useState('');
  const [businessDate, setBusinessDate] = useState(todayAtFarm);
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  const [selectedTreatmentAnimalIds, setSelectedTreatmentAnimalIds] = useState<string[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [doctorFee, setDoctorFee] = useState('');
  const [medicineCost, setMedicineCost] = useState('');
  const [doseQuantity, setDoseQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemUnit, setQuickItemUnit] = useState('');
  const [productCategory, setProductCategory] = useState<'operating_expense' | 'investment'>('operating_expense');
  const [editingRow, setEditingRow] = useState<OperationHistoryRow | null>(null);
  const [voidingKey, setVoidingKey] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [master, sync] = await Promise.all([listMasterData(), getPowerSyncSnapshot()]);
      setAnimals(master.animals.filter((animal) => animal.status === 'active'));
      setItems(master.items.filter((item) => item.active === 1));
      setFarmId(sync.farmId);
      setHistory(sync.farmId ? await listRecentOperations(sync.farmId) : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load farm operations.');
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

  const neededItemType = kind === 'feed' ? 'feed' : kind === 'treatment' ? 'medicine' : 'product';
  const availableItems = useMemo(() => items.filter((item) => item.type === neededItemType), [items, neededItemType]);
  const selectedAnimal = selectedAnimalId === null ? animals[0] ?? null : animals.find((animal) => animal.id === selectedAnimalId) ?? null;
  const selectedItem = selectedItemId === null ? availableItems[0] ?? null : availableItems.find((item) => item.id === selectedItemId) ?? null;
  const quantityMilli = parseDecimal(quantity, 1_000);
  const ratePaise = parseDecimal(rate, 100);
  const doctorFeePaise = doctorFee.trim() ? parseDecimal(doctorFee, 100) : 0;
  const medicineCostPaise = medicineCost.trim() ? parseDecimal(medicineCost, 100) : 0;
  const doseMilliUnits = doseQuantity.trim() ? parseDecimal(doseQuantity, 1_000) : null;
  const visibleHistory = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase();
    return history.filter((row) => {
      if (historyFilter !== 'all' && row.kind !== historyFilter) return false;
      if (!query) return true;
      return [row.businessDate, row.title, row.detail, row.voidReason]
        .some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [history, historyFilter, historySearch]);
  const heatSuggestions = useMemo(() => [...new Set(
    history
      .filter((row) => row.kind === 'heat' && row.isVoided !== 1 && row.notes?.trim())
      .map((row) => row.notes!.trim()),
  )].slice(0, 8), [history]);

  const clearForm = () => {
    setSelectedAnimalId(null);
    setSelectedTreatmentAnimalIds([]);
    setSelectedItemId(null);
    setQuantity('');
    setRate('');
    setDoctorFee('');
    setMedicineCost('');
    setDoseQuantity('');
    setNotes('');
    setQuickItemName('');
    setQuickItemUnit('');
    setProductCategory('operating_expense');
    setEditingRow(null);
  };

  const selectOperationItem = (id: string) => {
    const item = availableItems.find((candidate) => candidate.id === id);
    setSelectedItemId(id);
    if (item?.default_rate_paise_per_unit !== null && item?.default_rate_paise_per_unit !== undefined) setRate(String(item.default_rate_paise_per_unit / 100));
  };

  const startEdit = (row: OperationHistoryRow) => {
    setKind(row.kind);
    setHistoryFilter(row.kind);
    setBusinessDate(row.businessDate);
    setSelectedAnimalId(row.animalId);
    setSelectedItemId(row.itemId);
    setQuantity(row.quantityMilliUnits === null ? '' : String(row.quantityMilliUnits / 1_000));
    setRate(row.ratePaisePerUnit === null ? '' : String(row.ratePaisePerUnit / 100));
    setDoctorFee(row.doctorFeePaise === null ? '' : String(row.doctorFeePaise / 100));
    setMedicineCost(row.medicineCostPaise === null ? '' : String(row.medicineCostPaise / 100));
    setNotes(row.notes ?? '');
    setProductCategory(row.productCategory === 'investment' ? 'investment' : 'operating_expense');
    setEditingRow(row);
    setVoidingKey(null);
    setVoidReason('');
    setMessage(`Editing ${kindLabel(row.kind).toLowerCase()} from ${formatFarmDate(row.businessDate)}. Use the form above.`);
  };

  const save = async () => {
    if (!farmId || !session) return;
    setBusy(true);
    setMessage(null);
    try {
      const context = { farmId, userId: session.user.id, businessDate, notes };
      if (kind === 'feed') {
        if (!selectedItem || !Number.isSafeInteger(quantityMilli) || !Number.isSafeInteger(ratePaise)) throw new Error('Select a feed item, then enter quantity and rate.');
        const input = { ...context, animalId: null, animalCategory: null, itemId: selectedItem.id, quantityMilliUnits: quantityMilli, unitCode: selectedItem.base_unit, ratePaisePerUnit: ratePaise };
        if (editingRow) await updateFeedTransaction({ ...input, id: editingRow.id });
        else await createFeedTransaction(input);
      } else if (kind === 'treatment') {
        if (selectedTreatmentAnimalIds.length === 0 || !Number.isSafeInteger(doctorFeePaise) || !Number.isSafeInteger(medicineCostPaise) || (doseMilliUnits !== null && !Number.isSafeInteger(doseMilliUnits))) throw new Error('Select at least one animal and enter valid treatment values.');
        if (editingRow) await updateTreatment({ ...context, id: editingRow.id, animalId: selectedTreatmentAnimalIds[0], medicineItemId: selectedItem?.id ?? null, doctorFeePaise, medicineCostPaise });
        else await createTreatment({ ...context, animalIds: selectedTreatmentAnimalIds, medicineItemId: selectedItem?.id ?? null, doseMilliUnits, doseUnit: doseMilliUnits === null ? null : selectedItem?.base_unit ?? 'unit', doctorFeePaise, medicineCostPaise });
      } else if (kind === 'product' || kind === 'silage' || kind === 'investment') {
        if (!selectedItem || !Number.isSafeInteger(quantityMilli) || !Number.isSafeInteger(ratePaise)) throw new Error('Select a product, then enter quantity and rate.');
        const input = { ...context, animalId: null, animalCategory: null, itemId: selectedItem.id, category: kind === 'investment' ? 'investment' as const : kind === 'silage' ? 'silage' as const : productCategory, quantityMilliUnits: quantityMilli, unitCode: selectedItem.base_unit, ratePaisePerUnit: ratePaise };
        if (editingRow) await updateProductTransaction({ ...input, id: editingRow.id });
        else await createProductTransaction(input);
      } else {
        if (!selectedAnimal) throw new Error('Select the animal observed in heat.');
        const input = { ...context, animalId: selectedAnimal.id, signs: notes };
        if (editingRow) await updateHeatEvent({ ...input, id: editingRow.id });
        else await createHeatEvent(input);
      }

      const wasEditing = editingRow !== null;
      clearForm();
      await refresh();
      setMessage(`${kindLabel(kind)} ${wasEditing ? 'updated' : 'saved'} locally.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save the operation.');
    } finally {
      setBusy(false);
    }
  };

  const createQuickItem = async () => {
    if (!farmId || !session || (kind !== 'feed' && kind !== 'product' && kind !== 'silage' && kind !== 'investment' && kind !== 'treatment') || !quickItemName.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const itemId = await createItem({
        farmId,
        userId: session.user.id,
        type: kind === 'treatment' ? 'medicine' : kind === 'investment' || kind === 'silage' ? 'product' : kind,
        name: quickItemName,
        baseUnit: quickItemUnit.trim() || (kind === 'feed' ? 'kg' : kind === 'treatment' ? 'ml' : 'unit'),
      });
      setSelectedItemId(itemId);
      setQuickItemName('');
      setQuickItemUnit('');
      await refresh();
      setMessage(`${kindLabel(kind)} item added and selected locally.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add the item.');
    } finally {
      setBusy(false);
    }
  };

  const confirmVoid = async (row: OperationHistoryRow) => {
    if (!farmId || !session || !voidReason.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      await voidOperation({
        farmId,
        userId: session.user.id,
        id: row.id,
        kind: row.kind,
        reason: voidReason,
      });
      setVoidingKey(null);
      setVoidReason('');
      await refresh();
      setMessage(`${kindLabel(row.kind)} voided locally. It will no longer count in reports.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to void this operation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen title="Farm operations" subtitle="Farm-wide feed, products, health, and heat records">
      <View style={styles.tabs}>
        {(['feed', 'product', 'treatment', 'heat', 'investment', 'silage'] as const).map((value) => (
          <Pressable key={value} onPress={() => { setKind(value); setHistoryFilter(value); clearForm(); }} style={[styles.tab, { backgroundColor: kind === value ? colors.primary : colors.backgroundSelected }]}>
            <Text style={{ color: kind === value ? '#FFFFFF' : colors.text, fontWeight: '700' }}>{kindLabel(value)}</Text>
          </Pressable>
        ))}
      </View>

      <SectionCard title={`${editingRow ? 'Edit' : 'Add'} ${kindLabel(kind).toLowerCase()}`}>
        <DateField label="Operation date" onChange={setBusinessDate} value={businessDate} />

        {kind === 'heat' ? <ChoiceList label="Animal" rows={animals} selectedId={selectedAnimal?.id ?? null} onSelect={setSelectedAnimalId} /> : null}
        {kind === 'treatment' ? <View style={styles.choiceBlock}><Text style={[styles.choiceLabel, { color: colors.textSecondary }]}>Animals treated</Text><Pressable onPress={() => setSelectedTreatmentAnimalIds(animals.map((animal) => animal.id))} style={[styles.quickItemButton, { borderColor: colors.primary }]}><Text style={[styles.voidButtonText, { color: colors.primary }]}>Select all</Text></Pressable><View style={styles.choices}>{animals.map((animal) => <Pressable key={animal.id} onPress={() => setSelectedTreatmentAnimalIds((current) => current.includes(animal.id) ? current.filter((id) => id !== animal.id) : [...current, animal.id])} style={[styles.choice, { backgroundColor: selectedTreatmentAnimalIds.includes(animal.id) ? colors.primary : colors.backgroundSelected }]}><Text style={{ color: selectedTreatmentAnimalIds.includes(animal.id) ? '#FFFFFF' : colors.text, fontWeight: '600' }}>{animal.tag}</Text></Pressable>)}</View></View> : null}
        {kind !== 'heat' ? <ChoiceList label={`${neededItemType} suggestions`} rows={availableItems} selectedId={selectedItem?.id ?? null} onSelect={selectOperationItem} /> : null}
        {kind === 'feed' || kind === 'product' || kind === 'silage' || kind === 'investment' || kind === 'treatment' ? <View style={[styles.quickItem, { borderTopColor: colors.border }]}>
          <Text style={[styles.choiceLabel, { color: colors.textSecondary }]}>New {kindLabel(kind).toLowerCase()} item</Text>
          <View style={styles.numericRow}>
            <TextInput accessibilityLabel={`New ${kind} item name`} onChangeText={setQuickItemName} placeholder="Item name" placeholderTextColor={colors.textSecondary} style={[styles.numericInput, { color: colors.text, borderColor: colors.border }]} value={quickItemName} />
            <TextInput accessibilityLabel={`New ${kind} unit`} onChangeText={setQuickItemUnit} placeholder={kind === 'feed' ? 'Unit (kg)' : 'Unit'} placeholderTextColor={colors.textSecondary} style={[styles.numericInput, { color: colors.text, borderColor: colors.border }]} value={quickItemUnit} />
          </View>
          <Pressable disabled={busy || !quickItemName.trim()} onPress={() => void createQuickItem()} style={[styles.quickItemButton, { borderColor: colors.primary }, (busy || !quickItemName.trim()) && styles.disabled]}><Text style={[styles.voidButtonText, { color: colors.primary }]}>Add item</Text></Pressable>
        </View> : null}

        {kind === 'feed' || kind === 'product' || kind === 'silage' || kind === 'investment' ? (
          <View style={styles.numericRow}>
            <TextInput accessibilityLabel="Units" keyboardType="decimal-pad" onChangeText={setQuantity} placeholder={`Units (${selectedItem?.base_unit ?? 'package'})`} placeholderTextColor={colors.textSecondary} style={[styles.numericInput, { color: colors.text, borderColor: colors.border }]} value={quantity} />
            <TextInput accessibilityLabel="Rate" keyboardType="decimal-pad" onChangeText={setRate} placeholder="Rate ₹" placeholderTextColor={colors.textSecondary} style={[styles.numericInput, { color: colors.text, borderColor: colors.border }]} value={rate} />
          </View>
        ) : null}

        {kind === 'treatment' ? (
          <View style={styles.numericRow}>
            <TextInput accessibilityLabel="Medicine quantity" keyboardType="decimal-pad" onChangeText={setDoseQuantity} placeholder={`Quantity (${selectedItem?.base_unit ?? 'unit'})`} placeholderTextColor={colors.textSecondary} style={[styles.numericInput, { color: colors.text, borderColor: colors.border }]} value={doseQuantity} />
            <TextInput accessibilityLabel="Doctor fee" keyboardType="decimal-pad" onChangeText={setDoctorFee} placeholder="Doctor fee ₹" placeholderTextColor={colors.textSecondary} style={[styles.numericInput, { color: colors.text, borderColor: colors.border }]} value={doctorFee} />
            <TextInput accessibilityLabel="Medicine cost" keyboardType="decimal-pad" onChangeText={setMedicineCost} placeholder="Medicine ₹" placeholderTextColor={colors.textSecondary} style={[styles.numericInput, { color: colors.text, borderColor: colors.border }]} value={medicineCost} />
          </View>
        ) : null}

        {kind !== 'feed' ? <TextInput accessibilityLabel="Notes" multiline onChangeText={setNotes} placeholder={kind === 'heat' ? 'Observed signs or note' : 'Comment (optional)'} placeholderTextColor={colors.textSecondary} style={[styles.notes, { color: colors.text, borderColor: colors.border }]} value={notes} /> : null}
        {kind === 'heat' && heatSuggestions.length > 0 ? <View style={styles.choiceBlock}>
          <Text style={[styles.choiceLabel, { color: colors.textSecondary }]}>Previously observed signs</Text>
          <View style={styles.choices}>{heatSuggestions.map((suggestion) => <Pressable key={suggestion} onPress={() => setNotes(suggestion)} style={[styles.choice, { backgroundColor: notes === suggestion ? colors.primary : colors.backgroundSelected }]}><Text style={{ color: notes === suggestion ? '#FFFFFF' : colors.text, fontWeight: '600' }}>{suggestion}</Text></Pressable>)}</View>
        </View> : null}
        <Pressable disabled={busy || loading || !farmId} onPress={save} style={({ pressed }) => [styles.save, { backgroundColor: colors.primary }, (busy || loading || !farmId) && styles.disabled, pressed && styles.pressed]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>{editingRow ? 'Update' : 'Save'} {kindLabel(kind).toLowerCase()}</Text>}</Pressable>
        {editingRow ? <Pressable disabled={busy} onPress={clearForm} style={[styles.cancelEdit, { borderColor: colors.border }]}><Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel editing</Text></Pressable> : null}
      </SectionCard>

      {message ? <Text style={[styles.message, { color: message.includes('saved') || message.includes('updated') || message.includes('voided') || message.includes('Editing') ? colors.primary : colors.danger }]}>{message}</Text> : null}

      <SectionCard title={`Recent activity (${visibleHistory.length})`}>
        <TextInput accessibilityLabel="Search operation history" onChangeText={setHistorySearch} placeholder="Search date, animal, item, or void reason" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={historySearch} />
        <View style={styles.historyFilters}>
          {(['all', 'feed', 'treatment', 'product', 'silage', 'investment', 'heat'] as const).map((value) => (
            <Pressable key={value} onPress={() => setHistoryFilter(value)} style={[styles.historyFilter, { backgroundColor: historyFilter === value ? colors.primary : colors.backgroundSelected }]}>
              <Text style={{ color: historyFilter === value ? '#FFFFFF' : colors.text, fontSize: 12, fontWeight: '700' }}>{value === 'all' ? 'All' : kindLabel(value)}</Text>
            </Pressable>
          ))}
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : history.length === 0 ? <EmptyState>No farm operations recorded yet.</EmptyState> : visibleHistory.length === 0 ? <EmptyState>No records match this history filter.</EmptyState> : visibleHistory.map((row) => {
          const rowKey = `${row.kind}-${row.id}`;
          return (
            <View key={rowKey} style={[styles.historyRecord, { borderTopColor: colors.border }, row.isVoided === 1 && styles.voidedRecord]}>
              <View style={styles.historyRow}>
                <View style={styles.historyCopy}>
                  <Text style={[styles.historyTitle, { color: colors.text }]}>{row.title}</Text>
                  <Text style={[styles.historyDetail, { color: colors.textSecondary }]}>{formatFarmDate(row.businessDate)} • {kindLabel(row.kind)}{row.detail ? ` • ${row.detail}` : ''}</Text>
                  {row.notes ? <Text style={[styles.historyDetail, { color: colors.textSecondary }]}>Comment: {row.notes}</Text> : null}
                  {row.isVoided === 1 ? <Text style={[styles.voidReason, { color: colors.danger }]}>Voided: {row.voidReason}</Text> : null}
                </View>
                {row.amountPaise > 0 ? <Text style={[styles.amount, { color: colors.text }]}>{formatMoney(row.amountPaise)}</Text> : null}
              </View>
              {row.isVoided !== 1 && voidingKey !== rowKey ? (
                <View style={styles.historyActions}>
                  <Pressable disabled={busy} onPress={() => startEdit(row)} style={[styles.historyButton, { borderColor: colors.primary }]}><Text style={[styles.voidButtonText, { color: colors.primary }]}>Edit</Text></Pressable>
                  <Pressable disabled={busy} onPress={() => { setVoidingKey(rowKey); setVoidReason(''); }} style={[styles.historyButton, { borderColor: colors.danger }]}><Text style={[styles.voidButtonText, { color: colors.danger }]}>Void record</Text></Pressable>
                </View>
              ) : null}
              {voidingKey === rowKey ? (
                <View style={styles.voidEditor}>
                  <TextInput accessibilityLabel="Void reason" multiline onChangeText={setVoidReason} placeholder="Reason for correction (required)" placeholderTextColor={colors.textSecondary} style={[styles.notes, { color: colors.text, borderColor: colors.danger }]} value={voidReason} />
                  <View style={styles.voidActions}>
                    <Pressable disabled={busy} onPress={() => { setVoidingKey(null); setVoidReason(''); }} style={[styles.voidAction, { borderColor: colors.border }]}><Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text></Pressable>
                    <Pressable disabled={busy || !voidReason.trim()} onPress={() => void confirmVoid(row)} style={[styles.voidAction, { backgroundColor: colors.danger }, (busy || !voidReason.trim()) && styles.disabled]}><Text style={styles.saveText}>Confirm void</Text></Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </SectionCard>
    </AppScreen>
  );
}

function ChoiceList({ label, rows, selectedId, onSelect }: { label: string; rows: (AnimalRow | ItemRow)[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return (
    <View style={styles.choiceBlock}>
      <Text style={[styles.choiceLabel, { color: colors.textSecondary }]}>{label.charAt(0).toUpperCase() + label.slice(1)}</Text>
      {rows.length === 0 ? <Text style={[styles.message, { color: colors.danger }]}>Add this master data first.</Text> : <View style={styles.choices}>{rows.map((row) => {
        const name = 'tag' in row ? row.tag : row.name;
        return <Pressable key={row.id} onPress={() => onSelect(row.id)} style={[styles.choice, { backgroundColor: selectedId === row.id ? colors.primary : colors.backgroundSelected }]}><Text style={{ color: selectedId === row.id ? '#FFFFFF' : colors.text, fontWeight: '600' }}>{name}</Text></Pressable>;
      })}</View>}
    </View>
  );
}

function kindLabel(kind: OperationKind) {
  if (kind === 'treatment') return 'Treatment';
  if (kind === 'product') return 'Product';
  if (kind === 'silage') return 'Silage';
  if (kind === 'investment') return 'Investment';
  if (kind === 'heat') return 'Heat event';
  return 'Feed';
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { minHeight: 42, borderRadius: 21, justifyContent: 'center', paddingHorizontal: 14 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  choiceBlock: { gap: 7 },
  choiceLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 40, borderRadius: 20, justifyContent: 'center', paddingHorizontal: 13 },
  numericRow: { flexDirection: 'row', gap: 10 },
  numericInput: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 15 },
  quickItem: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  quickItemButton: { minHeight: 40, borderWidth: 1, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
  category: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  notes: { minHeight: 74, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top', fontSize: 15 },
  save: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelEdit: { minHeight: 44, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  message: { fontSize: 13, lineHeight: 19 },
  historyRecord: { gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  historyFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  historyFilter: { minHeight: 34, borderRadius: 17, justifyContent: 'center', paddingHorizontal: 11 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyCopy: { flex: 1, gap: 3 },
  historyTitle: { fontSize: 15, fontWeight: '700' },
  historyDetail: { fontSize: 12, lineHeight: 17, textTransform: 'capitalize' },
  amount: { fontSize: 14, fontWeight: '800' },
  voidedRecord: { opacity: 0.68 },
  voidReason: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  historyActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyButton: { minHeight: 36, borderWidth: 1, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 12 },
  voidButtonText: { fontSize: 13, fontWeight: '700' },
  voidEditor: { gap: 10 },
  voidActions: { flexDirection: 'row', gap: 10 },
  voidAction: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
