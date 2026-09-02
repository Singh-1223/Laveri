begin;

alter table public.correction_events
  drop constraint correction_events_entity_type_valid,
  add constraint correction_events_entity_type_valid check (
    entity_type in (
      'farm_settings',
      'milk_pricing_configs',
      'animals',
      'buyers',
      'items',
      'milk_session',
      'feed_transactions',
      'treatments',
      'product_transactions',
      'heat_events'
    )
  );

create unique index milk_pricing_configs_farm_mode_date_default_unique
  on public.milk_pricing_configs (farm_id, mode, effective_from)
  where buyer_id is null and deleted_at is null;

commit;
