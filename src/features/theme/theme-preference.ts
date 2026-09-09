import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

const storageKey = 'laveri.theme-preference';

function apply(preference: ThemePreference) {
  // Android's Appearance bridge rejects null. A fresh app launch already
  // follows the system scheme, so System deliberately performs no native call.
  if (preference === 'light' || preference === 'dark') Appearance.setColorScheme(preference);
}

export async function loadThemePreference(): Promise<ThemePreference> {
  const saved = await AsyncStorage.getItem(storageKey);
  const preference: ThemePreference = saved === 'light' || saved === 'dark' ? saved : 'system';
  apply(preference);
  return preference;
}

export async function saveThemePreference(preference: ThemePreference) {
  apply(preference);
  await AsyncStorage.setItem(storageKey, preference);
}
