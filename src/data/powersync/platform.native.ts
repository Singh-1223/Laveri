import {
  type CommonPowerSyncDatabase,
  type PowerSyncBackendConnector,
  PowerSyncDatabase,
  UpdateType,
} from '@powersync/react-native';
import * as Crypto from 'expo-crypto';

import { getEnvironmentState } from '@/config/env';
import { appSchema } from '@/data/db/schema';
import { requireSupabase } from '@/data/supabase/client';

import { conflictAlreadyApplied, patchAlreadyApplied } from './stale-patch';
import type { LocalConflict, PowerSyncSnapshot, SpikeRecord } from './types';

const database = new PowerSyncDatabase({
  schema: appSchema,
  database: { dbFilename: 'laveri.db' },
});

let initialized = false;
let connecting = false;

const UPLOADABLE_TABLES = new Set([
  'farms',
  'farm_settings',
  'milk_pricing_configs',
  'calculator_history',
  'daily_diary',
  'daily_diary_categories',
  'household_monthly_settings',
  'animals',
  'animal_labels',
  'animal_label_links',
  'animal_events',
  'lactation_records',
  'animal_photos',
  'buyers',
  'buyer_payments',
  'buyer_bill_attachments',
  'verka_billing_cycles',
  'items',
  'milk_entries',
  'milk_allocations',
  'milk_calf_allocations',
  'feed_transactions',
  'treatments',
  'treatment_animals',
  'product_transactions',
  'heat_events',
  'correction_events',
  'spike_records',
]);

const IMMUTABLE_PATCH_COLUMNS = new Set(['id', 'farm_id', 'created_at', 'created_by', 'version']);

function sanitizePatch(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !IMMUTABLE_PATCH_COLUMNS.has(key)));
}

