import type { SpikeRecord } from './types';
import { unavailablePowerSyncSnapshot } from './types';

export async function initializePowerSync() {}

export async function connectPowerSync() {}

export async function disconnectPowerSync() {}

export async function getPowerSyncSnapshot() {
  return unavailablePowerSyncSnapshot;
}

export async function createSpikeRecord(_farmId: string, _userId: string, _note: string) {
  throw new Error(unavailablePowerSyncSnapshot.error ?? 'PowerSync is unavailable on this platform.');
}

export async function updateSpikeRecord(_record: SpikeRecord, _userId: string, _note: string) {
  throw new Error(unavailablePowerSyncSnapshot.error ?? 'PowerSync is unavailable on this platform.');
}
