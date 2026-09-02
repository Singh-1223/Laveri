export type CorrectionAction = 'update' | 'deactivate' | 'reactivate' | 'void';

export type CorrectionEntity =
  | 'farm_settings'
  | 'milk_pricing_configs'
  | 'animals'
  | 'buyers'
  | 'items'
  | 'milk_session'
  | 'feed_transactions'
  | 'treatments'
  | 'product_transactions'
  | 'heat_events';

export type CorrectionEventRow = {
  id: string;
  entityType: CorrectionEntity;
  recordId: string;
  action: CorrectionAction;
  reason: string | null;
  beforeData: string;
  afterData: string | null;
  occurredAt: string;
  createdBy: string;
  createdByLabel: string;
};

export type RecordCorrectionInput = {
  farmId: string;
  userId: string;
  entityType: CorrectionEntity;
  recordId: string;
  action: CorrectionAction;
  reason?: string | null;
  before: unknown;
  after?: unknown;
};
