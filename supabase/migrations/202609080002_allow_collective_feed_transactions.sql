-- Feed is recorded as a collective farm-production cost, not per animal.
-- Older schema required an animal or animal category, blocking valid offline entries.
alter table public.feed_transactions
  drop constraint if exists feed_transactions_scope_present;
