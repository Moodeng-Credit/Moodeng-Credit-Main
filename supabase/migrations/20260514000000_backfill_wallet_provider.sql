ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS wallet_provider TEXT,
ADD COLUMN IF NOT EXISTS wallet_connector_name TEXT,
ADD COLUMN IF NOT EXISTS wallet_chain_id INTEGER,
ADD COLUMN IF NOT EXISTS wallet_connected_at TIMESTAMPTZ;

UPDATE public.users
SET
  wallet_provider = CASE
    WHEN wallet_connector_name IS NULL OR btrim(wallet_connector_name) = '' THEN 'unknown'
    WHEN lower(regexp_replace(wallet_connector_name, '[^a-z0-9]', '', 'g')) LIKE '%coinbase%' THEN 'base_wallet'
    WHEN lower(regexp_replace(wallet_connector_name, '[^a-z0-9]', '', 'g')) LIKE '%base%' THEN 'base_wallet'
    WHEN lower(regexp_replace(wallet_connector_name, '[^a-z0-9]', '', 'g')) LIKE '%metamask%' THEN 'metamask'
    WHEN lower(regexp_replace(wallet_connector_name, '[^a-z0-9]', '', 'g')) LIKE '%phantom%' THEN 'phantom'
    WHEN lower(regexp_replace(wallet_connector_name, '[^a-z0-9]', '', 'g')) LIKE '%walletconnect%' THEN 'walletconnect'
    WHEN lower(regexp_replace(wallet_connector_name, '[^a-z0-9]', '', 'g')) LIKE '%trust%' THEN 'trust'
    WHEN lower(regexp_replace(wallet_connector_name, '[^a-z0-9]', '', 'g')) LIKE '%rainbow%' THEN 'rainbow'
    WHEN lower(regexp_replace(wallet_connector_name, '[^a-z0-9]', '', 'g')) LIKE '%argent%' THEN 'argent'
    ELSE 'unknown'
  END,
  wallet_connected_at = COALESCE(wallet_connected_at, updated_at, created_at, NOW())
WHERE wallet_address IS NOT NULL
  AND btrim(wallet_address) <> ''
  AND wallet_provider IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_wallet_provider
  ON public.users(wallet_provider);
