# Indonesia track

A separate borrower system for Indonesians. They arrive from Facebook or TikTok ads (often inside
the Facebook/TikTok in-app browser) and land on `/id`.

## Hand-holding (read this before touching any borrower-facing text)

Design for someone who has never used a crypto wallet, may read slowly, and will give up the moment a
screen confuses them. Assume no prior knowledge, every time. In practice:

- **One action per screen.** Never "do X, then Y, then Z" in one message when it can be three steps
  with ➡️ Lanjut. Short sentences, one idea per line, everyday Bahasa ("kamu"), no jargon. "USDT =
  dolar digital" is explained, never assumed.
- **Always show the next button.** Every message ends with the button for the next thing to do
  (👛 Buka Walt, 💰 Bayar, ✅ Sudah kirim…). Typing is the fallback, not the plan.
- **Copy buttons for anything they must type** (usernames, amounts). Nobody retypes "6.08".
- **A guide at every money moment** (`_shared/idGuides.ts`, 📖 in the menu, `idg:<guide>:<step>`):
  - after the request is posted: "what happens now" in 3 steps + 📖 Buka Walt pertama kali
  - when the loan lands in their Walt: a message with 📖 Cairkan ke rupiah (`sendCashOutGuideOffer`)
  - on 💰 Bayar: 📖 Beli USDT + 📖 Bayar pinjaman under the instructions
  - 6 h after opening 💰 Bayar with no "✅ Sudah kirim": one "butuh bantuan?" nudge (`runIdRepayNudges`)
  - no Telegram @username: 📖 Buat username, then "✅ Sudah, cek lagi"
  Screenshots: in an admin chat, send a screenshot with the caption `/idguidephoto cash 2` (guide + step);
  `/idguidephoto` lists which steps have one, `… clear` removes it (stored in `id_guide_media`).
  **Check the Walt button names in the guides against a real phone** (Walt renames things); fix the text in
  `idGuides.ts` and add screenshots — pictures beat words for this audience.
- **"🙋 Masih bingung? Chat tim" on every guide screen.** A person is always one tap away, and the support
  chat itself talks Bahasa to Indonesia-track borrowers (connected / closed / how-to-start lines).
- **Typed questions get an answer** (`_shared/idHelper.ts`): DeepSeek Flash replies in ≤ 5 short lines from
  the guides + their loan state, with the right 📖 button. Unsure, money missing, complaints, extensions,
  "I want a person" → it says the team will reply and opens a support chat (`handoff`). It only explains:
  it never records, approves, changes amounts/dates, and an answer naming any @username other than ours
  or containing an address is dropped. Log: `id_ai_questions` (rate limit `id_ai_daily_limit`/day,
  switch `id_ai_helper`). Read the log weekly: repeated questions = a guide step that needs fixing.
- **Warnings only where they matter, in caps:** "BUKAN Withdraw", "jangan tekan Sudah terima sebelum uang
  masuk", "jangan kasih PIN ke siapa pun", "bayar HANYA ke rekening di dalam Walt".
- **Small first.** First loan $5 (`id_first_loan_max`); $10 only after a loan repaid on time
  (`app_private.id_first_loan_cap`, enforced on every insert). Shown as "⭐ Pinjaman pertama maksimal $5".

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
  7. Walt: open Walt once + have a Telegram @username ("Cek & lanjut" → the server reads the username from
     Telegram with getChat and sets `users.walt_ready_at`; migration 20261108130000). No address to paste.
     Old accounts with a saved BEP20 `walt_address` count as done too.
  8. Book the 15-minute call. The team approves after the call (`loan_access_status = 'approved'`).
- **Small, short loans**: $5 or $10 (`id_loan_amounts`), due within 14 days (`id_max_term_days`).
  Repayment can be at most 1.5× the amount. Enforced in `app_private.enforce_new_loan_terms`.
- **Their requests look different everywhere**: `loans.market = 'ID'` gets a 🇮🇩 mark on the
  request board, admin pages and team Telegram posts.
