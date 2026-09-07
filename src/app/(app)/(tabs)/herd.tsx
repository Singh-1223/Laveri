import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { Colors } from '@/constants/theme';
import { listMasterData, saveAnimalLabelOrder } from '@/data/repositories/master-data';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { requireSupabase } from '@/data/supabase/client';
import type { AnimalLabelLinkRow, AnimalLabelRow, AnimalRow } from '@/data/repositories/master-data.types';
import { useSession } from '@/features/auth/session-provider';

export default function HerdScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { session } = useSession();
  const [animals, setAnimals] = useState<AnimalRow[]>([]);
  const [labels, setLabels] = useState<AnimalLabelRow[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [labelLinks, setLabelLinks] = useState<AnimalLabelLinkRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedLabelId, setSelectedLabelId] = useState('all');
  const [farmId, setFarmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sync = await getPowerSyncSnapshot();
      setFarmId(sync.farmId);
      const master = await listMasterData();
      setAnimals(master.animals);
      setLabels(master.animalLabels);
      setLabelLinks(master.animalLabelLinks);
      const signed = await Promise.all(master.animals.filter((animal) => animal.primary_photo_path).map(async (animal) => { const url = await requireSupabase().storage.from('animal-files').createSignedUrl(animal.primary_photo_path!, 600); return [animal.id, url.data?.signedUrl] as const; }));
      setPhotoUrls(Object.fromEntries(signed.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load the herd.');
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

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return animals.filter((animal) => {
      const matchesSearch = !query || animal.tag.toLocaleLowerCase().includes(query) || animal.breed?.toLocaleLowerCase().includes(query);
      const matchesLabel = selectedLabelId === 'all' || labelLinks.some((link) => link.animal_id === animal.id && link.label_id === selectedLabelId);
      return matchesSearch && matchesLabel;
    });
  }, [animals, labelLinks, search, selectedLabelId]);

  const persistLabelOrder = async (nextLabels: AnimalLabelRow[]) => {
    setLabels(nextLabels);
    if (!farmId || !session) return;
    try {
      await saveAnimalLabelOrder({ farmId, userId: session.user.id, labelIds: nextLabels.map((label) => label.id) });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save label order.');
      void refresh();
    }
  };

  return (
    <AppScreen title="Herd" subtitle={`${animals.filter((animal) => animal.status === 'active').length} active animals`}>
      <TextInput accessibilityLabel="Search herd" onChangeText={setSearch} placeholder="Search tag or breed" placeholderTextColor={colors.textSecondary} style={[styles.search, { color: colors.text, borderColor: colors.border }]} value={search} />
      <View style={styles.filterBlock}>
        <Text style={[styles.filterHint, { color: colors.textSecondary }]}>Filter by label. Press and hold a label to change its tab order.</Text>
        <View style={styles.allTabRow}><Pressable onPress={() => setSelectedLabelId('all')} style={[styles.filterTab, { borderColor: colors.primary }, selectedLabelId === 'all' && { backgroundColor: colors.primary }]}><Text style={[styles.filterTabText, { color: selectedLabelId === 'all' ? '#FFFFFF' : colors.primary }]}>All</Text></Pressable></View>
        <DraggableFlatList horizontal data={labels} keyExtractor={(label) => label.id} onDragEnd={({ data }) => void persistLabelOrder(data)} contentContainerStyle={styles.filterList} renderItem={({ item: label, drag, isActive }) => <ScaleDecorator><Pressable delayLongPress={180} onLongPress={drag} onPress={() => setSelectedLabelId(label.id)} style={[styles.filterTab, { borderColor: label.color }, selectedLabelId === label.id && { backgroundColor: label.color }, isActive && styles.dragging]}><Text style={[styles.filterTabText, { color: selectedLabelId === label.id ? '#FFFFFF' : colors.text }]}>{label.name}</Text></Pressable></ScaleDecorator>} />
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <SectionCard title={`Animals (${visible.length})`}>
        {loading ? <ActivityIndicator color={colors.primary} /> : visible.length === 0 ? <EmptyState>No animals match this filter.</EmptyState> : visible.map((animal) => (
          <View key={animal.id} style={[styles.row, { borderTopColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.backgroundSelected }]}>{photoUrls[animal.id] ? <Image source={{ uri: photoUrls[animal.id] }} style={styles.photo} /> : <Text style={styles.avatarText}>🐄</Text>}</View>
            <View style={styles.rowCopy}>
              <Link href={{ pathname: '/animal-profile/[id]', params: { id: animal.id } }}><Text style={[styles.name, { color: colors.primary }]}>{animal.tag}</Text></Link>
              <Text style={[styles.detail, { color: colors.textSecondary }]}>{animal.category} • {animal.breed || 'breed not set'} • {animal.is_milking ? 'milking' : animal.status}</Text>
              <View style={styles.labels}>{labelLinks.filter((link) => link.animal_id === animal.id).map((link) => labels.find((label) => label.id === link.label_id)).filter((label): label is AnimalLabelRow => Boolean(label)).map((label) => <View key={label.id} style={[styles.labelChip, { backgroundColor: label.color }]}><Text style={styles.labelText}>{label.name}</Text></View>)}</View>
            </View>
          </View>
        ))}
      </SectionCard>

      <Link href="../master-data" asChild>
        <Pressable style={({ pressed }) => [styles.manage, { borderColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.manageText, { color: colors.primary }]}>Add or manage animals</Text></Pressable>
      </Link>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  search: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  filterBlock: { gap: 7 },
  filterHint: { fontSize: 12, lineHeight: 17 },
  allTabRow: { alignItems: 'flex-start' },
  filterList: { gap: 8, paddingRight: 18 },
  filterTab: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  filterTabText: { fontSize: 13, fontWeight: '700' },
  dragging: { opacity: 0.7 },
  error: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 23 },
  photo: { width: 46, height: 46, borderRadius: 23 },
  rowCopy: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontWeight: '800' },
  detail: { fontSize: 13, lineHeight: 18, textTransform: 'capitalize' },
  labels: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  labelChip: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  labelText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  manage: { minHeight: 48, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  manageText: { fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
