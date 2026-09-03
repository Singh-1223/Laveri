begin;

create table public.animal_labels (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  name text not null,
  color text not null default '#2E7D32',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint animal_labels_name_present check (char_length(trim(name)) between 1 and 48),
  constraint animal_labels_color_valid check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint animal_labels_version_positive check (version > 0),
  constraint animal_labels_id_farm_unique unique (id, farm_id)
);

create unique index animal_labels_active_name_unique
  on public.animal_labels (farm_id, lower(trim(name))) where deleted_at is null;

create table public.animal_label_links (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  animal_id uuid not null,
  label_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint animal_label_links_animal_same_farm foreign key (animal_id, farm_id) references public.animals(id, farm_id),
  constraint animal_label_links_label_same_farm foreign key (label_id, farm_id) references public.animal_labels(id, farm_id),
  constraint animal_label_links_version_positive check (version > 0)
);

create unique index animal_label_links_active_unique
  on public.animal_label_links (farm_id, animal_id, label_id) where deleted_at is null;

create index animal_label_links_animal_idx on public.animal_label_links (animal_id) where deleted_at is null;

create trigger animal_labels_audit_columns before insert or update on public.animal_labels
for each row execute function public.set_audit_columns_and_version();
create trigger animal_label_links_audit_columns before insert or update on public.animal_label_links
for each row execute function public.set_audit_columns_and_version();

alter table public.animal_labels enable row level security;
alter table public.animal_label_links enable row level security;
create policy animal_labels_select_member on public.animal_labels for select to authenticated using (public.is_active_farm_member(farm_id));
create policy animal_labels_insert_owner on public.animal_labels for insert to authenticated with check (public.is_farm_owner(farm_id) and created_by = auth.uid() and updated_by = auth.uid());
create policy animal_labels_update_owner on public.animal_labels for update to authenticated using (public.is_farm_owner(farm_id)) with check (public.is_farm_owner(farm_id) and updated_by = auth.uid());
create policy animal_label_links_select_member on public.animal_label_links for select to authenticated using (public.is_active_farm_member(farm_id));
create policy animal_label_links_insert_owner on public.animal_label_links for insert to authenticated with check (public.is_farm_owner(farm_id) and created_by = auth.uid() and updated_by = auth.uid());
create policy animal_label_links_update_owner on public.animal_label_links for update to authenticated using (public.is_farm_owner(farm_id)) with check (public.is_farm_owner(farm_id) and updated_by = auth.uid());
revoke all on public.animal_labels, public.animal_label_links from anon, authenticated;
grant select, insert, update on public.animal_labels, public.animal_label_links to authenticated;

alter publication powersync add table public.animal_labels, public.animal_label_links;

commit;
