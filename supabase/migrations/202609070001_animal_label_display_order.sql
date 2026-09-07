begin;

alter table public.animal_labels
  add column display_order integer not null default 0;

-- This maintenance backfill runs as the migration role. Disable the audit
-- trigger only while assigning the initial stable order.
alter table public.animal_labels disable trigger user;

with ordered as (
  select id, row_number() over (partition by farm_id order by name collate "C", id) as display_order
  from public.animal_labels
)
update public.animal_labels target
set display_order = ordered.display_order
from ordered
where target.id = ordered.id;

alter table public.animal_labels enable trigger user;

create index animal_labels_farm_display_order_idx
  on public.animal_labels (farm_id, display_order, name)
  where deleted_at is null;

commit;
