-- Food voucher email tracking: did the email arrive, was it opened, did they tap the voucher?
--
-- email_message_id   Resend's id for the voucher email (sendEmail's response), so its webhook events
--                    (email.delivered / email.opened / email.bounced, handled in email-inbound) find
--                    the claim.
-- email_*_at         first time each event happened. Opens are a hint only: iPhone Mail loads images
--                    without the email being read, and blocked images never count.
-- voucher_clicked_at first tap on a voucher button in the email. The buttons go through
--                    moodeng.app/v/<voucher_codes.id> (vercel.json → voucher-claim-telegram-notification
--                    ?go=), which stamps this and forwards to the Xoxo link.
-- Each first event re-stamps the claim's Telegram/Discord cards (voucherClaims.ts restampVoucherCard).

alter table public.voucher_claims add column if not exists email_message_id text;
alter table public.voucher_claims add column if not exists email_delivered_at timestamptz;
alter table public.voucher_claims add column if not exists email_opened_at timestamptz;
alter table public.voucher_claims add column if not exists email_bounced_at timestamptz;
alter table public.voucher_claims add column if not exists voucher_clicked_at timestamptz;

create index if not exists voucher_claims_email_message_id_idx
  on public.voucher_claims (email_message_id)
  where email_message_id is not null;
