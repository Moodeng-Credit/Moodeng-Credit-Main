-- Stableyard's fee / rate fields for each QR quote (option.providerFee etc.), so a quote's cost can be
-- split into their fee and their exchange rate (until now only the all-in USDC amount was kept).
alter table public.stableyard_qr_quotes add column if not exists pricing jsonb;
comment on column public.stableyard_qr_quotes.pricing is
   'Fee / rate / spread / amount fields from Stableyard''s payment + chosen Base USDC option, keyed by path (e.g. option.providerFee).';
