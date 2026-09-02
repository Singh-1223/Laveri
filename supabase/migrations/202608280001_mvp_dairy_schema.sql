begin;

create type public.animal_category as enum ('cow', 'heifer', 'calf');
create type public.animal_sex as enum ('female', 'male');
create type public.animal_status as enum ('active', 'inactive', 'sold', 'deceased');
create type public.item_type as enum ('feed', 'medicine', 'product');
create type public.milk_pricing_mode as enum ('flat', 'quality');
create type public.milk_session as enum ('morning', 'evening');
create type public.milk_entry_state as enum ('draft', 'complete');
create type public.milk_destination as enum ('buyer', 'household');
create type public.product_transaction_category as enum ('operating_expense', 'investment', 'byproduct_sale');
create type public.heat_event_status as enum ('observed', 'follow_up_due', 'closed');

create table public.farm_settings (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null unique references public.farms (id),
  milk_mode public.milk_pricing_mode not null default 'flat',
  milk_unit text not null default 'L',
  default_quantity_unit text not null default 'kg',
  morning_label text not null default 'Morning',
  evening_label text not null default 'Evening',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint farm_settings_labels_present check (
    char_length(trim(morning_label)) between 1 and 40
    and char_length(trim(evening_label)) between 1 and 40
  ),
  constraint farm_settings_units_present check (
    char_length(trim(milk_unit)) between 1 and 12
    and char_length(trim(default_quantity_unit)) between 1 and 24
  ),
  constraint farm_settings_version_positive check (version > 0),
  constraint farm_settings_id_farm_unique unique (id, farm_id)
);

create table public.milk_pricing_configs (
  id uuid primary key,
  farm_id uuid not null references public.farms (id),
  mode public.milk_pricing_mode not null,
  effective_from date not null,
  effective_to date,
  buyer_id uuid,
  flat_rate_paise_per_litre bigint,
  cmfat_paise bigint,
  cmsnf_paise bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint milk_pricing_configs_dates_valid check (effective_to is null or effective_to >= effective_from),
  constraint milk_pricing_configs_values_nonnegative check (
    coalesce(flat_rate_paise_per_litre, 0) >= 0
    and coalesce(cmfat_paise, 0) >= 0
    and coalesce(cmsnf_paise, 0) >= 0
  ),
  constraint milk_pricing_configs_mode_values check (
    (mode = 'flat' and flat_rate_paise_per_litre is not null)
    or (mode = 'quality' and cmfat_paise is not null and cmsnf_paise is not null)
  ),
  constraint milk_pricing_configs_version_positive check (version > 0),
  constraint milk_pricing_configs_id_farm_unique unique (id, farm_id)
);

create table public.animals (
  id uuid primary key,
  farm_id uuid not null references public.farms (id),
  tag text not null,
  category public.animal_category not null,
  sex public.animal_sex not null,
  status public.animal_status not null default 'active',
  is_milking boolean not null default false,
  breed text,
  birth_date date,
  acquisition_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint animals_tag_length check (char_length(trim(tag)) between 1 and 80),
  constraint animals_milking_consistency check (not is_milking or (category = 'cow' and sex = 'female' and status = 'active')),
  constraint animals_dates_valid check (
    birth_date is null
    or acquisition_date is null
    or acquisition_date >= birth_date
  ),
  constraint animals_version_positive check (version > 0),
  constraint animals_id_farm_unique unique (id, farm_id)
);

create table public.buyers (
  id uuid primary key,
  farm_id uuid not null references public.farms (id),
  name text not null,
  phone text,
  default_rate_paise_per_litre bigint,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint buyers_name_length check (char_length(trim(name)) between 1 and 120),
  constraint buyers_default_rate_nonnegative check (default_rate_paise_per_litre is null or default_rate_paise_per_litre >= 0),
  constraint buyers_version_positive check (version > 0),
  constraint buyers_id_farm_unique unique (id, farm_id)
);

alter table public.milk_pricing_configs
  add constraint milk_pricing_configs_buyer_same_farm
  foreign key (buyer_id, farm_id) references public.buyers (id, farm_id);

