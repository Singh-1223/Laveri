export type SpikeRecord = {
  id: string;
  farm_id: string;
  note: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type LocalConflict = {
  id: string;
  table_name: string;
  record_id: string;
  operation: string;
  message: string;
  created_at: string;
};

export type PowerSyncSnapshot = {
  available: boolean;
  initialized: boolean;
  connected: boolean;
  connecting: boolean;
  hasSynced: boolean;
  pendingUploads: number;
  lastSyncedAt: string | null;
  error: string | null;
  farmId: string | null;
  records: SpikeRecord[];
  conflicts: LocalConflict[];
};

export const unavailablePowerSyncSnapshot: PowerSyncSnapshot = {
  available: false,
  initialized: false,
  connected: false,
  connecting: false,
  hasSynced: false,
  pendingUploads: 0,
  lastSyncedAt: null,
  error: 'The native PowerSync spike is available on Android and iOS development builds.',
  farmId: null,
  records: [],
  conflicts: [],
};
