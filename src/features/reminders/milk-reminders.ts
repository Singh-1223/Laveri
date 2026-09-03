import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type ReminderPeriod = 'morning' | 'evening';

export type MilkReminderSettings = Record<ReminderPeriod, {
  enabled: boolean;
  hour: number;
  minute: number;
}>;

const storageKey = 'laveri:milk-reminder-settings:v1';
const notificationIdsKey = 'laveri:milk-reminder-notification-ids:v1';
const defaults: MilkReminderSettings = {
  morning: { enabled: false, hour: 9, minute: 0 },
  evening: { enabled: false, hour: 21, minute: 0 },
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export async function getMilkReminderSettings(): Promise<MilkReminderSettings> {
  const saved = await AsyncStorage.getItem(storageKey);
  if (!saved) return defaults;
  try {
    const parsed = JSON.parse(saved) as Partial<MilkReminderSettings>;
    return { morning: { ...defaults.morning, ...parsed.morning }, evening: { ...defaults.evening, ...parsed.evening } };
  } catch { return defaults; }
}

export async function saveMilkReminderSettings(settings: MilkReminderSettings) {
  if (!(await ensureNotificationPermission(settings))) throw new Error('Notification permission is off. Enable notifications for Laveri in the phone settings, then try again.');
  await AsyncStorage.setItem(storageKey, JSON.stringify(settings));
  await scheduleMilkReminders(settings);
}

export async function refreshMilkSessionReminder(period: ReminderPeriod, complete: boolean) {
  const settings = await getMilkReminderSettings();
  if (!settings[period].enabled || !(await hasNotificationPermission())) return;
  await cancelPeriod(period);
  await schedulePeriod(period, settings[period], complete);
}

async function ensureNotificationPermission(settings: MilkReminderSettings) {
  if (!settings.morning.enabled && !settings.evening.enabled) return true;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('milk-reminders', { name: 'Milk reminders', importance: Notifications.AndroidImportance.DEFAULT, vibrationPattern: [0, 250, 200, 250] });
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function hasNotificationPermission() { return (await Notifications.getPermissionsAsync()).granted; }

async function scheduleMilkReminders(settings: MilkReminderSettings) {
  await Promise.all((['morning', 'evening'] as const).map(async (period) => {
    await cancelPeriod(period);
    if (settings[period].enabled) await schedulePeriod(period, settings[period], false);
  }));
}

async function schedulePeriod(period: ReminderPeriod, setting: MilkReminderSettings[ReminderPeriod], complete: boolean) {
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: `${period === 'morning' ? 'Morning' : 'Evening'} milk entry`, body: 'Open Laveri and record the milk session.', data: { url: '/milk' }, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextOccurrence(setting.hour, setting.minute, complete) },
  });
  const ids = await getNotificationIds();
  await AsyncStorage.setItem(notificationIdsKey, JSON.stringify({ ...ids, [period]: id }));
}

function nextOccurrence(hour: number, minute: number, complete: boolean) {
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (complete || target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
  return target;
}

async function cancelPeriod(period: ReminderPeriod) {
  const ids = await getNotificationIds();
  if (!ids[period]) return;
  await Notifications.cancelScheduledNotificationAsync(ids[period]);
  await AsyncStorage.setItem(notificationIdsKey, JSON.stringify({ ...ids, [period]: undefined }));
}

async function getNotificationIds(): Promise<Partial<Record<ReminderPeriod, string>>> {
  const saved = await AsyncStorage.getItem(notificationIdsKey);
  if (!saved) return {};
  try { return JSON.parse(saved) as Partial<Record<ReminderPeriod, string>>; } catch { return {}; }
}
