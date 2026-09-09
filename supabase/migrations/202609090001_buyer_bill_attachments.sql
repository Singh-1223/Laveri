begin;

create table public.buyer_bill_attachments (
  id uuid primary key,
  farm_id uuid not null references public.farms(id),
  buyer_id uuid not null,
  bill_date date not null,
  storage_path text not null,
  file_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  deleted_at timestamptz,
  version bigint not null default 1,
  constraint buyer_bill_attachments_buyer_same_farm foreign key (buyer_id, farm_id) references public.buyers(id, farm_id)
);
create trigger buyer_bill_attachments_audit_columns before insert or update on public.buyer_bill_attachments for each row execute function public.set_audit_columns_and_version();
create index buyer_bill_attachments_buyer_date_idx on public.buyer_bill_attachments (buyer_id, bill_date desc, created_at desc) where deleted_at is null;
alter table public.buyer_bill_attachments enable row level security;
create policy buyer_bill_attachments_member on public.buyer_bill_attachments for all to authenticated using (public.is_active_farm_member(farm_id)) with check (public.is_active_farm_member(farm_id));
grant select,insert,update on public.buyer_bill_attachments to authenticated;
alter publication powersync add table public.buyer_bill_attachments;

insert into storage.buckets(id,name,public) values ('buyer-bill-files','buyer-bill-files',false) on conflict(id) do nothing;
create policy buyer_bill_files_member on storage.objects for all to authenticated using (bucket_id='buyer-bill-files' and public.is_active_farm_member((storage.foldername(name))[1]::uuid)) with check (bucket_id='buyer-bill-files' and public.is_active_farm_member((storage.foldername(name))[1]::uuid));
commit;
