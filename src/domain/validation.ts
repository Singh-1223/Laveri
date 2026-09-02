import type { MilkDestination, ValidationIssue } from './types';

export type AnimalDraft = {
  tag: string;
  category: 'cow' | 'heifer' | 'calf';
  sex: 'female' | 'male';
  status: 'active' | 'inactive' | 'sold' | 'deceased';
};

export type MilkEntryDraft = {
  animalId: string;
  milkDate: string;
  session: 'morning' | 'evening';
  volumeMl: number;
  fatHundredths?: number | null;
  snfHundredths?: number | null;
};

export type MilkAllocationDraft = {
  destination: MilkDestination;
  buyerId?: string | null;
  volumeMl: number;
  ratePaisePerLitre: number;
};

const BUSINESS_DATE = /^\d{4}-\d{2}-\d{2}$/;

function nonNegativeSafeInteger(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function validateAnimalDraft(draft: AnimalDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tag = draft.tag.trim();

  if (!tag) issues.push({ field: 'tag', message: 'Animal tag or name is required.' });
  if (tag.length > 80) issues.push({ field: 'tag', message: 'Animal tag or name must be 80 characters or fewer.' });

  if (draft.category !== 'cow' && draft.status === 'active' && draft.sex === 'male') {
    // This is allowed for calves/heifers only if the selected category/sex is intentional.
    if (draft.category === 'heifer') {
      issues.push({ field: 'sex', message: 'A heifer must be female; use the calf category for a young male animal.' });
    }
  }

  return issues;
}

export function validateMilkEntryDraft(draft: MilkEntryDraft, qualityMode: boolean): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!draft.animalId) issues.push({ field: 'animalId', message: 'Select an animal.' });
  if (!BUSINESS_DATE.test(draft.milkDate)) issues.push({ field: 'milkDate', message: 'Use a valid YYYY-MM-DD farm date.' });
  if (!nonNegativeSafeInteger(draft.volumeMl)) {
    issues.push({ field: 'volumeMl', message: 'Milk volume cannot be negative.' });
  }

  if (qualityMode) {
    if (!nonNegativeSafeInteger(draft.fatHundredths ?? -1)) {
      issues.push({ field: 'fatHundredths', message: 'Enter a non-negative FAT percentage.' });
    }
    if (!nonNegativeSafeInteger(draft.snfHundredths ?? -1)) {
      issues.push({ field: 'snfHundredths', message: 'Enter a non-negative SNF percentage.' });
    }
  }

  return issues;
}

export function validateMilkAllocationDraft(draft: MilkAllocationDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (draft.destination === 'buyer' && !draft.buyerId) {
    issues.push({ field: 'buyerId', message: 'Select a buyer for a buyer allocation.' });
  }
  if (draft.destination === 'household' && draft.buyerId) {
    issues.push({ field: 'buyerId', message: 'Household consumption cannot be assigned to a buyer.' });
  }
  if (!nonNegativeSafeInteger(draft.volumeMl) || draft.volumeMl === 0) {
    issues.push({ field: 'volumeMl', message: 'Allocation volume must be greater than zero.' });
  }
  if (!nonNegativeSafeInteger(draft.ratePaisePerLitre)) {
    issues.push({ field: 'ratePaisePerLitre', message: 'Rate cannot be negative.' });
  }

  return issues;
}
