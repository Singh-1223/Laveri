alter table public.verka_billing_cycles
  add column bill_morning_ml integer,
  add column bill_evening_ml integer,
  add column bill_total_ml integer;
