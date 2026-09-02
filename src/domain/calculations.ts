import type {
  FinanceSummary,
  FinanceSummaryInput,
  MilkAllocationInput,
  MilkAllocationSummary,
} from './types';

const MILLI_SCALE = 1_000n;
const QUALITY_RATE_SCALE = 10_000n;

function requireSafeNonNegativeInteger(value: number, name: string): bigint {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }

  return BigInt(value);
}

function roundedDivideHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

function toSafeNumber(value: bigint, name: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${name} exceeds the supported safe integer range.`);
  }

  return result;
}

export function calculateQuantityAmountPaise(quantityMilliUnits: number, ratePaisePerUnit: number): number {
  const quantity = requireSafeNonNegativeInteger(quantityMilliUnits, 'quantityMilliUnits');
  const rate = requireSafeNonNegativeInteger(ratePaisePerUnit, 'ratePaisePerUnit');
  return toSafeNumber(roundedDivideHalfUp(quantity * rate, MILLI_SCALE), 'amountPaise');
}

export function calculateFlatMilkAmountPaise(volumeMl: number, ratePaisePerLitre: number): number {
  return calculateQuantityAmountPaise(volumeMl, ratePaisePerLitre);
}

/**
 * Calculates the workbook's quality rate formula using integers:
 * `(FAT% × CMFAT / 100) + (SNF% × CMSNF / 100)`.
 *
 * FAT/SNF are stored in hundredths of a percent (4.25% = 425). CMFAT/CMSNF
 * are stored in paise, so the result is a rounded paise-per-litre snapshot.
 */
export function calculateQualityRatePaise(
  fatHundredths: number,
  snfHundredths: number,
  cmFatPaise: number,
  cmSnfPaise: number,
): number {
  const fat = requireSafeNonNegativeInteger(fatHundredths, 'fatHundredths');
  const snf = requireSafeNonNegativeInteger(snfHundredths, 'snfHundredths');
  const cmFat = requireSafeNonNegativeInteger(cmFatPaise, 'cmFatPaise');
  const cmSnf = requireSafeNonNegativeInteger(cmSnfPaise, 'cmSnfPaise');
  const numerator = fat * cmFat + snf * cmSnf;
  return toSafeNumber(roundedDivideHalfUp(numerator, QUALITY_RATE_SCALE), 'ratePaisePerLitre');
}

export function summarizeMilkAllocation(
  producedMl: number,
  allocations: readonly MilkAllocationInput[],
): MilkAllocationSummary {
  requireSafeNonNegativeInteger(producedMl, 'producedMl');

  let buyerMl = 0;
  let householdMl = 0;

  for (const allocation of allocations) {
    requireSafeNonNegativeInteger(allocation.volumeMl, 'allocation.volumeMl');
    if (allocation.destination === 'buyer') {
      buyerMl += allocation.volumeMl;
    } else {
      householdMl += allocation.volumeMl;
    }
  }

  if (!Number.isSafeInteger(buyerMl) || !Number.isSafeInteger(householdMl)) {
    throw new RangeError('Allocated milk exceeds the supported safe integer range.');
  }

  const allocatedMl = buyerMl + householdMl;
  if (!Number.isSafeInteger(allocatedMl)) {
    throw new RangeError('Allocated milk exceeds the supported safe integer range.');
  }

  return {
    producedMl,
    buyerMl,
    householdMl,
    allocatedMl,
    unallocatedMl: producedMl - allocatedMl,
    exceedsProduction: allocatedMl > producedMl,
  };
}

export function calculateTreatmentTotalPaise(doctorFeePaise: number, medicineCostPaise: number): number {
  const doctorFee = requireSafeNonNegativeInteger(doctorFeePaise, 'doctorFeePaise');
  const medicineCost = requireSafeNonNegativeInteger(medicineCostPaise, 'medicineCostPaise');
  return toSafeNumber(doctorFee + medicineCost, 'treatmentTotalPaise');
}

export function calculateFinanceSummary(input: FinanceSummaryInput): FinanceSummary {
  const cashRevenue = requireSafeNonNegativeInteger(input.cashRevenuePaise, 'cashRevenuePaise');
  const productionValue = requireSafeNonNegativeInteger(input.productionValuePaise, 'productionValuePaise');
  const feed = requireSafeNonNegativeInteger(input.feedCostPaise, 'feedCostPaise');
  const treatment = requireSafeNonNegativeInteger(input.treatmentCostPaise, 'treatmentCostPaise');
  const product = requireSafeNonNegativeInteger(input.productOperatingCostPaise, 'productOperatingCostPaise');
  requireSafeNonNegativeInteger(input.investmentPaise, 'investmentPaise');

  const operatingCost = feed + treatment + product;
  const operatingProfit = cashRevenue - operatingCost;
  const economicProfit = productionValue - operatingCost;

  return {
    ...input,
    operatingCostPaise: toSafeNumber(operatingCost, 'operatingCostPaise'),
    operatingProfitPaise: toSafeNumber(operatingProfit, 'operatingProfitPaise'),
    economicProfitPaise: toSafeNumber(economicProfit, 'economicProfitPaise'),
  };
}

export function formatMilk(volumeMl: number, locale = 'en-IN'): string {
  requireSafeNonNegativeInteger(volumeMl, 'volumeMl');
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(volumeMl / 1_000)} L`;
}

export function formatMoney(amountPaise: number, currency = 'INR', locale = 'en-IN'): string {
  if (!Number.isSafeInteger(amountPaise)) {
    throw new RangeError('amountPaise must be a safe integer.');
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
}
