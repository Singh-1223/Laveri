import type { CorrectionEventRow } from './corrections.types';

export async function listCorrectionEvents(_farmId: string, _limit = 100): Promise<CorrectionEventRow[]> {
  throw new Error('Offline correction history requires the Android or iOS development build.');
}
