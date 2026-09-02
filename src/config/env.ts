export type PublicEnvironment = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  powerSyncUrl: string;
};

export type EnvironmentState =
  | { configured: true; value: PublicEnvironment }
  | { configured: false; missing: string[] };

export function getEnvironmentState(): EnvironmentState {
  const values = {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim(),
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
    powerSyncUrl: process.env.EXPO_PUBLIC_POWERSYNC_URL?.trim(),
  };

  const missing = [
    !values.supabaseUrl && 'EXPO_PUBLIC_SUPABASE_URL',
    !values.supabasePublishableKey && 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    !values.powerSyncUrl && 'EXPO_PUBLIC_POWERSYNC_URL',
  ].filter((name): name is string => Boolean(name));

  if (missing.length > 0) {
    return { configured: false, missing };
  }

  return {
    configured: true,
    value: {
      supabaseUrl: values.supabaseUrl!,
      supabasePublishableKey: values.supabasePublishableKey!,
      powerSyncUrl: values.powerSyncUrl!,
    },
  };
}