create table public.items (
  id uuid primary key,
  farm_id uuid not null references public.farms (id),
  type public.item_type not null,
  name text not null,
  base_unit text not null,
  default_rate_paise_per_unit bigint,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint items_name_length check (char_length(trim(name)) between 1 and 120),
  constraint items_base_unit_length check (char_length(trim(base_unit)) between 1 and 24),
  constraint items_default_rate_nonnegative check (default_rate_paise_per_unit is null or default_rate_paise_per_unit >= 0),
  constraint items_version_positive check (version > 0),
  constraint items_id_farm_unique unique (id, farm_id)
);

create table public.milk_entries (
  id uuid primary key,
  farm_id uuid not null references public.farms (id),
  animal_id uuid not null,
  milk_date date not null,
  session public.milk_session not null,
  volume_ml bigint not null,
  pricing_mode public.milk_pricing_mode not null default 'flat',
  flat_rate_paise_per_litre bigint,
  fat_hundredths integer,
  snf_hundredths integer,
  cmfat_paise bigint,
  cmsnf_paise bigint,
  calculated_rate_paise_per_litre bigint not null,
  state public.milk_entry_state not null default 'draft',
  notes text,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint milk_entries_animal_same_farm foreign key (animal_id, farm_id) references public.animals (id, farm_id),
  constraint milk_entries_values_nonnegative check (
    volume_ml >= 0
    and calculated_rate_paise_per_litre >= 0
    and coalesce(flat_rate_paise_per_litre, 0) >= 0
    and coalesce(fat_hundredths, 0) >= 0
    and coalesce(snf_hundredths, 0) >= 0
    and coalesce(cmfat_paise, 0) >= 0
    and coalesce(cmsnf_paise, 0) >= 0
  ),
  constraint milk_entries_quality_ranges check (
    (fat_hundredths is null or fat_hundredths <= 1500)
    and (snf_hundredths is null or snf_hundredths <= 1500)
  ),
  constraint milk_entries_pricing_snapshot_complete check (
    (
      pricing_mode = 'flat'
      and flat_rate_paise_per_litre is not null
    ) or (
      pricing_mode = 'quality'
      and fat_hundredths is not null
      and snf_hundredths is not null
      and cmfat_paise is not null
      and cmsnf_paise is not null
    )
  ),
  constraint milk_entries_void_reason check (deleted_at is null or char_length(trim(void_reason)) > 0),
  constraint milk_entries_version_positive check (version > 0),
  constraint milk_entries_id_farm_unique unique (id, farm_id)
);

create table public.milk_allocations (
  id uuid primary key,
  farm_id uuid not null references public.farms (id),
  milk_date date not null,
  session public.milk_session not null,
  destination public.milk_destination not null,
  buyer_id uuid,
  volume_ml bigint not null,
  rate_paise_per_litre bigint not null,
  amount_paise bigint not null,
  notes text,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint milk_allocations_buyer_same_farm foreign key (buyer_id, farm_id) references public.buyers (id, farm_id),
  constraint milk_allocations_destination_consistent check (
    (destination = 'buyer' and buyer_id is not null)
    or (destination = 'household' and buyer_id is null)
  ),
  constraint milk_allocations_values_nonnegative check (volume_ml > 0 and rate_paise_per_litre >= 0 and amount_paise >= 0),
  constraint milk_allocations_void_reason check (deleted_at is null or char_length(trim(void_reason)) > 0),
  constraint milk_allocations_version_positive check (version > 0),
  constraint milk_allocations_id_farm_unique unique (id, farm_id)
);

create table public.feed_transactions (
  id uuid primary key,
  farm_id uuid not null references public.farms (id),
  transaction_date date not null,
  animal_id uuid,
  animal_category public.animal_category,
  item_id uuid not null,
  quantity_milli_units bigint not null,
  unit_code text not null,
  rate_paise_per_unit bigint not null,
  amount_paise bigint not null,
  supplier text,
  notes text,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint feed_transactions_animal_same_farm foreign key (animal_id, farm_id) references public.animals (id, farm_id),
  constraint feed_transactions_item_same_farm foreign key (item_id, farm_id) references public.items (id, farm_id),
  constraint feed_transactions_scope_present check (animal_id is not null or animal_category is not null),
  constraint feed_transactions_values_nonnegative check (quantity_milli_units > 0 and rate_paise_per_unit >= 0 and amount_paise >= 0),
  constraint feed_transactions_unit_present check (char_length(trim(unit_code)) between 1 and 24),
  constraint feed_transactions_void_reason check (deleted_at is null or char_length(trim(void_reason)) > 0),
  constraint feed_transactions_version_positive check (version > 0)
);

