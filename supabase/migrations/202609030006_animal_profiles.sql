begin;
create type public.animal_event_kind as enum ('birth','purchase','lactation','calving','custom');
create table public.animal_events (
 id uuid primary key, farm_id uuid not null references public.farms(id), animal_id uuid not null, event_date date not null, kind public.animal_event_kind not null, title text not null, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid not null references auth.users(id), updated_by uuid not null references auth.users(id), deleted_at timestamptz, version bigint not null default 1,
 constraint animal_events_animal_same_farm foreign key (animal_id,farm_id) references public.animals(id,farm_id)
);
create table public.animal_photos (
 id uuid primary key, farm_id uuid not null references public.farms(id), animal_id uuid not null, storage_path text not null, file_name text not null, caption text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid not null references auth.users(id), updated_by uuid not null references auth.users(id), deleted_at timestamptz, version bigint not null default 1,
 constraint animal_photos_animal_same_farm foreign key (animal_id,farm_id) references public.animals(id,farm_id)
);
create trigger animal_events_audit_columns before insert or update on public.animal_events for each row execute function public.set_audit_columns_and_version();
create trigger animal_photos_audit_columns before insert or update on public.animal_photos for each row execute function public.set_audit_columns_and_version();
alter table public.animal_events enable row level security; alter table public.animal_photos enable row level security;
create policy animal_events_member on public.animal_events for all to authenticated using (public.is_active_farm_member(farm_id)) with check (public.is_active_farm_member(farm_id));
create policy animal_photos_member on public.animal_photos for all to authenticated using (public.is_active_farm_member(farm_id)) with check (public.is_active_farm_member(farm_id));
grant select,insert,update on public.animal_events,public.animal_photos to authenticated;
alter publication powersync add table public.animal_events, public.animal_photos;
insert into storage.buckets(id,name,public) values ('animal-files','animal-files',false) on conflict(id) do nothing;
create policy animal_files_member on storage.objects for all to authenticated using (bucket_id='animal-files' and public.is_active_farm_member((storage.foldername(name))[1]::uuid)) with check (bucket_id='animal-files' and public.is_active_farm_member((storage.foldername(name))[1]::uuid));
commit;
