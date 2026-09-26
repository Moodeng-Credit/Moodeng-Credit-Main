-- Borrowers who could not confirm Facebook Messenger in the loan request's contact step.
--
-- The step only works when the m.me link reaches the SendPulse bot. On phones with Facebook Lite,
-- Messenger Lite or no Messenger app it never does, and the step had no way forward (Brian tapped
-- "Open Messenger" ~30 times over 35 minutes on 2026-09-26). After a minute of waiting the app now
-- offers "Continue without Messenger"; the contact-step-skipped function stamps this column and pings
-- the team on Discord to reach the borrower another way.
alter table public.users add column if not exists contact_step_skipped_at timestamptz;

comment on column public.users.contact_step_skipped_at is
   'Set by the contact-step-skipped edge function when a borrower continued without confirming Messenger. Server-only.';
