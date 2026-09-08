import * as Crypto from 'expo-crypto';

import { getPowerSyncDatabase } from '@/data/powersync/platform.native';
import { recordCorrection } from '@/data/repositories/corrections.native';
import { calculateQuantityAmountPaise, calculateTreatmentTotalPaise } from '@/domain/calculations';

import type { CorrectionEntity } from './corrections.types';

import type {
  CreateFeedInput,
  CreateHeatInput,
  CreateOtherEventInput,
  CreateProductInput,
  CreateTreatmentInput,
  OperationHistoryRow,
  OperationKind,
  UpdateFeedInput,
  UpdateHeatInput,
  UpdateProductInput,
  UpdateTreatmentInput,
  VoidOperationInput,
} from './operations.types';

const operationTables: Record<OperationKind, CorrectionEntity> = {
  feed: 'feed_transactions',
  treatment: 'treatments',
  product: 'product_transactions',
  silage: 'product_transactions',
  investment: 'product_transactions',
  heat: 'heat_events',
  other: 'animals',
};

function auditedId(input: { farmId: string; userId: string }) {
  return { id: Crypto.randomUUID(), now: new Date().toISOString(), ...input };
}

export async function listRecentOperations(farmId: string, limit = 50): Promise<OperationHistoryRow[]> {
  const database = await getPowerSyncDatabase();
  return database.getAll<OperationHistoryRow>(
    `SELECT * FROM (
      SELECT feed.id, 'feed' AS kind, feed.transaction_date AS businessDate,
        item.name AS title, coalesce(animal.tag, feed.animal_category, 'Farm-wide') AS detail,
        feed.amount_paise AS amountPaise,
        CASE WHEN feed.deleted_at IS NULL THEN 0 ELSE 1 END AS isVoided,
        feed.void_reason AS voidReason,
        feed.animal_id AS animalId, feed.item_id AS itemId,
        feed.quantity_milli_units AS quantityMilliUnits, feed.unit_code AS unitCode,
        feed.rate_paise_per_unit AS ratePaisePerUnit,
        NULL AS doctorFeePaise, NULL AS medicineCostPaise,
        feed.notes AS notes, NULL AS productCategory, feed.created_at AS createdAt
      FROM feed_transactions feed
      JOIN items item ON item.id = feed.item_id
      LEFT JOIN animals animal ON animal.id = feed.animal_id
      WHERE feed.farm_id = ?

      UNION ALL

      SELECT treatment.id, 'treatment' AS kind, treatment.treatment_date AS businessDate,
        coalesce(item.name, 'Treatment') AS title, animal.tag AS detail,
        treatment.total_paise AS amountPaise,
        CASE WHEN treatment.deleted_at IS NULL THEN 0 ELSE 1 END AS isVoided,
        treatment.void_reason AS voidReason,
        treatment.animal_id AS animalId, treatment.medicine_item_id AS itemId,
        NULL AS quantityMilliUnits, NULL AS unitCode, NULL AS ratePaisePerUnit,
        treatment.doctor_fee_paise AS doctorFeePaise,
        treatment.medicine_cost_paise AS medicineCostPaise,
        treatment.notes AS notes, NULL AS productCategory, treatment.created_at AS createdAt
      FROM treatments treatment
      JOIN animals animal ON animal.id = treatment.animal_id
      LEFT JOIN items item ON item.id = treatment.medicine_item_id
      WHERE treatment.farm_id = ?

      UNION ALL

      SELECT product.id, CASE WHEN product.category = 'investment' THEN 'investment' WHEN product.category = 'silage' THEN 'silage' ELSE 'product' END AS kind, product.transaction_date AS businessDate,
        coalesce(item.name, CASE WHEN product.category = 'investment' THEN 'Investment' WHEN product.category = 'silage' THEN 'Silage' ELSE 'Product' END) AS title, product.category AS detail,
        product.amount_paise AS amountPaise,
        CASE WHEN product.deleted_at IS NULL THEN 0 ELSE 1 END AS isVoided,
        product.void_reason AS voidReason,
        product.animal_id AS animalId, product.item_id AS itemId,
        product.quantity_milli_units AS quantityMilliUnits, product.unit_code AS unitCode,
        product.rate_paise_per_unit AS ratePaisePerUnit,
        NULL AS doctorFeePaise, NULL AS medicineCostPaise,
        product.notes AS notes, product.category AS productCategory, product.created_at AS createdAt
      FROM product_transactions product
      LEFT JOIN items item ON item.id = product.item_id
      WHERE product.farm_id = ?
    ) operations
    ORDER BY businessDate DESC, createdAt DESC
    LIMIT ?`,
    [farmId, farmId, farmId, limit],
  );
}

