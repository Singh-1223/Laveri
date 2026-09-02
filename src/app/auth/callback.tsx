import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { exchangeGoogleAuthCode } from '@/data/supabase/auth';
import { useSession } from '@/features/auth/session-provider';

/**
 * Android opens the app's laveri:// URL after Google redirects back from
 * Supabase. This route consumes that URL rather than letting Expo Router show
 * an "Unmatched Route" screen.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { code, error_description: providerError } = useLocalSearchParams<{
    code?: string | string[];
    error_description?: string | string[];
  }>();
  const completed = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (completed.current) return;
    completed.current = true;

    const authCode = Array.isArray(code) ? code[0] : code;
    const authError = Array.isArray(providerError) ? providerError[0] : providerError;

    // Android can restore this screen as the last activity after the browser
    // closes. That restored navigation has no OAuth data and is not an error.
    if (!authCode && !authError) {
      router.replace(session ? '/' : '/sign-in');
      return;
    }

    exchangeGoogleAuthCode(authCode ?? null, authError)
      .then(() => router.replace('/'))
      .catch((nextError: unknown) => {
        setError(nextError instanceof Error ? nextError.message : 'Google sign-in could not be completed.');
      });
  }, [code, providerError, router, session]);

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.title}>Sign-in could not be completed</Text>
          <Text style={styles.copy}>{error}</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" />
          <Text style={styles.title}>Completing sign-in…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  title: { fontSize: 21, fontWeight: '700', textAlign: 'center' },
  copy: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
