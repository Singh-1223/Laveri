begin;

create table public.correction_events (
  id uuid primary key,
  farm_id uuid not null references public.farms (id),
  entity_type text not null,
  record_id text not null,
  action text not null,
  reason text,
  before_data text not null,
  after_data text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint correction_events_entity_type_valid check (
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
  ),
  constraint correction_events_action_valid check (
    action in ('update', 'deactivate', 'reactivate', 'void')
  ),
  constraint correction_events_record_id_present check (char_length(trim(record_id)) > 0),
  constraint correction_events_before_data_present check (char_length(trim(before_data)) > 0),
  constraint correction_events_void_reason_present check (
    action <> 'void' or char_length(trim(reason)) > 0
  )
);

create index correction_events_farm_occurred_idx
  on public.correction_events (farm_id, occurred_at desc);

alter table public.correction_events enable row level security;

create policy correction_events_select_member
on public.correction_events
for select
to authenticated
using (public.is_active_farm_member(farm_id));

create policy correction_events_insert_member
on public.correction_events
for insert
to authenticated
with check (
  public.is_active_farm_member(farm_id)
  and created_by = auth.uid()
);

revoke all on public.correction_events from anon, authenticated;
grant select, insert on public.correction_events to authenticated;

commit;
