-- Web Push (RFC 8291) delivery channel.
--
-- Until now every user-facing notification went out over email + Telegram. Both
-- are pull channels in practice: email lands in a tab nobody has open, Telegram
-- only reaches the minority of users who linked the bot. Push reaches the device
-- lock screen, which is the whole point for the two time-sensitive moments we
-- care about:
--   1. a lender seeing that a borrower who already repaid them is asking again
--   2. a borrower whose repayment is due inside 24 hours
--
-- One row per browser/device subscription, not per user — a user with a phone
-- and a laptop has two. The (p256dh, auth) pair is the per-subscription key
-- material the push service requires to decrypt the payload; it is useless
-- without the server's VAPID private key, but it is still per-device secret
-- material, so it is never exposed beyond the owner and the service role.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Push service URL issued by the browser vendor (FCM / Mozilla / Apple).
  endpoint TEXT NOT NULL,
  -- RFC 8291 client key material, base64url, as returned by PushSubscription.toJSON().
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  -- Locale captured at subscribe time so the payload can be written in the
  -- user's language. The app supports en / fil / id; anything else falls to en.
  locale TEXT NOT NULL DEFAULT 'en',
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Refreshed every time the client re-registers, so stale devices are visible.
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_success_at TIMESTAMPTZ,
  -- Consecutive send failures. Reset on success; a subscription that 404/410s is
  -- deleted outright by the delivery helper rather than counted.
  failure_count INTEGER NOT NULL DEFAULT 0
);

-- The endpoint is the push service's own identifier for the device. Unique so a
-- re-subscribe upserts instead of fanning out duplicate notifications.
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_key
  ON public.push_subscriptions (endpoint);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- A user may see, register, refresh and revoke only their own devices.
DROP POLICY IF EXISTS "Users read their push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users read their push subscriptions"
  ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users register their push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users register their push subscriptions"
  ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users refresh their push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users refresh their push subscriptions"
  ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users revoke their push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users revoke their push subscriptions"
  ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Edge functions send and prune.
DROP POLICY IF EXISTS "Service role manages push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Service role manages push subscriptions"
  ON public.push_subscriptions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Per-channel opt-out, sitting alongside the existing notif_* category flags.
-- Category flags still apply on top: a user with notif_transaction_activity off
-- gets no due-date push even with push enabled.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notif_push BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.notif_push IS
  'User wants browser/device push notifications. Independent of the notif_* category flags, which still gate each notification type.';
