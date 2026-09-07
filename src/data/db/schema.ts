import { column, Schema, Table } from '@powersync/react-native';

const auditColumns = {
  created_at: column.text,
  updated_at: column.text,
  created_by: column.text,
  updated_by: column.text,
  deleted_at: column.text,
  version: column.integer,
};

const versioned = { trackPrevious: { columns: ['version'], onlyWhenChanged: true } };

const profiles = new Table({
  display_name: column.text,
  email: column.text,
  avatar_url: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const farms = new Table(
  {
    name: column.text,
    currency: column.text,
    timezone: column.text,
    locale: column.text,
    ...auditColumns,
  },
  versioned,
);

const farmMembers = new Table(
  {
    farm_id: column.text,
    user_id: column.text,
    role: column.text,
    status: column.text,
    ...auditColumns,
  },
  { indexes: { by_user: ['user_id'], by_farm: ['farm_id'] } },
);

const farmSettings = new Table(
  {
    farm_id: column.text,
    milk_mode: column.text,
    milk_unit: column.text,
    default_quantity_unit: column.text,
    morning_label: column.text,
    evening_label: column.text,
    ...auditColumns,
  },
  { ...versioned, indexes: { by_farm: ['farm_id'] } },
);

const milkPricingConfigs = new Table(
  {
    farm_id: column.text,
    mode: column.text,
    effective_from: column.text,
    effective_to: column.text,
    buyer_id: column.text,
    flat_rate_paise_per_litre: column.integer,
    cmfat_paise: column.integer,
    cmsnf_paise: column.integer,
    ...auditColumns,
  },
  { ...versioned, indexes: { by_farm_date: ['farm_id', '-effective_from'] } },
);

const animals = new Table(
  {
    farm_id: column.text,
    tag: column.text,
    category: column.text,
    sex: column.text,
    status: column.text,
    is_milking: column.integer,
    breed: column.text,
    birth_date: column.text,
    acquisition_date: column.text,
    notes: column.text,
    display_order: column.integer,
    milk_display_order: column.integer,
    ...auditColumns,
  },
  { ...versioned, indexes: { by_farm_status: ['farm_id', 'status'], by_farm_tag: ['farm_id', 'tag'] } },
);

const animalLabels = new Table(
  { farm_id: column.text, name: column.text, color: column.text, display_order: column.integer, ...auditColumns },
  { ...versioned, indexes: { by_farm_name: ['farm_id', 'name'] } },
);

const animalLabelLinks = new Table(
  { farm_id: column.text, animal_id: column.text, label_id: column.text, ...auditColumns },
  { ...versioned, indexes: { by_animal: ['animal_id'], by_label: ['label_id'] } },
);

const animalEvents = new Table(
  { farm_id: column.text, animal_id: column.text, event_date: column.text, kind: column.text, title: column.text, notes: column.text, ...auditColumns },
  { ...versioned, indexes: { by_animal_date: ['animal_id', '-event_date'] } },
);

const animalPhotos = new Table(
  { farm_id: column.text, animal_id: column.text, storage_path: column.text, file_name: column.text, caption: column.text, attachment_date: column.text, is_profile: column.integer, ...auditColumns },
  { ...versioned, indexes: { by_animal: ['animal_id'] } },
);

const buyers = new Table(
  {
    farm_id: column.text,
    name: column.text,
    phone: column.text,
    default_rate_paise_per_litre: column.integer,
    active: column.integer,
    notes: column.text,
    display_order: column.integer,
    ...auditColumns,
  },
  { ...versioned, indexes: { by_farm_active: ['farm_id', 'active'], by_farm_name: ['farm_id', 'name'] } },
);

const buyerPayments = new Table(
  { farm_id: column.text, buyer_id: column.text, payment_date: column.text, amount_paise: column.integer, mode: column.text, notes: column.text, ...auditColumns },
  { ...versioned, indexes: { by_buyer_date: ['buyer_id', '-payment_date'] } },
);

const verkaBillingCycles = new Table(
  { farm_id: column.text, buyer_id: column.text, cycle_start: column.text, cycle_end: column.text, final_rate_paise_per_litre: column.integer, commission_paise: column.integer, increment_paise: column.integer, deduction_paise: column.integer, notes: column.text, bill_path: column.text, bill_name: column.text, bill_morning_ml: column.integer, bill_evening_ml: column.integer, bill_total_ml: column.integer, bill_total_amount_paise: column.integer, bill_corpus_paise: column.integer, ...auditColumns },
  { ...versioned, indexes: { by_buyer_cycle: ['buyer_id', '-cycle_start'] } },
);

const items = new Table(
  {
    farm_id: column.text,
    type: column.text,
    name: column.text,
    base_unit: column.text,
    default_rate_paise_per_unit: column.integer,
    active: column.integer,
    notes: column.text,
    ...auditColumns,
  },
  { ...versioned, indexes: { by_farm_type_active: ['farm_id', 'type', 'active'] } },
);

const milkEntries = new Table(
  {
    farm_id: column.text,
    animal_id: column.text,
    milk_date: column.text,
    session: column.text,
    volume_ml: column.integer,
    pricing_mode: column.text,
    flat_rate_paise_per_litre: column.integer,
    fat_hundredths: column.integer,
    snf_hundredths: column.integer,
    cmfat_paise: column.integer,
    cmsnf_paise: column.integer,
    calculated_rate_paise_per_litre: column.integer,
    state: column.text,
    notes: column.text,
    void_reason: column.text,
    ...auditColumns,
  },
  { ...versioned, indexes: { by_farm_date: ['farm_id', '-milk_date', 'session'], by_animal_date: ['animal_id', '-milk_date'] } },
);

const milkAllocations = new Table(
  {
    farm_id: column.text,
    milk_date: column.text,
    session: column.text,
    destination: column.text,
    buyer_id: column.text,
    volume_ml: column.integer,
    rate_paise_per_litre: column.integer,
    amount_paise: column.integer,
    notes: column.text,
    void_reason: column.text,
    ...auditColumns,
  },
  { ...versioned, indexes: { by_farm_date: ['farm_id', '-milk_date', 'session'], by_buyer_date: ['buyer_id', '-milk_date'] } },
);

const feedTransactions = new Table(
  {
    farm_id: column.text,
    transaction_date: column.text,
    animal_id: column.text,
    animal_category: column.text,
    item_id: column.text,
    quantity_milli_units: column.integer,
    unit_code: column.text,
    rate_paise_per_unit: column.integer,
    amount_paise: column.integer,
    supplier: column.text,
    notes: column.text,
    void_reason: column.text,
    ...auditColumns,
  },
  { ...versioned, indexes: { by_farm_date: ['farm_id', '-transaction_date'] } },
);

const treatments = new Table(
  {
    farm_id: column.text,
    treatment_date: column.text,
    treated_at: column.text,
    animal_id: column.text,
    medicine_item_id: column.text,
    dose_milli_units: column.integer,
    dose_unit: column.text,
    doctor_fee_paise: column.integer,
    medicine_cost_paise: column.integer,
    total_paise: column.integer,
    notes: column.text,
    void_reason: column.text,
    ...auditColumns,
  },
  { ...versioned, indexes: { by_farm_date: ['farm_id', '-treated_at'], by_animal_date: ['animal_id', '-treated_at'] } },
);

const treatmentAnimals = new Table(
  { farm_id: column.text, treatment_id: column.text, animal_id: column.text, ...auditColumns },
  { ...versioned, indexes: { by_treatment: ['treatment_id'], by_animal: ['animal_id'] } },
);

const productTransactions = new Table(
  {
    farm_id: column.text,
    transaction_date: column.text,
    animal_id: column.text,
    animal_category: column.text,
    item_id: column.text,
    category: column.text,
    quantity_milli_units: column.integer,
    unit_code: column.text,
    rate_paise_per_unit: column.integer,
    amount_paise: column.integer,
    supplier: column.text,
    notes: column.text,
    void_reason: column.text,
    ...auditColumns,
  },
  { ...versioned, indexes: { by_farm_date: ['farm_id', '-transaction_date'], by_category_date: ['category', '-transaction_date'] } },
);

const heatEvents = new Table(
  {
    farm_id: column.text,
    animal_id: column.text,
    observed_at: column.text,
    signs: column.text,
    status: column.text,
    follow_up_at: column.text,
    notes: column.text,
    void_reason: column.text,
    ...auditColumns,
  },
  { ...versioned, indexes: { by_farm_date: ['farm_id', '-observed_at'], by_animal_date: ['animal_id', '-observed_at'] } },
);

const spikeRecords = new Table(
  {
    farm_id: column.text,
    note: column.text,
    ...auditColumns,
  },
  { ...versioned, indexes: { by_farm_updated: ['farm_id', '-updated_at'] } },
);

const correctionEvents = new Table(
  {
    farm_id: column.text,
    entity_type: column.text,
    record_id: column.text,
    action: column.text,
    reason: column.text,
    before_data: column.text,
    after_data: column.text,
    occurred_at: column.text,
    created_at: column.text,
    created_by: column.text,
  },
  { insertOnly: true, indexes: { by_farm_occurred: ['farm_id', '-occurred_at'] } },
);

const syncConflicts = Table.createLocalOnly(
  {
    table_name: column.text,
    record_id: column.text,
    operation: column.text,
    message: column.text,
    local_payload: column.text,
    remote_payload: column.text,
    created_at: column.text,
    resolved_at: column.text,
  },
  { indexes: { unresolved: ['resolved_at', '-created_at'] } },
);

export const appSchema = new Schema({
  profiles,
  farms,
  farm_members: farmMembers,
  farm_settings: farmSettings,
  milk_pricing_configs: milkPricingConfigs,
  animals,
  animal_labels: animalLabels,
  animal_label_links: animalLabelLinks,
  animal_events: animalEvents,
  animal_photos: animalPhotos,
  buyers,
  buyer_payments: buyerPayments,
  verka_billing_cycles: verkaBillingCycles,
  items,
  milk_entries: milkEntries,
  milk_allocations: milkAllocations,
  feed_transactions: feedTransactions,
  treatments,
  treatment_animals: treatmentAnimals,
  product_transactions: productTransactions,
  heat_events: heatEvents,
  correction_events: correctionEvents,
  spike_records: spikeRecords,
  sync_conflicts: syncConflicts,
});
