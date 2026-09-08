-- Investment and silage are simple farm-level amount entries. They do not
-- require a separately maintained product item.
alter table public.product_transactions
  alter column item_id drop not null;
