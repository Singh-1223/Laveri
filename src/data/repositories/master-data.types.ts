export type AnimalRow = {
  id: string;
  tag: string;
  category: 'cow' | 'heifer' | 'calf';
  sex: 'female' | 'male';
  status: 'active' | 'inactive' | 'sold' | 'deceased';
  is_milking: number;
  breed: string | null;
  birth_date?: string | null;
  acquisition_date?: string | null;
  primary_photo_path?: string | null;
  display_order: number;
};

export type BuyerRow = {
  id: string;
  name: string;
  phone: string | null;
  default_rate_paise_per_litre: number | null;
  active: number;
  display_order: number;
};

export type ItemRow = {
  id: string;
  type: 'feed' | 'medicine' | 'product';
  name: string;
  base_unit: string;
  default_rate_paise_per_unit: number | null;
  active: number;
};

export type AnimalLabelRow = { id: string; name: string; color: string };
export type AnimalLabelLinkRow = { animal_id: string; label_id: string };

export type MasterDataSnapshot = {
  animals: AnimalRow[];
  buyers: BuyerRow[];
  items: ItemRow[];
  animalLabels: AnimalLabelRow[];
  animalLabelLinks: AnimalLabelLinkRow[];
};

export type AuditContext = {
  farmId: string;
  userId: string;
};

export type CreateAnimalInput = AuditContext & {
  tag: string;
  category: AnimalRow['category'];
  sex: AnimalRow['sex'];
  isMilking: boolean;
  breed?: string;
  birthDate?: string | null;
  acquisitionDate?: string | null;
};

export type CreateBuyerInput = AuditContext & {
  name: string;
  phone?: string;
  defaultRatePaisePerLitre?: number | null;
};

export type CreateItemInput = AuditContext & {
  type: ItemRow['type'];
  name: string;
  baseUnit: string;
  defaultRatePaisePerUnit?: number | null;
};

export type UpdateAnimalInput = CreateAnimalInput & { id: string };
export type UpdateBuyerInput = CreateBuyerInput & { id: string };
export type UpdateItemInput = CreateItemInput & { id: string };

export type SetMasterRecordActiveInput = AuditContext & {
  id: string;
  kind: 'animal' | 'buyer' | 'item';
  active: boolean;
};

export type ReorderMasterRecordInput = AuditContext & {
  id: string;
  kind: 'animal' | 'buyer';
  direction: 'up' | 'down';
};

export type CreateAnimalLabelInput = AuditContext & { name: string; color: string };
export type UpdateAnimalLabelInput = CreateAnimalLabelInput & { id: string };
export type DeleteAnimalLabelInput = AuditContext & { id: string };
export type DeleteItemInput = AuditContext & { id: string };
export type SetAnimalLabelsInput = AuditContext & { animalId: string; labelIds: string[] };
