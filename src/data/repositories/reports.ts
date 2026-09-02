import type { PeriodReport } from './reports.types';

export async function getPeriodReport(_farmId: string, _fromDate: string, _toDate: string): Promise<PeriodReport> {
  throw new Error('Offline reports require the Android or iOS development build.');
}
