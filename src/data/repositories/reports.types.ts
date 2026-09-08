export type AnimalProductivityRow = {
  animalId: string;
  tag: string;
  morningMl: number;
  eveningMl: number;
  totalMl: number;
  recordedSessions: number;
};

export type MilkProductionDetailRow = {
  id: string;
  milkDate: string;
  session: 'morning' | 'evening';
  animalId: string;
  animalTag: string;
  volumeMl: number;
  pricingMode: 'flat' | 'quality';
  fatHundredths: number | null;
  snfHundredths: number | null;
  ratePaisePerLitre: number;
};

export type MilkQualityRecord = {
  milkDate: string;
  session: 'morning' | 'evening';
  fatHundredths: number | null;
  snfHundredths: number | null;
};

export type DailyDiaryRow = { id: string; diaryDate: string; comment: string };
export type SaveDailyDiaryInput = { farmId: string; userId: string; diaryDate: string; comment: string; id?: string };
export type DeleteDailyDiaryInput = { farmId: string; userId: string; id: string };

export type BuyerSaleDetailRow = {
  id: string;
  milkDate: string;
  session: 'morning' | 'evening';
  buyerId: string;
  buyerName: string;
  volumeMl: number;
  ratePaisePerLitre: number;
  amountPaise: number;
};

export type PeriodReport = {
  fromDate: string;
  toDate: string;
  morningMl: number;
  eveningMl: number;
  producedMl: number;
  buyerMl: number;
  householdMl: number;
  unallocatedMl: number;
  milkRevenuePaise: number;
  feedCostPaise: number;
  treatmentCostPaise: number;
  productOperatingCostPaise: number;
  operatingCostPaise: number;
  operatingProfitPaise: number;
  investmentPaise: number;
  animals: AnimalProductivityRow[];
  milkEntries: MilkProductionDetailRow[];
  buyerSales: BuyerSaleDetailRow[];
};
