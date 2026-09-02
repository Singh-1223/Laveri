import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AppScreen, SectionCard } from '@/components/app-screen';
import { getEnvironmentState } from '@/config/env';
import { Colors } from '@/constants/theme';
import { signInWithGoogle } from '@/data/supabase/auth';

export default function SignInScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const environment = getEnvironmentState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen title="Laveri" subtitle="Offline-first dairy records for your family farm">
      <View style={styles.hero}>
        <Text style={styles.mark}>🐄</Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Your daily dairy work, in one place.</Text>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>Sign in once while online. After the first sync, daily entries and reports remain available offline.</Text>
      </View>

      {!environment.configured ? (
        <SectionCard title="Development setup required">
          <Text style={[styles.copy, { color: colors.textSecondary }]}>Add these public values to `.env`, then restart Metro:</Text>
          {environment.missing.map((name) => <Text key={name} style={[styles.code, { color: colors.text }]}>{name}</Text>)}
        </SectionCard>
      ) : (
        <Pressable disabled={busy} onPress={signIn} style={({ pressed }) => [styles.button, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Continue with Google</Text>}
        </Pressable>
      )}

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 32, gap: 14 },
  mark: { fontSize: 64 },
  heroTitle: { maxWidth: 340, textAlign: 'center', fontSize: 28, lineHeight: 34, fontWeight: '800' },
  copy: { fontSize: 15, lineHeight: 22 },
  code: { fontFamily: 'monospace', fontSize: 13 },
  button: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.78 },
  error: { fontSize: 14, lineHeight: 20 },
});
