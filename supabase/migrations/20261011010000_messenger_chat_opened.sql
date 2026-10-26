-- Android Messenger timing match (sendpulse-events + _shared/messengerTimingMatch.ts).
--
-- On Android, Messenger refuses every link that carries the verification code, so the borrower's
-- code can't reach the bot by itself. The Android screen stamps the moment they tap "Open Messenger";
-- when a new Facebook contact opens the Page's chat within a minute and only one borrower tapped,
-- sendpulse-events connects that borrower.

ALTER TABLE public.contact_verification_codes
   ADD COLUMN IF NOT EXISTS chat_opened_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS contact_verification_codes_chat_opened_idx
   ON public.contact_verification_codes (chat_opened_at)
   WHERE channel = 'messenger' AND verified_at IS NULL AND chat_opened_at IS NOT NULL;

-- Stamps the caller's own latest live Messenger code. Nothing to pass, nothing to return.
CREATE OR REPLACE FUNCTION public.mark_messenger_chat_opened()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
   UPDATE public.contact_verification_codes c
      SET chat_opened_at = now()
    WHERE c.id = (
       SELECT id
         FROM public.contact_verification_codes
        WHERE user_id = auth.uid()
          AND channel = 'messenger'
          AND verified_at IS NULL
          AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1
    );
$$;

REVOKE ALL ON FUNCTION public.mark_messenger_chat_opened() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_messenger_chat_opened() TO authenticated;