create table public.treatments (
  id uuid primary key,
  farm_id uuid not null references public.farms (id),
  treatment_date date not null,
  treated_at timestamptz not null,
  animal_id uuid not null,
  medicine_item_id uuid,
  dose_milli_units bigint,
  dose_unit text,
  doctor_fee_paise bigint not null default 0,
  medicine_cost_paise bigint not null default 0,
  total_paise bigint not null,
  notes text,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint treatments_animal_same_farm foreign key (animal_id, farm_id) references public.animals (id, farm_id),
  constraint treatments_medicine_same_farm foreign key (medicine_item_id, farm_id) references public.items (id, farm_id),
  constraint treatments_values_nonnegative check (
    coalesce(dose_milli_units, 0) >= 0
    and doctor_fee_paise >= 0
    and medicine_cost_paise >= 0
    and total_paise >= 0
  ),
  constraint treatments_total_consistent check (total_paise = doctor_fee_paise + medicine_cost_paise),
  constraint treatments_dose_consistent check (
    (dose_milli_units is null and dose_unit is null)
    or (dose_milli_units is not null and dose_unit is not null and char_length(trim(dose_unit)) > 0)
  ),
  constraint treatments_void_reason check (deleted_at is null or char_length(trim(void_reason)) > 0),
  constraint treatments_version_positive check (version > 0)
);

create table public.product_transactions (
  id uuid primary key,
  farm_id uuid not null references public.farms (id),
  transaction_date date not null,
  animal_id uuid,
  animal_category public.animal_category,
  item_id uuid not null,
  category public.product_transaction_category not null,
  quantity_milli_units bigint not null,
  unit_code text not null,
  rate_paise_per_unit bigint not null,
  amount_paise bigint not null,
  supplier text,
  notes text,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint product_transactions_animal_same_farm foreign key (animal_id, farm_id) references public.animals (id, farm_id),
  constraint product_transactions_item_same_farm foreign key (item_id, farm_id) references public.items (id, farm_id),
  constraint product_transactions_values_nonnegative check (quantity_milli_units > 0 and rate_paise_per_unit >= 0 and amount_paise >= 0),
  constraint product_transactions_unit_present check (char_length(trim(unit_code)) between 1 and 24),
  constraint product_transactions_void_reason check (deleted_at is null or char_length(trim(void_reason)) > 0),
  constraint product_transactions_version_positive check (version > 0)
);

create table public.heat_events (
  id uuid primary key,
  farm_id uuid not null references public.farms (id),
  animal_id uuid not null,
  observed_at timestamptz not null,
  signs text,
  status public.heat_event_status not null default 'observed',
  follow_up_at timestamptz,
  notes text,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint heat_events_animal_same_farm foreign key (animal_id, farm_id) references public.animals (id, farm_id),
  constraint heat_events_follow_up_valid check (follow_up_at is null or follow_up_at >= observed_at),
  constraint heat_events_void_reason check (deleted_at is null or char_length(trim(void_reason)) > 0),
  constraint heat_events_version_positive check (version > 0)
);

create unique index animals_active_tag_unique
  on public.animals (farm_id, lower(trim(tag)))
  where deleted_at is null;

create unique index buyers_active_name_unique
  on public.buyers (farm_id, lower(trim(name)))
  where deleted_at is null;

create unique index items_active_name_unique
  on public.items (farm_id, type, lower(trim(name)))
  where deleted_at is null;

create unique index milk_entries_active_slot_unique
  on public.milk_entries (farm_id, animal_id, milk_date, session)
  where deleted_at is null;

