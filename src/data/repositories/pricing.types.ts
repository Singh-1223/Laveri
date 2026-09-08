export type MilkPricingMode = 'flat' | 'quality';

export type MilkPricingConfigRow = {
  id: string;
  mode: MilkPricingMode;
  effectiveFrom: string;
  effectiveTo: string | null;
  flatRatePaisePerLitre: number | null;
  cmFatPaise: number | null;
  cmSnfPaise: number | null;
};

export type PricingSettingsSnapshot = {
  mode: MilkPricingMode;
  configs: MilkPricingConfigRow[];
};

export type CalculatorHistoryRow = {
  id: string;
  fatThousandths: number;
  snfThousandths: number;
  cmFatPaise: number;
  cmSnfPaise: number;
  resultPaisePerLitre: number;
  createdAt: string;
};

export type SaveCalculatorHistoryInput = {
  farmId: string;
  userId: string;
  fatThousandths: number;
  snfThousandths: number;
  cmFatPaise: number;
  cmSnfPaise: number;
  resultPaisePerLitre: number;
};

export type SetMilkPricingModeInput = {
  farmId: string;
  userId: string;
  mode: MilkPricingMode;
};

export type SaveMilkPricingConfigInput = {
  farmId: string;
  userId: string;
  mode: MilkPricingMode;
  effectiveFrom: string;
  flatRatePaisePerLitre: number | null;
  cmFatPaise: number | null;
  cmSnfPaise: number | null;
};
