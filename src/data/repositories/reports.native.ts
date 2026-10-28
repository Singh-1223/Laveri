import { getPowerSyncDatabase } from '@/data/powersync/platform.native';
import * as Crypto from 'expo-crypto';

import type { AnimalMilkGraphSnapshot, AnimalProductivityRow, BuyerSaleDetailRow, DailyDiaryCategory, DailyDiaryRow, DeleteDailyDiaryCategoryInput, DeleteDailyDiaryInput, FarmAverageMilkPoint, MilkProductionDetailRow, MilkQualityRecord, PeriodReport, SaveDailyDiaryCategoryInput, SaveDailyDiaryInput } from './reports.types';

export async function getDailyDiary(farmId: string, fromDate: string, toDate: string): Promise<DailyDiaryRow[]> { const database = await getPowerSyncDatabase(); return database.getAll<DailyDiaryRow>(`SELECT diary.id, diary.diary_date AS diaryDate, diary.comment, diary.category_id AS categoryId, coalesce(category.name, 'Regular') AS categoryName FROM daily_diary diary LEFT JOIN daily_diary_categories category ON category.id = diary.category_id AND category.deleted_at IS NULL WHERE diary.farm_id = ? AND diary.diary_date BETWEEN ? AND ? AND diary.deleted_at IS NULL ORDER BY diary.diary_date DESC, diary.created_at DESC`, [farmId, fromDate, toDate]); }
export async function listDailyDiaryCategories(farmId: string): Promise<DailyDiaryCategory[]> { const database = await getPowerSyncDatabase(); return database.getAll<DailyDiaryCategory>(`SELECT id, name, display_order AS displayOrder FROM daily_diary_categories WHERE farm_id=? AND deleted_at IS NULL ORDER BY display_order, name COLLATE NOCASE`, [farmId]); }
export async function saveDailyDiary(input: SaveDailyDiaryInput) { const database = await getPowerSyncDatabase(); const now = new Date().toISOString(); if (input.id) return database.execute(`UPDATE daily_diary SET diary_date=?, category_id=?, comment=?, updated_at=?, updated_by=?, version=version+1 WHERE id=? AND farm_id=? AND deleted_at IS NULL`, [input.diaryDate, input.categoryId, input.comment.trim(), now, input.userId, input.id, input.farmId]); return database.execute(`INSERT INTO daily_diary(id,farm_id,diary_date,category_id,comment,created_at,updated_at,created_by,updated_by,deleted_at,version) VALUES(?,?,?,?,?,?,?,?,?,NULL,1)`, [Crypto.randomUUID(), input.farmId, input.diaryDate, input.categoryId, input.comment.trim(), now, now, input.userId, input.userId]); }
export async function deleteDailyDiary(input: DeleteDailyDiaryInput) { const database = await getPowerSyncDatabase(); const now = new Date().toISOString(); return database.execute(`UPDATE daily_diary SET deleted_at=?, updated_at=?, updated_by=?, version=version+1 WHERE id=? AND farm_id=? AND deleted_at IS NULL`, [now, now, input.userId, input.id, input.farmId]); }
export async function saveDailyDiaryCategory(input: SaveDailyDiaryCategoryInput) { const database = await getPowerSyncDatabase(); const now = new Date().toISOString(); if (input.id) return database.execute(`UPDATE daily_diary_categories SET name=?, updated_at=?, updated_by=?, version=version+1 WHERE id=? AND farm_id=? AND deleted_at IS NULL`, [input.name.trim(), now, input.userId, input.id, input.farmId]); const existing = await database.getOptional<{ id: string }>(`SELECT id FROM daily_diary_categories WHERE farm_id=? AND lower(trim(name))=lower(trim(?)) AND deleted_at IS NULL LIMIT 1`, [input.farmId, input.name]); if (existing) return existing.id; const id=Crypto.randomUUID(); await database.execute(`INSERT INTO daily_diary_categories(id,farm_id,name,display_order,created_at,updated_at,created_by,updated_by,deleted_at,version) VALUES(?,?,?,(SELECT coalesce(max(display_order),0)+1 FROM daily_diary_categories WHERE farm_id=?),?,?,?,?,NULL,1)`, [id,input.farmId,input.name.trim(),input.farmId,now,now,input.userId,input.userId]); return id; }
export async function deleteDailyDiaryCategory(input: DeleteDailyDiaryCategoryInput) { const database = await getPowerSyncDatabase(); const now = new Date().toISOString(); await database.writeTransaction(async transaction => { await transaction.execute(`UPDATE daily_diary SET category_id=NULL, updated_at=?, updated_by=?, version=version+1 WHERE farm_id=? AND category_id=? AND deleted_at IS NULL`, [now,input.userId,input.farmId,input.id]); await transaction.execute(`UPDATE daily_diary_categories SET deleted_at=?, updated_at=?, updated_by=?, version=version+1 WHERE id=? AND farm_id=? AND deleted_at IS NULL`, [now,now,input.userId,input.id,input.farmId]); }); }