create unique index milk_allocations_active_destination_unique
  on public.milk_allocations (
    farm_id,
    milk_date,
    session,
    destination,
    coalesce(buyer_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where deleted_at is null;

create index milk_entries_farm_date_idx on public.milk_entries (farm_id, milk_date desc, session);
create index milk_allocations_farm_date_idx on public.milk_allocations (farm_id, milk_date desc, session);
create index feed_transactions_farm_date_idx on public.feed_transactions (farm_id, transaction_date desc);
create index treatments_farm_date_idx on public.treatments (farm_id, treated_at desc);
create index product_transactions_farm_date_idx on public.product_transactions (farm_id, transaction_date desc);
create index heat_events_farm_date_idx on public.heat_events (farm_id, observed_at desc);

create or replace function public.set_farm_audit_columns_and_version()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'An authenticated user is required';
  end if;

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    new.version := 1;
  else
    if new.id <> old.id then
      raise exception 'Record identity is immutable';
    end if;

    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := auth.uid();
    new.version := old.version + 1;
  end if;

  return new;
end;
$$;

drop trigger farms_audit_columns on public.farms;
create trigger farms_audit_columns
before insert or update on public.farms
for each row execute function public.set_farm_audit_columns_and_version();

insert into public.farm_settings (farm_id, created_by, updated_by)
select farm.id, farm.created_by, farm.updated_by
from public.farms farm
where farm.deleted_at is null
on conflict (farm_id) do nothing;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'farm_settings',
    'milk_pricing_configs',
    'animals',
    'buyers',
    'items',
    'milk_entries',
    'milk_allocations',
    'feed_transactions',
    'treatments',
    'product_transactions',
    'heat_events'
  ] loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.set_audit_columns_and_version()',
      table_name || '_audit_columns',
      table_name
    );
  end loop;
end;
$$;

create or replace function public.onboard_owner(farm_name text default 'Laveri Dairy')
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  existing_farm_id uuid;
  new_farm_id uuid;
  normalized_name text := trim(farm_name);
begin
  if current_user_id is null then
    raise exception 'An authenticated user is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  select membership.farm_id
    into existing_farm_id
  from public.farm_members membership
  where membership.user_id = current_user_id
    and membership.role = 'owner'
    and membership.status = 'active'
    and membership.deleted_at is null
  order by membership.created_at
  limit 1;

  if existing_farm_id is not null then
    insert into public.farm_settings (farm_id, created_by, updated_by)
    values (existing_farm_id, current_user_id, current_user_id)
    on conflict (farm_id) do nothing;
    return existing_farm_id;
  end if;

  if normalized_name is null or char_length(normalized_name) = 0 then
    raise exception 'Farm name is required';
  end if;

  insert into public.profiles (id, display_name, email, avatar_url)
  values (
    current_user_id,
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() ->> 'email', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'avatar_url', '')
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        email = excluded.email,
        avatar_url = excluded.avatar_url,
        updated_at = now();

  insert into public.farms (name, created_by, updated_by)
  values (normalized_name, current_user_id, current_user_id)
  returning id into new_farm_id;

  insert into public.farm_members (
    farm_id,
    user_id,
    role,
    status,
    created_by,
    updated_by
  ) values (
    new_farm_id,
    current_user_id,
    'owner',
    'active',
    current_user_id,
    current_user_id
  );

  insert into public.farm_settings (farm_id, created_by, updated_by)
  values (new_farm_id, current_user_id, current_user_id);

  return new_farm_id;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'farm_settings',
    'milk_pricing_configs',
    'animals',
    'buyers',
    'items',
    'milk_entries',
    'milk_allocations',
    'feed_transactions',
    'treatments',
    'product_transactions',
    'heat_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_active_farm_member(farm_id))',
      table_name || '_select_member',
      table_name
    );
  end loop;

  foreach table_name in array array[
    'farm_settings',
    'milk_pricing_configs',
    'animals',
    'buyers',
    'items'
  ] loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_farm_owner(farm_id) and created_by = auth.uid() and updated_by = auth.uid())',
      table_name || '_insert_owner',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_farm_owner(farm_id)) with check (public.is_farm_owner(farm_id) and updated_by = auth.uid())',
      table_name || '_update_owner',
      table_name
    );
  end loop;

  foreach table_name in array array[
    'milk_entries',
    'milk_allocations',
    'feed_transactions',
    'treatments',
    'product_transactions',
    'heat_events'
  ] loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_active_farm_member(farm_id) and created_by = auth.uid() and updated_by = auth.uid())',
      table_name || '_insert_member',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_active_farm_member(farm_id)) with check (public.is_active_farm_member(farm_id) and updated_by = auth.uid())',
      table_name || '_update_member',
      table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'farm_settings',
    'milk_pricing_configs',
    'animals',
    'buyers',
    'items',
    'milk_entries',
    'milk_allocations',
    'feed_transactions',
    'treatments',
    'product_transactions',
    'heat_events'
  ] loop
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update on public.%I to authenticated', table_name);
  end loop;
end;
$$;

revoke all on function public.set_farm_audit_columns_and_version() from public, anon, authenticated;

commit;
