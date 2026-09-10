begin;
create table public.household_monthly_settings (
  id uuid primary key, farm_id uuid not null references public.farms(id), month_key text not null,
  rate_paise_per_litre integer, self_payment_paise integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id), updated_by uuid not null references auth.users(id), deleted_at timestamptz, version bigint not null default 1,
  constraint household_monthly_settings_month_valid check (month_key ~ '^\\d{4}-\\d{2}$'),
  constraint household_monthly_settings_farm_month_unique unique (farm_id, month_key)
);
create trigger household_monthly_settings_audit before insert or update on public.household_monthly_settings for each row execute function public.set_audit_columns_and_version();
alter table public.household_monthly_settings enable row level security;
create policy household_monthly_settings_member on public.household_monthly_settings for all to authenticated using (public.is_active_farm_member(farm_id)) with check (public.is_active_farm_member(farm_id));
grant select,insert,update on public.household_monthly_settings to authenticated;
alter publication powersync add table public.household_monthly_settings;
commit;
