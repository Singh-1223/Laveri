import { getPowerSyncDatabase } from '@/data/powersync/platform.native';

import type { AnimalProductivityRow, BuyerSaleDetailRow, MilkProductionDetailRow, MilkQualityRecord, PeriodReport } from './reports.types';

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
  const unallocatedMl = producedMl - aggregate.buyerMl - aggregate.householdMl;
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
     ORDER BY milk_date DESC, session ASC`,
    [farmId, fromDate, toDate],
  );
}
