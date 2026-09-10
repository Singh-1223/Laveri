begin;

alter table public.household_monthly_settings
  drop constraint if exists household_monthly_settings_month_valid;

alter table public.household_monthly_settings
  add constraint household_monthly_settings_month_valid
  check (month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

commit;
