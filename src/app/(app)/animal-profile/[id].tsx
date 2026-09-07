import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { DateField } from '@/components/date-field';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { createAnimalPhoto, deleteAnimalPhoto, loadAnimalProfile } from '@/data/repositories/animal-profile';
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
  const [attachmentImageUrls, setAttachmentImageUrls] = useState<Record<string, string>>({});
  const [attachmentDate, setAttachmentDate] = useState(today());
  const [message, setMessage] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(7);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const load = useCallback(async () => {
    const sync = await getPowerSyncSnapshot();
    if (!sync.farmId || !id) return;
    const nextProfile = await loadAnimalProfile(sync.farmId, id);
    setProfile(nextProfile);
    const photo = nextProfile.photos.find((item) => item.isProfile === 1);
    if (!photo) setProfilePhotoUrl(null);
    else {
      const signed = await requireSupabase().storage.from('animal-files').createSignedUrl(photo.storagePath, 600);
      setProfilePhotoUrl(signed.data?.signedUrl ?? null);
    }
    const imageAttachments = nextProfile.photos.filter((item) => !item.isProfile && isImageFile(item.fileName));
    const attachmentLinks = await Promise.all(imageAttachments.map(async (item) => {
      const signed = await requireSupabase().storage.from('animal-files').createSignedUrl(item.storagePath, 600);
      return [item.id, signed.data?.signedUrl] as const;
    }));
    setAttachmentImageUrls(Object.fromEntries(attachmentLinks.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))));
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openFile = async (storagePath: string) => {
    const link = await requireSupabase().storage.from('animal-files').createSignedUrl(storagePath, 600);
    if (link.data?.signedUrl) await Linking.openURL(link.data.signedUrl);
  };

  const removeAttachment = async (photo: NonNullable<AnimalProfile['photos']>[number]) => {
    try {
      const sync = await getPowerSyncSnapshot();
      if (!sync.farmId || !session) return;
      const removed = await requireSupabase().storage.from('animal-files').remove([photo.storagePath]);
      if (removed.error) throw removed.error;
      await deleteAnimalPhoto({ farmId: sync.farmId, photoId: photo.id, userId: session.user.id });
      setMessage('Attachment deleted.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to delete the attachment.'); }
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
  const milkPoints = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of profile?.milk ?? []) totals.set(row.milkDate, (totals.get(row.milkDate) ?? 0) + row.volumeMl);
    const todayValue = today(); const start = customFrom || new Date(new Date(`${todayValue}T12:00:00`).getTime() - (rangeDays - 1) * 86_400_000).toISOString().slice(0, 10); const end = customTo || todayValue;
    return [...totals.entries()].filter(([date]) => date >= start && date <= end).sort(([left], [right]) => left.localeCompare(right)).map(([date, volumeMl]) => ({ date, volumeMl }));
  }, [customFrom, customTo, profile?.milk, rangeDays]);
  const maxMilk = Math.max(1, ...milkPoints.map((point) => point.volumeMl));
  const chartWidth = Math.max(260, milkPoints.length * 48);
  const linePoints = milkPoints.map((point, index) => `${24 + index * 48},${136 - (point.volumeMl / maxMilk) * 112}`).join(' ');

  return <AppScreen title={profile?.animal.tag ?? 'Animal profile'} subtitle="History and attachments">
    <SectionCard title="Profile"><View style={styles.profileRow}>{profilePhotoUrl && profilePhoto ? <Pressable onPress={() => void openFile(profilePhoto.storagePath)}><Image source={{ uri: profilePhotoUrl }} style={styles.profileImage} /></Pressable> : <View style={[styles.profileImage, styles.profilePlaceholder, { backgroundColor: colors.backgroundSelected }]}><Text style={styles.cow}>🐄</Text></View>}<View style={styles.profileCopy}><Text style={{ color: colors.text }}>Birth: {profile?.animal.birthDate ? formatFarmDate(profile.animal.birthDate) : 'Not recorded'}</Text><Text style={{ color: colors.text }}>Purchase: {profile?.animal.acquisitionDate ? formatFarmDate(profile.animal.acquisitionDate) : 'Not recorded'}</Text><Pressable onPress={() => void attach(true)}><Text style={{ color: colors.primary }}>{profilePhoto ? 'Replace profile picture' : 'Set profile picture'}</Text></Pressable></View></View></SectionCard>
    <SectionCard title="Photos and documents"><DateField label="Attachment date" value={attachmentDate} onChange={setAttachmentDate} /><Pressable onPress={() => void attach(false)}><Text style={{ color: colors.primary }}>Add dated photo or PDF</Text></Pressable>{profile?.photos.filter((item) => !item.isProfile && isImageFile(item.fileName)).length ? <View style={styles.thumbnailGrid}>{profile.photos.filter((item) => !item.isProfile && isImageFile(item.fileName)).map((item) => <View key={item.id} style={styles.attachmentItem}><Pressable onPress={() => void openFile(item.storagePath)}>{attachmentImageUrls[item.id] ? <Image source={{ uri: attachmentImageUrls[item.id] }} style={styles.thumbnail} /> : <View style={[styles.thumbnail, styles.thumbnailPlaceholder, { backgroundColor: colors.backgroundSelected }]}><Text style={{ color: colors.textSecondary }}>Image</Text></View>}</Pressable><Pressable onPress={() => Alert.alert('Delete attachment?', item.fileName, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void removeAttachment(item) }])}><Text style={[styles.deleteText, { color: colors.danger }]}>Delete</Text></Pressable></View>)}</View> : null}{profile?.photos.filter((item) => !item.isProfile && !isImageFile(item.fileName)).map((item) => <View key={item.id} style={styles.documentRow}><Pressable onPress={() => void openFile(item.storagePath)} style={styles.documentName}><Text style={{ color: colors.primary }}>{item.fileName}</Text></Pressable><Pressable onPress={() => Alert.alert('Delete attachment?', item.fileName, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void removeAttachment(item) }])}><Text style={[styles.deleteText, { color: colors.danger }]}>Delete</Text></Pressable></View>)}{message ? <Text style={{ color: colors.textSecondary }}>{message}</Text> : null}</SectionCard>
    <SectionCard title="Milk history"><View style={styles.rangeButtons}>{([7, 30, 90] as const).map((value) => <Pressable key={value} onPress={() => { setRangeDays(value); setCustomFrom(''); setCustomTo(''); }} style={[styles.rangeButton, { backgroundColor: rangeDays === value && !customFrom && !customTo ? colors.primary : colors.backgroundSelected }]}><Text style={{ color: rangeDays === value && !customFrom && !customTo ? '#fff' : colors.text }}>{value === 7 ? '7 days' : value === 30 ? '1 month' : '3 months'}</Text></Pressable>)}</View><DateField label="Custom from (optional)" value={customFrom} onChange={setCustomFrom} /><DateField label="Custom to (optional)" value={customTo} onChange={setCustomTo} />{milkPoints.length ? <ScrollView horizontal showsHorizontalScrollIndicator><View><Svg width={chartWidth} height={156}><Line x1="24" y1="136" x2={chartWidth - 8} y2="136" stroke={colors.border} /><Polyline points={linePoints} fill="none" stroke={colors.primary} strokeWidth="3" />{milkPoints.map((point, index) => <Circle key={point.date} cx={24 + index * 48} cy={136 - (point.volumeMl / maxMilk) * 112} r="4" fill={colors.primary} />)}</Svg><View style={styles.chartLabels}>{milkPoints.map((point) => <Text key={point.date} style={[styles.chartLabel, { color: colors.textSecondary }]}>{formatFarmDate(point.date)}</Text>)}</View></View></ScrollView> : <EmptyState>No milk records in this date range.</EmptyState>}</SectionCard>
    <SectionCard title="History (newest first)">{history.length ? history.map((entry) => <Pressable key={entry.key} onPress={entry.storagePath ? () => void openFile(entry.storagePath!) : undefined}><Text style={{ color: entry.storagePath ? colors.primary : colors.text }}>{formatFarmDate(entry.date)} · {entry.text}</Text></Pressable>) : <EmptyState>No animal history yet.</EmptyState>}</SectionCard>
  </AppScreen>;
}

function isImageFile(fileName: string) {
  return /\.(avif|gif|heic|jpeg|jpg|png|webp)$/i.test(fileName);
}

const styles = StyleSheet.create({
  profileRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  profileImage: { borderRadius: 42, height: 84, width: 84 },
  profilePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cow: { fontSize: 40 },
  profileCopy: { flex: 1, gap: 6 },
  rangeButtons: { flexDirection: 'row', gap: 8 },
  rangeButton: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  chartLabels: { flexDirection: 'row', gap: 16, paddingHorizontal: 4 },
  chartLabel: { fontSize: 10, width: 32 },
  thumbnailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbnail: { borderRadius: 10, height: 76, width: 76 },
  thumbnailPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  attachmentItem: { gap: 3, width: 76 },
  documentRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  documentName: { flex: 1 },
  deleteText: { fontSize: 12, fontWeight: '700' },
});
