import type { AnimalMilkGraphSnapshot, DailyDiaryCategory, DailyDiaryRow, DeleteDailyDiaryCategoryInput, DeleteDailyDiaryInput, FarmAverageMilkPoint, MilkProductionDetailRow, MilkQualityRecord, PeriodReport, SaveDailyDiaryCategoryInput, SaveDailyDiaryInput } from './reports.types';
const unavailable = () => new Error('Offline reports require the Android or iOS development build.');

export async function getPeriodReport(_farmId: string, _fromDate: string, _toDate: string): Promise<PeriodReport> {
  throw new Error('Offline reports require the Android or iOS development build.');
}

export async function getQualityRecords(_farmId: string, _fromDate: string, _toDate: string): Promise<MilkQualityRecord[]> {
  throw new Error('Offline reports require the Android or iOS development build.');
}

export async function getMilkSourceEntries(_farmId: string, _fromDate: string, _toDate: string): Promise<MilkProductionDetailRow[]> {
  throw unavailable();
}
export async function getAnimalMilkGraph(_farmId: string, _fromDate: string, _toDate: string): Promise<AnimalMilkGraphSnapshot> { throw unavailable(); }
export async function getFarmAverageMilk(_farmId: string, _fromDate: string, _toDate: string): Promise<FarmAverageMilkPoint[]> { throw unavailable(); }
export async function getDailyDiary(_farmId: string, _fromDate: string, _toDate: string): Promise<DailyDiaryRow[]> { throw unavailable(); }
export async function saveDailyDiary(_input: SaveDailyDiaryInput) { throw unavailable(); }
export async function deleteDailyDiary(_input: DeleteDailyDiaryInput) { throw unavailable(); }
export async function listDailyDiaryCategories(_farmId: string): Promise<DailyDiaryCategory[]> { throw unavailable(); }
export async function saveDailyDiaryCategory(_input: SaveDailyDiaryCategoryInput) { throw unavailable(); }
export async function deleteDailyDiaryCategory(_input: DeleteDailyDiaryCategoryInput) { throw unavailable(); }
