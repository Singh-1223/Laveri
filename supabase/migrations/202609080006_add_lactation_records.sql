create table public.lactation_records (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  animal_id uuid not null,
  ai_date date,
  semen_or_bull_name text,
  calving_date date,
  calf_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint lactation_records_animal_same_farm foreign key (animal_id, farm_id) references public.animals(id, farm_id),
  constraint lactation_records_dates_valid check (calving_date is null or ai_date is null or calving_date >= ai_date)
);

create index lactation_records_animal_date_idx on public.lactation_records (animal_id, ai_date desc) where deleted_at is null;
create trigger lactation_records_audit_columns before insert or update on public.lactation_records for each row execute function public.set_audit_columns_and_version();
alter table public.lactation_records enable row level security;
create policy lactation_records_member on public.lactation_records for all to authenticated using (public.is_active_farm_member(farm_id)) with check (public.is_active_farm_member(farm_id));
grant select, insert, update on public.lactation_records to authenticated;
alter publication powersync add table public.lactation_records;
