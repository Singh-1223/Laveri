import * as Crypto from 'expo-crypto';
import type { Transaction } from '@powersync/react-native';

import { getPowerSyncDatabase } from '@/data/powersync/platform.native';

import type { CorrectionEventRow, RecordCorrectionInput } from './corrections.types';

export async function recordCorrection(target: Transaction, input: RecordCorrectionInput) {
  const occurredAt = new Date().toISOString();
  await target.execute(
    `INSERT INTO correction_events (
      id, farm_id, entity_type, record_id, action, reason,
      before_data, after_data, occurred_at, created_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Crypto.randomUUID(),
      input.farmId,
      input.entityType,
      input.recordId,
      input.action,
      input.reason?.trim() || null,
      JSON.stringify(input.before),
      input.after === undefined ? null : JSON.stringify(input.after),
      occurredAt,
      occurredAt,
      input.userId,
    ],
  );
}

export async function listCorrectionEvents(farmId: string, limit = 100): Promise<CorrectionEventRow[]> {
  const database = await getPowerSyncDatabase();
  return database.getAll<CorrectionEventRow>(
    `SELECT correction.id, correction.entity_type AS entityType,
       correction.record_id AS recordId, correction.action, correction.reason,
       correction.before_data AS beforeData, correction.after_data AS afterData,
       correction.occurred_at AS occurredAt, correction.created_by AS createdBy,
       coalesce(profile.display_name, profile.email, correction.created_by) AS createdByLabel
     FROM correction_events correction
     LEFT JOIN profiles profile ON profile.id = correction.created_by
     WHERE correction.farm_id = ?
     ORDER BY correction.occurred_at DESC, correction.id DESC
     LIMIT ?`,
    [farmId, limit],
  );
}