export async function createFeedTransaction(input: CreateFeedInput) {
  const database = await getPowerSyncDatabase();
  const audit = auditedId(input);
  const amountPaise = calculateQuantityAmountPaise(input.quantityMilliUnits, input.ratePaisePerUnit);
  await database.execute(
    `INSERT INTO feed_transactions (
      id, farm_id, transaction_date, animal_id, animal_category, item_id,
      quantity_milli_units, unit_code, rate_paise_per_unit, amount_paise,
      supplier, notes, void_reason, created_at, updated_at,
      created_by, updated_by, deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, NULL, 1)`,
    [audit.id, input.farmId, input.businessDate, input.animalId, input.animalCategory, input.itemId, input.quantityMilliUnits, input.unitCode, input.ratePaisePerUnit, amountPaise, input.notes?.trim() || null, audit.now, audit.now, input.userId, input.userId],
  );
}

export async function createTreatment(input: CreateTreatmentInput) {
  const database = await getPowerSyncDatabase();
  const audit = auditedId(input);
  const animalIds = [...new Set(input.animalIds)];
  if (animalIds.length === 0) throw new Error('Select at least one animal for treatment.');
  const totalPaise = calculateTreatmentTotalPaise(input.doctorFeePaise, input.medicineCostPaise);
  const treatedAt = new Date(`${input.businessDate}T12:00:00`).toISOString();
  await database.writeTransaction(async (transaction) => {
    await transaction.execute(
    `INSERT INTO treatments (
      id, farm_id, treatment_date, treated_at, animal_id, medicine_item_id,
      dose_milli_units, dose_unit, doctor_fee_paise, medicine_cost_paise,
      total_paise, notes, void_reason, created_at, updated_at,
      created_by, updated_by, deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL, 1)`,
      [audit.id, input.farmId, input.businessDate, treatedAt, animalIds[0], input.medicineItemId, input.doseMilliUnits, input.doseUnit, input.doctorFeePaise, input.medicineCostPaise, totalPaise, input.notes?.trim() || null, audit.now, audit.now, input.userId, input.userId],
    );
    for (const animalId of animalIds) {
      await transaction.execute(`INSERT INTO treatment_animals (id, farm_id, treatment_id, animal_id, created_at, updated_at, created_by, updated_by, deleted_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`, [Crypto.randomUUID(), input.farmId, audit.id, animalId, audit.now, audit.now, input.userId, input.userId]);
    }
  });
}

export async function createProductTransaction(input: CreateProductInput) {
  const database = await getPowerSyncDatabase();
  const audit = auditedId(input);
  const amountPaise = calculateQuantityAmountPaise(input.quantityMilliUnits, input.ratePaisePerUnit);
  await database.execute(
    `INSERT INTO product_transactions (
      id, farm_id, transaction_date, animal_id, animal_category, item_id,
      category, quantity_milli_units, unit_code, rate_paise_per_unit,
      amount_paise, supplier, notes, void_reason, created_at, updated_at,
      created_by, updated_by, deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, NULL, 1)`,
    [audit.id, input.farmId, input.businessDate, input.animalId, input.animalCategory, input.itemId, input.category, input.quantityMilliUnits, input.unitCode, input.ratePaisePerUnit, amountPaise, input.notes?.trim() || null, audit.now, audit.now, input.userId, input.userId],
  );
}

