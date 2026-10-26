-- Daily FX for admin → Finance → Borrower real cost (team only). Once a day the fx-daily function saves
-- the USDC→PHP / USDC→IDR rates and the exchanges' live buy/sell prices, so the dashboard's spreads are
-- measured instead of guessed, and posts a short "FX today" note to the team.
--
--   fx_daily_snapshots      — one row per day × currency × venue. 'ecb' (daily reference, mid only) and
--                             'coinbase' (USDC mid) are rates; 'coins_ph', 'tokocrypto', 'indodax' carry
--                             the top of their order book (bid / ask), i.e. the real spread. PDAX has no
--                             public prices, so Coins.ph's book stands in for the PHP spread.
--   exchange_cost_settings  — the per-trip exchange costs the dashboard uses, shared by the whole team
--                             (they were kept per browser before). Seeded with the dashboard defaults.
-- Admins read both; only the function (service role) writes snapshots.

CREATE TABLE IF NOT EXISTS public.fx_daily_snapshots (
   snapshot_date date NOT NULL,
   currency text NOT NULL CHECK (currency IN ('PHP', 'IDR')),
   venue text NOT NULL,
   mid numeric,
   bid numeric,
   ask numeric,
   captured_at timestamptz NOT NULL DEFAULT now(),
   PRIMARY KEY (snapshot_date, currency, venue)
);
ALTER TABLE public.fx_daily_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fx_daily_snapshots FROM anon;
DROP POLICY IF EXISTS fx_daily_snapshots_admin_read ON public.fx_daily_snapshots;
CREATE POLICY fx_daily_snapshots_admin_read ON public.fx_daily_snapshots FOR SELECT TO authenticated USING (app_private.is_moodeng_admin());

CREATE TABLE IF NOT EXISTS public.exchange_cost_settings (
   currency text PRIMARY KEY CHECK (currency IN ('PHP', 'IDR')),
   settings jsonb NOT NULL,
   updated_at timestamptz NOT NULL DEFAULT now(),
   updated_by uuid DEFAULT auth.uid()
);
ALTER TABLE public.exchange_cost_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exchange_cost_settings FROM anon;
DROP POLICY IF EXISTS exchange_cost_settings_admin_all ON public.exchange_cost_settings;
CREATE POLICY exchange_cost_settings_admin_all ON public.exchange_cost_settings FOR ALL TO authenticated
   USING (app_private.is_moodeng_admin()) WITH CHECK (app_private.is_moodeng_admin());

INSERT INTO public.exchange_cost_settings (currency, settings, updated_by) VALUES
   ('PHP', '{"label":"PDAX","sendToExchangeUsdc":0.01,"sellPct":0.005,"cashOutLocal":15,"cashInLocal":0,"buyPct":0.005,"withdrawToWalletUsdc":0.08}', NULL),
   ('IDR', '{"label":"Tokocrypto","sendToExchangeUsdc":0.01,"sellPct":0.002222,"cashOutLocal":0,"cashInLocal":0,"buyPct":0.002222,"withdrawToWalletUsdc":0.2}', NULL)
ON CONFLICT (currency) DO NOTHING;

-- 09:15 Manila (01:15 UTC), then hourly until noon so a failed run is retried; fx-daily posts at most
-- once a day (telegram_bot_settings.fx_daily_date, set only after a successful post).
DO $$
BEGIN
   PERFORM cron.unschedule('fx-daily-snapshot');
EXCEPTION
   WHEN OTHERS THEN
      NULL;
END $$;

SELECT cron.schedule(
   'fx-daily-snapshot',
   '15 1-4 * * *',
   $$
   SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/fx-daily',
      headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SECRET_KEY' LIMIT 1)
      ),
      body := '{}'::jsonb
   )
   $$
);
