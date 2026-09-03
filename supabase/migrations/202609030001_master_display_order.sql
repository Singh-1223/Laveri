begin;

alter table public.animals
  add column display_order integer not null default 0;

alter table public.buyers
  add column display_order integer not null default 0;

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
