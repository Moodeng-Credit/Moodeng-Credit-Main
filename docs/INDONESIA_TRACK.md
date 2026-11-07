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

## Signing in from Facebook's browser (Telegram app login)

Telegram's website login gets lost inside Facebook's / TikTok's in-app browser, so `/id` signs in
through the Telegram **app**:

1. The page gets a one-time code and a 2-digit number (`telegram-login` `app_start`), and its button
   opens our bot in the Telegram app (`intent://` on Android, `tg://` on iPhone).
2. Pressing **Start** does not sign anyone in. The bot shows the device, country and time with a blunt
   "this gives FULL ACCESS" warning, and asks them to tap the number on their screen out of four. The
   choices are fixed, and a wrong pick or "Not me" kills the code.
3. The page, still open in Facebook, polls (`app_poll`) and gets the session. Starting the bot also
   means the bot can message them, so the Telegram step is done.

Bot buttons to moodeng.app are Telegram **login_url** buttons, so Telegram signs in whoever taps
them (a forwarded message can't sign in anyone else). The signed data is moved out of the URL before
analytics load, is valid for 15 minutes, works once (`telegram_login_hashes`), and asks before
switching a browser that's signed in to a different account. If the camera or uploads don't work in
Facebook's browser, "Lanjut di Telegram" makes the bot send a sign-in button for that step.

## Living in Telegram (bot menu, loans and repayments in chat)

After onboarding an Indonesian never needs the website. In a private chat with the bot, `/menu`, a bare
`/start`, "menu" or "pinjaman" shows four buttons: **📋 Pinjamanku · 💸 Ajukan pinjaman · 💰 Bayar ·
❓ Bantuan**. Only people found by `users.chat_id` / `users.telegram_id` = the sender with `market = 'ID'`
get it; everyone else keeps the old behaviour (support chat). The "approved", "funded to Walt", "repaid"
and due/overdue messages carry the same buttons. Code: `_shared/idBot.ts` (screens + routing),
`_shared/idLoanMath.ts` (chips, terms, callback data), wired in `telegram-webhook` right after the
Telegram-app login tap.

- **📋 Pinjamanku**: the open request (⏳ Menunggu dana) or the active loan (amount, due date in WIB,
  rupiah left = `repay_idr − repaid_idr` and ≈ USD today, 💸 Sudah dikirim ke Walt / 🚨 Terlambat), or
  ✅ Lunas. Unfinished onboarding → the usual next-step button.
- **💸 Ajukan**: amount → 7 / 14 days → rupiah total (the same Rp 5.000 chips as the app, inside
  [amount + $1, 1.5 × amount] at `current_usd_idr()`) → purpose (6 chips, stored in English as
  `loans.reason`) → confirm. All state is in `callback_data` (`ida:5`, `idt:5:7`, `idr:5:7:110000`,
  `idp:…:2`, `idc:…:2`, ≤ 64 bytes) and is checked again at every step. The loan is created by
  `public.bot_request_id_loan` (migration `20261107190000`, service role only), which does every check a
  service-role insert would otherwise skip (ID terms + peg, Rp 500 steps, KYC/approved/Walt, verified,
  lender role, `mal`, credit limit, the repost cooldown, one open loan at a time) with the borrower row
  locked. All insert triggers still run, so the team post, the borrower's "loan posted" and autopay
  happen exactly as for app requests.
- **💰 Bayar**: straight to the lender, no Moodeng wallet needed. Relay quote BNB Chain USDT → Base USDC
  with recipient = `loans.lender_wallet` and refund to their Walt; amount = rupiah left ÷ today's rate +
  max(1%, $0.30), at least $1. The bot shows the amount (≈ Rp), the address with a copy button and the
  two Walt steps (Deposit → QRIS; Withdraw → External wallet → BEP20). A still-unused address for the same
  loan (< 30 min, still covers what's owed) is reused. Refused (support message) for smart-contract /
  credit-line loans or a loan without a `lender_wallet`. Kill switch: `walt_bridge = off`.
- **Recording** (`_shared/idRepayments.ts` `runRelayRepayments`, in the 5-minute job): Relay status by
  request id → the fill tx is verified on Base (USDC Transfer to `lender_wallet`, after the quote) → the
  real USDC is recorded with `record_loan_payment('repay', …)` and the same follow-ups as the Pay button
  (`_shared/repaymentFollowUps.ts`: credit level-up, repaid/partial notifications, team feed, repay feed).
  The deposit is also watched on BNB Chain. If Relay's status never follows a deposit (Relay makes a new
  request when the amount differs and `GET /requests` needs an API key from v3), after 10 min the fill is
  searched on Base: USDC → lender within 3 h, deposit − max(5%, $0.50) … deposit + 0.5%, from a known
  Relay solver (`relay_base_solvers`, learned from verified fills), hash never used. No match → one team
  alert, nothing recorded. The fill tx hash is spent in `used_payment_hashes`, so nothing is recorded twice.
  Safety rules for that search: only when Relay definitely answers `waiting`/`unknown` (a Relay API error
  never triggers it); never when USDT went back to their Walt on BNB Chain after the deposit (refund →
  not recorded, borrower + team told); when Relay's own fill was already spent by another loan the row
  stays open and the search keeps going (3 h, one alert). Bot rows (`loan_id` set) are invisible to the
  app's Walt screens (`stableyard-deposit-address` relay `latest`/`status`/reuse). The job works every
  bot row until `relay_transfers.recorded_at` is set — whatever its status — and sets it only after the
  follow-ups ran (`quote.recording` lets the next run finish them if a worker died half-way).
  The borrower hears "USDT kamu sudah masuk", then "✅ Pembayaran Rp X diterima. Sisa Rp Y" (partial) or
  the usual "lunas" message.
- **❓ Bantuan**: a button that opens the support chat (`/start support`) + a note that the team can
  reach them on WhatsApp.
