export type MilkSession = 'morning' | 'evening';

export type MilkDestination = 'buyer' | 'household';

export type ProductTransactionCategory = 'operating_expense' | 'investment' | 'byproduct_sale';

export type ValidationIssue = {
  field: string;
  message: string;
};

export type MilkAllocationInput = {
  destination: MilkDestination;
  volumeMl: number;
};

export type MilkAllocationSummary = {
  producedMl: number;
  buyerMl: number;
  householdMl: number;
  allocatedMl: number;
  unallocatedMl: number;
  exceedsProduction: boolean;
};

export type FinanceSummaryInput = {
  cashRevenuePaise: number;
  productionValuePaise: number;
  feedCostPaise: number;
  treatmentCostPaise: number;
  productOperatingCostPaise: number;
  investmentPaise: number;
};

export type FinanceSummary = FinanceSummaryInput & {
  operatingCostPaise: number;
  operatingProfitPaise: number;
  economicProfitPaise: number;
};
