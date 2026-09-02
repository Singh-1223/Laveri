import type {
  CreateAnimalInput,
  CreateBuyerInput,
  CreateItemInput,
  MasterDataSnapshot,
  SetMasterRecordActiveInput,
  UpdateAnimalInput,
  UpdateBuyerInput,
  UpdateItemInput,
} from './master-data.types';

const unavailable = () => new Error('Offline master data requires the Android or iOS development build.');

export async function listMasterData(): Promise<MasterDataSnapshot> {
  throw unavailable();
}

export async function createAnimal(_input: CreateAnimalInput) {
  throw unavailable();
}

export async function createBuyer(_input: CreateBuyerInput) {
  throw unavailable();
}

export async function createItem(_input: CreateItemInput) {
  throw unavailable();
}

export async function updateAnimal(_input: UpdateAnimalInput) {
  throw unavailable();
}

export async function updateBuyer(_input: UpdateBuyerInput) {
  throw unavailable();
}

export async function updateItem(_input: UpdateItemInput) {
  throw unavailable();
}

export async function setMasterRecordActive(_input: SetMasterRecordActiveInput) {
  throw unavailable();
}
