import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import {
  createAnimal,
  createBuyer,
  createItem,
  listMasterData,
  setMasterRecordActive,
  updateAnimal,
  updateBuyer,
  updateItem,
} from '@/data/repositories/master-data';
import type { ItemRow, MasterDataSnapshot } from '@/data/repositories/master-data.types';
import { useSession } from '@/features/auth/session-provider';

type MasterTab = 'animals' | 'buyers' | 'feed' | 'medicine' | 'product';

const initialSnapshot: MasterDataSnapshot = { animals: [], buyers: [], items: [] };

export default function MasterDataScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { session } = useSession();
  const [tab, setTab] = useState<MasterTab>('animals');
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [secondary, setSecondary] = useState('');
  const [animalCategory, setAnimalCategory] = useState<'cow' | 'heifer' | 'calf'>('cow');
  const [animalIsMilking, setAnimalIsMilking] = useState(true);
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
    setAnimalCategory('cow');
    setAnimalIsMilking(true);
    setEditingId(null);
  };

  const save = async () => {
    if (!farmId || !session || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const context = { farmId, userId: session.user.id };
      if (tab === 'animals') {
        const input = { ...context, tag: name, category: animalCategory, sex: 'female' as const, isMilking: animalIsMilking, breed: secondary };
        if (editingId) await updateAnimal({ ...input, id: editingId });
        else await createAnimal(input);
      } else if (tab === 'buyers') {
        if (editingId) await updateBuyer({ ...context, id: editingId, name, phone: secondary });
        else await createBuyer({ ...context, name, phone: secondary });
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
    if ('tag' in row) {
      setName(row.tag);
      setSecondary(row.breed ?? '');
      setAnimalCategory(row.category);
      setAnimalIsMilking(row.is_milking === 1);
    } else {
      setName(row.name);
      setSecondary('base_unit' in row ? row.base_unit : row.phone ?? '');
    }
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
        {tab === 'animals' ? (
          <View style={styles.choiceRow}>
            {(['cow', 'heifer', 'calf'] as const).map((category) => (
              <Pressable key={category} onPress={() => { setAnimalCategory(category); if (category !== 'cow') setAnimalIsMilking(false); }} style={[styles.choice, { backgroundColor: animalCategory === category ? colors.primary : colors.backgroundSelected }]}>
                <Text style={{ color: animalCategory === category ? '#FFFFFF' : colors.text }}>{tabLabel(category)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
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
        <Pressable disabled={busy || !farmId || !name.trim()} onPress={save} style={({ pressed }) => [styles.save, { backgroundColor: colors.primary }, (busy || !farmId || !name.trim()) && styles.disabled, pressed && styles.pressed]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>{editingId ? 'Update' : 'Save'} {singularLabel(tab)}</Text>}
        </Pressable>
        {editingId ? <Pressable disabled={busy} onPress={resetForm} style={[styles.cancel, { borderColor: colors.border }]}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel editing</Text></Pressable> : null}
      </SectionCard>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <SectionCard title={`${tabLabel(tab)} (${rows.length})`}>
        {loading ? <ActivityIndicator color={colors.primary} /> : rows.length === 0 ? <EmptyState>No {tabLabel(tab).toLowerCase()} added yet.</EmptyState> : rows.map((row) => (
          <MasterRow key={row.id} row={row} busy={busy} onEdit={() => startEdit(row)} onToggle={() => void toggleActive(row)} />
        ))}
      </SectionCard>
    </AppScreen>
  );
}

function MasterRow({ row, busy, onEdit, onToggle }: { row: MasterDataSnapshot['animals'][number] | MasterDataSnapshot['buyers'][number] | ItemRow; busy: boolean; onEdit: () => void; onToggle: () => void }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const name = 'tag' in row ? row.tag : row.name;
  const active = 'tag' in row ? row.status === 'active' : row.active === 1;
  const detail = 'category' in row ? `${row.category} • ${row.is_milking ? 'milking' : 'not milking'} • ${row.status}` : 'base_unit' in row ? `${row.type} • ${row.base_unit} • ${active ? 'active' : 'inactive'}` : `${row.phone || 'No phone'} • ${active ? 'active' : 'inactive'}`;
  return (
    <View style={[styles.row, { borderTopColor: colors.border }]}>
      <Text style={[styles.rowName, { color: colors.text }]}>{name}</Text>
      <Text style={[styles.rowDetail, { color: colors.textSecondary }]}>{detail}</Text>
      <View style={styles.rowActions}>
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

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { minHeight: 40, borderWidth: 1, borderRadius: 20, justifyContent: 'center', paddingHorizontal: 14 },
  tabText: { fontSize: 13, fontWeight: '700' },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { minHeight: 40, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 14 },
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
