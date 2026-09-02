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
