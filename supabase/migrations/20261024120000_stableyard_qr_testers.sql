-- Stableyard "Pay a store QR" field test: a short list of people (e.g. our PH teammate) who may use
-- the /testqr screen before it's offered to borrowers, plus a log of every USDC quote it gets so we
-- can measure Stableyard's real spread against the market rate at that moment.
--
-- Admins (admin_users owner/admin) can always use it. Add a tester by hand:
--   insert into public.stableyard_qr_testers (user_id, note) values ('<users.id>', 'PH teammate');
-- All writes come from the stableyard-deposit-address edge function (service role).

create table if not exists public.stableyard_qr_testers (
   user_id   uuid primary key references public.users(id) on delete cascade,
   note      text,
   added_at  timestamptz not null default now()
);

comment on table public.stableyard_qr_testers is
   'Who may use the Pay a store QR test screen (/testqr) besides admins. Added by hand.';

create table if not exists public.stableyard_qr_quotes (
   id              bigint generated always as identity primary key,
   user_id         uuid not null references public.users(id) on delete cascade,
   payment_id      text,
   country         text not null,
   fiat_currency   text not null,
   fiat_amount     numeric not null,
   usdc_amount     numeric,            -- what Stableyard asked for (depositInstructions.amount)
   market_rate     numeric,            -- fiat per USD from open.er-api.com at quote time
   market_rate_at  timestamptz,        -- when that market rate was last updated
   merchant_name   text,
   sent_tx_hash    text,               -- set when the person actually paid
   created_at      timestamptz not null default now()
);

comment on table public.stableyard_qr_quotes is
   'Every /testqr USDC quote. spread = usdc_amount / (fiat_amount / market_rate) - 1.';

create index if not exists stableyard_qr_quotes_created_idx on public.stableyard_qr_quotes (created_at desc);

alter table public.stableyard_qr_testers enable row level security;
alter table public.stableyard_qr_quotes enable row level security;

drop policy if exists "admins read stableyard qr testers" on public.stableyard_qr_testers;
create policy "admins read stableyard qr testers" on public.stableyard_qr_testers
   for select to authenticated
   using (app_private.is_moodeng_admin());

drop policy if exists "owners read own stableyard qr quotes" on public.stableyard_qr_quotes;
create policy "owners read own stableyard qr quotes" on public.stableyard_qr_quotes
   for select to authenticated
   using (user_id = auth.uid() or app_private.is_moodeng_admin());

revoke all on table public.stableyard_qr_testers, public.stableyard_qr_quotes from public, anon;
grant select on table public.stableyard_qr_testers, public.stableyard_qr_quotes to authenticated;
grant all on table public.stableyard_qr_testers, public.stableyard_qr_quotes to service_role;
