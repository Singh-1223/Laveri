export type BuyerAccountSnapshot = {
  buyer: { id: string; name: string; defaultRatePaisePerLitre: number | null };
  sales: { id: string; milkDate: string; session: string; volumeMl: number; amountPaise: number; ratePaisePerLitre: number }[];
  payments: { id: string; paymentDate: string; amountPaise: number; mode: string; notes: string | null }[];
  bills: { id: string; billDate: string; storagePath: string; fileName: string }[];
};
export type CreateBuyerPaymentInput = { farmId: string; userId: string; buyerId: string; paymentDate: string; amountPaise: number; mode: 'cash' | 'online' | 'other'; notes?: string };
export type CreateBuyerBillInput = { farmId: string; userId: string; buyerId: string; billDate: string; storagePath: string; fileName: string };
export type DeleteBuyerBillInput = { farmId: string; userId: string; id: string };
