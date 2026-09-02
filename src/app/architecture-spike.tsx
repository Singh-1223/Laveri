import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getEnvironmentState } from '@/config/env';
import {
  connectPowerSync,
  createSpikeRecord,
  disconnectPowerSync,
  getPowerSyncSnapshot,
  initializePowerSync,
  updateSpikeRecord,
} from '@/data/powersync/platform';
import type { PowerSyncSnapshot } from '@/data/powersync/types';
import { unavailablePowerSyncSnapshot } from '@/data/powersync/types';
import { onboardOwner, oauthRedirectUri, signInWithGoogle } from '@/data/supabase/auth';
import { requireSupabase, supabase } from '@/data/supabase/client';

const environment = getEnvironmentState();

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Never';
}

export default function PhaseZeroArchitectureSpikeScreen() {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? darkPalette : lightPalette;
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(supabase));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [farmName, setFarmName] = useState('Laveri Dairy');
  const [knownFarmId, setKnownFarmId] = useState<string | null>(null);
  const [note, setNote] = useState('Offline-first test record');
  const [snapshot, setSnapshot] = useState<PowerSyncSnapshot>(unavailablePowerSyncSnapshot);

  const refreshSnapshot = useCallback(async () => {
    try {
      setSnapshot(await getPowerSyncSnapshot());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read the local database.');
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(error.message);
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    let active = true;
    let interval: ReturnType<typeof setInterval> | undefined;

    const start = async () => {
      try {
        await initializePowerSync();
        if (!active) return;
        await connectPowerSync();
        if (!active) return;
        await refreshSnapshot();
        interval = setInterval(refreshSnapshot, 2000);
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'PowerSync could not start.');
          await refreshSnapshot();
        }
      }
    };

    start();

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [refreshSnapshot, session]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The operation failed.');
    } finally {
      setBusy(false);
      await refreshSnapshot();
    }
  };

  if (!environment.configured) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: palette.background }]}>
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.eyebrow, { color: palette.accent }]}>PHASE 0</Text>
          <Text style={[styles.title, { color: palette.text }]}>Cloud configuration required</Text>
          <Text style={[styles.body, { color: palette.muted }]}>
            Copy .env.example to .env and provide these public values:
          </Text>
          {environment.missing.map((item) => (
            <Text key={item} style={[styles.code, { color: palette.text }]}>
              {item}
            </Text>
          ))}
          <Text style={[styles.body, { color: palette.muted }]}>Restart the Expo development server afterward.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadingSession) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.accent} size="large" />
        <Text style={[styles.body, { color: palette.muted }]}>Restoring the secure session…</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: palette.background }]}>
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.eyebrow, { color: palette.accent }]}>LAVERI DAIRY</Text>
          <Text style={[styles.title, { color: palette.text }]}>Architecture spike</Text>
          <Text style={[styles.body, { color: palette.muted }]}>
            Sign in once with Google to prove farm ownership and multi-device synchronization. The initial sign-in needs internet access.
          </Text>
          <ActionButton
            disabled={busy}
            label={busy ? 'Opening Google…' : 'Continue with Google'}
            onPress={() => run(signInWithGoogle)}
            palette={palette}
          />
          <Text style={[styles.caption, { color: palette.muted }]}>OAuth callback: {oauthRedirectUri}</Text>
          {message && <ErrorMessage message={message} palette={palette} />}
        </View>
      </SafeAreaView>
    );
  }

  const farmId = snapshot.farmId ?? knownFarmId;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: palette.accent }]}>PHASE 0 • LOCAL FIRST</Text>
            <Text style={[styles.title, { color: palette.text }]}>Architecture proof</Text>
            <Text style={[styles.body, { color: palette.muted }]}>{session.user.email ?? session.user.id}</Text>
          </View>
          <StatusPill connected={snapshot.connected} palette={palette} />
        </View>

        {message && <ErrorMessage message={message} palette={palette} />}

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>1. Owner and farm</Text>
          {farmId ? (
            <>
              <Text style={[styles.success, { color: palette.success }]}>Owner onboarding complete</Text>
              <Text selectable style={[styles.code, { color: palette.muted }]}>{farmId}</Text>
            </>
          ) : (
            <>
              <TextInput
                accessibilityLabel="Farm name"
                onChangeText={setFarmName}
                placeholder="Farm name"
                placeholderTextColor={palette.muted}
                style={[styles.input, { borderColor: palette.border, color: palette.text }]}
                value={farmName}
              />
              <ActionButton
                disabled={busy || !farmName.trim()}
                label="Initialize owner farm"
                onPress={() =>
                  run(async () => {
                    const id = await onboardOwner(farmName);
                    setKnownFarmId(id);
                    setMessage('Farm created. Waiting for PowerSync to download the membership.');
                  })
                }
                palette={palette}
              />
            </>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>2. Offline write test</Text>
          <Text style={[styles.body, { color: palette.muted }]}>
            Turn on airplane mode before adding a record. It should remain after restart and upload when connectivity returns.
          </Text>
          <TextInput
            accessibilityLabel="Test record note"
            multiline
            onChangeText={setNote}
            placeholder="Test note"
            placeholderTextColor={palette.muted}
            style={[styles.input, styles.multiline, { borderColor: palette.border, color: palette.text }]}
            value={note}
          />
          <ActionButton
            disabled={busy || !farmId || !note.trim() || !snapshot.available}
            label="Save to local SQLite"
            onPress={() =>
              run(async () => {
                await createSpikeRecord(farmId!, session.user.id, note);
                setNote('Another offline-first test record');
              })
            }
            palette={palette}
          />
          {snapshot.records[0] && (
            <ActionButton
              disabled={busy}
              label="Edit newest record (conflict test)"
              secondary
              onPress={() =>
                run(() =>
                  updateSpikeRecord(
                    snapshot.records[0],
                    session.user.id,
                    `${snapshot.records[0].note} • edited ${new Date().toLocaleTimeString()}`,
                  ),
                )
              }
              palette={palette}
            />
          )}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>3. Synchronization</Text>
          <Metric label="Connection" value={snapshot.connected ? 'Connected' : snapshot.connecting ? 'Connecting' : 'Offline'} palette={palette} />
          <Metric label="First sync" value={snapshot.hasSynced ? 'Complete' : 'Not complete'} palette={palette} />
          <Metric label="Pending uploads" value={String(snapshot.pendingUploads)} palette={palette} />
          <Metric label="Last sync" value={formatTime(snapshot.lastSyncedAt)} palette={palette} />
          {snapshot.error && <ErrorMessage message={snapshot.error} palette={palette} />}
          <ActionButton disabled={busy} label="Refresh status" secondary onPress={() => run(refreshSnapshot)} palette={palette} />
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Local records ({snapshot.records.length})</Text>
          {snapshot.records.length === 0 ? (
            <Text style={[styles.body, { color: palette.muted }]}>No local records yet.</Text>
          ) : (
            snapshot.records.map((record) => (
              <View key={record.id} style={[styles.record, { borderColor: palette.border }]}>
                <Text style={[styles.recordText, { color: palette.text }]}>{record.note}</Text>
                <Text style={[styles.caption, { color: palette.muted }]}>Version {record.version} • {formatTime(record.updated_at)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Conflicts ({snapshot.conflicts.length})</Text>
          {snapshot.conflicts.length === 0 ? (
            <Text style={[styles.body, { color: palette.muted }]}>No stale edits have been rejected.</Text>
          ) : (
            snapshot.conflicts.map((conflict) => (
              <View key={conflict.id} style={[styles.record, { borderColor: palette.danger }]}>
                <Text style={[styles.recordText, { color: palette.danger }]}>{conflict.message}</Text>
                <Text style={[styles.caption, { color: palette.muted }]}>{conflict.table_name} • {formatTime(conflict.created_at)}</Text>
              </View>
            ))
          )}
        </View>

        <ActionButton
          disabled={busy}
          label="Sign out and remove local data"
          danger
          onPress={() =>
            run(async () => {
              await disconnectPowerSync();
              const { error } = await requireSupabase().auth.signOut();
              if (error) throw error;
              setKnownFarmId(null);
              setSnapshot(unavailablePowerSyncSnapshot);
            })
          }
          palette={palette}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

type Palette = typeof lightPalette;

function ActionButton({
  label,
  onPress,
  disabled,
  secondary,
  danger,
  palette,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
  palette: Palette;
}) {
  const backgroundColor = danger ? palette.danger : secondary ? palette.card : palette.accent;
  const color = secondary ? palette.text : '#FFFFFF';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, borderColor: secondary ? palette.border : backgroundColor },
        (pressed || disabled) && styles.buttonDimmed,
      ]}>
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function StatusPill({ connected, palette }: { connected: boolean; palette: Palette }) {
  return (
    <View style={[styles.pill, { backgroundColor: connected ? palette.successSoft : palette.warningSoft }]}>
      <View style={[styles.dot, { backgroundColor: connected ? palette.success : palette.warning }]} />
      <Text style={[styles.pillText, { color: connected ? palette.success : palette.warning }]}>
        {connected ? 'Synced' : 'Local'}
      </Text>
    </View>
  );
}

function Metric({ label, value, palette }: { label: string; value: string; palette: Palette }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.body, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

function ErrorMessage({ message, palette }: { message: string; palette: Palette }) {
  return (
    <View style={[styles.error, { backgroundColor: palette.dangerSoft }]}>
      <Text selectable style={[styles.body, { color: palette.danger }]}>{message}</Text>
    </View>
  );
}

const lightPalette = {
  background: '#F3F7F4',
  card: '#FFFFFF',
  text: '#17251D',
  muted: '#5D6B62',
  border: '#D8E1DB',
  accent: '#18794E',
  success: '#18794E',
  successSoft: '#E4F7EC',
  warning: '#9A6700',
  warningSoft: '#FFF3D0',
  danger: '#C62A2F',
  dangerSoft: '#FCE8E8',
};

const darkPalette: Palette = {
  background: '#0F1712',
  card: '#17221B',
  text: '#EDF5EF',
  muted: '#A8B5AC',
  border: '#304038',
  accent: '#3DD68C',
  success: '#3DD68C',
  successSoft: '#163C2B',
  warning: '#F2C14E',
  warningSoft: '#443717',
  danger: '#FF8D8D',
  dangerSoft: '#471F24',
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  content: { padding: 20, paddingBottom: 48, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  headerCopy: { flex: 1, gap: 5 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 13 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 30, lineHeight: 35, fontWeight: '800' },
  sectionTitle: { fontSize: 19, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  success: { fontSize: 15, fontWeight: '700' },
  code: { fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 17 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  multiline: { minHeight: 82, paddingTop: 13, textAlignVertical: 'top' },
  button: { minHeight: 48, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  buttonDimmed: { opacity: 0.58 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  pill: { minHeight: 34, borderRadius: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  pillText: { fontSize: 12, fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  metric: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  metricValue: { flexShrink: 1, textAlign: 'right', fontSize: 15, fontWeight: '700' },
  record: { borderTopWidth: 1, paddingTop: 12, gap: 4 },
  recordText: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  error: { borderRadius: 12, padding: 13 },
});
