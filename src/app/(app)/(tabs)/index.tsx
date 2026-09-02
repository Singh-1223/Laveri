import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { AppScreen, SectionCard } from '@/components/app-screen';
import { Colors } from '@/constants/theme';
import { getPowerSyncSnapshot } from '@/data/powersync/platform';
import { getDailyDashboardSummary } from '@/data/repositories/dashboard';
import type { DailyDashboardSummary } from '@/data/repositories/dashboard.types';
import { onboardOwner } from '@/data/supabase/auth';
import { formatMilk, formatMoney } from '@/domain/calculations';
import { useSession } from '@/features/auth/session-provider';

export default function HomeScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { session, signOut, syncError } = useSession();
  const [farmId, setFarmId] = useState<string | null>(null);
  const [farmName, setFarmName] = useState('Laveri Dairy');
  const [summary, setSummary] = useState<DailyDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [waitingForFarm, setWaitingForFarm] = useState(true);
  const [initialSyncError, setInitialSyncError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const snapshot = await getPowerSyncSnapshot();
      setFarmId(snapshot.farmId);
      setWaitingForFarm(!snapshot.farmId && !snapshot.hasSynced && !snapshot.error);
      setInitialSyncError(!snapshot.farmId && !snapshot.hasSynced ? snapshot.error : null);
      if (snapshot.farmId) {
        setSummary(await getDailyDashboardSummary(snapshot.farmId, todayAtFarm()));
      } else {
        setSummary(null);
      }
    } catch (error) {
      const nextError = error instanceof Error ? error.message : 'Unable to read local farm data.';
      setMessage(nextError);
      setInitialSyncError(nextError);
      setWaitingForFarm(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const poll = () => { if (active) void refresh(); };
      poll();
      // Sign-in and sign-out clear the local database. Poll briefly while the
      // first PowerSync download restores the user's farm membership.
      const interval = setInterval(poll, 1_000);
      return () => { active = false; clearInterval(interval); };
    }, [refresh]),
  );

  const initializeFarm = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const id = await onboardOwner(farmName.trim());
      setFarmId(id);
      setMessage('Farm initialized. Master data can now be added offline.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Farm setup failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen title="Good day" subtitle={session?.user.email ?? 'Family farm'}>
      {syncError ? <Text style={[styles.error, { color: colors.danger }]}>{syncError}</Text> : null}
      {message ? <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text> : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : waitingForFarm && !syncError ? (
        <SectionCard title="Loading your farm">
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.copy, { color: colors.textSecondary }]}>Checking your existing farm records. This can take a moment after signing in on a device.</Text>
        </SectionCard>
      ) : initialSyncError || syncError ? (
        <SectionCard title="Unable to load your farm">
          <Text style={[styles.copy, { color: colors.danger }]}>{initialSyncError ?? syncError}</Text>
          <Text style={[styles.copy, { color: colors.textSecondary }]}>Do not create another farm. Restore internet access, then open Sync status and try again.</Text>
          <Link href="../sync-status" asChild>
            <Pressable style={({ pressed }) => [styles.outlineButton, { borderColor: colors.primary }, pressed && styles.pressed]}>
              <Text style={[styles.outlineText, { color: colors.primary }]}>Open Sync status</Text>
            </Pressable>
          </Link>
        </SectionCard>
      ) : !farmId ? (
        <SectionCard title="Set up your farm">
          <Text style={[styles.copy, { color: colors.textSecondary }]}>This one-time online step creates the farm linked to your Google account.</Text>
          <TextInput
            accessibilityLabel="Farm name"
            onChangeText={setFarmName}
            placeholder="Farm name"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            value={farmName}
          />
          <PrimaryButton disabled={busy || !farmName.trim()} label={busy ? 'Setting up…' : 'Create farm'} onPress={initializeFarm} />
        </SectionCard>
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Today’s milk" value={formatMilk(summary?.producedMl ?? 0)} />
            <SummaryCard label="Unallocated" value={formatMilk(Math.abs(summary?.unallocatedMl ?? 0))} />
            <SummaryCard label="Turnover" value={formatMoney(summary?.turnoverPaise ?? 0)} />
            <SummaryCard label="Operating cost" value={formatMoney(summary?.operatingCostPaise ?? 0)} />
            <SummaryCard label="Operating profit" value={formatMoney(summary?.operatingProfitPaise ?? 0)} />
            <SummaryCard label="Investment" value={formatMoney(summary?.investmentPaise ?? 0)} />
          </View>

          <SectionCard title="Start with master data">
            <Text style={[styles.copy, { color: colors.textSecondary }]}>Add animals, buyers, feed, medicines, and products before recording daily activity.</Text>
            <Link href="../master-data" asChild>
              <Pressable style={({ pressed }) => [styles.outlineButton, { borderColor: colors.primary }, pressed && styles.pressed]}>
                <Text style={[styles.outlineText, { color: colors.primary }]}>Manage master data</Text>
              </Pressable>
            </Link>
          </SectionCard>

          <SectionCard title="Milk pricing">
            <Text style={[styles.copy, { color: colors.textSecondary }]}>Choose flat-rate or FAT/SNF quality pricing and set values by effective date.</Text>
            <Link href="../pricing" asChild>
              <Pressable style={({ pressed }) => [styles.outlineButton, { borderColor: colors.primary }, pressed && styles.pressed]}>
                <Text style={[styles.outlineText, { color: colors.primary }]}>Configure milk pricing</Text>
              </Pressable>
            </Link>
          </SectionCard>

          <SectionCard title="Records and accountability">
            <Text style={[styles.copy, { color: colors.textSecondary }]}>Review edits, deactivations, and voids with their before/after values.</Text>
            <Link href="../corrections" asChild>
              <Pressable style={({ pressed }) => [styles.outlineButton, { borderColor: colors.primary }, pressed && styles.pressed]}>
                <Text style={[styles.outlineText, { color: colors.primary }]}>Open correction history</Text>
              </Pressable>
            </Link>
          </SectionCard>
        </>
      )}

      <Pressable onPress={signOut} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
        <Text style={[styles.signOutText, { color: colors.textSecondary }]}>Sign out and remove local data</Text>
      </Pressable>
    </AppScreen>
  );
}

function todayAtFarm() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return (
    <View style={[styles.summaryCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function PrimaryButton({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, disabled && styles.disabled, pressed && styles.pressed]}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 14, lineHeight: 20 },
  message: { fontSize: 14, lineHeight: 20 },
  copy: { fontSize: 15, lineHeight: 22 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  primaryButton: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryCard: { width: '48%', flexGrow: 1, minHeight: 104, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13, fontWeight: '600' },
  summaryValue: { fontSize: 24, fontWeight: '800' },
  outlineButton: { minHeight: 48, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontSize: 15, fontWeight: '700' },
  signOut: { alignItems: 'center', paddingVertical: 12 },
  signOutText: { fontSize: 13, fontWeight: '600' },
});
