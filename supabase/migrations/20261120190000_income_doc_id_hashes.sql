-- Hashes of the government ID numbers printed on a payslip / SSS record (SSS, PhilHealth, Pag-IBIG, TIN),
-- to flag the same numbers on documents from different accounts. The numbers themselves are never stored
-- (see idKeys in supabase/functions/_shared/incomeDocs.ts).
alter table public.income_documents add column if not exists id_hashes text[] not null default '{}';
create index if not exists income_documents_id_hashes_idx on public.income_documents using gin (id_hashes);
