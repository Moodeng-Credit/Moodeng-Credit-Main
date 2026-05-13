ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS wallet_provider TEXT,
ADD COLUMN IF NOT EXISTS wallet_connector_name TEXT,
ADD COLUMN IF NOT EXISTS wallet_chain_id INTEGER,
ADD COLUMN IF NOT EXISTS wallet_connected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_wallet_provider
  ON public.users(wallet_provider);

CREATE TABLE IF NOT EXISTS public.guided_tour_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tour_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('shown', 'completed', 'skipped')),
  shown_count INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guided_tour_events_user_tour
  ON public.guided_tour_events(user_id, tour_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guided_tour_events_event_type
  ON public.guided_tour_events(event_type, created_at DESC);

ALTER TABLE public.guided_tour_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own guided tour events" ON public.guided_tour_events;
CREATE POLICY "Users can read own guided tour events"
  ON public.guided_tour_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own guided tour events" ON public.guided_tour_events;
CREATE POLICY "Users can insert own guided tour events"
  ON public.guided_tour_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON public.guided_tour_events TO authenticated;