type PeriodAggregate = Omit<PeriodReport, 'fromDate' | 'toDate' | 'producedMl' | 'unallocatedMl' | 'operatingCostPaise' | 'operatingProfitPaise' | 'animals' | 'milkEntries' | 'buyerSales'>;

export async function getPeriodReport(farmId: string, fromDate: string, toDate: string): Promise<PeriodReport> {
  const database = await getPowerSyncDatabase();
  const [aggregate, animals, milkEntries, buyerSales] = await Promise.all([
    database.get<PeriodAggregate>(
      `SELECT
        coalesce((SELECT sum(volume_ml) FROM milk_entries WHERE farm_id = ? AND milk_date BETWEEN ? AND ? AND session = 'morning' AND deleted_at IS NULL), 0) AS morningMl,
        coalesce((SELECT sum(volume_ml) FROM milk_entries WHERE farm_id = ? AND milk_date BETWEEN ? AND ? AND session = 'evening' AND deleted_at IS NULL), 0) AS eveningMl,
        coalesce((SELECT sum(volume_ml) FROM milk_allocations WHERE farm_id = ? AND milk_date BETWEEN ? AND ? AND destination = 'buyer' AND deleted_at IS NULL), 0) AS buyerMl,
        coalesce((SELECT sum(volume_ml) FROM milk_allocations WHERE farm_id = ? AND milk_date BETWEEN ? AND ? AND destination = 'household' AND deleted_at IS NULL), 0) AS householdMl,
        coalesce((SELECT sum(volume_ml) FROM milk_calf_allocations WHERE farm_id = ? AND milk_date BETWEEN ? AND ? AND deleted_at IS NULL), 0) AS milkCalfMl,
        coalesce((SELECT sum(amount_paise) FROM milk_allocations WHERE farm_id = ? AND milk_date BETWEEN ? AND ? AND destination = 'buyer' AND deleted_at IS NULL), 0) AS milkRevenuePaise,
        coalesce((SELECT sum(amount_paise) FROM feed_transactions WHERE farm_id = ? AND transaction_date BETWEEN ? AND ? AND deleted_at IS NULL), 0) AS feedCostPaise,
        coalesce((SELECT sum(total_paise) FROM treatments WHERE farm_id = ? AND treatment_date BETWEEN ? AND ? AND deleted_at IS NULL), 0) AS treatmentCostPaise,
        coalesce((SELECT sum(amount_paise) FROM product_transactions WHERE farm_id = ? AND transaction_date BETWEEN ? AND ? AND category = 'operating_expense' AND deleted_at IS NULL), 0) AS productOperatingCostPaise,
        coalesce((SELECT sum(amount_paise) FROM product_transactions WHERE farm_id = ? AND transaction_date BETWEEN ? AND ? AND category = 'investment' AND deleted_at IS NULL), 0) AS investmentPaise`,
      [
        farmId, fromDate, toDate,
        farmId, fromDate, toDate,
        farmId, fromDate, toDate,
        farmId, fromDate, toDate,
        farmId, fromDate, toDate,
        farmId, fromDate, toDate,
        farmId, fromDate, toDate,
        farmId, fromDate, toDate,
        farmId, fromDate, toDate,
        farmId, fromDate, toDate,
      ],
    ),
    database.getAll<AnimalProductivityRow>(
      `SELECT
        animal.id AS animalId,
        animal.tag,
        coalesce(sum(CASE WHEN entry.session = 'morning' THEN entry.volume_ml ELSE 0 END), 0) AS morningMl,
        coalesce(sum(CASE WHEN entry.session = 'evening' THEN entry.volume_ml ELSE 0 END), 0) AS eveningMl,
        coalesce(sum(entry.volume_ml), 0) AS totalMl,
        count(entry.id) AS recordedSessions
       FROM animals animal
       LEFT JOIN milk_entries entry
         ON entry.animal_id = animal.id
         AND entry.milk_date BETWEEN ? AND ?
         AND entry.deleted_at IS NULL
       WHERE animal.farm_id = ?
         AND animal.deleted_at IS NULL
       GROUP BY animal.id, animal.tag
       HAVING count(entry.id) > 0
       ORDER BY totalMl DESC, animal.tag COLLATE NOCASE`,
      [fromDate, toDate, farmId],
    ),
    database.getAll<MilkProductionDetailRow>(
      `SELECT entry.id, entry.milk_date AS milkDate, entry.session,
         entry.animal_id AS animalId, animal.tag AS animalTag,
         entry.volume_ml AS volumeMl, entry.pricing_mode AS pricingMode,
         entry.fat_hundredths AS fatHundredths, entry.snf_hundredths AS snfHundredths,
         entry.calculated_rate_paise_per_litre AS ratePaisePerLitre
       FROM milk_entries entry
       INNER JOIN animals animal ON animal.id = entry.animal_id
       WHERE entry.farm_id = ? AND entry.milk_date BETWEEN ? AND ?
         AND entry.deleted_at IS NULL
       ORDER BY entry.milk_date DESC, entry.session, animal.tag COLLATE NOCASE`,
      [farmId, fromDate, toDate],
    ),
    database.getAll<BuyerSaleDetailRow>(
      `SELECT allocation.id, allocation.milk_date AS milkDate, allocation.session,
         allocation.buyer_id AS buyerId, buyer.name AS buyerName,
         allocation.volume_ml AS volumeMl,
         allocation.rate_paise_per_litre AS ratePaisePerLitre,
         allocation.amount_paise AS amountPaise
       FROM milk_allocations allocation
       INNER JOIN buyers buyer ON buyer.id = allocation.buyer_id
       WHERE allocation.farm_id = ? AND allocation.milk_date BETWEEN ? AND ?
         AND allocation.destination = 'buyer' AND allocation.deleted_at IS NULL
       ORDER BY allocation.milk_date DESC, allocation.session, buyer.name COLLATE NOCASE`,
      [farmId, fromDate, toDate],
    ),
  ]);

  const producedMl = aggregate.morningMl + aggregate.eveningMl;
  const unallocatedMl = producedMl - aggregate.buyerMl - aggregate.householdMl - aggregate.milkCalfMl;
  const operatingCostPaise = aggregate.feedCostPaise + aggregate.treatmentCostPaise + aggregate.productOperatingCostPaise;

  return {
    fromDate,
    toDate,
    ...aggregate,
    producedMl,
    unallocatedMl,
    operatingCostPaise,
    operatingProfitPaise: aggregate.milkRevenuePaise - operatingCostPaise,
    animals,
    milkEntries,
    buyerSales,
  };
}

