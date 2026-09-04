import * as Crypto from 'expo-crypto';

import { getPowerSyncDatabase } from '@/data/powersync/platform.native';
import { recordCorrection } from '@/data/repositories/corrections.native';

import type {
  CreateAnimalInput,
  CreateAnimalLabelInput,
  DeleteAnimalLabelInput,
  DeleteItemInput,
  CreateBuyerInput,
  CreateItemInput,
  MasterDataSnapshot,
  SetAnimalLabelsInput,
  ReorderMasterRecordInput,
  SetMasterRecordActiveInput,
  UpdateAnimalInput,
  UpdateAnimalLabelInput,
  UpdateBuyerInput,
  UpdateItemInput,
} from './master-data.types';

function auditValues(context: { farmId: string; userId: string }) {
  const now = new Date().toISOString();
  return [Crypto.randomUUID(), context.farmId, now, now, context.userId, context.userId] as const;
}

export async function listMasterData(): Promise<MasterDataSnapshot> {
  const database = await getPowerSyncDatabase();
  const [animals, buyers, items, animalLabels, animalLabelLinks] = await Promise.all([
    database.getAll<MasterDataSnapshot['animals'][number]>(
      `SELECT id, tag, category, sex, status, is_milking, breed, display_order,
        (SELECT storage_path FROM animal_photos photo WHERE photo.animal_id = animals.id AND photo.deleted_at IS NULL ORDER BY photo.created_at DESC LIMIT 1) AS primary_photo_path
       FROM animals WHERE deleted_at IS NULL ORDER BY display_order, tag COLLATE NOCASE`,
    ),
    database.getAll<MasterDataSnapshot['buyers'][number]>(
      `SELECT id, name, phone, default_rate_paise_per_litre, active, display_order
       FROM buyers WHERE deleted_at IS NULL ORDER BY display_order, name COLLATE NOCASE`,
    ),
    database.getAll<MasterDataSnapshot['items'][number]>(
      `SELECT id, type, name, base_unit, default_rate_paise_per_unit, active, notes
       FROM items WHERE deleted_at IS NULL ORDER BY type, active DESC, name COLLATE NOCASE`,
    ),
    database.getAll<MasterDataSnapshot['animalLabels'][number]>(`SELECT id, name, color FROM animal_labels WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE`),
    database.getAll<MasterDataSnapshot['animalLabelLinks'][number]>(`SELECT animal_id, label_id FROM animal_label_links WHERE deleted_at IS NULL`),
  ]);
  return { animals, buyers, items, animalLabels, animalLabelLinks };
}

export async function createAnimal(input: CreateAnimalInput) {
  const database = await getPowerSyncDatabase();
  const audit = auditValues(input);
  await database.execute(
    `INSERT INTO animals (
      id, farm_id, tag, category, sex, status, is_milking, breed, birth_date, acquisition_date, display_order, milk_display_order,
      created_at, updated_at, created_by, updated_by, deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, (SELECT coalesce(max(display_order), 0) + 1 FROM animals WHERE farm_id = ?), (SELECT coalesce(max(milk_display_order), 0) + 1 FROM animals WHERE farm_id = ?), ?, ?, ?, ?, NULL, 1)`,
    [audit[0], audit[1], input.tag.trim(), input.category, input.sex, input.isMilking ? 1 : 0, input.breed?.trim() || null, input.birthDate ?? null, input.acquisitionDate ?? null, input.farmId, input.farmId, ...audit.slice(2)],
  );
  return audit[0];
}

export async function createAnimalLabel(input: CreateAnimalLabelInput) {
  const database = await getPowerSyncDatabase();
  const name = input.name.trim();
  const existing = await database.getOptional<{ id: string }>(
    `SELECT id FROM animal_labels
     WHERE farm_id = ? AND lower(trim(name)) = lower(trim(?)) AND deleted_at IS NULL
     LIMIT 1`,
    [input.farmId, name],
  );
  if (existing) return existing.id;
  const audit = auditValues(input);
  await database.execute(
    `INSERT INTO animal_labels (id, farm_id, name, color, created_at, updated_at, created_by, updated_by, deleted_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
    [audit[0], audit[1], name, input.color, ...audit.slice(2)],
  );
  return audit[0];
}

export async function updateAnimalLabel(input: UpdateAnimalLabelInput) {
  const database = await getPowerSyncDatabase();
  await database.execute(
    `UPDATE animal_labels SET name = ?, color = ?, updated_at = ?, updated_by = ?, version = version + 1
     WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
    [input.name.trim(), input.color, new Date().toISOString(), input.userId, input.id, input.farmId],
  );
}

export async function deleteAnimalLabel(input: DeleteAnimalLabelInput) {
  const database = await getPowerSyncDatabase();
  const now = new Date().toISOString();
  await database.execute(
    `UPDATE animal_labels SET deleted_at = ?, updated_at = ?, updated_by = ?, version = version + 1
     WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
    [now, now, input.userId, input.id, input.farmId],
  );
}

export async function deleteItem(input: DeleteItemInput) {
  const database = await getPowerSyncDatabase();
  const now = new Date().toISOString();
  await database.execute(
    `UPDATE items SET deleted_at = ?, updated_at = ?, updated_by = ?, version = version + 1
     WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
    [now, now, input.userId, input.id, input.farmId],
  );
}

