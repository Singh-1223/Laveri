import type { DailyDashboardSummary } from './dashboard.types';

export async function getDailyDashboardSummary(_farmId: string, _businessDate: string): Promise<DailyDashboardSummary> {
  throw new Error('Offline dashboard requires the Android or iOS development build.');
}
