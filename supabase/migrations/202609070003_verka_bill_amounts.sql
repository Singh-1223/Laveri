begin;
alter table public.verka_billing_cycles add column bill_total_amount_paise integer, add column bill_corpus_paise integer;
commit;
