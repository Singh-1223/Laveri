export type BuyerAccountSnapshot = {
  buyer: { id: string; name: string; defaultRatePaisePerLitre: number | null };
  sales: { id: string; milkDate: string; session: string; volumeMl: number; amountPaise: number }[];
  payments: { id: string; paymentDate: string; amountPaise: number; mode: string; notes: string | null }[];
};
export type CreateBuyerPaymentInput = { farmId: string; userId: string; buyerId: string; paymentDate: string; amountPaise: number; mode: 'cash' | 'online' | 'other'; notes?: string };
