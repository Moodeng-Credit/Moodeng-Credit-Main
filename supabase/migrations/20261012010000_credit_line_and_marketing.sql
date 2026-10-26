-- Credit line reporting + marketing dashboard (admin → Finance → Credit line, Growth → Marketing).
--
--   credit_facilities        — a credit line Moodeng borrows (first: BitRepo pilot, 500 USDC at 15%/yr on
--                              deployed principal, reporting periods 17th → 16th).
--   credit_facility_loans    — which loans the facility funded, with the one-line underwriting rationale the
--                              lender's monthly report needs (Schedule B).
--   credit_facility_ledger   — movements of the facility's money that aren't loan rows: the advance, hops
--                              through Binance, draws into the lending wallet, interest paid, principal returned,
--                              and disbursement/repayment txs a loan record is missing.
--   monthly_goals            — per-month targets (lent_usd, marketing_budget_usd, cac_target_usd).
--   marketing_spend          — posters, referral payouts, ads: what was spent, when, on which code.
--   referral_codes.channel / label — tells poster codes apart from people's referral codes.
--
-- Admins only (app_private.is_moodeng_admin()), read and write from the admin panel.

create table if not exists public.credit_facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  lender_name text not null,
  commitment_usd numeric not null check (commitment_usd > 0),
  annual_rate numeric not null check (annual_rate >= 0),
  start_date date not null,
  period_anchor_day int not null default 1 check (period_anchor_day between 1 and 28),
  max_loan_usd numeric null,
  max_term_days int null,
  originator_wallet text null,
  lending_wallet text null,
  notes text null,
  created_at timestamptz not null default now()
);

