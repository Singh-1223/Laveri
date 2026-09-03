import * as Crypto from 'expo-crypto';

import { getPowerSyncDatabase } from '@/data/powersync/platform.native';
import { recordCorrection } from '@/data/repositories/corrections.native';
import { calculateFlatMilkAmountPaise } from '@/domain/calculations';

import type { MilkLaunchTarget, MilkSessionSnapshot, SaveMilkSessionInput, VoidMilkSessionInput } from './milk.types';

function todayAtFarm(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export async function getMilkLaunchTarget(farmId: string): Promise<MilkLaunchTarget> {
  const database = await getPowerSyncDatabase();
  const activeAnimals = await database.getOptional<{ count: number }>(
    `SELECT count(*) AS count FROM animals
     WHERE farm_id = ? AND status = 'active' AND is_milking = 1 AND deleted_at IS NULL`,
    [farmId],
  );
  const animalCount = activeAnimals?.count ?? 0;
  const incomplete = animalCount > 0 ? await database.getOptional<MilkLaunchTarget>(
    `SELECT entry.milk_date AS milkDate, entry.session
     FROM milk_entries entry
     WHERE entry.farm_id = ? AND entry.deleted_at IS NULL
     GROUP BY entry.milk_date, entry.session
     HAVING count(distinct entry.animal_id) < ?
     ORDER BY entry.milk_date DESC,
       CASE entry.session WHEN 'evening' THEN 1 ELSE 0 END DESC
     LIMIT 1`,
    [farmId, animalCount],
  ) : null;
  if (incomplete) return incomplete;

  const now = new Date();
  return { milkDate: todayAtFarm(), session: now.getHours() < 12 ? 'morning' : 'evening' };
}

export async function loadMilkSession(
  farmId: string,
  milkDate: string,
  session: 'morning' | 'evening',
): Promise<MilkSessionSnapshot> {
  const database = await getPowerSyncDatabase();
  const [entries, buyerAllocations, householdAllocation] = await Promise.all([
    database.getAll<MilkSessionSnapshot['entries'][number]>(
      `SELECT
        animal.id AS animalId,
        animal.tag,
        animal.category,
        entry.id AS entryId,
        entry.volume_ml AS volumeMl,
        entry.pricing_mode AS pricingMode,
        entry.flat_rate_paise_per_litre AS flatRatePaisePerLitre,
        entry.fat_hundredths AS fatHundredths,
        entry.snf_hundredths AS snfHundredths,
        entry.cmfat_paise AS cmFatPaise,
        entry.cmsnf_paise AS cmSnfPaise,
        entry.calculated_rate_paise_per_litre AS ratePaisePerLitre,
        entry.state
      FROM animals animal
      LEFT JOIN milk_entries entry
        ON entry.animal_id = animal.id
        AND entry.milk_date = ?
        AND entry.session = ?
        AND entry.deleted_at IS NULL
      WHERE animal.farm_id = ?
        AND animal.deleted_at IS NULL
        AND ((animal.status = 'active' AND animal.is_milking = 1) OR entry.id IS NOT NULL)
      ORDER BY animal.tag COLLATE NOCASE`,
      [milkDate, session, farmId],
    ),
    database.getAll<MilkSessionSnapshot['allocations'][number]>(
      `SELECT
        buyer.id AS key,
        allocation.id AS allocationId,
        'buyer' AS destination,
        buyer.id AS buyerId,
        buyer.name AS label,
        allocation.volume_ml AS volumeMl,
        coalesce(allocation.rate_paise_per_litre, buyer.default_rate_paise_per_litre) AS ratePaisePerLitre
       FROM buyers buyer
       LEFT JOIN milk_allocations allocation
         ON allocation.buyer_id = buyer.id
         AND allocation.milk_date = ?
         AND allocation.session = ?
         AND allocation.destination = 'buyer'
         AND allocation.deleted_at IS NULL
       WHERE buyer.farm_id = ?
         AND buyer.deleted_at IS NULL
         AND (buyer.active = 1 OR allocation.id IS NOT NULL)
       ORDER BY buyer.name COLLATE NOCASE`,
      [milkDate, session, farmId],
    ),
    database.getOptional<{
      id: string;
      volume_ml: number;
      rate_paise_per_litre: number;
    }>(
      `SELECT id, volume_ml, rate_paise_per_litre
       FROM milk_allocations
       WHERE farm_id = ?
         AND milk_date = ?
         AND session = ?
         AND destination = 'household'
         AND deleted_at IS NULL
       LIMIT 1`,
      [farmId, milkDate, session],
    ),
  ]);

  return {
    entries,
    allocations: [
      ...buyerAllocations,
      {
        key: 'household',
        allocationId: householdAllocation?.id ?? null,
        destination: 'household',
        buyerId: null,
        label: 'Household consumption',
        volumeMl: householdAllocation?.volume_ml ?? null,
        ratePaisePerLitre: householdAllocation?.rate_paise_per_litre ?? null,
      },
    ],
    pricingMode: 'flat',
    suggestedRatePaisePerLitre: null,
    suggestedCmFatPaise: null,
    suggestedCmSnfPaise: null,
  };
}

export async function saveMilkSession(input: SaveMilkSessionInput) {
  const database = await getPowerSyncDatabase();
  const now = new Date().toISOString();
  if (input.pricingMode !== 'flat' || input.flatRatePaisePerLitre !== 0 || input.ratePaisePerLitre !== 0) {
    throw new Error('Milk production no longer stores a shared sales rate.');
  }
  const isCorrection = input.entries.some((entry) => entry.entryId !== null)
    || input.allocations.some((allocation) => allocation.allocationId !== null);

  await database.writeTransaction(async (transaction) => {
    const before = isCorrection ? {
      entries: await transaction.getAll<Record<string, unknown>>(
        `SELECT * FROM milk_entries WHERE farm_id = ? AND milk_date = ? AND session = ? AND deleted_at IS NULL ORDER BY animal_id`,
        [input.farmId, input.milkDate, input.session],
      ),
      allocations: await transaction.getAll<Record<string, unknown>>(
        `SELECT * FROM milk_allocations WHERE farm_id = ? AND milk_date = ? AND session = ? AND deleted_at IS NULL ORDER BY destination, buyer_id`,
        [input.farmId, input.milkDate, input.session],
      ),
    } : null;

    for (const entry of input.entries) {
      if (!Number.isSafeInteger(entry.volumeMl) || entry.volumeMl < 0) {
        throw new RangeError('Milk volume must be a non-negative safe integer.');
      }

      if (entry.entryId) {
        await transaction.execute(
          `UPDATE milk_entries
           SET volume_ml = ?, pricing_mode = ?, flat_rate_paise_per_litre = ?,
               fat_hundredths = ?, snf_hundredths = ?, cmfat_paise = ?, cmsnf_paise = ?,
               calculated_rate_paise_per_litre = ?, state = 'complete',
               updated_at = ?, updated_by = ?, version = version + 1
           WHERE id = ?`,
          [
            entry.volumeMl, input.pricingMode, input.flatRatePaisePerLitre,
            input.fatHundredths, input.snfHundredths, input.cmFatPaise, input.cmSnfPaise,
            input.ratePaisePerLitre, now, input.userId, entry.entryId,
          ],
        );
      } else {
        const existing = await transaction.getOptional<{ id: string }>(
          `SELECT id FROM milk_entries
           WHERE farm_id = ? AND animal_id = ? AND milk_date = ? AND session = ? AND deleted_at IS NULL
           LIMIT 1`,
          [input.farmId, entry.animalId, input.milkDate, input.session],
        );
        if (existing) {
          await transaction.execute(
            `UPDATE milk_entries
             SET volume_ml = ?, pricing_mode = ?, flat_rate_paise_per_litre = ?,
                 fat_hundredths = ?, snf_hundredths = ?, cmfat_paise = ?, cmsnf_paise = ?,
                 calculated_rate_paise_per_litre = ?, state = 'complete',
                 updated_at = ?, updated_by = ?, version = version + 1
             WHERE id = ?`,
            [
              entry.volumeMl, input.pricingMode, input.flatRatePaisePerLitre,
              input.fatHundredths, input.snfHundredths, input.cmFatPaise, input.cmSnfPaise,
              input.ratePaisePerLitre, now, input.userId, existing.id,
            ],
          );
        } else await transaction.execute(
          `INSERT INTO milk_entries (
            id, farm_id, animal_id, milk_date, session, volume_ml,
            pricing_mode, flat_rate_paise_per_litre, fat_hundredths, snf_hundredths,
            cmfat_paise, cmsnf_paise,
            calculated_rate_paise_per_litre, state, notes, void_reason,
            created_at, updated_at, created_by, updated_by, deleted_at, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'complete', NULL, NULL, ?, ?, ?, ?, NULL, 1)`,
          [
            Crypto.randomUUID(),
            input.farmId,
            entry.animalId,
            input.milkDate,
            input.session,
            entry.volumeMl,
            input.pricingMode,
            input.flatRatePaisePerLitre,
            input.fatHundredths,
            input.snfHundredths,
            input.cmFatPaise,
            input.cmSnfPaise,
            input.ratePaisePerLitre,
            now,
            now,
            input.userId,
            input.userId,
          ],
        );
      }
    }

    for (const allocation of input.allocations) {
      if (!Number.isSafeInteger(allocation.volumeMl) || allocation.volumeMl <= 0) {
        throw new RangeError('Milk allocation must be a positive safe integer.');
      }

      if (!Number.isSafeInteger(allocation.ratePaisePerLitre) || allocation.ratePaisePerLitre < 0) {
        throw new RangeError('Allocation rate must be a non-negative safe integer.');
      }
      const amountPaise = calculateFlatMilkAmountPaise(allocation.volumeMl, allocation.ratePaisePerLitre);
      if (allocation.allocationId) {
        await transaction.execute(
          `UPDATE milk_allocations
           SET volume_ml = ?, rate_paise_per_litre = ?, amount_paise = ?,
               updated_at = ?, updated_by = ?, version = version + 1
           WHERE id = ?`,
          [allocation.volumeMl, allocation.ratePaisePerLitre, amountPaise, now, input.userId, allocation.allocationId],
        );
      } else {
        const existing = await transaction.getOptional<{ id: string }>(
          `SELECT id FROM milk_allocations
           WHERE farm_id = ? AND milk_date = ? AND session = ? AND destination = ?
             AND ((buyer_id IS NULL AND ? IS NULL) OR buyer_id = ?)
             AND deleted_at IS NULL
           LIMIT 1`,
          [input.farmId, input.milkDate, input.session, allocation.destination, allocation.buyerId, allocation.buyerId],
        );
        if (existing) {
          await transaction.execute(
            `UPDATE milk_allocations
             SET volume_ml = ?, rate_paise_per_litre = ?, amount_paise = ?,
                 updated_at = ?, updated_by = ?, version = version + 1
             WHERE id = ?`,
            [allocation.volumeMl, allocation.ratePaisePerLitre, amountPaise, now, input.userId, existing.id],
          );
        } else await transaction.execute(
          `INSERT INTO milk_allocations (
            id, farm_id, milk_date, session, destination, buyer_id,
            volume_ml, rate_paise_per_litre, amount_paise,
            notes, void_reason, created_at, updated_at,
            created_by, updated_by, deleted_at, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, 1)`,
          [
            Crypto.randomUUID(),
            input.farmId,
            input.milkDate,
            input.session,
            allocation.destination,
            allocation.buyerId,
            allocation.volumeMl,
            allocation.ratePaisePerLitre,
            amountPaise,
            now,
            now,
            input.userId,
            input.userId,
          ],
        );
      }
    }

    for (const allocationId of input.deletedAllocationIds) {
      await transaction.execute(
        `UPDATE milk_allocations
         SET deleted_at = ?, updated_at = ?, updated_by = ?, version = version + 1
         WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
        [now, now, input.userId, allocationId, input.farmId],
      );
    }

    for (const animalId of input.clearedAnimalIds) {
      await transaction.execute(
        `UPDATE milk_entries
         SET deleted_at = ?, updated_at = ?, updated_by = ?, version = version + 1
         WHERE farm_id = ? AND animal_id = ? AND milk_date = ? AND session = ? AND deleted_at IS NULL`,
        [now, now, input.userId, input.farmId, animalId, input.milkDate, input.session],
      );
    }

    if (before) {
      const after = {
        entries: await transaction.getAll<Record<string, unknown>>(
          `SELECT * FROM milk_entries WHERE farm_id = ? AND milk_date = ? AND session = ? AND deleted_at IS NULL ORDER BY animal_id`,
          [input.farmId, input.milkDate, input.session],
        ),
        allocations: await transaction.getAll<Record<string, unknown>>(
          `SELECT * FROM milk_allocations WHERE farm_id = ? AND milk_date = ? AND session = ? AND deleted_at IS NULL ORDER BY destination, buyer_id`,
          [input.farmId, input.milkDate, input.session],
        ),
      };
      await recordCorrection(transaction, {
        farmId: input.farmId,
        userId: input.userId,
        entityType: 'milk_session',
        recordId: `${input.milkDate}:${input.session}`,
        action: 'update',
        before,
        after,
      });
    }
  });
}

export async function voidMilkSession(input: VoidMilkSessionInput) {
  const reason = input.reason.trim();
  if (!reason) throw new Error('A reason is required to void a milk session.');

  const database = await getPowerSyncDatabase();
  const now = new Date().toISOString();
  await database.writeTransaction(async (transaction) => {
    const before = {
      entries: await transaction.getAll<Record<string, unknown>>(
        `SELECT * FROM milk_entries WHERE farm_id = ? AND milk_date = ? AND session = ? AND deleted_at IS NULL ORDER BY animal_id`,
        [input.farmId, input.milkDate, input.session],
      ),
      allocations: await transaction.getAll<Record<string, unknown>>(
        `SELECT * FROM milk_allocations WHERE farm_id = ? AND milk_date = ? AND session = ? AND deleted_at IS NULL ORDER BY destination, buyer_id`,
        [input.farmId, input.milkDate, input.session],
      ),
    };
    const values = [reason, now, now, input.userId, input.farmId, input.milkDate, input.session];
    await transaction.execute(
      `UPDATE milk_entries
       SET void_reason = ?, deleted_at = ?, updated_at = ?, updated_by = ?,
           version = version + 1
       WHERE farm_id = ? AND milk_date = ? AND session = ? AND deleted_at IS NULL`,
      values,
    );
    await transaction.execute(
      `UPDATE milk_allocations
       SET void_reason = ?, deleted_at = ?, updated_at = ?, updated_by = ?,
           version = version + 1
       WHERE farm_id = ? AND milk_date = ? AND session = ? AND deleted_at IS NULL`,
      values,
    );
    const after = {
      entries: await transaction.getAll<Record<string, unknown>>(
        `SELECT * FROM milk_entries WHERE farm_id = ? AND milk_date = ? AND session = ? AND deleted_at = ? ORDER BY animal_id`,
        [input.farmId, input.milkDate, input.session, now],
      ),
      allocations: await transaction.getAll<Record<string, unknown>>(
        `SELECT * FROM milk_allocations WHERE farm_id = ? AND milk_date = ? AND session = ? AND deleted_at = ? ORDER BY destination, buyer_id`,
        [input.farmId, input.milkDate, input.session, now],
      ),
    };
    await recordCorrection(transaction, {
      farmId: input.farmId,
      userId: input.userId,
      entityType: 'milk_session',
      recordId: `${input.milkDate}:${input.session}`,
      action: 'void',
      reason,
      before,
      after,
    });
  });
}
