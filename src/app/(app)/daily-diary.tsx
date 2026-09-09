import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { AppScreen, EmptyState, SectionCard } from '@/components/app-screen';
import { DateField } from '@/components/date-field';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { deleteDailyDiary, getDailyDiary, saveDailyDiary } from '@/data/repositories/reports';
import type { DailyDiaryRow } from '@/data/repositories/reports.types';
import { formatFarmDate } from '@/domain/dates';
import { useSession } from '@/features/auth/session-provider';

const todayAtFarm = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const monthRange = (anchor: string) => { const date = new Date(`${anchor}-01T12:00:00`); return { fromDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`, toDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()}` }; };
const shiftMonth = (anchor: string, direction: -1 | 1) => { const date = new Date(`${anchor}-01T12:00:00`); date.setMonth(date.getMonth() + direction); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; };

export default function DailyDiaryScreen() {
  const colors = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const { session } = useSession();
  const [farmId, setFarmId] = useState<string | null>(null);
  const [month, setMonth] = useState(todayAtFarm().slice(0, 7));
  const [rows, setRows] = useState<DailyDiaryRow[]>([]);
  const [date, setDate] = useState(todayAtFarm());
  const [comment, setComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => { setLoading(true); try { const sync = await getPowerSyncSnapshot(); setFarmId(sync.farmId); const range = monthRange(month); setRows(sync.farmId ? await getDailyDiary(sync.farmId, range.fromDate, range.toDate) : []); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load Daily Dairy.'); } finally { setLoading(false); } }, [month]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const save = async () => { if (!farmId || !session || !comment.trim()) return; try { await saveDailyDiary({ farmId, userId: session.user.id, diaryDate: date, comment, id: editingId ?? undefined }); setComment(''); setEditingId(null); await load(); setMessage('Daily Dairy entry saved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save the entry.'); } };
  const remove = async (id: string) => { if (!farmId || !session) return; try { await deleteDailyDiary({ farmId, userId: session.user.id, id }); if (editingId === id) { setEditingId(null); setComment(''); } await load(); setMessage('Daily Dairy entry deleted.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to delete the entry.'); } };

  return <AppScreen title="Daily Dairy" subtitle="Dated farm comments"><SectionCard title={`Entries (${rows.length})`}><View style={styles.navigation}><Pressable onPress={() => setMonth((value) => shiftMonth(value, -1))}><Text style={{ color: colors.primary }}>‹ Previous</Text></Pressable><Text style={{ color: colors.text }}>{formatFarmDate(`${month}-01`).replace(/^\d{2}-/, '')}</Text><Pressable onPress={() => setMonth((value) => shiftMonth(value, 1))}><Text style={{ color: colors.primary }}>Next ›</Text></Pressable></View><DateField label="Diary date" value={date} onChange={setDate} /><TextInput accessibilityLabel="Daily Dairy comment" multiline onChangeText={setComment} placeholder="Daily farm comment" placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={comment} /><Pressable disabled={!comment.trim()} onPress={() => void save()} style={[styles.save, { backgroundColor: colors.primary }, !comment.trim() && styles.disabled]}><Text style={styles.saveText}>{editingId ? 'Update comment' : 'Save comment'}</Text></Pressable>{editingId ? <Pressable onPress={() => { setEditingId(null); setComment(''); }}><Text style={{ color: colors.textSecondary }}>Cancel editing</Text></Pressable> : null}{loading ? <ActivityIndicator color={colors.primary} /> : rows.length ? rows.map((entry) => <View key={entry.id} style={[styles.row, { borderBottomColor: colors.border }]}><View style={styles.copy}><Text style={{ color: colors.text, fontWeight: '700' }}>{formatFarmDate(entry.diaryDate)}</Text><Text style={{ color: colors.textSecondary }}>{entry.comment}</Text></View><View style={styles.actions}><Pressable onPress={() => { setEditingId(entry.id); setDate(entry.diaryDate); setComment(entry.comment); }}><Text style={{ color: colors.primary }}>Edit</Text></Pressable><Pressable onPress={() => void remove(entry.id)}><Text style={{ color: colors.danger }}>Delete</Text></Pressable></View></View>) : <EmptyState>No Daily Dairy comments this month.</EmptyState>}{message ? <Text style={{ color: colors.textSecondary }}>{message}</Text> : null}</SectionCard></AppScreen>;
}

const styles = StyleSheet.create({
  navigation: { flexDirection: 'row', justifyContent: 'space-between' },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 76, padding: 12, textAlignVertical: 'top' },
  save: { alignItems: 'center', borderRadius: 11, justifyContent: 'center', minHeight: 46 },
  saveText: { color: '#FFFFFF', fontWeight: '700' },
  disabled: { opacity: 0.45 },
  row: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, paddingVertical: 10 },
  copy: { flex: 1, gap: 3 },
  actions: { gap: 10 },
});
