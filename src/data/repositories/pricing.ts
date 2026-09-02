import type { PricingSettingsSnapshot, SaveMilkPricingConfigInput, SetMilkPricingModeInput } from './pricing.types';

const unavailable = () => new Error('Offline pricing settings require the Android or iOS development build.');

export async function loadPricingSettings(_farmId: string): Promise<PricingSettingsSnapshot> {
  throw unavailable();
}

export async function setMilkPricingMode(_input: SetMilkPricingModeInput) {
  throw unavailable();
}

export async function saveMilkPricingConfig(_input: SaveMilkPricingConfigInput) {
  throw unavailable();
}
