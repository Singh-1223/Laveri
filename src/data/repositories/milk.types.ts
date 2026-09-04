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
  labels: { id: string; name: string; color: string }[];
};

export type MilkSessionSnapshot = {
  entries: MilkAnimalEntry[];
  allocations: MilkAllocationEntry[];
  pricingMode: 'flat' | 'quality';
  suggestedRatePaisePerLitre: number | null;
  suggestedCmFatPaise: number | null;
  suggestedCmSnfPaise: number | null;
  previousVolumesMl: Record<string, number>;
  previousAllocationVolumesMl: Record<string, number>;
  previousFatHundredths: number | null;
  previousSnfHundredths: number | null;
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
  cmFatPaise: null;
  cmSnfPaise: null;
  ratePaisePerLitre: 0;
  entries: SaveMilkEntry[];
  allocations: {
    allocationId: string | null;
    destination: 'buyer' | 'household';
    buyerId: string | null;
    volumeMl: number;
    ratePaisePerLitre: number;
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

export type MilkLaunchTarget = {
  milkDate: string;
  session: MilkSession;
};

export type ReorderMilkAnimalsInput = {
  farmId: string;
  userId: string;
  animalId: string;
  direction: 'up' | 'down';
};