export async function createHeatEvent(input: CreateHeatInput) {
  const database = await getPowerSyncDatabase();
  const audit = auditedId(input);
  const observedAt = new Date(`${input.businessDate}T12:00:00`).toISOString();
  await database.execute(
    `INSERT INTO heat_events (
      id, farm_id, animal_id, observed_at, signs, status, follow_up_at,
      notes, void_reason, created_at, updated_at, created_by, updated_by,
      deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, 'observed', NULL, ?, NULL, ?, ?, ?, ?, NULL, 1)`,
    [audit.id, input.farmId, input.animalId, observedAt, input.signs?.trim() || null, input.notes?.trim() || null, audit.now, audit.now, input.userId, input.userId],
  );
}

export async function createOtherEvents(input: CreateOtherEventInput) {
  if (!input.animalIds.length) throw new Error('Select at least one animal.');
  const database = await getPowerSyncDatabase(); const now = new Date().toISOString();
  await database.writeTransaction(async (transaction) => {
    for (const animalId of input.animalIds) await transaction.execute(
      `INSERT INTO animal_events (id,farm_id,animal_id,event_date,kind,title,notes,cost_paise,created_at,updated_at,created_by,updated_by,deleted_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL,1)`,
      [Crypto.randomUUID(), input.farmId, animalId, input.businessDate, 'other', input.eventType?.trim() || 'Other event', input.notes?.trim() || null, input.costPaise ?? null, now, now, input.userId, input.userId],
    );
  });
}

export async function updateFeedTransaction(input: UpdateFeedInput) {
  const database = await getPowerSyncDatabase();
  const amountPaise = calculateQuantityAmountPaise(input.quantityMilliUnits, input.ratePaisePerUnit);
  await database.writeTransaction(async (transaction) => {
    const before = await transaction.get<Record<string, unknown>>(`SELECT * FROM feed_transactions WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`, [input.id, input.farmId]);
    await transaction.execute(
      `UPDATE feed_transactions
       SET transaction_date = ?, animal_id = ?, animal_category = ?, item_id = ?,
           quantity_milli_units = ?, unit_code = ?, rate_paise_per_unit = ?,
           amount_paise = ?, notes = ?, updated_at = ?, updated_by = ?, version = version + 1
       WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
      [input.businessDate, input.animalId, input.animalCategory, input.itemId, input.quantityMilliUnits, input.unitCode, input.ratePaisePerUnit, amountPaise, input.notes?.trim() || null, new Date().toISOString(), input.userId, input.id, input.farmId],
    );
    const after = await transaction.get<Record<string, unknown>>(`SELECT * FROM feed_transactions WHERE id = ?`, [input.id]);
    await recordCorrection(transaction, { farmId: input.farmId, userId: input.userId, entityType: 'feed_transactions', recordId: input.id, action: 'update', before, after });
  });
}

export async function updateTreatment(input: UpdateTreatmentInput) {
  const database = await getPowerSyncDatabase();
  const totalPaise = calculateTreatmentTotalPaise(input.doctorFeePaise, input.medicineCostPaise);
  const treatedAt = new Date(`${input.businessDate}T12:00:00`).toISOString();
  await database.writeTransaction(async (transaction) => {
    const before = await transaction.get<Record<string, unknown>>(`SELECT * FROM treatments WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`, [input.id, input.farmId]);
    await transaction.execute(
      `UPDATE treatments
       SET treatment_date = ?, treated_at = ?, animal_id = ?, medicine_item_id = ?,
           doctor_fee_paise = ?, medicine_cost_paise = ?, total_paise = ?, notes = ?,
           updated_at = ?, updated_by = ?, version = version + 1
       WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
      [input.businessDate, treatedAt, input.animalId, input.medicineItemId, input.doctorFeePaise, input.medicineCostPaise, totalPaise, input.notes?.trim() || null, new Date().toISOString(), input.userId, input.id, input.farmId],
    );
    const after = await transaction.get<Record<string, unknown>>(`SELECT * FROM treatments WHERE id = ?`, [input.id]);
    await recordCorrection(transaction, { farmId: input.farmId, userId: input.userId, entityType: 'treatments', recordId: input.id, action: 'update', before, after });
  });
}

