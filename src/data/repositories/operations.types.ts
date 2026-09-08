import type { AnimalRow, ItemRow } from './master-data.types';

export type OperationKind = 'feed' | 'treatment' | 'product' | 'silage' | 'investment' | 'heat' | 'other';

export type OperationHistoryRow = {
  id: string;
  kind: OperationKind;
  businessDate: string;
  createdAt: string;
  title: string;
  detail: string | null;
  amountPaise: number;
  isVoided: number;
  voidReason: string | null;
  animalId: string | null;
  itemId: string | null;
  quantityMilliUnits: number | null;
  unitCode: string | null;
  ratePaisePerUnit: number | null;
  doctorFeePaise: number | null;
  medicineCostPaise: number | null;
  notes: string | null;
  productCategory: CreateProductInput['category'] | null;
};

type OperationContext = {
  farmId: string;
  userId: string;
  businessDate: string;
  notes?: string;
};

export type CreateFeedInput = OperationContext & {
  animalId: string | null;
  animalCategory: AnimalRow['category'] | null;
  itemId: string;
  quantityMilliUnits: number;
  unitCode: string;
  ratePaisePerUnit: number;
};

export type CreateTreatmentInput = OperationContext & {
  animalIds: string[];
  medicineItemId: string | null;
  doseMilliUnits: number | null;
  doseUnit: string | null;
  doctorFeePaise: number;
  medicineCostPaise: number;
};

export type CreateProductInput = OperationContext & {
  animalId: string | null;
  animalCategory: AnimalRow['category'] | null;
  itemId: string | null;
  category: 'operating_expense' | 'silage' | 'investment' | 'byproduct_sale';
  quantityMilliUnits: number;
  unitCode: string;
  ratePaisePerUnit: number;
};

export type CreateHeatInput = OperationContext & {
  animalId: string;
  signs?: string;
};
export type CreateOtherEventInput = OperationContext & { animalIds: string[]; eventType?: string; costPaise?: number | null };

export type UpdateFeedInput = CreateFeedInput & { id: string };
export type UpdateTreatmentInput = OperationContext & {
  id: string;
  animalId: string;
  medicineItemId: string | null;
  doctorFeePaise: number;
  medicineCostPaise: number;
};
export type UpdateProductInput = CreateProductInput & { id: string };
export type UpdateHeatInput = CreateHeatInput & { id: string };

export type OperationOptions = {
  animals: AnimalRow[];
  items: ItemRow[];
};

export type VoidOperationInput = {
  farmId: string;
  userId: string;
  id: string;
  kind: OperationKind;
  reason: string;
};
