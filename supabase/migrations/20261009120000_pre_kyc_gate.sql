-- Pre-KYC gate: borrowers connect Messenger, book a call and get approved after it BEFORE they
-- can start a paid KYC session (Didit liveness / combined / id). Reuses the loan-access gate
-- (users.loan_access_status, loan_access_requests, Telegram Showed up / No-show) — it just sits in
-- front of KYC now, independent of telegram_bot_settings.loan_flow.
--
-- Who is gated (one rule, used by create-didit-session, loan-access, videoCallOutcome and the app):
--   kyc_gate switch on  AND  not a lender  AND  not KYC-verified  AND  not approved  AND  never had a loan.
-- So grandfathered (approved) accounts, verified accounts and anyone who has borrowed are never gated.
--
-- Switch: telegram_bot_settings.kyc_gate = 'on' | 'off' (Telegram /kycgate on|off). 'off' = old flow.

INSERT INTO public.telegram_bot_settings (key, value)
VALUES ('kyc_gate', 'on')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_kyc_gate()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT value FROM public.telegram_bot_settings WHERE key = 'kyc_gate'), 'on') = 'on';
$$;

REVOKE ALL ON FUNCTION public.get_kyc_gate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_kyc_gate() TO anon, authenticated, service_role;

-- is_world_id_passport isn't on every deployed database (see 20260803000000), so it's read via
-- to_jsonb rather than named directly.
CREATE OR REPLACE FUNCTION public.needs_pre_kyc_gate(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_kyc_gate()
     AND u.user_role IS DISTINCT FROM 'lender'
     AND u.is_didit IS DISTINCT FROM 'ACTIVE'
     AND u.is_world_id IS DISTINCT FROM 'ACTIVE'
     AND (to_jsonb(u) ->> 'is_world_id_passport') IS DISTINCT FROM 'ACTIVE'
     AND u.loan_access_status IS DISTINCT FROM 'approved'
     AND NOT EXISTS (SELECT 1 FROM public.loans l WHERE l.borrower_user_id = u.id)
  FROM public.users u
  WHERE u.id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.needs_pre_kyc_gate(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.needs_pre_kyc_gate(UUID) TO service_role;

-- The app's view of the same rule, for the signed-in user only.
CREATE OR REPLACE FUNCTION public.my_pre_kyc_gate()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.needs_pre_kyc_gate(auth.uid()), false);
$$;

REVOKE ALL ON FUNCTION public.my_pre_kyc_gate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_pre_kyc_gate() TO authenticated;
