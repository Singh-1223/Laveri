create table public.calculator_history (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  fat_thousandths integer not null check (fat_thousandths >= 0),
  snf_thousandths integer not null check (snf_thousandths >= 0),
  cmfat_paise integer not null check (cmfat_paise >= 0),
  cmsnf_paise integer not null check (cmsnf_paise >= 0),
  result_paise_per_litre integer not null check (result_paise_per_litre >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  deleted_at timestamptz,
  version bigint not null default 1
);

create index calculator_history_farm_created_idx
  on public.calculator_history (farm_id, created_at desc)
  where deleted_at is null;

create trigger calculator_history_audit_columns
before insert or update on public.calculator_history
for each row execute function public.set_audit_columns_and_version();

alter table public.calculator_history enable row level security;
create policy calculator_history_member on public.calculator_history for all to authenticated
  using (public.is_active_farm_member(farm_id))
  with check (public.is_active_farm_member(farm_id));
grant select, insert, update on public.calculator_history to authenticated;
alter publication powersync add table public.calculator_history;
