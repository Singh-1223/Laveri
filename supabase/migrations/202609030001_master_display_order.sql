begin;

alter table public.animals
  add column display_order integer not null default 0;

alter table public.buyers
  add column display_order integer not null default 0;

-- This one-time backfill is run by the migration role, not an authenticated app
-- user. Temporarily disable only user triggers so the audit trigger does not
-- reject the maintenance update; re-enable them before committing.
alter table public.animals disable trigger user;
alter table public.buyers disable trigger user;

with ordered as (
  select id, row_number() over (partition by farm_id order by tag collate "C", id) as display_order
  from public.animals
)
update public.animals target
set display_order = ordered.display_order
from ordered
where target.id = ordered.id;

with ordered as (
  select id, row_number() over (partition by farm_id order by name collate "C", id) as display_order
  from public.buyers
)
update public.buyers target
set display_order = ordered.display_order
from ordered
where target.id = ordered.id;

alter table public.animals enable trigger user;
alter table public.buyers enable trigger user;

create index animals_farm_display_order_idx
  on public.animals (farm_id, display_order, tag)
  where deleted_at is null;

create index buyers_farm_display_order_idx
  on public.buyers (farm_id, display_order, name)
  where deleted_at is null;

alter table public.correction_events
  drop constraint correction_events_action_valid,
  add constraint correction_events_action_valid
    check (action in ('update', 'deactivate', 'reactivate', 'void', 'reorder'));

commit;