export async function getQualityRecords(farmId: string, fromDate: string, toDate: string) {
  const database = await getPowerSyncDatabase();
  return database.getAll<MilkQualityRecord>(
    `SELECT milk_date AS milkDate, session, max(fat_hundredths) AS fatHundredths, max(snf_hundredths) AS snfHundredths
     FROM milk_entries
     WHERE farm_id = ? AND milk_date BETWEEN ? AND ? AND deleted_at IS NULL
       AND (fat_hundredths IS NOT NULL OR snf_hundredths IS NOT NULL)
     GROUP BY milk_date, session
     ORDER BY milk_date ASC, session ASC`,
    [farmId, fromDate, toDate],
  );
}

export async function getMilkSourceEntries(farmId: string, fromDate: string, toDate: string) {
  const database = await getPowerSyncDatabase();
  return database.getAll<MilkProductionDetailRow>(
    `SELECT entry.id, entry.milk_date AS milkDate, entry.session,
       entry.animal_id AS animalId, animal.tag AS animalTag,
       entry.volume_ml AS volumeMl, entry.pricing_mode AS pricingMode,
       entry.fat_hundredths AS fatHundredths, entry.snf_hundredths AS snfHundredths,
       entry.calculated_rate_paise_per_litre AS ratePaisePerLitre
     FROM milk_entries entry
     INNER JOIN animals animal ON animal.id = entry.animal_id
     WHERE entry.farm_id = ? AND entry.milk_date BETWEEN ? AND ?
       AND entry.deleted_at IS NULL
     ORDER BY entry.milk_date DESC, entry.session, animal.tag COLLATE NOCASE`,
    [farmId, fromDate, toDate],
  );
}

