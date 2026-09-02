import * as Crypto from 'expo-crypto';

import { getPowerSyncDatabase } from '@/data/powersync/platform.native';
import { recordCorrection } from '@/data/repositories/corrections.native';

import type {
  CreateAnimalInput,
  CreateBuyerInput,
  CreateItemInput,
  MasterDataSnapshot,
  SetMasterRecordActiveInput,
  UpdateAnimalInput,
  UpdateBuyerInput,
  UpdateItemInput,
} from './master-data.types';

function auditValues(context: { farmId: string; userId: string }) {
  const now = new Date().toISOString();
  return [Crypto.randomUUID(), context.farmId, now, now, context.userId, context.userId] as const;
}

export async function listMasterData(): Promise<MasterDataSnapshot> {
  const database = await getPowerSyncDatabase();
  const [animals, buyers, items] = await Promise.all([
    database.getAll<MasterDataSnapshot['animals'][number]>(
      `SELECT id, tag, category, sex, status, is_milking, breed
       FROM animals WHERE deleted_at IS NULL ORDER BY status, tag COLLATE NOCASE`,
    ),
    database.getAll<MasterDataSnapshot['buyers'][number]>(
      `SELECT id, name, phone, default_rate_paise_per_litre, active
       FROM buyers WHERE deleted_at IS NULL ORDER BY active DESC, name COLLATE NOCASE`,
    ),
    database.getAll<MasterDataSnapshot['items'][number]>(
      `SELECT id, type, name, base_unit, default_rate_paise_per_unit, active
       FROM items WHERE deleted_at IS NULL ORDER BY type, active DESC, name COLLATE NOCASE`,
    ),
  ]);
  return { animals, buyers, items };
}

export async function createAnimal(input: CreateAnimalInput) {
  const database = await getPowerSyncDatabase();
  const audit = auditValues(input);
  await database.execute(
    `INSERT INTO animals (
      id, farm_id, tag, category, sex, status, is_milking, breed,
      created_at, updated_at, created_by, updated_by, deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, NULL, 1)`,
    [audit[0], audit[1], input.tag.trim(), input.category, input.sex, input.isMilking ? 1 : 0, input.breed?.trim() || null, ...audit.slice(2)],
  );
}

export async function createBuyer(input: CreateBuyerInput) {
  const database = await getPowerSyncDatabase();
  const audit = auditValues(input);
  await database.execute(
    `INSERT INTO buyers (
      id, farm_id, name, phone, default_rate_paise_per_litre, active, notes,
      created_at, updated_at, created_by, updated_by, deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, 1, NULL, ?, ?, ?, ?, NULL, 1)`,
    [audit[0], audit[1], input.name.trim(), input.phone?.trim() || null, input.defaultRatePaisePerLitre ?? null, ...audit.slice(2)],
  );
}

export async function createItem(input: CreateItemInput) {
  const database = await getPowerSyncDatabase();
  const audit = auditValues(input);
  await database.execute(
    `INSERT INTO items (
      id, farm_id, type, name, base_unit, default_rate_paise_per_unit, active, notes,
      created_at, updated_at, created_by, updated_by, deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, ?, ?, NULL, 1)`,
    [audit[0], audit[1], input.type, input.name.trim(), input.baseUnit.trim(), input.defaultRatePaisePerUnit ?? null, ...audit.slice(2)],
  );
}

export async function updateAnimal(input: UpdateAnimalInput) {
  const database = await getPowerSyncDatabase();
  await database.writeTransaction(async (transaction) => {
    const before = await transaction.get<Record<string, unknown>>(
      `SELECT * FROM animals WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
      [input.id, input.farmId],
    );
    await transaction.execute(
      `UPDATE animals
       SET tag = ?, category = ?, sex = ?, is_milking = ?, breed = ?,
           updated_at = ?, updated_by = ?, version = version + 1
       WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
      [input.tag.trim(), input.category, input.sex, input.isMilking ? 1 : 0, input.breed?.trim() || null, new Date().toISOString(), input.userId, input.id, input.farmId],
    );
    const after = await transaction.get<Record<string, unknown>>(`SELECT * FROM animals WHERE id = ?`, [input.id]);
    await recordCorrection(transaction, { farmId: input.farmId, userId: input.userId, entityType: 'animals', recordId: input.id, action: 'update', before, after });
  });
}

