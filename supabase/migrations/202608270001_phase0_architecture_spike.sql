begin;

create type public.farm_member_role as enum ('owner', 'operator');
create type public.farm_member_status as enum ('active', 'inactive');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 120)
);

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  locale text not null default 'en-IN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint farms_name_length check (char_length(trim(name)) between 1 and 120),
  constraint farms_version_positive check (version > 0)
);

create table public.farm_members (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.farm_member_role not null default 'operator',
  status public.farm_member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint farm_members_version_positive check (version > 0),
  constraint farm_members_one_membership unique (farm_id, user_id)
);

create table public.spike_records (
  id uuid primary key,
  farm_id uuid not null references public.farms (id),
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint spike_records_note_length check (char_length(trim(note)) between 1 and 500),
  constraint spike_records_version_positive check (version > 0)
);

create index farm_members_user_active_idx
  on public.farm_members (user_id, farm_id)
  where status = 'active' and deleted_at is null;

create index spike_records_farm_updated_idx
  on public.spike_records (farm_id, updated_at desc)
  where deleted_at is null;

create or replace function public.is_active_farm_member(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.farm_members membership
    where membership.farm_id = target_farm_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.deleted_at is null
  );
$$;

create or replace function public.is_farm_owner(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.farm_members membership
    where membership.farm_id = target_farm_id
      and membership.user_id = auth.uid()
      and membership.role = 'owner'
      and membership.status = 'active'
      and membership.deleted_at is null
  );
$$;

create or replace function public.set_audit_columns_and_version()
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
    if new.id <> old.id or new.farm_id <> old.farm_id then
      raise exception 'Record identity and farm ownership are immutable';
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

create trigger farms_audit_columns
before insert or update on public.farms
for each row execute function public.set_audit_columns_and_version();

create trigger farm_members_audit_columns
before insert or update on public.farm_members
for each row execute function public.set_audit_columns_and_version();

create trigger spike_records_audit_columns
before insert or update on public.spike_records
for each row execute function public.set_audit_columns_and_version();

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

  -- Prevent simultaneous first-use requests on two devices from creating two farms.
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

  return new_farm_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.farm_members enable row level security;
alter table public.spike_records enable row level security;

create policy profiles_select_own
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy farms_select_member
on public.farms for select
to authenticated
using (public.is_active_farm_member(id));

create policy farms_update_owner
on public.farms for update
to authenticated
using (public.is_farm_owner(id))
with check (public.is_farm_owner(id));

create policy farm_members_select_self_or_owner
on public.farm_members for select
to authenticated
using (user_id = auth.uid() or public.is_farm_owner(farm_id));

create policy farm_members_insert_owner
on public.farm_members for insert
to authenticated
with check (public.is_farm_owner(farm_id));

create policy farm_members_update_owner
on public.farm_members for update
to authenticated
using (public.is_farm_owner(farm_id))
with check (public.is_farm_owner(farm_id));

create policy spike_records_select_member
on public.spike_records for select
to authenticated
using (public.is_active_farm_member(farm_id));

create policy spike_records_insert_member
on public.spike_records for insert
to authenticated
with check (
  public.is_active_farm_member(farm_id)
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy spike_records_update_member
on public.spike_records for update
to authenticated
using (public.is_active_farm_member(farm_id))
with check (
  public.is_active_farm_member(farm_id)
  and updated_by = auth.uid()
);

-- Supabase may auto-grant exposed-schema objects to API roles. Remove those defaults
-- before adding the application's exact operation-level grants.
revoke all on public.profiles from anon, authenticated;
revoke all on public.farms from anon, authenticated;
revoke all on public.farm_members from anon, authenticated;
revoke all on public.spike_records from anon, authenticated;

revoke all on function public.is_active_farm_member(uuid) from public, anon, authenticated;
revoke all on function public.is_farm_owner(uuid) from public, anon, authenticated;
revoke all on function public.onboard_owner(text) from public, anon, authenticated;
revoke all on function public.set_audit_columns_and_version() from public, anon, authenticated;

grant execute on function public.is_active_farm_member(uuid) to authenticated;
grant execute on function public.is_farm_owner(uuid) to authenticated;
grant execute on function public.onboard_owner(text) to authenticated;

grant select, update on public.profiles to authenticated;
grant select, update on public.farms to authenticated;
grant select, insert, update on public.farm_members to authenticated;
grant select, insert, update on public.spike_records to authenticated;

commit;