create table if not exists public.credit_facility_loans (
  facility_id uuid not null references public.credit_facilities(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  rationale text null,
  added_at timestamptz not null default now(),
  primary key (facility_id, loan_id),
  -- A loan is funded by one facility at most.
  unique (loan_id)
);

create table if not exists public.credit_facility_ledger (
  id bigserial primary key,
  facility_id uuid not null references public.credit_facilities(id) on delete cascade,
  occurred_at timestamptz not null,
  kind text not null check (kind in ('advance', 'transfer', 'draw', 'disbursement', 'repayment', 'interest_payment', 'principal_return', 'fee', 'other')),
  description text not null,
  from_label text null,
  to_label text null,
  -- Signed from the facility's point of view: money coming in to Moodeng is positive.
  amount_usd numeric not null,
  tx_hash text null,
  loan_id uuid null references public.loans(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists credit_facility_ledger_facility_idx on public.credit_facility_ledger (facility_id, occurred_at);
create unique index if not exists credit_facility_ledger_tx_idx on public.credit_facility_ledger (facility_id, tx_hash, kind) where tx_hash is not null;

create table if not exists public.monthly_goals (
  month date not null check (extract(day from month) = 1),
  metric text not null check (metric in ('lent_usd', 'marketing_budget_usd', 'cac_target_usd', 'new_borrowers')),
  target numeric not null check (target >= 0),
  updated_at timestamptz not null default now(),
  primary key (month, metric)
);

create table if not exists public.marketing_spend (
  id bigserial primary key,
  spent_on date not null,
  channel text not null check (channel in ('poster', 'referral', 'ads', 'other')),
  amount_usd numeric not null check (amount_usd >= 0),
  referral_code_id uuid null references public.referral_codes(id) on delete set null,
  borrower_user_id uuid null references public.users(id) on delete set null,
  note text null,
  created_at timestamptz not null default now()
);
create index if not exists marketing_spend_spent_on_idx on public.marketing_spend (spent_on desc);

alter table public.referral_codes add column if not exists channel text not null default 'person';
alter table public.referral_codes add column if not exists label text null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'referral_codes_channel_check') then
    alter table public.referral_codes add constraint referral_codes_channel_check check (channel in ('person', 'ambassador', 'poster'));
  end if;
end $$;
update public.referral_codes set channel = 'ambassador' where is_ambassador and channel = 'person';

-- Admin-only access.
do $$
declare t text;
begin
  foreach t in array array['credit_facilities', 'credit_facility_loans', 'credit_facility_ledger', 'monthly_goals', 'marketing_spend'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin())', t || '_admin_all', t);
  end loop;
end $$;
grant usage on sequence public.credit_facility_ledger_id_seq, public.marketing_spend_id_seq to authenticated;

-- ---- Seed: BitRepo pilot (terms agreed with George 2026-10-12; draft timing clause not agreed) ----
insert into public.credit_facilities (name, lender_name, commitment_usd, annual_rate, start_date, period_anchor_day, max_loan_usd, max_term_days, originator_wallet, lending_wallet, notes)
values ('BitRepo pilot', 'Token Terrier LLC (BitRepo)', 500, 0.15, '2026-09-17', 17, 100, null,
        '0xafc69d06f30a2080101acf565c4b6766de530aaf', '0xc1022456dfd3bf36af1da553cd5631f9e76ca8d6',
        '15% simple on deployed principal, actual/365. Monthly report on the 17th. Building Credit LLC liable regardless of borrower losses.')
on conflict (name) do nothing;

insert into public.credit_facility_loans (facility_id, loan_id, rationale)
select f.id, l.id, v.rationale
from (values
  ('LOAN-1789776389440-o6le6uy', 'Level 1 ($15 starting limit), 1st loan. Didit ID verification passed. Self-reported: teacher, full-time, $700+/mo. Income check not performed (below threshold).'),
  ('LOAN-1789903420498-20fztui', 'Level 2 ($20). 2nd loan; prior $15 loan repaid in full (late). Didit ID passed (PH national ID). Self-reported: virtual assistant, full-time, $400–700/mo. Income check not performed.'),
  ('LOAN-1790500246970-dc1o99u', 'Level 4 ($60). 3rd loan; 2 prior loans repaid in full (1 late). Didit ID passed (PH driver''s license); Facebook verified. Self-reported: HR, full-time, $700+/mo. Income check not performed.'),
  ('LOAN-1790664444902-tdx3j02', 'Level 1 ($15), 1st loan. Didit ID + liveness passed (PH passport); Facebook verified. Self-reported: overseas Filipino worker, full-time, $400–700/mo. Income check not performed.'),
  ('LOAN-1791396142268-c3ca964', 'Restructure: 0% bridge so the borrower could close LOAN-1788419443238-vbsh92s. 2 prior loans repaid on time. Didit ID + liveness passed; Facebook verified. Self-reported: freelance, $700+/mo.'),
  ('LOAN-1791431916503-3hm1kr4', 'Level 4. 4th loan; prior loans repaid on time. Same borrower as the bridge loan; combined $60 open, under the $100 cap. Didit ID + liveness passed; Facebook verified.'),
  ('LOAN-1791451985887-uy8e0ll', 'Level 1 ($15), 1st loan. Didit ID passed (PH passport); Facebook verified; video call attended. Self-reported: teacher, full-time, $400–700/mo. Income check not performed.'),
  ('LOAN-1791601119883-u6mp2l9', 'Level 2 ($20): leveled up after repaying 1st loan on time (19 days early). Didit ID + liveness passed; Facebook verified.'),
  ('LOAN-1791634060577-3g9gwja', 'Level 1 ($15), 1st loan. Didit ID passed (PH driver''s license); Facebook verified; video call attended. Self-reported: content creator, freelance, $400–700/mo. Income check not performed.'),
  ('LOAN-1791696837807-5sd7tfh', 'Level 1 ($15), 1st loan. Didit ID passed (Indonesian ID); Facebook verified; video call attended. Self-reported: store manager, full-time, $200–400/mo. Income check not performed.')
) as v(tracking_id, rationale)
join public.loans l on l.tracking_id = v.tracking_id
cross join (select id from public.credit_facilities where name = 'BitRepo pilot') f
on conflict do nothing;

insert into public.credit_facility_ledger (facility_id, occurred_at, kind, description, from_label, to_label, amount_usd, tx_hash, loan_id)
select f.id, v.occurred_at::timestamptz, v.kind, v.description, v.from_label, v.to_label, v.amount, v.tx_hash,
       (select id from public.loans where tracking_id = v.tracking_id)
from (values
  ('2026-09-17 14:40:11+08', 'advance', 'BitRepo advance (test transfer)', 'BitRepo 0x4BE9…28c9', 'Originator wallet 0xafc6…0aaf', 10, '0x117a86ffdd81e970c6145797f33304fbb931429454fc0d1f338d834528b3f6a2', null),
  ('2026-09-17 15:00:05+08', 'transfer', 'Moved to Binance', 'Originator wallet 0xafc6…0aaf', 'Binance', -10, '0x310b661e8f03392e7cf1df26745e927743bef288da366216c3d8a97d091cf7f2', null),
  ('2026-09-17 22:17:35+08', 'advance', 'BitRepo advance (balance)', 'BitRepo 0x4BE9…28c9', 'Originator wallet 0xafc6…0aaf', 490, '0x2560487a42ca7816dc0ee90be8db900bfbecb4bf7d185bf98ac5d8a653ce8985', null),
  ('2026-09-17 22:20:05+08', 'transfer', 'Moved to Binance', 'Originator wallet 0xafc6…0aaf', 'Binance', -490, '0x606718b9225e806dabcea512cc413e6499ea764cbdd9fe695aefb4698b750843', null),
  ('2026-09-20 18:02:05+08', 'draw', 'Binance → lending wallet', 'Binance', 'Base app wallet 0xc102…a8d6', 30, '0xa1abc9eb16f5d6a680e9445e24c01c653b7ff3c8dd86bdd74a486a4e20684e24', null),
  ('2026-09-27 23:34:23+08', 'draw', 'Binance → lending wallet', 'Binance', 'Base app wallet 0xc102…a8d6', 59.8, '0x03ad35eb0c1688295937906a641ef6b5e9ef738d78d171fbc14e12ce9157cea8', null),
  ('2026-09-29 17:23:31+08', 'draw', 'Binance → lending wallet', 'Binance', 'Base app wallet 0xc102…a8d6', 19.8, '0x2c5650aaad69aaaafa980e568b737db3b65b6f7aa418b9b64c30154a4ab94302', null),
  ('2026-10-08 00:11:05+08', 'draw', 'Binance → lending wallet', 'Binance', 'Base app wallet 0xc102…a8d6', 30.8, '0xe7b1776e76f0ecdf8e00d6eaec1e3b634fa6d2cd8b19ae6c3a3b9c2111bc06fc', null),
  ('2026-10-08 12:07:49+08', 'draw', 'Binance → lending wallet', 'Binance', 'Base app wallet 0xc102…a8d6', 29.8, '0x717375672e4f223d7e448378c7b92f5034f2f80ebbefce3b2d971175bf4aab9b', null),
  ('2026-10-08 17:00:45+08', 'draw', 'Binance → lending wallet', 'Binance', 'Base app wallet 0xc102…a8d6', 9.8, '0x4bbc511262b82707fa77bef4278dc7b6a17971f3fe928695c4bf64d6f3e09976', null),
  ('2026-10-10 19:44:23+08', 'draw', 'Binance → lending wallet', 'Binance', 'Base app wallet 0xc102…a8d6', 29.8, '0x0c017ddd01ee36aa0a727349e9ec0a14de93b2e77ddea794497ff308c9f1a5d0', null),
  -- The 0% bridge loan's record has no tx hash; it went out as 1 + 29 USDC.
  ('2026-10-08 00:12:43+08', 'disbursement', 'Bridge loan, part 1', 'Base app wallet 0xc102…a8d6', 'Borrower', -1, '0xd245bf1673d2be35e09c7181638c7a9a7a4e80eda7b651124dd699d61a0e9c0a', 'LOAN-1791396142268-c3ca964'),
  ('2026-10-08 00:14:05+08', 'disbursement', 'Bridge loan, part 2', 'Base app wallet 0xc102…a8d6', 'Borrower', -29, '0x4265a1b240f8173e73aaa5929fcca94edd3f4b193aa3a5c903b1381587c38f2b', 'LOAN-1791396142268-c3ca964')
) as v(occurred_at, kind, description, from_label, to_label, amount, tx_hash, tracking_id)
cross join (select id from public.credit_facilities where name = 'BitRepo pilot') f
on conflict do nothing;

insert into public.monthly_goals (month, metric, target) values
  ('2026-10-01', 'lent_usd', 500),
  ('2026-10-01', 'marketing_budget_usd', 50),
  ('2026-10-01', 'cac_target_usd', 5)
on conflict (month, metric) do nothing;
