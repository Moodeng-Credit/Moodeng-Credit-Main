CREATE OR REPLACE FUNCTION public.verify_internal_notification_secret(candidate TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SECRET_KEY'
      AND decrypted_secret = candidate
  );
$$;

REVOKE ALL ON FUNCTION public.verify_internal_notification_secret(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_internal_notification_secret(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.verify_internal_notification_secret(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_internal_notification_secret(TEXT) TO service_role;
