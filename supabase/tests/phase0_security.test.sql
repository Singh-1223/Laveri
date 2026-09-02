begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(32);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'farms', 'farms table exists');
select has_table('public', 'farm_members', 'farm_members table exists');
select has_table('public', 'spike_records', 'spike_records table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.farms'::regclass),
  'farms has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.farm_members'::regclass),
  'farm_members has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.spike_records'::regclass),
  'spike_records has RLS enabled'
);

select policies_are(
  'public',
  'profiles',
  array['profiles_select_own', 'profiles_update_own'],
  'profiles has only the expected policies'
);
select policies_are(
  'public',
  'farms',
  array['farms_select_member', 'farms_update_owner'],
  'farms has only the expected policies'
);
select policies_are(
  'public',
  'farm_members',
  array[
    'farm_members_insert_owner',
    'farm_members_select_self_or_owner',
    'farm_members_update_owner'
  ],
  'farm_members has only the expected policies'
);
select policies_are(
  'public',
  'spike_records',
  array[
    'spike_records_insert_member',
    'spike_records_select_member',
    'spike_records_update_member'
  ],
  'spike_records has only the expected policies'
);

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
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'owner@example.test',
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Farm Owner"}',
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'outsider@example.test',
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"Unrelated User"}',
    now(),
    now()
  );

create temporary table phase0_context (
  owner_id uuid not null,
  outsider_id uuid not null,
  farm_id uuid,
  record_id uuid not null
);

insert into phase0_context (owner_id, outsider_id, record_id)
values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003'
);

grant select, update on phase0_context to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","email":"owner@example.test","user_metadata":{"full_name":"Farm Owner"}}',
  true
);

select lives_ok(
  $$
    update phase0_context
    set farm_id = public.onboard_owner('Family Farm')
  $$,
  'owner onboarding succeeds'
);

select results_eq(
  $$select count(*) from public.farms$$,
  array[1::bigint],
  'onboarding creates one visible farm'
);

select results_eq(
  $$select count(*) from public.farm_members where role = 'owner'$$,
  array[1::bigint],
  'onboarding creates one owner membership'
);

select results_eq(
  $$select count(*) from public.profiles$$,
  array[1::bigint],
  'onboarding creates the owner profile'
);

select is(
  public.onboard_owner('Ignored second name'),
  (select farm_id from phase0_context),
  'onboarding is idempotent for an existing owner'
);

select results_eq(
  $$select count(*) from public.farms$$,
  array[1::bigint],
  'idempotent onboarding does not create a second farm'
);

select lives_ok(
  $$
    insert into public.spike_records (
      id,
      farm_id,
      note,
      created_by,
      updated_by
    )
    select record_id, farm_id, 'Offline record', outsider_id, outsider_id
    from phase0_context
  $$,
  'farm owner can create a farm record'
);

select results_eq(
  $$select count(*) from public.spike_records$$,
  array[1::bigint],
  'owner can read the inserted farm record'
);

select results_eq(
  $$
    select created_by
    from public.spike_records
    where id = (select record_id from phase0_context)
  $$,
  array['10000000-0000-4000-8000-000000000001'::uuid],
  'insert trigger replaces a forged creator with auth.uid()'
);

select results_eq(
  $$select version from public.spike_records$$,
  array[1::bigint],
  'new records start at version one'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated","email":"outsider@example.test","user_metadata":{"full_name":"Unrelated User"}}',
  true
);

select results_eq(
  $$select count(*) from public.farms$$,
  array[0::bigint],
  'an unrelated authenticated user cannot read the owner farm'
);

select results_eq(
  $$select count(*) from public.spike_records$$,
  array[0::bigint],
  'an unrelated authenticated user cannot read farm records'
);

select throws_ok(
  $$
    insert into public.spike_records (
      id,
      farm_id,
      note,
      created_by,
      updated_by
    )
    select gen_random_uuid(), farm_id, 'Forged cross-farm row', outsider_id, outsider_id
    from phase0_context
  $$,
  '42501',
  'new row violates row-level security policy for table "spike_records"',
  'an unrelated user cannot insert into the owner farm'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","email":"owner@example.test","user_metadata":{"full_name":"Farm Owner"}}',
  true
);

select lives_ok(
  $$
    update public.spike_records
    set note = 'Corrected offline record'
    where id = (select record_id from phase0_context)
  $$,
  'owner can update a farm record'
);

select results_eq(
  $$select version from public.spike_records$$,
  array[2::bigint],
  'update trigger increments the version'
);

select results_eq(
  $$select created_by from public.spike_records$$,
  array['10000000-0000-4000-8000-000000000001'::uuid],
  'update trigger preserves the original creator'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated","email":"outsider@example.test"}',
  true
);

select results_eq(
  $$
    update public.spike_records
    set note = 'Unauthorized change'
    where id = (select record_id from phase0_context)
    returning 1
  $$,
  $$select 1 where false$$,
  'an unrelated user cannot update the owner record'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","email":"owner@example.test"}',
  true
);

select throws_ok(
  $$delete from public.spike_records where true$$,
  '42501',
  'permission denied for table spike_records',
  'hard delete is denied even to the owner'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{}', true);

select throws_ok(
  $$select * from public.farms$$,
  '42501',
  'permission denied for table farms',
  'an unauthenticated caller has no farm read grant'
);

select throws_ok(
  $$select public.onboard_owner('Anonymous Farm')$$,
  '42501',
  'permission denied for function onboard_owner',
  'an unauthenticated caller cannot execute onboarding'
);

select * from finish();
rollback;
