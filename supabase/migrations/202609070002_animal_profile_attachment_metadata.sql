begin;

alter table public.animal_photos
  add column attachment_date date,
  add column is_profile boolean not null default false;

alter table public.animal_photos disable trigger user;
update public.animal_photos set attachment_date = created_at::date where attachment_date is null;
alter table public.animal_photos alter column attachment_date set not null;
alter table public.animal_photos enable trigger user;

create unique index animal_photos_one_active_profile
  on public.animal_photos (animal_id)
  where is_profile and deleted_at is null;

create index animal_photos_history_date_idx
  on public.animal_photos (animal_id, attachment_date desc, created_at desc)
  where deleted_at is null;

commit;
