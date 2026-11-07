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

## Paying loans out (three ways, all recorded the same: funding_method 'walt_manual', hash `bsc:0x…`)

1. **Payout wallet (automatic).** A Moodeng-owned Openfort backend wallet on BNB Chain, topped up
   with USDC (BSC) from Binance TH. With `/idautopay on`, the 5-minute job pays each open Indonesian
   request (2 min after posting, ≤ `id_autopay_max_usd`, ≤ `id_autopay_daily_cap_usd` per Bangkok day)
   to the borrower's Walt, gas sponsored. Admin → Requests → "Pay now" works even when autopay is off.
   A payout is claimed in SQL (`claim_id_auto_payout`) before Openfort is called and is never re-sent;
   it only counts once the BNB Chain receipt shows the exact USDC transfer. Keys: vault secret
   `OPENFORT_PAYOUT` = {secretKey, walletSecret, feeSponsorshipId}. Code: `_shared/idPayoutWallet.ts`.
2. **By hand from Binance TH** ("Pay by hand instead"): send, tap "I sent it", the job finds it.
3. **TxID** pasted in the admin card.

## Rupiah peg

Indonesian loans are fixed in rupiah: the borrower chooses `repay_idr` (e.g. Rp 110.000) and that never
changes. The USD owed (`total_repayment_amount`) = rupiah left ÷ the current USD/IDR rate (`fx_rates`,
refreshed by the 5-minute job at most every 6 h from open.er-api / frankfurter; no rate under 36 h old →
requests are refused). Each repayment adds `payment × rate` to `repaid_idr`; under Rp 1.000 left → Paid.
Moodeng lends and is repaid in USDC and carries the FX swing; a >5% move on an open loan pings the team.
Code: migration `20261107160000_indonesia_idr_peg.sql`, `_shared/fxRates.ts`, `src/lib/loanMarket.ts`.

## Safety rails (migration 20261107170000)

- A loan with a payout in progress (paying / found / marked sent / an auto attempt not yet checked on
  chain) can't be deleted — by the borrower, an admin, or a user deletion.
- Indonesian loans can't be funded from Base (record_loan_payment 'fund' and admin-fund-loan refuse
  market 'ID'); lenders see "Dibayar oleh Moodeng" instead of Lend.
- A failed auto payout is searched on BNB Chain (USDC from the payout wallet to their Walt) before any
  hand payment or release is allowed; if the money went out it's recorded, not paid again.
- Admin "Release" on a stuck auto payout runs that chain check first.
- One BNB Chain transfer (tx hash + log index) can fund only one loan.
- USD/IDR is stored only when both sources agree within 2% (or a single source is within 3% of the
  last rate); the peg falls back to the last stored rate of any age.
- `loans.usd_total_at_request` keeps the original USD total for the BitRepo report.
