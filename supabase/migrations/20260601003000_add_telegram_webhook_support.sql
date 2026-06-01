INSERT INTO public.telegram_bot_settings (key, value, description)
VALUES
  ('lender_direct_notifications_enabled', 'false', 'Set to true when lender private Telegram repayment DMs are ready.'),
  ('support_group_chat_id', '', 'Private Telegram support supergroup chat id for forum-topic support inbox.')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.support_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_chat_id BIGINT UNIQUE NOT NULL,
  thread_id BIGINT NOT NULL,
  username TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT support_sessions_status_check CHECK (status IN ('open', 'resolved'))
);

ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage support sessions" ON public.support_sessions;
CREATE POLICY "Service role can manage support sessions"
  ON public.support_sessions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_support_sessions_thread_open
  ON public.support_sessions (thread_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_support_sessions_customer_status
  ON public.support_sessions (customer_chat_id, status);

CREATE TABLE IF NOT EXISTS public.telegram_connect_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.telegram_connect_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage telegram connect tokens" ON public.telegram_connect_tokens;
CREATE POLICY "Service role can manage telegram connect tokens"
  ON public.telegram_connect_tokens
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_telegram_connect_tokens_token_active
  ON public.telegram_connect_tokens (token)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_connect_tokens_user_created
  ON public.telegram_connect_tokens (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.telegram_referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL,
  username TEXT,
  referral_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.telegram_referral_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage telegram referral clicks" ON public.telegram_referral_clicks;
CREATE POLICY "Service role can manage telegram referral clicks"
  ON public.telegram_referral_clicks
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_telegram_referral_clicks_code
  ON public.telegram_referral_clicks (referral_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_referral_clicks_chat
  ON public.telegram_referral_clicks (chat_id, created_at DESC);
