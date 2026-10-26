-- Viber opt-in fixes from the review (2026-10-19):
--   * at most 3 different numbers a day per borrower (each gets a welcome message from us);
--   * the welcome sends questions to Messenger: replies on Viber land on the emulator, where nobody
--     may see them.

-- Borrower: "remind me on Viber at this number". Returns 'ok', 'invalid_number' or 'too_many'.
CREATE OR REPLACE FUNCTION public.set_my_viber_number(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_phone TEXT := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  -- Local Philippine (09…) and Thai (0…) numbers: assume the country from the leading 0.
  IF v_phone ~ '^09\d{9}$' THEN
    v_phone := '63' || substr(v_phone, 2);
  ELSIF v_phone ~ '^0[689]\d{8}$' THEN
    v_phone := '66' || substr(v_phone, 2);
  END IF;
  IF length(v_phone) < 8 OR length(v_phone) > 15 OR v_phone ~ '^0' THEN
    RETURN 'invalid_number';
  END IF;

  -- Same number again: nothing to do (no second welcome or team message).
  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_uid AND viber_number = v_phone AND notif_viber) THEN
    RETURN 'ok';
  END IF;
  -- At most 3 numbers a day per borrower: each one gets a message from us, so nobody can use this to
  -- make us message lots of numbers.
  IF (SELECT count(*) FROM public.viber_outbox WHERE user_id = v_uid AND kind = 'welcome' AND created_at > now() - interval '1 day') >= 3 THEN
    RETURN 'too_many';
  END IF;

  UPDATE public.users SET viber_number = v_phone, viber_verified_at = now(), notif_viber = true
  WHERE id = v_uid
  RETURNING COALESCE(NULLIF(trim(username), ''), email, id::text) INTO v_name;

  INSERT INTO public.viber_outbox (user_id, phone, body, kind)
  VALUES (v_uid, v_phone, 'Hi! This is Moodeng Credit. We''ll send your payment reminders here on Viber. Need help? Message us on Messenger: m.me/MoodengCredit', 'welcome');

  PERFORM private.viber_team_post('💜 ' || v_name || ' turned on Viber reminders: +' || v_phone);
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_viber_number(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_viber_number(TEXT) TO authenticated;
