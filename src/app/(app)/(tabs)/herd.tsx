import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { Colors } from '@/constants/theme';
import { listMasterData } from '@/data/repositories/master-data';
import type { AnimalRow } from '@/data/repositories/master-data.types';

export default function HerdScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [animals, setAnimals] = useState<AnimalRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAnimals((await listMasterData()).animals);
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
    return animals.filter((animal) => !query || animal.tag.toLocaleLowerCase().includes(query) || animal.breed?.toLocaleLowerCase().includes(query));
  }, [animals, search]);

  return (
    <AppScreen title="Herd" subtitle={`${animals.filter((animal) => animal.status === 'active').length} active animals`}>
      <TextInput accessibilityLabel="Search herd" onChangeText={setSearch} placeholder="Search tag or breed" placeholderTextColor={colors.textSecondary} style={[styles.search, { color: colors.text, borderColor: colors.border }]} value={search} />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <SectionCard title={`Animals (${visible.length})`}>
        {loading ? <ActivityIndicator color={colors.primary} /> : visible.length === 0 ? <EmptyState>No animals match this filter.</EmptyState> : visible.map((animal) => (
          <View key={animal.id} style={[styles.row, { borderTopColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.backgroundSelected }]}><Text style={styles.avatarText}>🐄</Text></View>
            <View style={styles.rowCopy}>
              <Text style={[styles.name, { color: colors.text }]}>{animal.tag}</Text>
              <Text style={[styles.detail, { color: colors.textSecondary }]}>{animal.category} • {animal.breed || 'breed not set'} • {animal.is_milking ? 'milking' : animal.status}</Text>
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
  error: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 23 },
  rowCopy: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontWeight: '800' },
  detail: { fontSize: 13, lineHeight: 18, textTransform: 'capitalize' },
  manage: { minHeight: 48, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  manageText: { fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
