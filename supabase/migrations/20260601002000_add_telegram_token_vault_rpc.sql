CREATE OR REPLACE FUNCTION public.get_telegram_api_token()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, pg_temp
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name IN ('TELEGRAM_API_TOKEN', 'TELEGRAM_BOT_TOKEN')
  ORDER BY CASE name
    WHEN 'TELEGRAM_API_TOKEN' THEN 1
    ELSE 2
  END
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_telegram_api_token() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_telegram_api_token() FROM anon;
REVOKE ALL ON FUNCTION public.get_telegram_api_token() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_telegram_api_token() TO service_role;
