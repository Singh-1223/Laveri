import { getPowerSyncDatabase } from '@/data/powersync/platform.native';

import type { DailyDashboardSummary } from './dashboard.types';

type AggregateRow = {
  morning_ml: number;
  evening_ml: number;
  buyer_ml: number;
  household_ml: number;
  turnover_paise: number;
  feed_cost_paise: number;
  treatment_cost_paise: number;
  product_cost_paise: number;
  investment_paise: number;
};

export async function getDailyDashboardSummary(farmId: string, businessDate: string): Promise<DailyDashboardSummary> {
  const database = await getPowerSyncDatabase();
  const row = await database.get<AggregateRow>(
    `SELECT
      coalesce((SELECT sum(volume_ml) FROM milk_entries WHERE farm_id = ? AND milk_date = ? AND session = 'morning' AND deleted_at IS NULL), 0) AS morning_ml,
      coalesce((SELECT sum(volume_ml) FROM milk_entries WHERE farm_id = ? AND milk_date = ? AND session = 'evening' AND deleted_at IS NULL), 0) AS evening_ml,
      coalesce((SELECT sum(volume_ml) FROM milk_allocations WHERE farm_id = ? AND milk_date = ? AND destination = 'buyer' AND deleted_at IS NULL), 0) AS buyer_ml,
      coalesce((SELECT sum(volume_ml) FROM milk_allocations WHERE farm_id = ? AND milk_date = ? AND destination = 'household' AND deleted_at IS NULL), 0) AS household_ml,
      coalesce((SELECT sum(amount_paise) FROM milk_allocations WHERE farm_id = ? AND milk_date = ? AND destination = 'buyer' AND deleted_at IS NULL), 0) AS turnover_paise,
      coalesce((SELECT sum(amount_paise) FROM feed_transactions WHERE farm_id = ? AND transaction_date = ? AND deleted_at IS NULL), 0) AS feed_cost_paise,
      coalesce((SELECT sum(total_paise) FROM treatments WHERE farm_id = ? AND treatment_date = ? AND deleted_at IS NULL), 0) AS treatment_cost_paise,
      coalesce((SELECT sum(amount_paise) FROM product_transactions WHERE farm_id = ? AND transaction_date = ? AND category = 'operating_expense' AND deleted_at IS NULL), 0) AS product_cost_paise,
      coalesce((SELECT sum(amount_paise) FROM product_transactions WHERE farm_id = ? AND transaction_date = ? AND category = 'investment' AND deleted_at IS NULL), 0) AS investment_paise`,
    [
      farmId, businessDate,
      farmId, businessDate,
      farmId, businessDate,
      farmId, businessDate,
      farmId, businessDate,
      farmId, businessDate,
      farmId, businessDate,
      farmId, businessDate,
      farmId, businessDate,
    ],
  );

  const producedMl = row.morning_ml + row.evening_ml;
  const allocatedMl = row.buyer_ml + row.household_ml;
  const operatingCostPaise = row.feed_cost_paise + row.treatment_cost_paise + row.product_cost_paise;

  return {
    morningMl: row.morning_ml,
    eveningMl: row.evening_ml,
    producedMl,
    buyerMl: row.buyer_ml,
    householdMl: row.household_ml,
    unallocatedMl: producedMl - allocatedMl,
    turnoverPaise: row.turnover_paise,
    operatingCostPaise,
    operatingProfitPaise: row.turnover_paise - operatingCostPaise,
    investmentPaise: row.investment_paise,
  };
}
