import * as Crypto from 'expo-crypto';

import { getPowerSyncDatabase } from '@/data/powersync/platform.native';
import { recordCorrection } from '@/data/repositories/corrections.native';

import type {
  PricingSettingsSnapshot,
  CalculatorHistoryRow,
  SaveCalculatorHistoryInput,
  SaveMilkPricingConfigInput,
  SetMilkPricingModeInput,
} from './pricing.types';

export async function listCalculatorHistory(farmId: string): Promise<CalculatorHistoryRow[]> {
  const database = await getPowerSyncDatabase();
  return database.getAll<CalculatorHistoryRow>(
    `SELECT id, fat_thousandths AS fatThousandths, snf_thousandths AS snfThousandths,
      cmfat_paise AS cmFatPaise, cmsnf_paise AS cmSnfPaise,
      result_paise_per_litre AS resultPaisePerLitre, created_at AS createdAt
     FROM calculator_history WHERE farm_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 100`,
    [farmId],
  );
}

export async function saveCalculatorHistory(input: SaveCalculatorHistoryInput) {
  const values = [input.fatThousandths, input.snfThousandths, input.cmFatPaise, input.cmSnfPaise, input.resultPaisePerLitre];
  if (!values.every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error('Enter valid calculator values before saving.');
  const database = await getPowerSyncDatabase();
  const now = new Date().toISOString();
  await database.execute(
    `INSERT INTO calculator_history (
      id, farm_id, fat_thousandths, snf_thousandths, cmfat_paise, cmsnf_paise, result_paise_per_litre,
      created_at, updated_at, created_by, updated_by, deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
    [Crypto.randomUUID(), input.farmId, ...values, now, now, input.userId, input.userId],
  );
}

export async function loadPricingSettings(farmId: string): Promise<PricingSettingsSnapshot> {
  const database = await getPowerSyncDatabase();
  const [settings, configs] = await Promise.all([
    database.getOptional<{ milk_mode: PricingSettingsSnapshot['mode'] }>(
      `SELECT milk_mode FROM farm_settings WHERE farm_id = ? AND deleted_at IS NULL LIMIT 1`,
      [farmId],
    ),
    database.getAll<PricingSettingsSnapshot['configs'][number]>(
      `SELECT id, mode, effective_from AS effectiveFrom, effective_to AS effectiveTo,
         flat_rate_paise_per_litre AS flatRatePaisePerLitre,
         cmfat_paise AS cmFatPaise, cmsnf_paise AS cmSnfPaise
       FROM milk_pricing_configs
       WHERE farm_id = ? AND buyer_id IS NULL AND deleted_at IS NULL
       ORDER BY effective_from DESC, updated_at DESC`,
      [farmId],
    ),
  ]);
  return { mode: settings?.milk_mode ?? 'flat', configs };
}

export async function setMilkPricingMode(input: SetMilkPricingModeInput) {
  const database = await getPowerSyncDatabase();
  await database.writeTransaction(async (transaction) => {
    const before = await transaction.get<Record<string, unknown>>(
      `SELECT * FROM farm_settings WHERE farm_id = ? AND deleted_at IS NULL`,
      [input.farmId],
    );
    if (before.milk_mode === input.mode) return;
    await transaction.execute(
      `UPDATE farm_settings
       SET milk_mode = ?, updated_at = ?, updated_by = ?, version = version + 1
       WHERE farm_id = ? AND deleted_at IS NULL`,
      [input.mode, new Date().toISOString(), input.userId, input.farmId],
    );
    const after = await transaction.get<Record<string, unknown>>(
      `SELECT * FROM farm_settings WHERE farm_id = ? AND deleted_at IS NULL`,
      [input.farmId],
    );
    await recordCorrection(transaction, {
      farmId: input.farmId,
      userId: input.userId,
      entityType: 'farm_settings',
      recordId: String(before.id),
      action: 'update',
      before,
      after,
    });
  });
}

export async function saveMilkPricingConfig(input: SaveMilkPricingConfigInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) throw new Error('Use a valid effective date.');
  if (input.mode === 'flat' && (!Number.isSafeInteger(input.flatRatePaisePerLitre) || (input.flatRatePaisePerLitre ?? -1) < 0)) {
    throw new Error('Enter a valid flat rate.');
  }
  if (input.mode === 'quality' && (
    !Number.isSafeInteger(input.cmFatPaise) || (input.cmFatPaise ?? -1) < 0
    || !Number.isSafeInteger(input.cmSnfPaise) || (input.cmSnfPaise ?? -1) < 0
  )) throw new Error('Enter valid CMFAT and CMSNF values.');

  const database = await getPowerSyncDatabase();
  const now = new Date().toISOString();
  await database.writeTransaction(async (transaction) => {
    const existing = await transaction.getOptional<Record<string, unknown>>(
      `SELECT * FROM milk_pricing_configs
       WHERE farm_id = ? AND mode = ? AND effective_from = ?
         AND buyer_id IS NULL AND deleted_at IS NULL
       ORDER BY updated_at DESC LIMIT 1`,
      [input.farmId, input.mode, input.effectiveFrom],
    );
    const values = input.mode === 'flat'
      ? [input.flatRatePaisePerLitre, null, null]
      : [null, input.cmFatPaise, input.cmSnfPaise];

    if (!existing) {
      await transaction.execute(
        `INSERT INTO milk_pricing_configs (
          id, farm_id, mode, effective_from, effective_to, buyer_id,
          flat_rate_paise_per_litre, cmfat_paise, cmsnf_paise,
          created_at, updated_at, created_by, updated_by, deleted_at, version
        ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
        [Crypto.randomUUID(), input.farmId, input.mode, input.effectiveFrom, ...values, now, now, input.userId, input.userId],
      );
      return;
    }

    const id = String(existing.id);
    await transaction.execute(
      `UPDATE milk_pricing_configs
       SET flat_rate_paise_per_litre = ?, cmfat_paise = ?, cmsnf_paise = ?,
           updated_at = ?, updated_by = ?, version = version + 1
       WHERE id = ?`,
      [...values, now, input.userId, id],
    );
    const after = await transaction.get<Record<string, unknown>>(`SELECT * FROM milk_pricing_configs WHERE id = ?`, [id]);
    await recordCorrection(transaction, {
      farmId: input.farmId,
      userId: input.userId,
      entityType: 'milk_pricing_configs',
      recordId: id,
      action: 'update',
      before: existing,
      after,
    });
  });
}
