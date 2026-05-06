CREATE SCHEMA IF NOT EXISTS private;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    CREATE TYPE public.account_status AS ENUM ('active', 'blocked', 'banned');
  END IF;
END $$;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS account_status public.account_status NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_users_account_status ON public.users(account_status);

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS note TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.account_status_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  previous_status public.account_status NOT NULL,
  new_status public.account_status NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_status_audit_logs_target_user_id
  ON public.account_status_audit_logs(target_user_id);

CREATE INDEX IF NOT EXISTS idx_account_status_audit_logs_actor_user_id
  ON public.account_status_audit_logs(actor_user_id);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_status_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read their admin grant" ON public.admin_users;
CREATE POLICY "Admins can read their admin grant"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION private.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Admins can read account status audit logs" ON public.account_status_audit_logs;
CREATE POLICY "Admins can read account status audit logs"
  ON public.account_status_audit_logs
  FOR SELECT
  TO authenticated
  USING (private.current_user_is_admin());

CREATE OR REPLACE FUNCTION private.admin_set_account_status(
  target_user_id UUID,
  target_status public.account_status,
  reason TEXT DEFAULT NULL
)
RETURNS TABLE(user_id UUID, account_status public.account_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_user_id UUID := auth.uid();
  previous_status public.account_status;
BEGIN
  IF actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF target_user_id = actor_user_id AND target_status <> 'active'::public.account_status THEN
    RAISE EXCEPTION 'Admins cannot restrict their own account' USING ERRCODE = '42501';
  END IF;

  SELECT users.account_status
  INTO previous_status
  FROM public.users
  WHERE id = target_user_id
  FOR UPDATE;

  IF previous_status IS NULL THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  IF previous_status <> target_status THEN
    UPDATE public.users
    SET account_status = target_status,
        updated_at = now()
    WHERE id = target_user_id;

    INSERT INTO public.account_status_audit_logs (
      target_user_id,
      actor_user_id,
      previous_status,
      new_status,
      reason
    )
    VALUES (
      target_user_id,
      actor_user_id,
      previous_status,
      target_status,
      NULLIF(btrim(reason), '')
    );
  END IF;

  RETURN QUERY
  SELECT target_user_id, target_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  target_user_id UUID,
  target_status public.account_status,
  reason TEXT DEFAULT NULL
)
RETURNS TABLE(user_id UUID, account_status public.account_status)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT *
  FROM private.admin_set_account_status($1, $2, $3);
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.current_user_is_admin();
$$;

REVOKE ALL ON FUNCTION public.admin_set_account_status(UUID, public.account_status, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(UUID, public.account_status, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.admin_set_account_status(UUID, public.account_status, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION private.sync_account_restriction_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.users
  SET account_status = CASE NEW.status
      WHEN 'banned' THEN 'banned'::public.account_status
      WHEN 'watchlist' THEN 'blocked'::public.account_status
      ELSE 'active'::public.account_status
    END,
    updated_at = now()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.admin_account_restrictions') IS NOT NULL THEN
    EXECUTE '
      DROP TRIGGER IF EXISTS sync_admin_account_restrictions_to_users
      ON public.admin_account_restrictions
    ';

    EXECUTE '
      CREATE TRIGGER sync_admin_account_restrictions_to_users
      AFTER INSERT OR UPDATE OF status
      ON public.admin_account_restrictions
      FOR EACH ROW
      EXECUTE FUNCTION private.sync_account_restriction_status()
    ';

    EXECUTE '
      UPDATE public.users AS users
      SET account_status = CASE restrictions.status
          WHEN ''banned'' THEN ''banned''::public.account_status
          WHEN ''watchlist'' THEN ''blocked''::public.account_status
          ELSE ''active''::public.account_status
        END,
        updated_at = now()
      FROM public.admin_account_restrictions AS restrictions
      WHERE users.id = restrictions.user_id
    ';
  END IF;
END $$;
