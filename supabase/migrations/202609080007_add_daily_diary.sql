create table public.daily_diary (
  id uuid primary key, farm_id uuid not null references public.farms(id), diary_date date not null, comment text not null check (char_length(trim(comment)) between 1 and 4000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid not null references auth.users(id), updated_by uuid not null references auth.users(id), deleted_at timestamptz, version bigint not null default 1
);
create index daily_diary_farm_date_idx on public.daily_diary(farm_id, diary_date desc) where deleted_at is null;
create trigger daily_diary_audit_columns before insert or update on public.daily_diary for each row execute function public.set_audit_columns_and_version();
alter table public.daily_diary enable row level security;
create policy daily_diary_member on public.daily_diary for all to authenticated using (public.is_active_farm_member(farm_id)) with check (public.is_active_farm_member(farm_id));
grant select, insert, update on public.daily_diary to authenticated;
alter publication powersync add table public.daily_diary;
