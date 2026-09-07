import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { DateField } from '@/components/date-field';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { createAnimalPhoto, loadAnimalProfile } from '@/data/repositories/animal-profile';
import type { AnimalProfile } from '@/data/repositories/animal-profile.types';
import { requireSupabase } from '@/data/supabase/client';
import { formatMoney } from '@/domain/calculations';
import { formatFarmDate } from '@/domain/dates';
import { useSession } from '@/features/auth/session-provider';

const today = () => new Date().toISOString().slice(0, 10);

export default function AnimalProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const colors = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [profile, setProfile] = useState<AnimalProfile | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [attachmentDate, setAttachmentDate] = useState(today());
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sync = await getPowerSyncSnapshot();
    if (!sync.farmId || !id) return;
    const nextProfile = await loadAnimalProfile(sync.farmId, id);
    setProfile(nextProfile);
    const photo = nextProfile.photos.find((item) => item.isProfile === 1);
    if (!photo) { setProfilePhotoUrl(null); return; }
    const signed = await requireSupabase().storage.from('animal-files').createSignedUrl(photo.storagePath, 600);
    setProfilePhotoUrl(signed.data?.signedUrl ?? null);
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openFile = async (storagePath: string) => {
    const link = await requireSupabase().storage.from('animal-files').createSignedUrl(storagePath, 600);
    if (link.data?.signedUrl) await Linking.openURL(link.data.signedUrl);
  };

  const attach = async (isProfile: boolean) => {
    try {
      const sync = await getPowerSyncSnapshot();
      if (!sync.farmId || !session || !id) return;
      const result = await DocumentPicker.getDocumentAsync({ type: isProfile ? ['image/*'] : ['image/*', 'application/pdf'], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error('Attachments must be 10 MB or smaller.');
      const path = `${sync.farmId}/${id}/${Date.now()}-${asset.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const file = await fetch(asset.uri);
      const upload = await requireSupabase().storage.from('animal-files').upload(path, await file.arrayBuffer(), { contentType: asset.mimeType ?? 'application/octet-stream' });
      if (upload.error) throw upload.error;
      await createAnimalPhoto({ farmId: sync.farmId, animalId: id, userId: session.user.id, storagePath: path, fileName: asset.name, attachmentDate, isProfile });
      setMessage(isProfile ? 'Profile picture updated.' : 'Attachment added to History.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to add the attachment.'); }
  };

  const profilePhoto = profile?.photos.find((item) => item.isProfile === 1) ?? null;
  const history = useMemo(() => profile ? [
    ...profile.events.map((event) => ({ key: `event-${event.id}`, date: event.eventDate, text: `${event.kind}: ${event.title}${event.notes ? ` — ${event.notes}` : ''}`, storagePath: undefined as string | undefined })),
    ...profile.heat.map((event, index) => ({ key: `heat-${event.observedAt}-${index}`, date: event.observedAt, text: `Heat: ${event.signs}`, storagePath: undefined as string | undefined })),
    ...profile.treatments.map((event, index) => ({ key: `treatment-${event.treatmentDate}-${index}`, date: event.treatmentDate, text: `Treatment ${formatMoney(event.totalPaise)}${event.notes ? ` — ${event.notes}` : ''}`, storagePath: undefined as string | undefined })),
    ...profile.photos.filter((photo) => !photo.isProfile).map((photo) => ({ key: `attachment-${photo.id}`, date: photo.attachmentDate, text: photo.fileName, storagePath: photo.storagePath })),
  ].sort((left, right) => right.date.localeCompare(left.date)) : [], [profile]);

  return <AppScreen title={profile?.animal.tag ?? 'Animal profile'} subtitle="History and attachments">
    <SectionCard title="Profile"><View style={styles.profileRow}>{profilePhotoUrl && profilePhoto ? <Pressable onPress={() => void openFile(profilePhoto.storagePath)}><Image source={{ uri: profilePhotoUrl }} style={styles.profileImage} /></Pressable> : <View style={[styles.profileImage, styles.profilePlaceholder, { backgroundColor: colors.backgroundSelected }]}><Text style={styles.cow}>🐄</Text></View>}<View style={styles.profileCopy}><Text style={{ color: colors.text }}>Birth: {profile?.animal.birthDate ? formatFarmDate(profile.animal.birthDate) : 'Not recorded'}</Text><Text style={{ color: colors.text }}>Purchase: {profile?.animal.acquisitionDate ? formatFarmDate(profile.animal.acquisitionDate) : 'Not recorded'}</Text><Pressable onPress={() => void attach(true)}><Text style={{ color: colors.primary }}>{profilePhoto ? 'Replace profile picture' : 'Set profile picture'}</Text></Pressable></View></View></SectionCard>
    <SectionCard title="Photos and documents"><DateField label="Attachment date" value={attachmentDate} onChange={setAttachmentDate} /><Pressable onPress={() => void attach(false)}><Text style={{ color: colors.primary }}>Add dated photo or PDF</Text></Pressable>{message ? <Text style={{ color: colors.textSecondary }}>{message}</Text> : null}</SectionCard>
    <SectionCard title="History (newest first)">{history.length ? history.map((entry) => <Pressable key={entry.key} onPress={entry.storagePath ? () => void openFile(entry.storagePath!) : undefined}><Text style={{ color: entry.storagePath ? colors.primary : colors.text }}>{formatFarmDate(entry.date)} · {entry.text}</Text></Pressable>) : <EmptyState>No animal history yet.</EmptyState>}</SectionCard>
  </AppScreen>;
}

const styles = StyleSheet.create({
  profileRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  profileImage: { borderRadius: 42, height: 84, width: 84 },
  profilePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cow: { fontSize: 40 },
  profileCopy: { flex: 1, gap: 6 },
});
