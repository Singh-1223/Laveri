import * as Crypto from 'expo-crypto';
import { getPowerSyncDatabase } from '@/data/powersync/platform.native';
import type { BuyerAccountSnapshot, CreateBuyerPaymentInput } from './buyer-account.types';

export async function loadBuyerAccount(farmId: string, buyerId: string): Promise<BuyerAccountSnapshot> {
  const database = await getPowerSyncDatabase();
  const [buyer, sales, payments] = await Promise.all([
    database.get<BuyerAccountSnapshot['buyer']>(`SELECT id, name, default_rate_paise_per_litre AS defaultRatePaisePerLitre FROM buyers WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`, [buyerId, farmId]),
    database.getAll<BuyerAccountSnapshot['sales'][number]>(`SELECT id, milk_date AS milkDate, session, volume_ml AS volumeMl, amount_paise AS amountPaise FROM milk_allocations WHERE buyer_id = ? AND farm_id = ? AND destination = 'buyer' AND deleted_at IS NULL ORDER BY milk_date DESC, session DESC LIMIT 100`, [buyerId, farmId]),
    database.getAll<BuyerAccountSnapshot['payments'][number]>(`SELECT id, payment_date AS paymentDate, amount_paise AS amountPaise, mode, notes FROM buyer_payments WHERE buyer_id = ? AND farm_id = ? AND deleted_at IS NULL ORDER BY payment_date DESC LIMIT 100`, [buyerId, farmId]),
  ]);
  if (!buyer) throw new Error('Buyer was not found.');
  return { buyer, sales, payments };
}
export async function createBuyerPayment(input: CreateBuyerPaymentInput) {
  const database = await getPowerSyncDatabase();
  const now = new Date().toISOString();
  await database.execute(`INSERT INTO buyer_payments (id, farm_id, buyer_id, payment_date, amount_paise, mode, notes, created_at, updated_at, created_by, updated_by, deleted_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`, [Crypto.randomUUID(), input.farmId, input.buyerId, input.paymentDate, input.amountPaise, input.mode, input.notes?.trim() || null, now, now, input.userId, input.userId]);
}
