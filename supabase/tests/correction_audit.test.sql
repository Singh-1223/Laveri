begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

select has_table('public', 'correction_events', 'correction_events table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.correction_events'::regclass), 'correction_events has RLS');

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('66000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'audit-owner@example.test', '{}', '{}', now(), now()),
  ('77000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'audit-outsider@example.test', '{}', '{}', now(), now());

create temporary table correction_context (farm_id uuid);
insert into correction_context default values;
grant select, update on correction_context to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"66000000-0000-4000-8000-000000000006","role":"authenticated"}', true);

update correction_context set farm_id = public.onboard_owner('Audit Dairy');

select lives_ok(
  $$
    insert into public.correction_events (
      id, farm_id, entity_type, record_id, action, reason,
      before_data, after_data, occurred_at, created_by
    )
    select
      '88000000-0000-4000-8000-000000000008', farm_id, 'animals',
      '99000000-0000-4000-8000-000000000009', 'update', null,
      '{"tag":"Cow 01"}', '{"tag":"Cow 02"}', now(),
      '66000000-0000-4000-8000-000000000006'
    from correction_context
  $$,
  'farm member can append a correction event'
);

select results_eq(
  $$select count(*) from public.correction_events$$,
  array[1::bigint],
  'farm member can read the appended event'
);

select throws_ok(
  $$update public.correction_events set reason = 'tampered'$$,
  '42501',
  'permission denied for table correction_events',
  'correction events cannot be updated through the client role'
);

select set_config('request.jwt.claims', '{"sub":"77000000-0000-4000-8000-000000000007","role":"authenticated"}', true);

select results_eq(
  $$select count(*) from public.correction_events$$,
  array[0::bigint],
  'unrelated user cannot read correction events'
);

select * from finish();
rollback;
