import { Link } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import {
  createAnimal,
  createAnimalLabel,
  deleteAnimalLabel,
  createBuyer,
  createItem,
  listMasterData,
  reorderMasterRecord,
  setMasterRecordActive,
  setAnimalLabels,
  updateAnimal,
  updateAnimalLabel,
  updateBuyer,
  updateItem,
} from '@/data/repositories/master-data';
import type { ItemRow, MasterDataSnapshot } from '@/data/repositories/master-data.types';
import { useSession } from '@/features/auth/session-provider';

type MasterTab = 'animals' | 'buyers' | 'feed' | 'medicine' | 'product';

const initialSnapshot: MasterDataSnapshot = { animals: [], buyers: [], items: [], animalLabels: [], animalLabelLinks: [] };
const labelColors = ['#2E7D32', '#1565C0', '#6A1B9A', '#C62828', '#EF6C00', '#FFFFFF', '#1B1B1B', '#EC407A', '#FDD835', '#29B6F6', '#795548'];

function parseRupees(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return Number.NaN;
  const paise = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(paise) ? paise : Number.NaN;
}

export default function MasterDataScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { session } = useSession();
  const [tab, setTab] = useState<MasterTab>('animals');
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [secondary, setSecondary] = useState('');
  const [buyerRate, setBuyerRate] = useState('');
  const [animalIsMilking, setAnimalIsMilking] = useState(true);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(labelColors[0]);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [data, sync] = await Promise.all([listMasterData(), getPowerSyncSnapshot()]);
      setSnapshot(data);
      setFarmId(sync.farmId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load master data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timeout);
  }, [refresh]);

  const visibleItems = useMemo(
    () => snapshot.items.filter((item) => item.type === tab),
    [snapshot.items, tab],
  );

  const resetForm = () => {
    setName('');
    setSecondary('');
    setBuyerRate('');
    setAnimalIsMilking(true);
    setSelectedLabelIds([]);
    setNewLabelName('');
    setNewLabelColor(labelColors[0]);
    setEditingLabelId(null);
    setEditingId(null);
  };

  const save = async () => {
    if (!farmId || !session || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const context = { farmId, userId: session.user.id };
      if (tab === 'animals') {
        const input = { ...context, tag: name, category: 'cow' as const, sex: 'female' as const, isMilking: animalIsMilking, breed: secondary };
        const animalId = editingId ?? await createAnimal(input);
        if (editingId) await updateAnimal({ ...input, id: editingId });
        await setAnimalLabels({ ...context, animalId, labelIds: selectedLabelIds });
      } else if (tab === 'buyers') {
        const defaultRatePaisePerLitre = parseRupees(buyerRate);
        if (Number.isNaN(defaultRatePaisePerLitre)) throw new Error('Use a valid buyer rate with up to two decimal places.');
        if (editingId) await updateBuyer({ ...context, id: editingId, name, phone: secondary, defaultRatePaisePerLitre });
        else await createBuyer({ ...context, name, phone: secondary, defaultRatePaisePerLitre });
      } else {
        const input = { ...context, type: tab, name, baseUnit: secondary || defaultUnit(tab) };
        if (editingId) await updateItem({ ...input, id: editingId });
        else await createItem(input);
      }
      resetForm();
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save master data.');
    } finally {
      setBusy(false);
    }
  };

  const rows = tab === 'animals' ? snapshot.animals : tab === 'buyers' ? snapshot.buyers : visibleItems;

  const startEdit = (row: MasterDataSnapshot['animals'][number] | MasterDataSnapshot['buyers'][number] | ItemRow) => {
    setEditingId(row.id);
    setBuyerRate('');
    if ('tag' in row) {
      setName(row.tag);
      setSecondary(row.breed ?? '');
      setAnimalIsMilking(row.is_milking === 1);
      setSelectedLabelIds(snapshot.animalLabelLinks.filter((link) => link.animal_id === row.id).map((link) => link.label_id));
    } else {
      setName(row.name);
      setSecondary('base_unit' in row ? row.base_unit : row.phone ?? '');
      if (!('base_unit' in row)) setBuyerRate(row.default_rate_paise_per_litre === null ? '' : String(row.default_rate_paise_per_litre / 100));
    }
  };

  const addCustomLabel = async () => {
    if (!farmId || !session || !newLabelName.trim()) return;
    setBusy(true);
    try {
      const labelId = editingLabelId ?? await createAnimalLabel({ farmId, userId: session.user.id, name: newLabelName, color: newLabelColor });
      if (editingLabelId) await updateAnimalLabel({ farmId, userId: session.user.id, id: editingLabelId, name: newLabelName, color: newLabelColor });
      setSelectedLabelIds((current) => [...current, labelId]);
      setNewLabelName('');
      setEditingLabelId(null);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to create the label.');
    } finally { setBusy(false); }
  };

  const removeLabel = async (id: string) => {
    if (!farmId || !session) return;
    setBusy(true);
    try { await deleteAnimalLabel({ farmId, userId: session.user.id, id }); setSelectedLabelIds((current) => current.filter((value) => value !== id)); if (editingLabelId === id) { setEditingLabelId(null); setNewLabelName(''); } await refresh(); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to delete the label.'); }
    finally { setBusy(false); }
  };

  const toggleActive = async (row: MasterDataSnapshot['animals'][number] | MasterDataSnapshot['buyers'][number] | ItemRow) => {
    if (!farmId || !session) return;
    const active = 'tag' in row ? row.status === 'active' : row.active === 1;
    const kind = 'tag' in row ? 'animal' : 'base_unit' in row ? 'item' : 'buyer';
    setBusy(true);
    setError(null);
    try {
      await setMasterRecordActive({ farmId, userId: session.user.id, id: row.id, kind, active: !active });
      if (editingId === row.id) resetForm();
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to change this record.');
    } finally {
      setBusy(false);
    }
  };

  const reorder = async (row: MasterDataSnapshot['animals'][number] | MasterDataSnapshot['buyers'][number], direction: 'up' | 'down') => {
    if (!farmId || !session) return;
    setBusy(true);
    setError(null);
    try {
      await reorderMasterRecord({ farmId, userId: session.user.id, id: row.id, kind: 'tag' in row ? 'animal' : 'buyer', direction });
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to change the display order.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen title="Master data" subtitle="Saved locally first and synchronized when online">
      <View style={styles.tabs}>
        {(['animals', 'buyers', 'feed', 'medicine', 'product'] as const).map((value) => (
          <Pressable key={value} onPress={() => { setTab(value); resetForm(); }} style={[styles.tab, { borderColor: tab === value ? colors.primary : colors.border, backgroundColor: tab === value ? colors.backgroundSelected : colors.backgroundElement }]}>
            <Text style={[styles.tabText, { color: tab === value ? colors.primary : colors.textSecondary }]}>{tabLabel(value)}</Text>
          </Pressable>
        ))}
      </View>

      <SectionCard title={`${editingId ? 'Edit' : 'Add'} ${singularLabel(tab)}`}>
        {tab === 'animals' ? <View style={styles.labelBlock}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Custom labels</Text>
          <View style={styles.choiceRow}>{snapshot.animalLabels.map((label) => <Pressable key={label.id} onPress={() => setSelectedLabelIds((current) => current.includes(label.id) ? current.filter((id) => id !== label.id) : [...current, label.id])} style={[styles.choice, { backgroundColor: selectedLabelIds.includes(label.id) ? label.color : colors.backgroundSelected }]}><Text style={{ color: selectedLabelIds.includes(label.id) ? labelTextColor(label.color) : colors.text }}>{label.name}</Text></Pressable>)}</View>
          <TextInput accessibilityLabel="New custom label" onChangeText={setNewLabelName} placeholder="New label, e.g. Pregnant" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={newLabelName} />
          <View style={styles.choiceRow}>{labelColors.map((color) => <Pressable key={color} onPress={() => setNewLabelColor(color)} style={[styles.colorChoice, { backgroundColor: color, borderColor: newLabelColor === color ? colors.text : color }]} />)}</View>
          <Pressable disabled={busy || !newLabelName.trim()} onPress={() => void addCustomLabel()} style={[styles.addLabel, { borderColor: colors.primary }, (busy || !newLabelName.trim()) && styles.disabled]}><Text style={[styles.cancelText, { color: colors.primary }]}>{editingLabelId ? 'Update custom label' : 'Add custom label'}</Text></Pressable>
          {snapshot.animalLabels.map((label) => <View key={`manage-${label.id}`} style={styles.labelManageRow}><Text style={{ color: colors.text, flex: 1 }}>{label.name}</Text><Pressable onPress={() => { setEditingLabelId(label.id); setNewLabelName(label.name); setNewLabelColor(label.color); }}><Text style={{ color: colors.primary }}>Edit</Text></Pressable><Pressable onPress={() => void removeLabel(label.id)}><Text style={{ color: colors.danger }}>Delete</Text></Pressable></View>)}
        </View> : null}
        {tab === 'animals' ? (
          <View style={styles.choiceRow}>
            {[true, false].map((value) => (
              <Pressable key={String(value)} onPress={() => setAnimalIsMilking(value)} style={[styles.choice, { backgroundColor: animalIsMilking === value ? colors.primary : colors.backgroundSelected }]}>
                <Text style={{ color: animalIsMilking === value ? '#FFFFFF' : colors.text }}>{value ? 'Milking' : 'Not milking'}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <TextInput
          accessibilityLabel={`${singularLabel(tab)} name`}
          onChangeText={setName}
          placeholder={tab === 'animals' ? 'Tag or name' : `${singularLabel(tab)} name`}
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={name}
        />
        <TextInput
          accessibilityLabel={tab === 'buyers' ? 'Phone' : tab === 'animals' ? 'Breed' : 'Base unit'}
          onChangeText={setSecondary}
          placeholder={tab === 'buyers' ? 'Phone (optional)' : tab === 'animals' ? 'Breed (optional)' : `Base unit, e.g. ${defaultUnit(tab)}`}
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={secondary}
        />
        {tab === 'buyers' ? <TextInput
          accessibilityLabel="Buyer rate per litre"
          keyboardType="decimal-pad"
          onChangeText={setBuyerRate}
          placeholder="Fixed rate per litre ₹ (Verka can be left blank)"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text, borderColor: Number.isNaN(parseRupees(buyerRate)) ? colors.danger : colors.border }]}
          value={buyerRate}
        /> : null}
        <Pressable disabled={busy || !farmId || !name.trim()} onPress={save} style={({ pressed }) => [styles.save, { backgroundColor: colors.primary }, (busy || !farmId || !name.trim()) && styles.disabled, pressed && styles.pressed]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>{editingId ? 'Update' : 'Save'} {singularLabel(tab)}</Text>}
        </Pressable>
        {editingId ? <Pressable disabled={busy} onPress={resetForm} style={[styles.cancel, { borderColor: colors.border }]}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel editing</Text></Pressable> : null}
      </SectionCard>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <SectionCard title={`${tabLabel(tab)} (${rows.length})`}>
        {loading ? <ActivityIndicator color={colors.primary} /> : rows.length === 0 ? <EmptyState>No {tabLabel(tab).toLowerCase()} added yet.</EmptyState> : rows.map((row) => (
          <MasterRow key={row.id} row={row} busy={busy} onEdit={() => startEdit(row)} onToggle={() => void toggleActive(row)} onReorder={'base_unit' in row ? undefined : (direction) => void reorder(row, direction)} />
        ))}
      </SectionCard>
    </AppScreen>
  );
}

function MasterRow({ row, busy, onEdit, onToggle, onReorder }: { row: MasterDataSnapshot['animals'][number] | MasterDataSnapshot['buyers'][number] | ItemRow; busy: boolean; onEdit: () => void; onToggle: () => void; onReorder?: (direction: 'up' | 'down') => void }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const name = 'tag' in row ? row.tag : row.name;
  const active = 'tag' in row ? row.status === 'active' : row.active === 1;
  const detail = 'category' in row ? `${row.category} • ${row.is_milking ? 'milking' : 'not milking'} • ${row.status}` : 'base_unit' in row ? `${row.type} • ${row.base_unit} • ${active ? 'active' : 'inactive'}` : `${row.phone || 'No phone'} • ${row.default_rate_paise_per_litre === null ? 'Rate not set' : `₹${(row.default_rate_paise_per_litre / 100).toFixed(2)}/L`} • ${active ? 'active' : 'inactive'}`;
  return (
    <View style={[styles.row, { borderTopColor: colors.border }]}>
      {'default_rate_paise_per_litre' in row ? <Link href={row.name.trim().toLocaleLowerCase() === 'verka' ? { pathname: '/verka-billing/[buyerId]', params: { buyerId: row.id } } : { pathname: '/buyer-account/[id]', params: { id: row.id } }}><Text style={[styles.rowName, { color: colors.primary }]}>{name}</Text></Link> : <Text style={[styles.rowName, { color: colors.text }]}>{name}</Text>}
      <Text style={[styles.rowDetail, { color: colors.textSecondary }]}>{detail}</Text>
      <View style={styles.rowActions}>
        {onReorder ? <><Pressable disabled={busy} onPress={() => onReorder('up')} style={[styles.rowAction, { borderColor: colors.border }]}><Text style={[styles.rowActionText, { color: colors.textSecondary }]}>Move up</Text></Pressable><Pressable disabled={busy} onPress={() => onReorder('down')} style={[styles.rowAction, { borderColor: colors.border }]}><Text style={[styles.rowActionText, { color: colors.textSecondary }]}>Move down</Text></Pressable></> : null}
        <Pressable disabled={busy} onPress={onEdit} style={[styles.rowAction, { borderColor: colors.primary }]}><Text style={[styles.rowActionText, { color: colors.primary }]}>Edit</Text></Pressable>
        <Pressable disabled={busy} onPress={onToggle} style={[styles.rowAction, { borderColor: active ? colors.danger : colors.primary }]}><Text style={[styles.rowActionText, { color: active ? colors.danger : colors.primary }]}>{active ? 'Deactivate' : 'Reactivate'}</Text></Pressable>
      </View>
    </View>
  );
}

function defaultUnit(type: MasterTab) {
  if (type === 'medicine') return 'ml';
  if (type === 'product') return 'unit';
  return 'kg';
}

function tabLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function singularLabel(tab: MasterTab) {
  if (tab === 'animals') return 'animal';
  if (tab === 'buyers') return 'buyer';
  return tab;
}

function labelTextColor(color: string) {
  const hex = color.replace('#', '');
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1_000 > 160 ? '#1B1B1B' : '#FFFFFF';
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { minHeight: 40, borderWidth: 1, borderRadius: 20, justifyContent: 'center', paddingHorizontal: 14 },
  tabText: { fontSize: 13, fontWeight: '700' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 40, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 14 },
  labelBlock: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700' },
  colorChoice: { width: 30, height: 30, borderRadius: 15, borderWidth: 3 },
  addLabel: { minHeight: 40, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  labelManageRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  save: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cancel: { minHeight: 44, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  error: { fontSize: 14, lineHeight: 20 },
  row: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 3 },
  rowName: { fontSize: 16, fontWeight: '700' },
  rowDetail: { fontSize: 13 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  rowAction: { minHeight: 36, borderWidth: 1, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 12 },
  rowActionText: { fontSize: 13, fontWeight: '700' },
});
