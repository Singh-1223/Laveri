begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(32);

select has_table('public', 'farm_settings', 'farm_settings table exists');
select has_table('public', 'milk_pricing_configs', 'milk_pricing_configs table exists');
select has_table('public', 'animals', 'animals table exists');
select has_table('public', 'buyers', 'buyers table exists');
select has_table('public', 'items', 'items table exists');
select has_table('public', 'milk_entries', 'milk_entries table exists');
select has_table('public', 'milk_allocations', 'milk_allocations table exists');
select has_table('public', 'feed_transactions', 'feed_transactions table exists');
select has_table('public', 'treatments', 'treatments table exists');
select has_table('public', 'product_transactions', 'product_transactions table exists');
select has_table('public', 'heat_events', 'heat_events table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.farm_settings'::regclass), 'farm_settings has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.milk_pricing_configs'::regclass), 'milk_pricing_configs has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.animals'::regclass), 'animals has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.buyers'::regclass), 'buyers has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.items'::regclass), 'items has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.milk_entries'::regclass), 'milk_entries has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.milk_allocations'::regclass), 'milk_allocations has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.feed_transactions'::regclass), 'feed_transactions has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.treatments'::regclass), 'treatments has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.product_transactions'::regclass), 'product_transactions has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.heat_events'::regclass), 'heat_events has RLS');

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '11000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'mvp-owner@example.test',
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"MVP Owner"}',
    now(),
    now()
  ),
  (
    '22000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'mvp-outsider@example.test',
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"MVP Outsider"}',
    now(),
    now()
  );

create temporary table mvp_context (
  farm_id uuid,
  cow_id uuid not null,
  medicine_id uuid not null,
  treatment_id uuid not null
);

insert into mvp_context (cow_id, medicine_id, treatment_id)
values (
  '33000000-0000-4000-8000-000000000003',
  '44000000-0000-4000-8000-000000000004',
  '55000000-0000-4000-8000-000000000005'
);

grant select, update on mvp_context to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated","email":"mvp-owner@example.test","user_metadata":{"full_name":"MVP Owner"}}',
  true
);

select lives_ok(
  $$update mvp_context set farm_id = public.onboard_owner('MVP Dairy')$$,
  'MVP owner onboarding succeeds'
);

select results_eq(
  $$select count(*) from public.farm_settings$$,
  array[1::bigint],
  'onboarding creates default farm settings'
);

select lives_ok(
  $$
    insert into public.animals (
      id, farm_id, tag, category, sex, status, is_milking, created_by, updated_by
    )
    select cow_id, farm_id, 'Cow 01', 'cow', 'female', 'active', true,
      '22000000-0000-4000-8000-000000000002',
      '22000000-0000-4000-8000-000000000002'
    from mvp_context
  $$,
  'owner can create a milking cow'
);

select lives_ok(
  $$
    insert into public.items (
      id, farm_id, type, name, base_unit, created_by, updated_by
    )
    select medicine_id, farm_id, 'medicine', 'Medicine 01', 'ml',
      '11000000-0000-4000-8000-000000000001',
      '11000000-0000-4000-8000-000000000001'
    from mvp_context
  $$,
  'owner can create a medicine item'
);

select lives_ok(
  $$
    insert into public.treatments (
      id, farm_id, treatment_date, treated_at, animal_id, medicine_item_id,
      doctor_fee_paise, medicine_cost_paise, total_paise,
      created_by, updated_by
    )
    select treatment_id, farm_id, current_date, now(), cow_id, medicine_id,
      50000, 12500, 62500,
      '11000000-0000-4000-8000-000000000001',
      '11000000-0000-4000-8000-000000000001'
    from mvp_context
  $$,
  'owner can create a valid treatment'
);

select results_eq(
  $$select total_paise from public.treatments$$,
  array[62500::bigint],
  'treatment stores doctor fee plus medicine cost'
);

select throws_ok(
  $$
    insert into public.treatments (
      id, farm_id, treatment_date, treated_at, animal_id,
      doctor_fee_paise, medicine_cost_paise, total_paise,
      created_by, updated_by
    )
    select gen_random_uuid(), farm_id, current_date, now(), cow_id,
      100, 200, 200,
      '11000000-0000-4000-8000-000000000001',
      '11000000-0000-4000-8000-000000000001'
    from mvp_context
  $$,
  '23514',
  'new row for relation "treatments" violates check constraint "treatments_total_consistent"',
  'database rejects an inconsistent treatment total'
);

select lives_ok(
  $$update public.farms set name = 'Renamed MVP Dairy'$$,
  'farm audit trigger supports farm updates'
);

select results_eq(
  $$select version from public.farms$$,
  array[2::bigint],
  'farm update increments its version'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22000000-0000-4000-8000-000000000002","role":"authenticated","email":"mvp-outsider@example.test"}',
  true
);

select results_eq(
  $$select count(*) from public.animals$$,
  array[0::bigint],
  'unrelated authenticated user cannot read animals'
);

select * from finish();
rollback;
