alter table public.animals
  add column milk_display_order integer not null default 0;

-- This is a one-time backfill. The normal audit trigger correctly requires an
-- authenticated app user, so it is temporarily disabled for the migration.
alter table public.animals disable trigger user;

with ordered as (
  select id, row_number() over (partition by farm_id order by display_order, tag collate "C", id) as milk_display_order
  from public.animals
)
update public.animals target
set milk_display_order = ordered.milk_display_order
from ordered
where target.id = ordered.id;

alter table public.animals enable trigger user;

create index animals_farm_milk_display_order_idx
  on public.animals (farm_id, milk_display_order, tag);