async function saveConflict(
  target: CommonPowerSyncDatabase,
  details: {
    table: string;
    recordId: string;
    operation: string;
    message: string;
    localPayload?: unknown;
    remotePayload?: unknown;
  },
) {
  // A retried batch re-runs earlier operations; never log the same unresolved conflict twice.
  const existing = await target.getOptional<{ id: string }>(
    `SELECT id FROM sync_conflicts
     WHERE resolved_at IS NULL AND table_name = ? AND record_id = ? AND operation = ? AND message = ? AND local_payload = ?
     LIMIT 1`,
    [details.table, details.recordId, details.operation, details.message, JSON.stringify(details.localPayload ?? null)],
  );
  if (existing) return;
  await target.execute(
    `INSERT INTO sync_conflicts (
      id, table_name, record_id, operation, message,
      local_payload, remote_payload, created_at, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      Crypto.randomUUID(),
      details.table,
      details.recordId,
      details.operation,
      details.message,
      JSON.stringify(details.localPayload ?? null),
      JSON.stringify(details.remotePayload ?? null),
      new Date().toISOString(),
    ],
  );
}

class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const environment = getEnvironmentState();
    if (!environment.configured) return null;

    const { data, error } = await requireSupabase().auth.getSession();
    if (error) throw error;
    if (!data.session?.access_token) return null;

    return {
      endpoint: environment.value.powerSyncUrl,
      token: data.session.access_token,
      expiresAt: data.session.expires_at ? new Date(data.session.expires_at * 1000) : undefined,
    };
  }

  async uploadData(target: CommonPowerSyncDatabase) {
    const transaction = await target.getNextCrudTransaction();
    if (!transaction) return;

    const client = requireSupabase();
    // A label can be created independently on two offline devices. Keep the
    // first server label and remap its queued links during this upload batch.
    const labelIdRemaps = new Map<string, string>();

    for (const operation of transaction.crud) {
      if (!UPLOADABLE_TABLES.has(operation.table)) {
        throw new Error(`Upload for table ${operation.table} is not allowed by the mobile connector.`);
      }

      const record = { ...operation.opData, id: operation.id } as Record<string, unknown>;
      if (operation.table === 'animal_label_links' && typeof record.label_id === 'string') {
        record.label_id = labelIdRemaps.get(record.label_id) ?? record.label_id;
      }

      if (operation.op === UpdateType.PUT) {
        const { error } = await client.from(operation.table).insert(record);

        if (error?.code === '23505') {
          if (operation.table === 'animal_labels' && typeof record.farm_id === 'string' && typeof record.name === 'string') {
            const { data: matchingLabel, error: matchingLabelError } = await client
              .from('animal_labels')
              .select('id')
              .eq('farm_id', record.farm_id)
              .ilike('name', record.name.trim())
              .is('deleted_at', null)
              .maybeSingle();
            if (matchingLabelError) throw matchingLabelError;
            if (matchingLabel) {
              labelIdRemaps.set(operation.id, matchingLabel.id);
              continue;
            }
          }
          const { data: existing, error: readError } = await client
            .from(operation.table)
            .select('id')
            .eq('id', operation.id)
            .maybeSingle();

          if (readError) throw readError;
          if (existing) continue;
        }

        if (error) {
          if (operation.table === 'animals' && error.code === '23505') {
            const tag = typeof record.tag === 'string' ? record.tag.trim() : 'unknown';
            throw new Error(`Duplicate active animal tag “${tag}” is blocking upload. Rename or deactivate the duplicate animal, then sync again. (${error.message})`);
          }
          if (operation.table === 'animals' && error.code === '23514') {
            const tag = typeof record.tag === 'string' ? record.tag.trim() : 'unknown';
            // A failed offline PUT can be followed by a local PATCH that fixes
            // the dates. Retry the PUT with the current local row so the
            // correction can unblock the original queued insert.
            const latest = await target.get<Record<string, unknown>>('SELECT * FROM animals WHERE id = ?', [operation.id]);
            if (latest) {
              const retry = await client.from('animals').insert(latest);
              if (!retry.error) continue;
            }
            throw new Error(`Animal “${tag}” has a purchase date earlier than its birth date. Edit its two dates in Master data, then sync again. (${error.message})`);
          }
          throw error;
        }
        continue;
      }

      if (operation.op === UpdateType.PATCH) {
        const previousVersion = operation.previousValues?.version;
        if (typeof previousVersion !== 'number') {
          throw new Error('A tracked base version is required for an offline update.');
        }

        const patch = sanitizePatch(operation.opData ?? {});

        const { data: updated, error } = await client
          .from(operation.table)
          .update(patch)
          .eq('id', operation.id)
          .eq('version', previousVersion)
          .select('id, version')
          .maybeSingle();

        if (error) throw error;

        if (!updated) {
          const { data: current, error: readError } = await client
            .from(operation.table)
            .select('*')
            .eq('id', operation.id)
            .maybeSingle();

          if (readError) throw readError;

          // Already on the server (replay of a batch that partly succeeded): nothing to resolve.
          if (patchAlreadyApplied(patch, current as Record<string, unknown> | null)) continue;

          await saveConflict(target, {
            table: operation.table,
            recordId: operation.id,
            operation: operation.op,
            message: `Stale edit rejected: expected server version ${previousVersion}.`,
            localPayload: operation.opData,
            remotePayload: current,
          });
        }

        continue;
      }

      await saveConflict(target, {
        table: operation.table,
        recordId: operation.id,
        operation: operation.op,
        message: 'Hard deletes are disabled. Use a soft-delete update.',
      });
    }

    await transaction.complete();
  }
}

const connector = new SupabaseConnector();

export async function initializePowerSync() {
  if (initialized) return;
  await database.init();
  initialized = true;
}

export async function getPowerSyncDatabase() {
  await initializePowerSync();
  return database;
}

/**
 * Marks already-logged "Stale edit rejected" conflicts as resolved when the server verifiably
 * holds the same values (i.e. they came from a replayed upload batch, not a real clash).
 * Read-only against the server and non-destructive locally: rows are only stamped resolved_at,
 * never deleted, and anything that does not match stays visible for review.
 */
async function reconcileStaleConflicts() {
  const rows = await database.getAll<{ id: string; table_name: string; record_id: string; local_payload: string | null; remote_payload: string | null }>(
    `SELECT id, table_name, record_id, local_payload, remote_payload FROM sync_conflicts
     WHERE resolved_at IS NULL AND operation = ? AND message LIKE 'Stale edit rejected%'`,
    [UpdateType.PATCH],
  );
  if (rows.length === 0) return;

  const now = new Date().toISOString();
  const resolve = (id: string) => database.execute('UPDATE sync_conflicts SET resolved_at = ? WHERE id = ?', [now, id]);

  // Pass 1 (offline): the server row captured when the conflict was logged already held the edit.
  // Unaffected by later edits to the same row.
  const remaining: typeof rows = [];
  for (const row of rows) {
    if (conflictAlreadyApplied(row.local_payload, row.remote_payload)) await resolve(row.id);
    else remaining.push(row);
  }
  if (remaining.length === 0) return;

  // Pass 2 (online, read-only): compare with the current server row. Any error leaves rows untouched.
  const client = requireSupabase();
  const idsByTable = new Map<string, string[]>();
  for (const row of remaining) {
    if (!UPLOADABLE_TABLES.has(row.table_name)) continue;
    idsByTable.set(row.table_name, [...(idsByTable.get(row.table_name) ?? []), row.record_id]);
  }
  const remoteByKey = new Map<string, Record<string, unknown>>();
  for (const [table, ids] of idsByTable) {
    const unique = [...new Set(ids)];
    for (let index = 0; index < unique.length; index += 50) {
      const { data, error } = await client.from(table).select('*').in('id', unique.slice(index, index + 50));
      if (error) return;
      for (const remote of (data ?? []) as Record<string, unknown>[]) remoteByKey.set(`${table}:${String(remote.id)}`, remote);
    }
  }
  for (const row of remaining) {
    const current = remoteByKey.get(`${row.table_name}:${row.record_id}`);
    if (current && conflictAlreadyApplied(row.local_payload, null, current)) await resolve(row.id);
  }
}

export async function connectPowerSync() {
  if (database.connected || connecting) return;

  connecting = true;
  try {
    await initializePowerSync();
    await database.connect(connector);
    void reconcileStaleConflicts().catch(() => undefined);
  } finally {
    connecting = false;
  }
}

export async function disconnectPowerSync() {
  await initializePowerSync();
  await database.disconnectAndClear({ clearLocal: true });
}

/** Requests a fresh server stream without clearing local/offline records. */
export async function refreshPowerSync() {
  await initializePowerSync();
  if (database.connected) await database.disconnect();
  await connectPowerSync();
}

export async function getPowerSyncSnapshot(): Promise<PowerSyncSnapshot> {
  await initializePowerSync();

  const [membership, records, conflicts, queue] = await Promise.all([
    database.getOptional<{ farm_id: string }>(
      `SELECT farm_id FROM farm_members
       WHERE status = 'active' AND deleted_at IS NULL
       ORDER BY created_at LIMIT 1`,
    ),
    database.getAll<SpikeRecord>(
      `SELECT id, farm_id, note, version, created_at, updated_at
       FROM spike_records
       WHERE deleted_at IS NULL
       ORDER BY updated_at DESC`,
    ),
    database.getAll<LocalConflict>(
      `SELECT id, table_name, record_id, operation, message, created_at
       FROM sync_conflicts
       WHERE resolved_at IS NULL
       ORDER BY created_at DESC`,
    ),
    database.getUploadQueueStats(),
  ]);

  const status = database.currentStatus;
  return {
    available: true,
    initialized,
    connected: status.connected,
    connecting: status.connecting || connecting,
    hasSynced: status.hasSynced ?? false,
    pendingUploads: queue.count,
    lastSyncedAt: status.lastSyncedAt?.toISOString() ?? null,
    error: status.uploadError?.message ?? status.downloadError?.message ?? null,
    farmId: membership?.farm_id ?? null,
    records,
    conflicts,
  };
}

export async function createSpikeRecord(farmId: string, userId: string, note: string) {
  await initializePowerSync();
  const now = new Date().toISOString();

  await database.execute(
    `INSERT INTO spike_records (
      id, farm_id, note, created_at, updated_at,
      created_by, updated_by, deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
    [Crypto.randomUUID(), farmId, note.trim(), now, now, userId, userId],
  );
}

export async function updateSpikeRecord(record: SpikeRecord, userId: string, note: string) {
  await initializePowerSync();
  await database.execute(
    `UPDATE spike_records
     SET note = ?, updated_at = ?, updated_by = ?, version = version + 1
     WHERE id = ?`,
    [note.trim(), new Date().toISOString(), userId, record.id],
  );
}
