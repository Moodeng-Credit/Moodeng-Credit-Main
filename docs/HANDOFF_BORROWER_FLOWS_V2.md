# Handoff — Borrower flows v2: call-first filter, Emma setup call, Messenger reminders

> Written 2026-09-24 so the work can continue from another Claude account.
> Companion to `docs/HANDOFF_BORROWER_VERIFICATION.md` (PR #915: Messenger verification, schema,
> alerts). Read that first for background; this doc covers everything built **after** it.

**Status: built, tested, NOT live.** Everything is on branch **`feat/connect-approve-apply`**
(pushed to GitHub as **draft PR #916** — https://github.com/Moodeng-Credit/Moodeng-Credit-Main/pull/916 — do NOT merge until George says "launch"). The migration is **not applied** to production. The live
site still runs today's flow.

---

## 1. Why — the problem

1. **No-shows.** Today a borrower without a referral *books* a video call and their loan request
   posts to lenders immediately. Showing up changes nothing for them, so they don't. Three
   no-shows in a row.
2. **Strangers treat it as free money** (Emma): TikTok leads (Jessa, Shiena, Cris) have no
   reputation at stake.
3. **Referred borrowers couldn't repay** (Jaja, Nina, Neri): no way to deposit or cash out locally,
   so due dates kept getting extended.
4. **No contact line:** 101 borrowers, **0** verified Facebook/WhatsApp; 14 of them already funded.

The fix: **nobody new can post a loan request until they've attended a call and an admin taps
"Showed up."** Referred borrowers' call is with **Emma**, to set them up with a local exchange
(deposit, cash out, repay).

---

## 2. The flows (as built)

A switch picks the live flow. It's flipped from the admin Telegram group, with no deploy:

| Command | Flow | What happens |
|---|---|---|
| `/loanflow open` | **open** (default) | Exactly today's site: no referral → book a call → request posts right away. |
| `/loanflow call` | **call** (recommended) | Everyone new goes through the filter below. |
| `/loanflow approval` | **approval** | Like `call`, but unreferred borrowers get approved in Telegram without a call. Referred borrowers still do Emma's call. |
| `/loanflow` | — | Shows which flow is on. |

### In `call` mode (both paths start at "Apply for a loan" → Referral card)

**No referral (strong filter)**
1. **Confirm Facebook**: one tap in Messenger (SendPulse; see the other handoff doc §6).
2. **About you (bio)**: work, income, expenses, payday. It's saved to the profile right away.
3. **Why they need a loan**: a short note to the team.
4. **Book a video call**: George or Emma, round-robin. The picker shows the next ~22h first.
5. **Waiting screen**: "See you on the call". They can't apply yet.
6. **Admin taps ✅ Showed up** (or ❌ No-show = rebook, 🚫 Reject) in the Telegram KYC group.
7. **Loan terms**: amount, date, reason. The bio is skipped because it's already saved.
8. **Posted to the board.**

**With a referral:** same steps, but step 4 is **a setup call with Emma** (her calendar only),
and the copy explains it's for the local exchange: how to deposit, cash out and repay. The request
only exists after Emma marks them attended. They keep the +$5 referral boost.

**Existing borrowers (177 at the time):** grandfathered as *approved*. They skip all of this.
**Approval is once per person**; future loans post straight away.

### Admin side (Telegram group `kyc_alert_chat_id` = `-5455180275`; George and Emma are both in it)
- **New borrower card** when they book: Facebook name (from SendPulse), KYC status, work,
  income/expenses/payday, referral code, reason, call time. Buttons: ✅ Showed up / ❌ No-show /
  🚫 Reject, plus "Open Page inbox". Whoever taps first wins, and the card updates with who decided.
- **~20 min after each call:** "📞 Did Maria show up?" with the same buttons.
- **"✅ Maria confirmed she'll attend"** when the borrower taps the Messenger button.
- **"🎟️ Referral code BELLE just used"** on every code redemption, with a use count.
- **Booking = sending.** The request goes to the team the moment the call is booked (the borrower
  doesn't have to tap "Send"). As a safety net, if "Showed up" is tapped for someone whose request
  never arrived, the tap still approves them.
- **`/pending`** lists everyone waiting on a decision, with ids.
- **Typed fallbacks** (if buttons fail): `/approve <id|@user>`, `/reject`, `/showed`, `/noshow`.
  The `<id>` is the 8-character id on the card.
- **Discord** gets the same messages as notifications only (#kyc, bookings channel). There are no
  Discord buttons. Note: a `discord-interactions` edge function already exists in production (not
  in this repo), so a Discord app exists. Wiring buttons there is a possible follow-up.

### Borrower reminders
- **Push + Telegram:** a day before and an hour before (existing `video-call-reminders`).
- **Messenger (new, via SendPulse API):** a booking confirmation, a day-before reminder and an
  hour-before reminder, with an **"✅ I'll be there"** button until they tap it.
  **Meta rule:** a Page can only message someone within **24h of their last interaction**. Meta
  retired the "event reminder" message tags on 2026-04-27. So Messenger sends only inside that
  window. That's why the slot picker prefers times within ~22h.

---

## 3. Emma's message scripts → where each goes (DONE on the branch)

Emma's existing manual scripts, mapped to the steps. **All six rows are in the code.** The Zoom
link is **not hard-coded**: each booking's own join link comes from Cal.com's booking response
(`location`), is saved to `users.video_call_join_url`, and is shown on the waiting screen ("Join the
meeting") and in the Messenger confirmation and hour-before reminder. Emma's personal Zoom
password and dial-in numbers stay out of the repo, since the Cal.com link already carries them.
"Send me your contact details and social handles" is in the approval (post-meeting) message.
The decline script is used for both No-show and Reject.

| Step | Emma's script (short) | Put it in |
|---|---|---|
| 1 Confirm Facebook ("Let's talk") | "Glad you're here. Next step, let's talk in person about your needs for loan and how we can serve you best. Look forward to meeting you soon." | `ConnectStep` intro (contact page) |
| 3/4 Book the call | "IMPORTANT: Before we get your needs covered … book a 15-minute meeting with our Support team to set up your account, complete verification, and guide you through cashing out seamlessly … During the brief in-person verification meeting, we will also unlock exclusive perks, including a $10 referral bonus. So let's schedule a meeting now!" | `ConnectStep` call page → `VideoCallStep intro` |
| Waiting screen ("Confirm the initial meeting") | "Your meeting with Emma Moodeng is confirmed for [DATE] at [TIME] (Local Time) via Zoom … Requirements: 1) have your original physical ID or passport ready (approval is contingent on passing this check); 2) camera on, well-lit room, phone available; 3) to get funded post-meeting, connect with Emma on Facebook: https://www.facebook.com/emmamoodengcredit" | `LoanAccessPendingCard` + Messenger booking confirmation (`_shared/videoCall.ts sendBookedMessenger`) |
| Reminder | "Just a quick reminder about our meeting scheduled for [DATE] at [TIME] (Local Time). Please let me know if that time still works for you or if you'd prefer to reschedule." | `_shared/videoCall.ts sendReminderMessenger` |
| 5 After "Showed up" (post-meeting recap) | "Connect with Emma on Facebook … IMPORTANT: Maintaining an active account requires adhering to our repayment terms. Loan defaults result in immediate flagging and a permanent ban across all affiliated platforms." | `BORROWER_MESSAGES.approved` in `_shared/loanAccess.ts` (push + Telegram) |
| No-show ("Decline the loan request") | "We're sorry to see you go … Should you wish to pursue funding in the future, you can reschedule a call with me again or connect directly with Emma Moodeng on Facebook here https://www.facebook.com/emmamoodengcredit" | `BORROWER_MESSAGES.no_show` in `_shared/loanAccess.ts` |

**Two different referral rewards (not a conflict):**
- **+$5 credit-limit boost** for the *new borrower* who enters a code. This is in the code (`redeem_referral_code`, `referral_codes.boost_amount`).
- **$10 cash** for the *person who referred them* once that friend joins. This is Emma's "perk". It is **not in the code; it's paid manually.** The `referral_redemptions` table and the 🎟️ Telegram alert (who used which code, use count) are the record for working out who's owed. Automating the payout is a possible follow-up.

---

## 3b. Visual design (from Figma "Milestone_9.23version", pulled via the Figma MCP)

The Connect screens follow the Figma's `verify_popup` / milestone style. They're built from
`src/views/dashboard/components/connectKit.tsx`:
- a lavender-to-white hero with a 3D hippo, a bold title and one line of copy;
- a gamified **step trail** (Messenger → About you → Your goal → Book call);
- big **option cards** (`#f8f1ff` fill, `#7661f9` border, speech-bubble badge);
- a purple **gradient pill CTA**;
- icon **perk rows** instead of paragraphs;
- quick-pick **goal chips** on "What's the loan for?".

**Hippo art:** `public/hippos/connect/` holds six dedicated poses of the dashboard hippo:
`hello` (Messenger), `call` (book call), `waiting` (booked), `approved` (Apply card after approval),
`cashout` ("What's the loan for?") and `missed` (returning after a rejection). They were cleaned from
George's generated cutouts: stray crop scraps removed, trimmed, and 480px tall (about 4× the 112px
display size). `call` and `approved` keep a slight hard edge on the right from the generator's crop,
so regenerate them with more margin if it bothers anyone.

## 3c. Time zones & timing (like Calendly)

- **Borrower always sees their own time.** The booking screen reads the phone's time zone
  (shown as "Your time zone · Manila (GMT+8)"), and the slots, booked card and waiting screen all
  show the borrower's local time. Cal.com's email invite uses it too (the attendee zone is sent).
- **Messenger / Telegram / push reminders** use the zone saved at booking
  (`users.video_call_timezone`): "Fri, Sep 25, 11:00 AM (Manila time)".
- **Team cards** (booking ping, admin card, "did they show up?") show Bangkok time plus the
  borrower's clock when it differs: "10:00 AM (Bangkok time) · 11:00 AM their time (Manila)".
- **Stored in UTC.** The booking is sent to Cal.com and stored in UTC. The pre-booking re-check
  looks a day either side, so an early-morning slot in Manila (the previous UTC day) isn't
  wrongly reported as taken.
- **Reminder ladder** (cron every 15 min):
  - day-before, except when booked less than 20h ahead, since the booking confirmation already
    covers it;
  - about 1h before;
  - admin "did they show up?" 20–35 min after the start.
- **Cal.com webhook echo.** Cal.com's echo of our own booking no longer restarts reminders. Only a
  real time change (reschedule) does, and it also clears the old "I'll be there" confirmation.
- **After the call** (start + 30 min), the waiting screen says "Thanks for joining!" and hides Join.
- **After a no-show**, the borrower sees "We missed you!" with the "oops" hippo and rebooks.

## 4. What's in the branch (files)

**Database**: `supabase/migrations/20260924000000_loan_access_gate.sql` (one migration):
- enum `loan_access_status` (`none|pending|approved|rejected`); `users.loan_access_status`
  (default `none`; **existing users get `approved` via a column default**, with no UPDATE, so no
  triggers fire and `updated_at` isn't touched), `loan_access_approved_at`, `loan_access_seen_at`
  (drives the one-time "You're approved 🎉" glow).
- table `loan_access_requests` (one row per reach-out: `kind` approval|call; `status`
  pending|approved|rejected|no_show|expired; `expires_at` = call + 7 days). RLS: borrower can read
  their own rows; writes are service-role only.
- `users.video_call_confirm_token / _confirmed_at / _outcome / _outcome_at / _timezone`.
- setting `telegram_bot_settings.loan_flow` (default `open`) + RPC `get_loan_flow()`.
- **Security fixes** in `enforce_user_privileged_columns_server_only` (re-declared from the
  deployed body): users could previously self-set `messenger_verified_at`, `whatsapp_verified_at`,
  `messenger_psid` and all `video_call_*` columns (a fake "booked"), and could set
  `redeemed_referral_code_id` / `referral_boost_amount`. All of these are now server-only.
- trigger `trg_enforce_loan_access_approved` on `loans` insert: in call/approval flows, only
  `approved` borrowers can create a request (client inserts only).
- trigger `private.approve_borrower_on_open_flow_loan`: a loan made while `loan_flow = open`
  approves its borrower and closes any waiting request, so switching to `call` later never locks out
  people who already borrow. Dry-run verified.
- `referral_redemptions` table + trigger `private.log_referral_redemption` → alert.
- pg_cron `loan-access-expire-hourly` → `loan-access {action:"expire"}`.
- Dry-run verified against production **inside rolled-back transactions** (all guards, the flow
  switch, grandfathering, the referral rules). Nothing persisted and no alerts were sent.

**Edge functions**
- `loan-access` (new): `submit` (borrower JWT: creates the request and pings admins), `expire`
  (cron), `referral_alert` (DB trigger; deduped by `referral_redemptions.alerted_at`).
- `video-call-confirm` (new, `verify_jwt=false`): the "✅ I'll be there" link target. GET `?t=token`
  → stamps confirmed, pings admins, redirects to `/request-board?callConfirmed=yes`.
- `telegram-webhook`: callback buttons (`la:a|r|n:<requestId>`, `vc:a|n:<userId>`) and commands
  `/approve /reject /showed /noshow /loanflow`.
- `calcom-round-robin`: optional `host: 'emma'|'george'` pins the calendar (falls back to the
  round-robin with an error log if that host isn't configured), soonest-first slots, stores the
  confirm token and timezone, sends the Messenger booking confirmation.
- `video-call-reminders`: Messenger reminders + the post-call "did they show up?" prompt (stage 3).
- `_shared/`: `loanAccess.ts` (decide, admin card, borrower notices), `sendpulse.ts` (API; static
  key or ID/secret; 24h-window check), `videoCall.ts`, `videoCallOutcome.ts`; `discord.ts` now
  sends `allowed_mentions: {parse: []}` (a borrower typing "@everyone" can't ping the server).

**Frontend**
- `src/hooks/useLoanFlow.ts` (reads `get_loan_flow`, defaults to `open` on any error).
- `LoanRequestModal.tsx`: the gate (`isGateOn = loanFlow !== 'open'`); `connectMode` (referred →
  always `call` with Emma); the open flow keeps its old video-call step; the bio is shared via
  `renderBioStep`.
- `ConnectStep.tsx` (new): contact → about (bio) → why → call → send; `LoanAccessPendingCard`.
- `ContactsStep.tsx` (`intro` prop), `VideoCallStep.tsx` (`intro`, `continueLabel`,
  `requireUpcoming`, `host`).
- `RequestBoard.tsx`: passes `loanFlow`; Apply card glows "You're approved 🎉" once; "See you on
  the call" state; toast for `?callConfirmed=`.
- `LoanRequestPreview.tsx` (DEV only, `/loan-request-preview`): `?flow=call|approval|open`,
  `?access=none|pending|rejected`, `?referral&referralTest` (test code `BELLE`).

**Tests**: 445 vitest tests pass (including `connectStep.test.ts` and the flow-split tests in
`creditLeveling.test.ts`), plus Deno tests for `_shared/loanAccess|sendpulse|videoCallOutcome` and
`calcom-round-robin/lib`. Type check is clean.

---

## 5. Config & secrets

| Name | Where | Status |
|---|---|---|
| `SENDPULSE_API_KEY` | Supabase → Edge Functions → Secrets | **Added by George 2026-09-24.** Verified working (lists bot "Moodeng Credit"). Consider rotating it, since it was pasted in chat. |
| `CALCOM_API_KEY_GEORGE`, `CALCOM_API_KEY_EMMA` | Edge secrets | Must exist for booking. **No call has ever been booked through Cal.com in production.** Verify at launch. |
| `TELEGRAM_API_TOKEN` | Edge secret | Works (KYC alerts arrive). The copy in the DB **vault** returns 401 (stale; unused). |
| Vault `SUPABASE_PROJECT_URL`, `SUPABASE_SECRET_KEY` | DB vault | Used by the cron + referral trigger. Present. |
| `DISCORD_KYC_WEBHOOK_URL`, `DISCORD_BOOKINGS_WEBHOOK_URL` | Edge secrets | Existing. |

Supabase project **`qplmmxynzxzkfxtayoqr`** (named "[Dev]Moodeng" but it IS production).
Branch **`staging` = production** (Vercel deploys it).

---

## 6. Launch checklist (only when George says "launch")

1. **Drift check** (last done 2026-09-24): the deployed `telegram-webhook` (v53) was byte-identical to
   the branch's starting point, `staging` had no new commits since `da1e6c8`, no migrations after
   `20260923150440`, and `enforce_user_privileged_columns_server_only` was unchanged. Repeat these
   checks at launch (`get_edge_function`, `git log origin/staging`, `schema_migrations`,
   `pg_get_functiondef`) in case someone deployed in between.
2. Rebase `feat/connect-approve-apply` on `origin/staging`; run `pnpm run type-check`,
   `pnpm test`, and the Deno tests.
3. Mark draft PR #916 ready → merge to `staging`. The frontend treats a missing column as "approved", so the
   deploy is safe before the migration.
4. **Right after:** apply the migration (Supabase MCP `apply_migration`).
5. **Apply the migration first, then** deploy the edge functions: `loan-access`, `video-call-confirm`,
   `telegram-webhook`, `calcom-round-robin`, `video-call-reminders`, `calcom-webhook` and
   `sendpulse-messenger-verify`. The last two changed too:
   - `calcom-webhook` handles cancel/reschedule and join links.
   - `sendpulse-messenger-verify` now stores the **SendPulse contact id**, looked up by the code
     via `getByVariable`. That's the only id SendPulse's send API accepts; Facebook's numeric PSID
     is rejected, which was checked live.

   Functions write the new columns, so the migration must be in first. `config.toml` needs `video-call-confirm`
   `verify_jwt = false`.
6. **Live test with a real borrower account** while still on `open`:
   - Set `/loanflow call` in the Telegram group.
   - Messenger confirm → bio → why → book (check the Cal.com booking and the Messenger
     confirmation) → tap "I'll be there" → the admin card → tap **Showed up** → loan terms → posted.
   - Also test No-show → rebook, and a referral code → Emma-only slots + the 🎟️ alert.
6b. **Cal.com has never booked a call in production** (the old no-shows came via Calendly). Before
   the live test, check:
   - Edge secrets `CALCOM_API_KEY_GEORGE` and `CALCOM_API_KEY_EMMA` exist.
   - Each host has an event type with slug `15min`, with **Location = Zoom** (Zoom app connected in
     Cal.com) so `video_call_join_url` is a Zoom link.
   - The Cal.com webhook points at `…/functions/v1/calcom-webhook` with the `CALCOM_WEBHOOK_SECRET`
     secret. It now also handles cancel (the request is closed, the borrower is asked to rebook, the
     admins are pinged) and reschedule (reminders restart).
   - Each host's Google Calendar is connected, so Cal.com avoids double-booking against Calendly or
     personal events.
7. **Telegram facts found 2026-09-24:**
   - The KYC group's alerts come from the *main* bot (edge secret `TELEGRAM_API_TOKEN`), whose
     webhook is `telegram-webhook`, which is receiving traffic.
   - The vault token `TELEGRAM_NOTIFICATION_API_TOKEN` is a *different* bot
     (@moodengnewbranchbot). It has no webhook and is **not** in the KYC group, only the team
     group, so it's irrelevant here.
   - The vault copy of `TELEGRAM_API_TOKEN` is stale (401), so `getWebhookInfo` for the main bot
     couldn't be read.
   - If typed commands get no reply, the bot is in privacy mode and another bot spoke last: use
     `/approve@<botusername> …`.
   - Site links: the app is **https://moodeng.app**. `app.moodeng.credit` does NOT resolve. New
     code falls back to moodeng.app. **Fixed in this branch:** every link fallback that pointed at a
     dead domain (`app.moodeng.credit`, `dashboard.moodeng.app`) now points at moodeng.app:
     - `loan-request-telegram-notification`, `loan-request-lender-suggestions`, `support-chat`,
       `admin-loan-notify`, `admin-loan-request-removed`
     - `_shared/diditNotifications|loanNotifications|pushMessages`
     - the privacy page's back link

     Fallbacks only matter when the `VITE_SITE_URL` / `MOODENG_APP_URL` / `SITE_URL` edge secret
     is unset. If it's unset, redeploy those functions (and the ones importing those shared files:
     `didit-webhook`, `check-didit-status`, the `loan-*-notification(s)` functions,
     `loan-request-repeat-lender-push`) so lender/borrower links stop pointing at a dead site.
   - The service key used by crons and triggers works: `video-call-reminders` had 96/96 × 200.
7b. Check the Telegram **buttons** actually arrive at the webhook. If they don't, run `setWebhook`
   with `allowed_updates` including `callback_query`. Meanwhile the typed commands work.
8. Leave `/loanflow call` on, or go back to `open`.
9. Then update `docs/HANDOFF_BORROWER_VERIFICATION.md` §13 and merge PR #915 (George said don't
   merge yet).

---

## 7. Open items / decisions

- **Emma's texts** (§3) are in the code. Have Emma read them in the preview (`/loan-request-preview?flow=call&referral&referralTest`) and tweak the wording.
- **$10 vs $5 referral bonus**: confirm with Emma.
- **Emma's "pre-interview before verification" idea:** today the gate appears when tapping Apply,
  *after* KYC (Didit) + wallet. Moving it before KYC would save Didit costs on no-shows. That
  needs the gate at the onboarding entry instead of inside `LoanRequestModal`.
- **Referral codes** are first names (BELLE, ABIGAIL…) with unlimited uses. George manages them
  himself; the redemption alert now shows usage.
- **SendPulse plan:** a PRO trial auto-charges on Oct 1. A reminder is scheduled for Sep 29. It's
  unknown whether the free plan allows API sends. If not, Messenger reminders stop silently and
  everything else keeps working.
- **WhatsApp** is parked (George's personal number +66951659077 would need to move to WhatsApp
  Business first).
- **Discord buttons**: optional, via the existing `discord-interactions` app.
- **Login card** asking all 101 existing borrowers to connect Facebook (only 0 verified; 14
  funded): proposed, not built.
- **Business pivot** (Emma): B2B with recruitment agencies and visa-application loans. Loan sizes
  far exceed the current $15-start credit tiers; decide the product before building.

---

## 8. How to resume in a new session

```bash
cd /Users/georgelerner/Claude/Moodeng/Moodeng-Credit-Main
git fetch origin
git worktree add ../wt-gate origin/feat/connect-approve-apply   # or any path
cd ../wt-gate && ln -s ../Moodeng-Credit-Main/node_modules node_modules
pnpm run type-check && pnpm test
```

Tell the new session: "Read `docs/HANDOFF_BORROWER_FLOWS_V2.md` and
`docs/HANDOFF_BORROWER_VERIFICATION.md`, then continue." Rules George cares about:
- Don't merge or apply anything to production without his explicit "launch".
- `staging` is production.
- Never delete macOS Keychain items.
- Work in a git worktree, because the main checkout is shared with other sessions.
