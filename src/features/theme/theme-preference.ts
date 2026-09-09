import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, type ColorSchemeName } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

const storageKey = 'laveri.theme-preference';

function apply(preference: ThemePreference) {
  Appearance.setColorScheme((preference === 'system' ? null : preference) as ColorSchemeName);
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

export function activeThemePreference(scheme: ColorSchemeName): ThemePreference {
  return scheme === 'dark' ? 'dark' : 'light';
}
