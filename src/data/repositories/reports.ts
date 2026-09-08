import type { MilkProductionDetailRow, MilkQualityRecord, PeriodReport } from './reports.types';

export async function getPeriodReport(_farmId: string, _fromDate: string, _toDate: string): Promise<PeriodReport> {
  throw new Error('Offline reports require the Android or iOS development build.');
}

export async function getQualityRecords(_farmId: string, _fromDate: string, _toDate: string): Promise<MilkQualityRecord[]> {
  throw new Error('Offline reports require the Android or iOS development build.');
}

export async function getMilkSourceEntries(_farmId: string, _fromDate: string, _toDate: string): Promise<MilkProductionDetailRow[]> {
  throw new Error('Offline reports require the Android or iOS development build.');
}
