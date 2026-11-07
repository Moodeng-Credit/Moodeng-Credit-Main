# Indonesia track

A separate borrower system for Indonesians. They arrive from Facebook or TikTok ads (often inside
the Facebook/TikTok in-app browser) and land on `/id`.

## The rules

- **Sign-up and sign-in are Telegram only.** The page says plainly that Telegram is required and
  links to install it. Telegram login asks for permission for our bot to message them, and the bot
  then messages them about everything.
- **WhatsApp is required**: a verified +62 number. It is used only for notifications and for the
  team to message them directly. No WhatsApp bot conversation: when they send the verify code, the
  only reply is "✅ connected, go back to the app".
- **Facebook is required**: the Messenger code sent to our Page, their Facebook profile link, and
  "I followed the page".
- **Long onboarding before the call**, in this order (enforced in SQL, `id_onboarding_status`):
  1. Telegram (the bot can message them)
  2. WhatsApp (+62, verified)
  3. Facebook (Messenger code + profile link + followed the Page)
  4. About you (income type, payday, income and expenses)
  5. Proof of income (upload, not declined)
  6. ID + liveness (Didit), submitted. Approval is needed before the team can ✅ them.
  7. Walt address (their Telegram wallet, USDC on BNB Smart Chain / BEP20)
  8. Book the 15-minute call. The team approves after the call (`loan_access_status = 'approved'`).
- **Small, short loans**: $5 or $10 (`id_loan_amounts`), due within 14 days (`id_max_term_days`).
  Repayment can be at most 1.5× the amount. Enforced in `app_private.enforce_new_loan_terms`.
- **Their requests look different everywhere**: `loans.market = 'ID'` gets a 🇮🇩 mark on the
  request board, admin pages and team Telegram posts.
- **Money in and out goes through Walt** (Telegram's wallet bot, with IDR P2P):
  - Cash-out: Moodeng wallet (USDC on Base) → Relay one-time address → USDC on BNB Chain → their
    Walt address. One tap, about $0.07 on $20, a few seconds.
  - Repay: Walt P2P (buy USDT with IDR) → withdraw USDT on BEP20 to a Relay one-time address →
    USDC on Base in their Moodeng wallet → tap Pay as usual.

## The switch

`telegram_bot_settings.id_track` is `off` (the default), `test` (only `is_test` accounts can
join), or `on`. Turning it off stops new people joining; people already on the track keep their
rules. Change it with `/idtrack off|test|on` in the admin Telegram group.

## Where things live

- SQL: `supabase/migrations/20261107120000_indonesia_track.sql`. It holds the columns, `join_id_track`,
  `save_my_facebook_profile`, `save_my_walt_address`, `id_onboarding_status` / `my_id_onboarding`,
  the loan rules, the `loans.market` stamp, and the `relay_transfers` table.
- App: `src/lib/idTrack.ts` (types and constants), `src/hooks/useIdOnboarding.ts`, and `src/views/indonesia/`.
- Server: `supabase/functions/_shared/idTrack.ts` (Bahasa Telegram messages, "next step" pings) and
  `supabase/functions/_shared/relay.ts` (Relay quotes and status). The Relay actions live in
  `stableyard-deposit-address`, because we're at the edge-function cap.
