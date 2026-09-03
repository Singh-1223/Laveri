import type { MilkSession } from '@/domain/types';

export type MilkAnimalEntry = {
  animalId: string;
  tag: string;
  category: 'cow' | 'heifer' | 'calf';
  entryId: string | null;
  volumeMl: number | null;
  pricingMode: 'flat' | 'quality' | null;
  flatRatePaisePerLitre: number | null;
  fatHundredths: number | null;
  snfHundredths: number | null;
  cmFatPaise: number | null;
  cmSnfPaise: number | null;
  ratePaisePerLitre: number | null;
  state: 'draft' | 'complete' | null;
};

export type MilkSessionSnapshot = {
  entries: MilkAnimalEntry[];
  allocations: MilkAllocationEntry[];
  pricingMode: 'flat' | 'quality';
  suggestedRatePaisePerLitre: number | null;
  suggestedCmFatPaise: number | null;
  suggestedCmSnfPaise: number | null;
};

export type MilkAllocationEntry = {
  key: string;
  allocationId: string | null;
  destination: 'buyer' | 'household';
  buyerId: string | null;
  label: string;
  volumeMl: number | null;
  ratePaisePerLitre: number | null;
};

export type SaveMilkEntry = {
  animalId: string;
  entryId: string | null;
  volumeMl: number;
};

export type SaveMilkSessionInput = {
  farmId: string;
  userId: string;
  milkDate: string;
  session: MilkSession;
  pricingMode: 'flat' | 'quality';
  flatRatePaisePerLitre: number | null;
  fatHundredths: number | null;
  snfHundredths: number | null;
  cmFatPaise: number | null;
  cmSnfPaise: number | null;
  ratePaisePerLitre: number;
  entries: SaveMilkEntry[];
  allocations: {
    allocationId: string | null;
    destination: 'buyer' | 'household';
    buyerId: string | null;
    volumeMl: number;
  }[];
  clearedAnimalIds: string[];
  deletedAllocationIds: string[];
};

export type VoidMilkSessionInput = {
  farmId: string;
  userId: string;
  milkDate: string;
  session: MilkSession;
  reason: string;
};