export async function getFarmAverageMilk(farmId: string, fromDate: string, toDate: string): Promise<FarmAverageMilkPoint[]> {
  const database = await getPowerSyncDatabase();
  // Daily average = total produced (morning + evening) / number of milking animals that date.
  // "Milking animals on that date" = animals that have a saved milk entry that day; this
  // naturally excludes Not Milking (no entry) and Milk Calf (consumption lives in
  // milk_calf_allocations, not milk_entries), and reflects the category applicable on that date.
  const rows = await database.getAll<{ milkDate: string; totalMl: number; milkingAnimals: number }>(
    `SELECT milk_date AS milkDate,
            coalesce(sum(volume_ml), 0) AS totalMl,
            count(DISTINCT animal_id) AS milkingAnimals
     FROM milk_entries
     WHERE farm_id = ? AND milk_date BETWEEN ? AND ? AND deleted_at IS NULL
     GROUP BY milk_date
     HAVING count(DISTINCT animal_id) > 0
     ORDER BY milk_date ASC`,
    [farmId, fromDate, toDate],
  );
  return rows.map((row) => ({
    milkDate: row.milkDate,
    totalMl: row.totalMl,
    milkingAnimals: row.milkingAnimals,
    averageMl: Math.round(row.totalMl / row.milkingAnimals),
  }));
}

export async function getAnimalMilkGraph(farmId: string, fromDate: string, toDate: string): Promise<AnimalMilkGraphSnapshot> {
  const database = await getPowerSyncDatabase();
  const [animals, points] = await Promise.all([
    database.getAll<AnimalMilkGraphSnapshot['animals'][number]>(
      `SELECT id, tag
       FROM animals
       WHERE farm_id = ? AND deleted_at IS NULL
       ORDER BY display_order ASC, tag COLLATE NOCASE`,
      [farmId],
    ),
    database.getAll<AnimalMilkGraphSnapshot['points'][number]>(
      `SELECT animal_id AS animalId, milk_date AS milkDate, sum(volume_ml) AS volumeMl
       FROM milk_entries
       WHERE farm_id = ? AND milk_date BETWEEN ? AND ? AND deleted_at IS NULL
       GROUP BY animal_id, milk_date
       ORDER BY milk_date ASC, animal_id ASC`,
      [farmId, fromDate, toDate],
    ),
  ]);
  return { animals, points };
}
