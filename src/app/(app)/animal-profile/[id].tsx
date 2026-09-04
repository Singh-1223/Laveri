import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { createAnimalPhoto, loadAnimalProfile } from '@/data/repositories/animal-profile';
import type { AnimalProfile } from '@/data/repositories/animal-profile.types';
import { requireSupabase } from '@/data/supabase/client';
import { formatMoney } from '@/domain/calculations';
import { formatFarmDate } from '@/domain/dates';
import { useSession } from '@/features/auth/session-provider';

export default function AnimalProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const colors = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [profile, setProfile] = useState<AnimalProfile | null>(null);
  const load = useCallback(async () => { const sync = await getPowerSyncSnapshot(); if (sync.farmId && id) setProfile(await loadAnimalProfile(sync.farmId, id)); }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const attach = async () => { const sync = await getPowerSyncSnapshot(); if (!sync.farmId || !session || !id) return; const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true }); if (result.canceled) return; const asset = result.assets[0]; if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error('Attachments must be 10 MB or smaller.'); const path = `${sync.farmId}/${id}/${Date.now()}-${asset.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`; const file = await fetch(asset.uri); const upload = await requireSupabase().storage.from('animal-files').upload(path, await file.arrayBuffer(), { contentType: asset.mimeType ?? 'application/octet-stream' }); if (upload.error) throw upload.error; await createAnimalPhoto({ farmId: sync.farmId, animalId: id, userId: session.user.id, storagePath: path, fileName: asset.name }); await load(); };
  const history = profile ? [...profile.events.map((x) => `${formatFarmDate(x.eventDate)} · ${x.kind}: ${x.title}${x.notes ? ` — ${x.notes}` : ''}`), ...profile.heat.map((x) => `${formatFarmDate(x.observedAt)} · Heat: ${x.signs}`), ...profile.treatments.map((x) => `${formatFarmDate(x.treatmentDate)} · Treatment ${formatMoney(x.totalPaise)}${x.notes ? ` — ${x.notes}` : ''}`)] : [];
  return <AppScreen title={profile?.animal.tag ?? 'Animal profile'} subtitle="History and attachments"><SectionCard title="Profile"><Text style={{ color: colors.text }}>Birth: {profile?.animal.birthDate ? formatFarmDate(profile.animal.birthDate) : 'Not recorded'} · Purchase: {profile?.animal.acquisitionDate ? formatFarmDate(profile.animal.acquisitionDate) : 'Not recorded'}</Text></SectionCard><SectionCard title="Photos and documents"><Pressable onPress={() => void attach()}><Text style={{ color: colors.primary }}>Add photo or PDF</Text></Pressable>{profile?.photos.map((photo) => <Pressable key={photo.id} onPress={async () => { const link = await requireSupabase().storage.from('animal-files').createSignedUrl(photo.storagePath, 600); if (link.data?.signedUrl) await Linking.openURL(link.data.signedUrl); }}><Text style={{ color: colors.primary }}>{photo.fileName}</Text></Pressable>)}</SectionCard><SectionCard title="History">{history.length ? history.map((entry, index) => <Text key={`${entry}-${index}`} style={{ color: colors.text }}>{entry}</Text>) : <EmptyState>No animal history yet.</EmptyState>}</SectionCard></AppScreen>;
}
