import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AppScreen, SectionCard } from '@/components/app-screen';
import { Colors } from '@/constants/theme';
import { getMilkReminderSettings, MilkReminderSettings, ReminderPeriod, saveMilkReminderSettings } from '@/features/reminders/milk-reminders';

function timeDate(hour: number, minute: number) { const value = new Date(); value.setHours(hour, minute, 0, 0); return value; }
function timeLabel(hour: number, minute: number) { return timeDate(hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }

export default function RemindersScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [settings, setSettings] = useState<MilkReminderSettings | null>(null);
  const [editing, setEditing] = useState<ReminderPeriod | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { void getMilkReminderSettings().then(setSettings); }, []);
  const update = useCallback((period: ReminderPeriod, change: Partial<MilkReminderSettings[ReminderPeriod]>) => setSettings((current) => current ? { ...current, [period]: { ...current[period], ...change } } : current), []);
  const save = async () => {
    if (!settings) return;
    setBusy(true); setMessage(null);
    try { await saveMilkReminderSettings(settings); setMessage('Milk reminders saved on this device.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save reminders.'); }
    finally { setBusy(false); }
  };

  return <AppScreen title="Milk reminders" subtitle="A separate setting for this phone"><SectionCard title="Missing entry reminders"><Text style={[styles.helper, { color: colors.textSecondary }]}>Choose when this phone should remind you to enter Morning and Evening milk. Completing a session moves its reminder to the next day.</Text>{settings ? (['morning', 'evening'] as const).map((period) => <View key={period} style={[styles.row, { borderTopColor: colors.border }]}><View style={styles.copy}><Text style={[styles.title, { color: colors.text }]}>{period === 'morning' ? 'Morning milk' : 'Evening milk'}</Text><Text style={[styles.helper, { color: colors.textSecondary }]}>{settings[period].enabled ? `Reminder at ${timeLabel(settings[period].hour, settings[period].minute)}` : 'Off'}</Text></View><Pressable onPress={() => update(period, { enabled: !settings[period].enabled })} style={[styles.toggle, { backgroundColor: settings[period].enabled ? colors.primary : colors.backgroundSelected }]}><Text style={{ color: settings[period].enabled ? '#fff' : colors.text, fontWeight: '800' }}>{settings[period].enabled ? 'On' : 'Off'}</Text></Pressable><Pressable disabled={!settings[period].enabled} onPress={() => setEditing(period)} style={[styles.time, { borderColor: colors.border }, !settings[period].enabled && styles.disabled]}><Text style={{ color: colors.text, fontWeight: '700' }}>{timeLabel(settings[period].hour, settings[period].minute)}</Text></Pressable></View>) : <ActivityIndicator color={colors.primary} />}{editing && settings ? <DateTimePicker mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} value={timeDate(settings[editing].hour, settings[editing].minute)} onChange={(_event, selected) => { if (Platform.OS === 'android') setEditing(null); if (selected) update(editing, { hour: selected.getHours(), minute: selected.getMinutes() }); }} /> : null}<Pressable disabled={!settings || busy} onPress={() => void save()} style={[styles.save, { backgroundColor: colors.primary }, (!settings || busy) && styles.disabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save reminders</Text>}</Pressable>{message ? <Text style={[styles.helper, { color: message.includes('saved') ? colors.primary : colors.danger }]}>{message}</Text> : null}</SectionCard><SectionCard title="Important"><Text style={[styles.helper, { color: colors.textSecondary }]}>Reminders are local to this phone. Android may delay them slightly to protect battery life. Allow Laveri notifications when the phone asks.</Text></SectionCard></AppScreen>;
}

const styles = StyleSheet.create({
  helper: { fontSize: 13, lineHeight: 19 }, row: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, copy: { flex: 1, gap: 2 }, title: { fontSize: 16, fontWeight: '800' }, toggle: { paddingVertical: 9, paddingHorizontal: 11, borderRadius: 9 }, time: { borderWidth: 1, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 10 }, save: { minHeight: 48, marginTop: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }, saveText: { color: '#fff', fontWeight: '800', fontSize: 15 }, disabled: { opacity: 0.5 },
});
