import * as Crypto from 'expo-crypto';
import { getPowerSyncDatabase } from '@/data/powersync/platform.native';
import type { SaveVerkaCycleInput, VerkaCycleSnapshot } from './verka-billing.types';

export async function loadVerkaCycles(farmId: string, buyerId: string): Promise<VerkaCycleSnapshot> {
  const database = await getPowerSyncDatabase();
  const [cycles, sales] = await Promise.all([
    database.getAll<VerkaCycleSnapshot['cycles'][number]>(`SELECT id, cycle_start AS cycleStart, cycle_end AS cycleEnd, final_rate_paise_per_litre AS finalRatePaisePerLitre, commission_paise AS commissionPaise, increment_paise AS incrementPaise, deduction_paise AS deductionPaise, notes, bill_path AS billPath, bill_name AS billName, bill_morning_ml AS billMorningMl, bill_evening_ml AS billEveningMl, bill_total_ml AS billTotalMl FROM verka_billing_cycles WHERE farm_id = ? AND buyer_id = ? AND deleted_at IS NULL ORDER BY cycle_start DESC`, [farmId, buyerId]),
    database.getAll<VerkaCycleSnapshot['sales'][number]>(`SELECT milk_date AS milkDate, session, volume_ml AS volumeMl FROM milk_allocations WHERE farm_id = ? AND buyer_id = ? AND destination = 'buyer' AND deleted_at IS NULL ORDER BY milk_date DESC`, [farmId, buyerId]),
  ]);
  return { cycles, sales };
}

export async function saveVerkaCycle(input: SaveVerkaCycleInput) {
  const database = await getPowerSyncDatabase(); const now = new Date().toISOString(); const id = input.id ?? Crypto.randomUUID();
  const values = [input.farmId, input.buyerId, input.cycleStart, input.cycleEnd, input.finalRatePaisePerLitre, input.commissionPaise, input.incrementPaise, input.deductionPaise, input.notes?.trim() || null, input.billPath ?? null, input.billName ?? null, input.billMorningMl ?? null, input.billEveningMl ?? null, input.billTotalMl ?? null, now, input.userId];
  if (input.id) await database.execute(`UPDATE verka_billing_cycles SET farm_id=?, buyer_id=?, cycle_start=?, cycle_end=?, final_rate_paise_per_litre=?, commission_paise=?, increment_paise=?, deduction_paise=?, notes=?, bill_path=?, bill_name=?, bill_morning_ml=?, bill_evening_ml=?, bill_total_ml=?, updated_at=?, updated_by=?, version=version+1 WHERE id=?`, [...values, id]);
  else await database.execute(`INSERT INTO verka_billing_cycles (id,farm_id,buyer_id,cycle_start,cycle_end,final_rate_paise_per_litre,commission_paise,increment_paise,deduction_paise,notes,bill_path,bill_name,bill_morning_ml,bill_evening_ml,bill_total_ml,created_at,updated_at,created_by,updated_by,deleted_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,1)`, [id, ...values.slice(0, 14), now, now, input.userId, input.userId]);
  if (input.finalRatePaisePerLitre !== null) await database.execute(`UPDATE milk_allocations SET rate_paise_per_litre = ?, amount_paise = round(volume_ml * ? / 1000.0), updated_at = ?, updated_by = ?, version = version + 1 WHERE farm_id = ? AND buyer_id = ? AND destination = 'buyer' AND milk_date BETWEEN ? AND ? AND deleted_at IS NULL`, [input.finalRatePaisePerLitre, input.finalRatePaisePerLitre, now, input.userId, input.farmId, input.buyerId, input.cycleStart, input.cycleEnd]);
}
