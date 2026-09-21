begin;

alter table public.animals
  add column milk_entry_category text not null default 'not_milking'
  check (milk_entry_category in ('milking', 'not_milking', 'milk_calf'));

-- Migrations run without an app-authenticated JWT. Temporarily bypass the
-- row audit trigger for this one-time backfill, then restore it immediately.
alter table public.animals disable trigger user;
update public.animals
set milk_entry_category = case when is_milking then 'milking' else 'not_milking' end;
alter table public.animals enable trigger user;

create table public.milk_calf_allocations (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  animal_id uuid not null,
  milk_date date not null,
  session public.milk_session not null,
  volume_ml bigint not null check (volume_ml >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint milk_calf_allocations_animal_same_farm foreign key (animal_id, farm_id) references public.animals(id, farm_id)
);
create unique index milk_calf_allocations_active_session_unique on public.milk_calf_allocations (farm_id, animal_id, milk_date, session) where deleted_at is null;
create trigger milk_calf_allocations_audit_columns before insert or update on public.milk_calf_allocations for each row execute function public.set_audit_columns_and_version();
alter table public.milk_calf_allocations enable row level security;
create policy milk_calf_allocations_member on public.milk_calf_allocations for all to authenticated using (public.is_active_farm_member(farm_id)) with check (public.is_active_farm_member(farm_id));
grant select, insert, update on public.milk_calf_allocations to authenticated;
alter publication powersync add table public.milk_calf_allocations;

create table public.daily_diary_categories (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  name text not null,
  display_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint daily_diary_categories_name_present check (char_length(trim(name)) between 1 and 80)
);
create unique index daily_diary_categories_active_name_unique on public.daily_diary_categories (farm_id, lower(trim(name))) where deleted_at is null;
create trigger daily_diary_categories_audit_columns before insert or update on public.daily_diary_categories for each row execute function public.set_audit_columns_and_version();
alter table public.daily_diary_categories enable row level security;
create policy daily_diary_categories_member on public.daily_diary_categories for all to authenticated using (public.is_active_farm_member(farm_id)) with check (public.is_active_farm_member(farm_id));
grant select, insert, update on public.daily_diary_categories to authenticated;
alter publication powersync add table public.daily_diary_categories;

alter table public.daily_diary add column category_id uuid references public.daily_diary_categories(id);
create index daily_diary_category_date_idx on public.daily_diary (farm_id, category_id, diary_date desc) where deleted_at is null;

commit;
