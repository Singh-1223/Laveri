import * as Crypto from 'expo-crypto';
import {
  type CommonPowerSyncDatabase,
  PowerSyncDatabase,
  type PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/react-native';

import { getEnvironmentState } from '@/config/env';
import { appSchema } from '@/data/db/schema';
import { requireSupabase } from '@/data/supabase/client';

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
  'animals',
  'animal_labels',
  'animal_label_links',
  'buyers',
  'items',
  'milk_entries',
  'milk_allocations',
  'feed_transactions',
  'treatments',
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

    for (const operation of transaction.crud) {
      if (!UPLOADABLE_TABLES.has(operation.table)) {
        throw new Error(`Upload for table ${operation.table} is not allowed by the mobile connector.`);
      }

      const record = { ...operation.opData, id: operation.id };

      if (operation.op === UpdateType.PUT) {
        const { error } = await client.from(operation.table).insert(record);

        if (error?.code === '23505') {
          const { data: existing, error: readError } = await client
            .from(operation.table)
            .select('id')
            .eq('id', operation.id)
            .maybeSingle();

          if (readError) throw readError;
          if (existing) continue;
        }

        if (error) throw error;
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

export async function connectPowerSync() {
  if (database.connected || connecting) return;

  connecting = true;
  try {
    await initializePowerSync();
    await database.connect(connector);
  } finally {
    connecting = false;
  }
}

export async function disconnectPowerSync() {
  await initializePowerSync();
  await database.disconnectAndClear({ clearLocal: true });
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