export async function updateProductTransaction(input: UpdateProductInput) {
  const database = await getPowerSyncDatabase();
  const amountPaise = calculateQuantityAmountPaise(input.quantityMilliUnits, input.ratePaisePerUnit);
  await database.writeTransaction(async (transaction) => {
    const before = await transaction.get<Record<string, unknown>>(`SELECT * FROM product_transactions WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`, [input.id, input.farmId]);
    await transaction.execute(
      `UPDATE product_transactions
       SET transaction_date = ?, animal_id = ?, animal_category = ?, item_id = ?,
           category = ?, quantity_milli_units = ?, unit_code = ?, rate_paise_per_unit = ?,
           amount_paise = ?, notes = ?, updated_at = ?, updated_by = ?, version = version + 1
       WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
      [input.businessDate, input.animalId, input.animalCategory, input.itemId, input.category, input.quantityMilliUnits, input.unitCode, input.ratePaisePerUnit, amountPaise, input.notes?.trim() || null, new Date().toISOString(), input.userId, input.id, input.farmId],
    );
    const after = await transaction.get<Record<string, unknown>>(`SELECT * FROM product_transactions WHERE id = ?`, [input.id]);
    await recordCorrection(transaction, { farmId: input.farmId, userId: input.userId, entityType: 'product_transactions', recordId: input.id, action: 'update', before, after });
  });
}

export async function updateHeatEvent(input: UpdateHeatInput) {
  const database = await getPowerSyncDatabase();
  const observedAt = new Date(`${input.businessDate}T12:00:00`).toISOString();
  await database.writeTransaction(async (transaction) => {
    const before = await transaction.get<Record<string, unknown>>(`SELECT * FROM heat_events WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`, [input.id, input.farmId]);
    await transaction.execute(
      `UPDATE heat_events
       SET animal_id = ?, observed_at = ?, signs = ?, notes = ?,
           updated_at = ?, updated_by = ?, version = version + 1
       WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
      [input.animalId, observedAt, input.signs?.trim() || null, input.notes?.trim() || null, new Date().toISOString(), input.userId, input.id, input.farmId],
    );
    const after = await transaction.get<Record<string, unknown>>(`SELECT * FROM heat_events WHERE id = ?`, [input.id]);
    await recordCorrection(transaction, { farmId: input.farmId, userId: input.userId, entityType: 'heat_events', recordId: input.id, action: 'update', before, after });
  });
}

export async function voidOperation(input: VoidOperationInput) {
  const reason = input.reason.trim();
  if (!reason) throw new Error('A reason is required to void a record.');

  const database = await getPowerSyncDatabase();
  const table = operationTables[input.kind];
  const now = new Date().toISOString();
  await database.writeTransaction(async (transaction) => {
    const before = await transaction.get<Record<string, unknown>>(`SELECT * FROM ${table} WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`, [input.id, input.farmId]);
    await transaction.execute(
      `UPDATE ${table}
       SET void_reason = ?, deleted_at = ?, updated_at = ?, updated_by = ?,
           version = version + 1
       WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
      [reason, now, now, input.userId, input.id, input.farmId],
    );
    const after = await transaction.get<Record<string, unknown>>(`SELECT * FROM ${table} WHERE id = ?`, [input.id]);
    await recordCorrection(transaction, { farmId: input.farmId, userId: input.userId, entityType: table, recordId: input.id, action: 'void', reason, before, after });
  });
}
