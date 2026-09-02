import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateFinanceSummary,
  calculateFlatMilkAmountPaise,
  calculateQualityRatePaise,
  calculateQuantityAmountPaise,
  calculateTreatmentTotalPaise,
  summarizeMilkAllocation,
} from '../src/domain/calculations.ts';
import {
  validateAnimalDraft,
  validateMilkAllocationDraft,
  validateMilkEntryDraft,
} from '../src/domain/validation.ts';

test('flat milk and general quantity totals use integer half-up rounding', () => {
  assert.equal(calculateFlatMilkAmountPaise(12_500, 4_250), 53_125);
  assert.equal(calculateQuantityAmountPaise(2_500, 3_333), 8_333);
});

test('Mode 02 preserves the workbook formula in scaled integers', () => {
  assert.equal(calculateQualityRatePaise(425, 850, 60_000, 20_000), 4_250);
});

test('milk allocation separates buyer and household milk and exposes variance', () => {
  assert.deepEqual(
    summarizeMilkAllocation(20_000, [
      { destination: 'buyer', volumeMl: 12_000 },
      { destination: 'buyer', volumeMl: 5_000 },
      { destination: 'household', volumeMl: 2_000 },
    ]),
    {
      producedMl: 20_000,
      buyerMl: 17_000,
      householdMl: 2_000,
      allocatedMl: 19_000,
      unallocatedMl: 1_000,
      exceedsProduction: false,
    },
  );
});

test('milk allocation flags an over-allocation without hiding the negative variance', () => {
  const result = summarizeMilkAllocation(10_000, [{ destination: 'buyer', volumeMl: 10_500 }]);
  assert.equal(result.unallocatedMl, -500);
  assert.equal(result.exceedsProduction, true);
});

test('treatment total includes both doctor and medicine cost', () => {
  assert.equal(calculateTreatmentTotalPaise(50_000, 12_500), 62_500);
});

test('finance summary keeps investment separate from operating cost', () => {
  assert.deepEqual(
    calculateFinanceSummary({
      cashRevenuePaise: 500_000,
      productionValuePaise: 540_000,
      feedCostPaise: 120_000,
      treatmentCostPaise: 30_000,
      productOperatingCostPaise: 20_000,
      investmentPaise: 200_000,
    }),
    {
      cashRevenuePaise: 500_000,
      productionValuePaise: 540_000,
      feedCostPaise: 120_000,
      treatmentCostPaise: 30_000,
      productOperatingCostPaise: 20_000,
      investmentPaise: 200_000,
      operatingCostPaise: 170_000,
      operatingProfitPaise: 330_000,
      economicProfitPaise: 370_000,
    },
  );
});

test('animal and milk validation report actionable fields', () => {
  assert.deepEqual(validateAnimalDraft({ tag: ' ', category: 'cow', sex: 'female', status: 'active' }), [
    { field: 'tag', message: 'Animal tag or name is required.' },
  ]);

  assert.deepEqual(
    validateMilkEntryDraft(
      {
        animalId: '',
        milkDate: '28/08/2026',
        session: 'morning',
        volumeMl: -1,
        fatHundredths: null,
        snfHundredths: null,
      },
      true,
    ).map((issue) => issue.field),
    ['animalId', 'milkDate', 'volumeMl', 'fatHundredths', 'snfHundredths'],
  );
});

test('allocation validation enforces destination consistency', () => {
  assert.deepEqual(
    validateMilkAllocationDraft({
      destination: 'buyer',
      buyerId: null,
      volumeMl: 0,
      ratePaisePerLitre: -1,
    }).map((issue) => issue.field),
    ['buyerId', 'volumeMl', 'ratePaisePerLitre'],
  );
});

test('calculations reject invalid numeric input', () => {
  assert.throws(() => calculateFlatMilkAmountPaise(-1, 4_000), RangeError);
  assert.throws(
    () => calculateQuantityAmountPaise(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
    RangeError,
  );
});
