import type { BuyerAccountSnapshot, CreateBuyerBillInput, CreateBuyerPaymentInput, DeleteBuyerBillInput } from './buyer-account.types';
const unavailable = () => new Error('Offline buyer accounts require the Android or iOS development build.');
export async function loadBuyerAccount(_farmId: string, _buyerId: string): Promise<BuyerAccountSnapshot> { throw unavailable(); }
export async function createBuyerPayment(_input: CreateBuyerPaymentInput) { throw unavailable(); }
export async function createBuyerBill(_input: CreateBuyerBillInput) { throw unavailable(); }
export async function deleteBuyerBill(_input: DeleteBuyerBillInput) { throw unavailable(); }