- **Money in and out goes through Walt** (Telegram's wallet bot, with IDR P2P):
  - Loan out: Moodeng's payout wallet (or Binance TH) → USDC on BNB Chain → their Walt. No fee comes
    out of the loan (gas is sponsored; Walt turns USDC into USDT 1:1 up to $2,000 / 30 days).
  - Repay: Walt P2P Express (buy USDT with IDR) → withdraw an EXACT amount of USDT on BEP20 to the payout
    wallet → recorded automatically (see "Repaying"). No bridge, no fee taken from the money. Walt's QRIS
    has a ~Rp 272.000 minimum (checked 2026-11-08), too much for $5/$10 loans, so the steps say P2P.
  - Walt P2P prices seen 2026-11-08: sell 5 USDT → Rp 88.500, buy 5 USDT → Rp 91.661 (official ~18.100/$).
  - The old Relay route (Base ↔ BNB Chain, `relay_transfers`) stays for the app's Base cash-out only.

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

## Paying loans out — Walt Transfer (default, free)

`telegram_bot_settings.id_payout_mode = 'walt_transfer'` (default). No chain, no fee, no withdrawal:

1. The 5-minute job posts ONE card per open (not held) Indonesian request to the admin chat
   (`_shared/idWaltPayouts.ts`): "💸 Pay MC-…: send 5 USDT to @budi_88 by Walt Transfer", with copy
   buttons for the @username and the amount, 👛 Open Walt and **✅ Sent**.
2. In Walt: Transfer → paste @username → paste amount → send. Then tap ✅ Sent (`idwp:<loan id>`).
3. `recordWaltTransferPayout` funds the loan (funding_method 'walt_manual', lender = `id_payout_lender_user_id`,
   hash `walt-transfer-out:<loan id>`, found_by 'walt'), the borrower gets "money sent" + the cash-out guide.
   Two taps can't fund twice; a row the payout wallet is paying is refused.
- Loans go to the borrower's **Telegram @username** (`users.telegram_username`, refreshed from every bot
  message/tap). No username → no card; the bot sends the "make a username" guide once, and 💸 Ajukan asks
  for one first. They must have opened Walt once (the onboarding Walt step does that).
- **⚠️ Not found in Walt** on the card (`idwx:<loan id>`): the borrower is asked to message @jimmymoodengcredit
  ("halo") and open Walt + tap Start, so Walt can find them; the card keeps its buttons (max once per 30 min).
- A card still untapped after 2 h gets one "⏰ still unpaid" ping in the admin chat.
- Payout rows for these loans have no address (`id_manual_payouts.walt_address` may be null; the chain ways
  still refuse without one). A Walt Transfer repayment that can't be recorded / is overpaid is sent back by
  Walt Transfer to their @username (the alert says so; no on-chain refund button).
- The payout wallet's autopay never sends in this mode. `id_payout_mode = 'chain'` brings back the ways below.

## Paying loans out on chain (`id_payout_mode = 'chain'`; recorded the same: funding_method 'walt_manual', hash `bsc:0x…`)

1. **Payout wallet (automatic).** A Moodeng-owned Openfort backend wallet on BNB Chain, topped up
   with USDC (BSC) from Binance TH. With `/idautopay on`, the 5-minute job pays each open Indonesian
   request (2 min after posting, ≤ `id_autopay_max_usd`, ≤ `id_autopay_daily_cap_usd` per Bangkok day)
   to the borrower's Walt, gas sponsored. Admin → Requests → "Pay now" works even when autopay is off.
   A payout is claimed in SQL (`claim_id_auto_payout`) before Openfort is called and is never re-sent;
   it only counts once the BNB Chain receipt shows the exact USDC transfer. Keys: vault secret
   `OPENFORT_PAYOUT` = {secretKey, walletSecret, feeSponsorshipId}. Code: `_shared/idPayoutWallet.ts`.
2. **By hand from Binance TH** ("Pay by hand instead"): send, tap "I sent it", the job finds it.
3. **TxID** pasted in the admin card.

## "Fund" on the request board (2026-11-12)