export async function setAnimalLabels(input: SetAnimalLabelsInput) {
  const database = await getPowerSyncDatabase();
  const targetIds = [...new Set(input.labelIds)];
  const now = new Date().toISOString();
  await database.writeTransaction(async (transaction) => {
    const existing = await transaction.getAll<{ id: string; label_id: string }>(
      `SELECT id, label_id FROM animal_label_links WHERE farm_id = ? AND animal_id = ? AND deleted_at IS NULL`,
      [input.farmId, input.animalId],
    );
    for (const link of existing.filter((link) => !targetIds.includes(link.label_id))) {
      await transaction.execute(`UPDATE animal_label_links SET deleted_at = ?, updated_at = ?, updated_by = ?, version = version + 1 WHERE id = ?`, [now, now, input.userId, link.id]);
    }
    for (const labelId of targetIds.filter((labelId) => !existing.some((link) => link.label_id === labelId))) {
      await transaction.execute(
        `INSERT INTO animal_label_links (id, farm_id, animal_id, label_id, created_at, updated_at, created_by, updated_by, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
        [Crypto.randomUUID(), input.farmId, input.animalId, labelId, now, now, input.userId, input.userId],
      );
    }
  });
}

export async function createBuyer(input: CreateBuyerInput) {
  const database = await getPowerSyncDatabase();
  const audit = auditValues(input);
  await database.execute(
    `INSERT INTO buyers (
      id, farm_id, name, phone, default_rate_paise_per_litre, active, notes, display_order,
      created_at, updated_at, created_by, updated_by, deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, 1, NULL, (SELECT coalesce(max(display_order), 0) + 1 FROM buyers WHERE farm_id = ?), ?, ?, ?, ?, NULL, 1)`,
    [audit[0], audit[1], input.name.trim(), input.phone?.trim() || null, input.defaultRatePaisePerLitre ?? null, input.farmId, ...audit.slice(2)],
  );
}

export async function createItem(input: CreateItemInput) {
  const database = await getPowerSyncDatabase();
  const audit = auditValues(input);
  await database.execute(
    `INSERT INTO items (
      id, farm_id, type, name, base_unit, default_rate_paise_per_unit, active, notes,
      created_at, updated_at, created_by, updated_by, deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, NULL, 1)`,
    [audit[0], audit[1], input.type, input.name.trim(), input.baseUnit.trim(), input.defaultRatePaisePerUnit ?? null, input.notes?.trim() || null, ...audit.slice(2)],
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
       SET tag = ?, category = ?, sex = ?, is_milking = ?, breed = ?, birth_date = ?, acquisition_date = ?,
           updated_at = ?, updated_by = ?, version = version + 1
       WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
      [input.tag.trim(), input.category, input.sex, input.isMilking ? 1 : 0, input.breed?.trim() || null, input.birthDate ?? null, input.acquisitionDate ?? null, new Date().toISOString(), input.userId, input.id, input.farmId],
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
           default_rate_paise_per_litre = ?,
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
       SET type = ?, name = ?, base_unit = ?, notes = ?,
           default_rate_paise_per_unit = coalesce(?, default_rate_paise_per_unit),
           updated_at = ?, updated_by = ?, version = version + 1
       WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
      [input.type, input.name.trim(), input.baseUnit.trim(), input.notes?.trim() || null, input.defaultRatePaisePerUnit ?? null, new Date().toISOString(), input.userId, input.id, input.farmId],
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

export async function reorderMasterRecord(input: ReorderMasterRecordInput) {
  const database = await getPowerSyncDatabase();
  const table = input.kind === 'animal' ? 'animals' : 'buyers';
  const nameColumn = input.kind === 'animal' ? 'tag' : 'name';
  await database.writeTransaction(async (transaction) => {
    const rows = await transaction.getAll<{ id: string; display_order: number }>(
      `SELECT id, display_order FROM ${table}
       WHERE farm_id = ? AND deleted_at IS NULL
       ORDER BY display_order, ${nameColumn} COLLATE NOCASE`,
      [input.farmId],
    );
    const index = rows.findIndex((row) => row.id === input.id);
    const swapIndex = input.direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= rows.length) return;

    const current = rows[index];
    const adjacent = rows[swapIndex];
    const before = { current, adjacent };
    const now = new Date().toISOString();
    await transaction.execute(
      `UPDATE ${table} SET display_order = ?, updated_at = ?, updated_by = ?, version = version + 1 WHERE id = ? AND farm_id = ?`,
      [adjacent.display_order, now, input.userId, current.id, input.farmId],
    );
    await transaction.execute(
      `UPDATE ${table} SET display_order = ?, updated_at = ?, updated_by = ?, version = version + 1 WHERE id = ? AND farm_id = ?`,
      [current.display_order, now, input.userId, adjacent.id, input.farmId],
    );
    const after = await transaction.getAll<Record<string, unknown>>(
      `SELECT id, display_order FROM ${table} WHERE id IN (?, ?) ORDER BY display_order`,
      [current.id, adjacent.id],
    );
    await recordCorrection(transaction, { farmId: input.farmId, userId: input.userId, entityType: table, recordId: current.id, action: 'reorder', before, after });
  });
}
