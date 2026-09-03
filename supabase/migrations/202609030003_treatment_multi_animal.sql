begin;
create table public.treatment_animals (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  treatment_id uuid not null references public.treatments(id),
  animal_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint treatment_animals_treatment_same_farm foreign key (treatment_id, farm_id) references public.treatments(id, farm_id),
  constraint treatment_animals_animal_same_farm foreign key (animal_id, farm_id) references public.animals(id, farm_id)
);
create unique index treatment_animals_active_unique on public.treatment_animals(farm_id, treatment_id, animal_id) where deleted_at is null;
create trigger treatment_animals_audit_columns before insert or update on public.treatment_animals for each row execute function public.set_audit_columns_and_version();
alter table public.treatment_animals enable row level security;
create policy treatment_animals_select_member on public.treatment_animals for select to authenticated using (public.is_active_farm_member(farm_id));
create policy treatment_animals_insert_member on public.treatment_animals for insert to authenticated with check (public.is_active_farm_member(farm_id) and created_by = auth.uid() and updated_by = auth.uid());
create policy treatment_animals_update_member on public.treatment_animals for update to authenticated using (public.is_active_farm_member(farm_id)) with check (public.is_active_farm_member(farm_id) and updated_by = auth.uid());
revoke all on public.treatment_animals from anon, authenticated;
grant select, insert, update on public.treatment_animals to authenticated;
alter publication powersync add table public.treatment_animals;
commit;
