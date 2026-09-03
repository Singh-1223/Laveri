begin;

create table public.verka_billing_cycles (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  buyer_id uuid not null,
  cycle_start date not null,
  cycle_end date not null,
  final_rate_paise_per_litre bigint,
  commission_paise bigint not null default 0,
  increment_paise bigint not null default 0,
  deduction_paise bigint not null default 0,
  notes text,
  bill_path text,
  bill_name text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id), updated_by uuid not null references auth.users(id),
  deleted_at timestamptz, version bigint not null default 1,
  constraint verka_billing_buyer_same_farm foreign key (buyer_id, farm_id) references public.buyers(id, farm_id),
  constraint verka_billing_dates_valid check (cycle_end >= cycle_start),
  constraint verka_billing_rate_valid check (final_rate_paise_per_litre is null or final_rate_paise_per_litre >= 0),
  constraint verka_billing_adjustments_nonnegative check (commission_paise >= 0 and increment_paise >= 0 and deduction_paise >= 0),
  constraint verka_billing_cycle_unique unique (farm_id, buyer_id, cycle_start)
);
create index verka_billing_cycles_buyer_date_idx on public.verka_billing_cycles(buyer_id, cycle_start desc) where deleted_at is null;
create trigger verka_billing_cycles_audit_columns before insert or update on public.verka_billing_cycles for each row execute function public.set_audit_columns_and_version();
alter table public.verka_billing_cycles enable row level security;
create policy verka_billing_cycles_select_member on public.verka_billing_cycles for select to authenticated using (public.is_active_farm_member(farm_id));
create policy verka_billing_cycles_insert_member on public.verka_billing_cycles for insert to authenticated with check (public.is_active_farm_member(farm_id) and created_by = auth.uid() and updated_by = auth.uid());
create policy verka_billing_cycles_update_member on public.verka_billing_cycles for update to authenticated using (public.is_active_farm_member(farm_id)) with check (public.is_active_farm_member(farm_id) and updated_by = auth.uid());
revoke all on public.verka_billing_cycles from anon, authenticated;
grant select, insert, update on public.verka_billing_cycles to authenticated;
alter publication powersync add table public.verka_billing_cycles;

insert into storage.buckets (id, name, public) values ('verka-bills', 'verka-bills', false) on conflict (id) do nothing;
create policy verka_bills_select_member on storage.objects for select to authenticated using (bucket_id = 'verka-bills' and public.is_active_farm_member((storage.foldername(name))[1]::uuid));
create policy verka_bills_insert_member on storage.objects for insert to authenticated with check (bucket_id = 'verka-bills' and public.is_active_farm_member((storage.foldername(name))[1]::uuid));

commit;