For Moodeng's funding accounts, an Indonesian request on the board shows **Fund $X to their Walt** instead
of "Dibayar oleh Moodeng" (`src/views/dashboard/components/IdBoardFund.tsx`). Two taps (Fund → Confirm), then
`admin-fund-loan` → `walt_payout_auto` → `payNow`: the payout wallet sends to the borrower's Walt deposit
address on BNB Chain, in any `id_payout_mode`, at most once, with the same max / daily cap / balance checks.

- The wallet sends `id_payout_token` (`USDT` = what Walt holds; anything else = USDC). On-chain checks accept
  either coin.
- It needs the borrower's Walt deposit address (`users.walt_address`). They paste it into the bot chat once
  (any private message that is exactly one 0x address → `handleIdWaltAddressMessage`, same rules as
  `save_my_walt_address`; a changed address pings the team). The bot asks for it after a request is posted
  while none is saved. It is optional: without one, the Walt Transfer card still pays them by @username.
- Everyone else still sees "Dibayar oleh Moodeng"; lenders can't fund Indonesian requests from Base.

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

## The front door: WhatsApp → Telegram (2026-11-10)

Most Indonesians have WhatsApp but must install Telegram, and people who leave Facebook's in-app browser
for another app don't come back to the page (PostHog, Oct–Nov 2026: 0 of 8 Android people returned after
opening WhatsApp, though 5 of the 6 real ones did send the message). So `/id` leads with **Chat di
WhatsApp**, and nothing after that tap needs the page again:

1. The button is a `wa.me` link with a message already typed, ending in a tag: `MDNG-DAFTAR-A`
   (DAFTAR = Bahasa, JOIN = English; A = Android, I = iPhone). "MDNG" is what makes SendPulse's
   "Confirm WhatsApp" flow pass the message to `sendpulse-messenger-verify`.
2. They wrote first, so we may reply freely for 24 hours (no template). `_shared/idWaBridge.ts` sends
   four short messages: hello, step 1 install Telegram (the right store link), step 2 tap
   `moodeng.app/t/<token>` (our own link, a 302 to the bot: `vercel.json` → `sendpulse-messenger-verify?go=`),
   and "reply BANTUAN". One row per WhatsApp contact in `id_wa_bridge`.
3. In the bot, `/start wa_<token>` ties their Telegram to the row and sends the welcome with
   **▶️ Mulai daftar**, a login_url button to `/auth/telegram/callback?track=id`. Telegram signs them in,
   the page joins the track, and `join_id_track()` → `attach_id_wa_bridge()` copies the WhatsApp number
   onto the account (matched on the Telegram id in `auth.users.raw_app_meta_data`), so the WhatsApp step
   is already done for a +62 number.
4. Nudges, from the 5-minute job (`runIdWaBridgeNudges`): on WhatsApp at 20 min and 3 h while they haven't
   pressed Start (the second one also asks the team, in the KYC group, to message them by hand); in
   Telegram at 30 min and 20 h when they pressed Start but never tapped the button.

**WhatsApp never talks about loans or money** (George): those messages only lead to Telegram. A test in
`idWaBridge.test.ts` fails if a WhatsApp text mentions them.

Switch: `telegram_bot_settings.id_wa_bridge` = `off` | `test` (the bridge answers, `/id` shows the button
only with `?wa=1`) | `on`. The old "Daftar dengan Telegram" button stays underneath for people who already
have Telegram. Not checked yet on real phones: whether `wa.me` opens from Facebook's browser for
Indonesians, and whether Telegram keeps the link when someone has to create their account first (the
steps say install and make the account first, and the nudge repeats the link).

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
- **💰 Bayar** (bot) and "Bayar dari Walt" (app Repay page, `WaltRepaySteps`): see "Repaying" below.
- **❓ Bantuan**: a button that opens the support chat (`/start support`) + a note that the team can
  reach them on WhatsApp.

## Repaying (no fees — migration 20261107200000, `_shared/idRepayments.ts`)

George's rule (2026-11-08): no fees anywhere. Walt's on-chain withdrawal costs 1.5 USDT (BEP20) — 25% of a
$6 repayment — and Walt Pay (merchant API) is "unavailable" for his account, so:

- **The only way — Walt Transfer** (`method = 'walt_transfer'`, setting `id_walt_username` = `jimmymoodengcredit`):
  💰 Bayar shows the exact amount + `@jimmymoodengcredit` with copy buttons and "👛 Buka Walt". In Walt:
  Transfer → paste username → paste amount → send (free, inside Walt). Then "✅ Sudah kirim" (`ids:<id>`;
  app: "Sudah kirim" button → relay action `id_repay_sent`). The team gets a card (once per 10 min):
  "✅ Arrived — record" (`idw:a:<id>`) creates deposit `walt-transfer:<id>` (unique — a double tap can't
  record twice) and records it with the request's rupiah; "❌ Not there" (`idw:x:<id>`) tells the borrower
  to check and tap again. Walt can't be opened pre-filled (no API): the bot gives copy buttons.
- **No on-chain backup any more** (2026-11-08): with `id_walt_username` empty, 💰 Bayar says paying is paused
  ("hubungi kami") instead of telling anyone to withdraw. The BNB Chain scan below still runs, so money
  someone sends on chain anyway is still found (or lands on the unmatched card).
- **Fees, all in:** none from Moodeng or Walt Transfer. The only cost is Walt P2P's spread when the
  borrower sells USDT for rupiah (~2.2%) and buys it back to repay (~1.3%), plus any bank/e-wallet transfer
  fee to the P2P seller (free same-bank/e-wallet, ~Rp 2.500 BI-FAST).

- **Who**: loans with `market = 'ID'` and `funding_method = 'walt_manual'` (Moodeng paid them to Walt).
  Anything else (e.g. an older Indonesian loan a lender funded on Base) is owed to that lender and goes
  through the app's normal Pay.
- **The request** (`id_repay_requests`): 💰 Bayar / "Tampilkan jumlah & alamat" gives the payout wallet
  address and an EXACT amount: rupiah left ÷ today's rate, rounded up to the cent, plus 0–50 cents when
  another request from the last 7 days already has that amount. Good for 48 h; reused while it still
  covers what's owed (≤ $0.50 over). No two OPEN requests share an amount (unique index). Kill switch:
  `telegram_bot_settings.id_repay = off`.
- **Why the amount**: Walt withdraws from its own shared wallets, so the sender says nothing about who
  paid. The amount does. The steps say "if Walt takes a fee, make sure the amount RECEIVED is exact".
- **Recording** (5-minute job, `runIdRepayments`): reads USDT/USDC transfers into the payout wallet on
  BNB Chain since `id_repay_scan_block` → `id_wallet_deposits`. Exact match to an open request (or, if
  none, to the one expired/replaced request from the last 7 days with that amount whose loan is still
  owed) → `record_loan_payment('repay', hash 'bsc:<tx>:<log>')` + the shared follow-ups → borrower
  ("✅ Pembayaran Rp X diterima. Sisa Rp Y", or the usual "lunas") and team ("💰 … arrived in the payout
  wallet"). Never twice: deposit and request are each claimed by one run only and the hash is spent in
  `used_payment_hashes`; `recorded_at` only after the follow-ups (a run that died is finished after 2 min).
- **Not matched** → a team card: "✅ Record for MC-…" (closest recent requests), "⬆️ It's a top-up"
  (adds the sender to `id_topup_senders`; future transfers from it are just top-ups) or "🙈 Ignore".
- **Money a loan can't take / overpaid > $0.50** → team alert with "↩️ Refund to their Walt" (sends back
  from the payout wallet to their saved Walt address, one tap only).
- **Money out of the payout wallet**: `/idsweep` (admin chats) shows USDT/USDC/BNB; `/idsweep USDT 25` or
  `all` → confirm → sends ONLY to `id_payout_sweep_to` (set by SQL, e.g. your Binance TH BEP20 deposit
  address). Repayments arrive mostly as USDT while auto-payouts send USDC: sweep USDT to Binance TH,
  convert, and top up USDC again (or switch payouts to USDT once Walt is confirmed to credit USDT).