export async function updateBuyer(input: UpdateBuyerInput) {
  const database = await getPowerSyncDatabase();
  await database.writeTransaction(async (transaction) => {
    const before = await transaction.get<Record<string, unknown>>(`SELECT * FROM buyers WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`, [input.id, input.farmId]);
    await transaction.execute(
      `UPDATE buyers
       SET name = ?, phone = ?,
           default_rate_paise_per_litre = coalesce(?, default_rate_paise_per_litre),
           updated_at = ?, updated_by = ?, version = version + 1
       WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
      [input.name.trim(), input.phone?.trim() || null, input.defaultRatePaisePerLitre ?? null, new Date().toISOString(), input.userId, input.id, input.farmId],
    );
    const after = await transaction.get<Record<string, unknown>>(`SELECT * FROM buyers WHERE id = ?`, [input.id]);
    await recordCorrection(transaction, { farmId: input.farmId, userId: input.userId, entityType: 'buyers', recordId: input.id, action: 'update', before, after });
  });
}

export async function updateItem(input: UpdateItemInput) {
  const database = await getPowerSyncDatabase();
  await database.writeTransaction(async (transaction) => {
    const before = await transaction.get<Record<string, unknown>>(`SELECT * FROM items WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`, [input.id, input.farmId]);
    await transaction.execute(
      `UPDATE items
       SET type = ?, name = ?, base_unit = ?,
           default_rate_paise_per_unit = coalesce(?, default_rate_paise_per_unit),
           updated_at = ?, updated_by = ?, version = version + 1
       WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
      [input.type, input.name.trim(), input.baseUnit.trim(), input.defaultRatePaisePerUnit ?? null, new Date().toISOString(), input.userId, input.id, input.farmId],
    );
    const after = await transaction.get<Record<string, unknown>>(`SELECT * FROM items WHERE id = ?`, [input.id]);
    await recordCorrection(transaction, { farmId: input.farmId, userId: input.userId, entityType: 'items', recordId: input.id, action: 'update', before, after });
  });
}

export async function setMasterRecordActive(input: SetMasterRecordActiveInput) {
  const database = await getPowerSyncDatabase();
  const now = new Date().toISOString();

  if (input.kind === 'animal') {
    await database.writeTransaction(async (transaction) => {
      const before = await transaction.get<Record<string, unknown>>(`SELECT * FROM animals WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`, [input.id, input.farmId]);
      await transaction.execute(
        `UPDATE animals
         SET status = ?, is_milking = CASE WHEN ? = 0 THEN 0 ELSE is_milking END,
             updated_at = ?, updated_by = ?, version = version + 1
         WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
        [input.active ? 'active' : 'inactive', input.active ? 1 : 0, now, input.userId, input.id, input.farmId],
      );
      const after = await transaction.get<Record<string, unknown>>(`SELECT * FROM animals WHERE id = ?`, [input.id]);
      await recordCorrection(transaction, { farmId: input.farmId, userId: input.userId, entityType: 'animals', recordId: input.id, action: input.active ? 'reactivate' : 'deactivate', before, after });
    });
    return;
  }

  const table = input.kind === 'buyer' ? 'buyers' : 'items';
  await database.writeTransaction(async (transaction) => {
    const before = await transaction.get<Record<string, unknown>>(`SELECT * FROM ${table} WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`, [input.id, input.farmId]);
    await transaction.execute(
      `UPDATE ${table}
       SET active = ?, updated_at = ?, updated_by = ?, version = version + 1
       WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
      [input.active ? 1 : 0, now, input.userId, input.id, input.farmId],
    );
    const after = await transaction.get<Record<string, unknown>>(`SELECT * FROM ${table} WHERE id = ?`, [input.id]);
    await recordCorrection(transaction, { farmId: input.farmId, userId: input.userId, entityType: table, recordId: input.id, action: input.active ? 'reactivate' : 'deactivate', before, after });
  });
}
