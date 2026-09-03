begin;
create table public.buyer_payments (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  buyer_id uuid not null,
  payment_date date not null,
  amount_paise bigint not null,
  mode text not null,
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id), updated_by uuid not null references auth.users(id),
  deleted_at timestamptz, version bigint not null default 1,
  constraint buyer_payments_buyer_same_farm foreign key (buyer_id, farm_id) references public.buyers(id, farm_id),
  constraint buyer_payments_amount_positive check (amount_paise > 0),
  constraint buyer_payments_mode_valid check (mode in ('cash', 'online', 'other'))
);
create index buyer_payments_buyer_date_idx on public.buyer_payments(buyer_id, payment_date desc) where deleted_at is null;
create trigger buyer_payments_audit_columns before insert or update on public.buyer_payments for each row execute function public.set_audit_columns_and_version();
alter table public.buyer_payments enable row level security;
create policy buyer_payments_select_member on public.buyer_payments for select to authenticated using (public.is_active_farm_member(farm_id));
create policy buyer_payments_insert_member on public.buyer_payments for insert to authenticated with check (public.is_active_farm_member(farm_id) and created_by = auth.uid() and updated_by = auth.uid());
create policy buyer_payments_update_member on public.buyer_payments for update to authenticated using (public.is_active_farm_member(farm_id)) with check (public.is_active_farm_member(farm_id) and updated_by = auth.uid());
revoke all on public.buyer_payments from anon, authenticated;
grant select, insert, update on public.buyer_payments to authenticated;
alter publication powersync add table public.buyer_payments;
commit;
