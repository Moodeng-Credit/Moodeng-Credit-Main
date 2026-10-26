# Reminders: push first, WhatsApp fallback

## What shipped (v1, 2026-10-16), off until switched on

- **Where it shows:** the reminders card in `ContactsStep`. When notifications can't work (no push here,
  blocked, or broken on this phone), a **"Get reminders on WhatsApp"** card appears
  (`WhatsAppRemindersCard`). It's *Recommended*, not required. Tapping it opens WhatsApp with the code
  pre-typed to +66 95 165 9077. If WhatsApp doesn't open, the code, a Copy button and the number are on
  screen.
- **Facebook stays required.** A verified WhatsApp no longer counts instead of Messenger.
- **Opt-in:** SendPulse WhatsApp flow → `sendpulse-messenger-verify` with `channel: 'whatsapp'` → stamps
  `whatsapp_verified_at`, `whatsapp_number`, `whatsapp_contact_id`. `STOP` → `notif_whatsapp = false`.
- **Sending:** `borrowerNotificationDelivery` sends the templates `moodeng_due_tomorrow` (only when no push
  landed), `moodeng_due_today` and `moodeng_overdue`.
- **One switch:** `telegram_bot_settings.borrower_whatsapp_enabled` (starts `false`) turns on both the card
  (`get_whatsapp_reminders_enabled()`) and the sending.
- **Not in v1:** the end-to-end "test notification arrived" check (push still counts as on once
  subscribed), and the dashboard banner for existing borrowers.

### To switch it on
1. In SendPulse → WhatsApp bot, create flow **Confirm WhatsApp**: trigger keyword `MDNG` (contains).
   Its action is an API request: `POST https://qplmmxynzxzkfxtayoqr.supabase.co/functions/v1/sendpulse-messenger-verify`,
   header `x-sendpulse-secret: <SENDPULSE_VERIFY_SECRET>`, body
   `{"channel":"whatsapp","message":"{{last_message}}","contact_id":"{{contact_id}}","phone":"{{phone}}"}`.
   On success it replies "You're set! We'll send your payment reminders here."
2. Create flow **STOP**: keyword `STOP`, same URL, body
   `{"channel":"whatsapp","action":"opt_out","contact_id":"{{contact_id}}"}`.
3. Submit three **Utility** templates in English, each with body variables {{1}} name, {{2}} amount,
   {{3}} when, and a URL button "Repay now" → `https://moodeng.app/repay`:
   - `moodeng_due_tomorrow`: "Hi {{1}}, your Moodeng loan of {{2}} USDC is due {{3}}. Repay on time to keep growing your credit level."
   - `moodeng_due_today`: "Hi {{1}}, your Moodeng loan of {{2}} USDC is due {{3}}. Tap below to repay."
   - `moodeng_overdue`: "Hi {{1}}, your Moodeng loan of {{2}} USDC is overdue ({{3}} late). Repay now to protect your credit level, or reply here if you need help."
4. Once approved: `update telegram_bot_settings set value = 'true' where key = 'borrower_whatsapp_enabled';`

---

## Original plan


Status: **plan only, nothing built** (2026-10-16). No PR until George signs off on the open decisions at the bottom.

## Goal

One "Turn on reminders" tap at the end of the loan request. A progress bar checks, for real, whether this
device can get push reminders. If it can → push is the channel. If any check fails → the same card turns
into "Get reminders on WhatsApp instead" (one tap, hit send). The borrower can't continue without one
working reminder channel.

Why now (prod, 2026-10-16): **23 borrowers have had a loan funded; only 10 have a push subscription.**
13 of 23 can't get a lock-screen reminder today.

## What exists (verified in code)

| Piece | Where | Today |
|---|---|---|
| Push permission + subscribe | `src/lib/push/webPushClient.ts`, `src/hooks/usePushNotifications.ts` | Returns `subscribed / permission-denied / permission-dismissed / unsupported / failed`. "Subscribed" only means the browser handed us an endpoint, **not** that a notification ever showed. |
| Service worker | `public/sw.js` | Shows the notification on `push`. Doesn't report back. |
| Reminder card + gate | `src/views/dashboard/components/ContactsStep.tsx` | `canContinue = contactVerified && (pushOn \|\| !pushRequired)` where `contactVerified = whatsappVerified \|\| messengerVerified`. Unsupported browsers (iPhone Safari not on Home Screen, FB in-app) pass **with no reminder channel at all**. |
| WhatsApp verify (old) | `start_whatsapp_verification()` RPC → wa.me link → `whatsapp-webhook` fn | Built for Meta's **test** number via our own Cloud API app. Number defaults to `15551939271`; card hidden behind `VITE_WHATSAPP_VERIFY_ENABLED`. Stamps `users.whatsapp_number` + `whatsapp_verified_at` (1 user verified). |
| Fan-out | `_shared/borrowerNotificationDelivery.ts` `sendBorrowerLoanNotification` | Email → Telegram → push → Messenger (24h window only). Used by 8 functions incl. `loan-due-notifications`, `loan-overdue-notifications`. |
| SendPulse client | `_shared/sendpulse.ts` | Messenger only (`api.sendpulse.com/messenger/...`). Same API credentials work for WhatsApp. |

### The thing that changes the design

The real number **+66 95 165 9077 is connected through SendPulse** (Embedded Signup under SendPulse's
Meta app, coexistence with the WhatsApp Business app). Meta delivers its webhooks to **SendPulse**, not to
our `whatsapp-webhook`. So:

- **Inbound** (verification, STOP) must come through a **SendPulse WhatsApp flow → External Request → our
  function**, exactly like Messenger does today.
- **Outbound** goes through **SendPulse's WhatsApp API** (`https://api.sendpulse.com/whatsapp`), not
  `graph.facebook.com`.
- `whatsapp-webhook` stays untouched (legacy test-number path). No new Meta app.

### Hard constraints

- **Edge-function cap:** the project can't deploy a new function (402). Everything below goes into
  existing functions.
- **Edge secrets are capped at 100.** No new secrets. The WhatsApp bot id goes in as a code constant with an
  optional env override, like `SENDPULSE_BOT_ID`.
- **Facebook stays mandatory** (George vetoed "skip Facebook" and rejected WhatsApp as a substitute). Today
  `contactVerified` accepts WhatsApp **instead of** Facebook. That has to be decoupled before WhatsApp is
  switched on, or WhatsApp becomes a back door around the Facebook check.
- **Templates:** a reminder days after the borrower last wrote to us is business-initiated, so it needs a
  Meta-approved **utility** template. Free-text works only inside 24h.
- **250 business-initiated conversations / 24h** until business verification (Building Credit Asia LLC)
  passes. That's fine for current volume.

## Design

### 1. Frontend: one "Reminders" card (`ContactsStep.tsx`)

Replaces the current push `OptionCard` + help box. A small state machine in a new
`src/views/dashboard/components/RemindersCard.tsx` (keeps ContactsStep from growing further):

```
idle ──tap──▶ checking ──all pass──▶ push_on ✓
                 │
                 └─any fail/timeout─▶ whatsapp_offer ──tap──▶ whatsapp_waiting ──verified──▶ whatsapp_on ✓
unsupported (detected on mount) ───────▶ whatsapp_offer   (+ secondary "Add to Home Screen instead")
```

Progress bar steps, each with a tick or a cross:

1. **This browser can do reminders.** `isPushSupported() && isPushConfigured()`. It fails right away for
   iPhone Safari not on the Home Screen and for in-app browsers.
2. **Permission.** `Notification.requestPermission()` from the tap. Denied or dismissed → fail.
3. **Device registered.** The existing `syncPushSubscription({ promptIfNeeded: true })` returns
   `subscribed`/`already-subscribed`.
4. **Test reminder arrived.** New, and this is the step that makes the bar honest. The client asks the server
   to send one test push to this device's endpoint. The service worker shows it ("✅ Reminders work") and
   `postMessage`s `{ type: 'push-test-ack', nonce }` to open clients. The card waits up to **10 s**. No ack →
   fail → WhatsApp offer.

The animation runs on real events (`step N done`), not a timer, so the bar never claims something we didn't
see.

`whatsapp_offer` reuses the existing `handleVerify('whatsapp')` path (RPC → `wa.me` link with the code
pre-filled → poll `whatsapp_verified_at`, plus the re-check on focus). The copy says it's for **payment
reminders**: that on-screen promise plus the borrower sending the first message is the opt-in Meta requires.

**Gate change:**

```ts
const facebookOk = messengerVerified;                  // was: whatsappVerified || messengerVerified
const remindersOk = pushOn || whatsappVerified;        // was: pushOn || !pushRequired
const canContinue = facebookOk && remindersOk;
```

The standalone WhatsApp contact card (`showWhatsApp`) is removed. WhatsApp shows up only as the reminder
fallback.

`CONTACT_STEP_EXEMPT_USER_IDS` still skips the whole step.

### 2. Test push: server side (no new function)

Add an `action: 'test_push'` branch to **`connect-telegram-notifications`**. It's already user-JWT
authenticated (`verify_jwt = true`, `auth.getUser`) and is the "turn on notifications" function. Body:
`{ action: 'test_push', endpoint, nonce }`. It loads that user's `push_subscriptions` row **matching the
endpoint**, so it only ever sends to the caller's own device, and calls `sendPushToSubscriptions` with
`{ type: 'push_test', nonce, title: '✅ Reminders work', body: 'We'll remind you here before your due date.' }`
at `urgency: 'high'`, `ttl: 60`. It's rate-limited to 5 per user per hour.

`public/sw.js`: in the `push` handler, after `showNotification`, if `payload.type === 'push_test'`, post the
ack to all window clients. (Chrome requires a visible notification for every push, so the test one has to
show. It doubles as proof to the borrower.)

### 3. WhatsApp inbound: verification + STOP (no new function)

**SendPulse (George, in the UI):** on the WhatsApp bot:
- Keyword trigger **`MDNG`** (contains) → flow "Confirm WhatsApp" → External Request `POST`
  `…/functions/v1/sendpulse-messenger-verify` with header `x-sendpulse-secret`, body
  `{"channel":"whatsapp","message":"{{last_message}}","contact_id":"{{contact_id}}"}`. On `ok:true` it replies
  "You're set — we'll send payment reminders here."
- Keyword **`STOP`** → same URL, body `{"channel":"whatsapp","action":"opt_out","contact_id":"{{contact_id}}"}`.

**`sendpulse-messenger-verify`:** branch on `channel`:
- `whatsapp` + code: match `contact_verification_codes` (channel `whatsapp`, which is what
  `start_whatsapp_verification()` already writes), unexpired and unverified. Then fetch the contact **server-side**
  with `GET /whatsapp/contacts/get?id=` to read the phone, so the number on file comes from SendPulse and not
  the request body. Stamp `users.whatsapp_number`, `whatsapp_verified_at`, `whatsapp_contact_id`, and set
  `notif_whatsapp = true`. Same KYC/Discord "connected" ping as Messenger.
- `whatsapp` + `opt_out`: `notif_whatsapp = false` for the user with that `whatsapp_contact_id`.
- Messenger behaviour is unchanged (default when `channel` is absent).

The existing `candidateCodes()` already copes with `"Verify my Moodeng account: MDNG-XXXXXX"`.

### 4. DB migration

```sql
alter table public.users
  add column if not exists whatsapp_contact_id text,      -- SendPulse contact id (send API key)
  add column if not exists notif_whatsapp boolean not null default true;
-- extend the 20260924150000 guard trigger: clients may not write whatsapp_contact_id;
-- clients MAY set notif_whatsapp=false (settings toggle), never true→ only server re-enables on re-verify.
insert into telegram_bot_settings(key, value) values ('borrower_whatsapp_enabled','false')
  on conflict (key) do nothing;                            -- kill switch, starts OFF
```

### 5. WhatsApp outbound: `_shared/sendpulse.ts` + fan-out

Add to `_shared/sendpulse.ts`, using the same token and base `https://api.sendpulse.com/whatsapp`:

```ts
export const SENDPULSE_WHATSAPP_BOT_ID = Deno.env.get('SENDPULSE_WHATSAPP_BOT_ID')?.trim() || '<from GET /whatsapp/bots>';
export const sendWhatsAppTemplate = (contactId: string, template: WaTemplate) => // POST /contacts/sendTemplate {contact_id, template}
```

`template = { name, language: { code: 'en' }, components: [{ type: 'body', parameters: [...] }, { type: 'button', sub_type: 'url', index: 0, parameters: [...] }] }`.

It never throws and returns `{ ok, reason }`, like `sendMessengerMessage`.

**`sendBorrowerLoanNotification`** gets a `whatsapp` channel and a `whatsappSent` result:

- Sent when: kill switch is on, `recipient.whatsapp_contact_id`, `notif_whatsapp !== false`, and the type has a
  template.
- **Push first, WhatsApp to fill the gap:** for `final_reminder` (due tomorrow), send WhatsApp only if
  `!pushSent`. For `due_today` and `overdue`, always send WhatsApp too (the moments that matter; a few cents).
- Callers `loan-due-notifications` and `loan-overdue-notifications` add `whatsapp_contact_id, notif_whatsapp` to
  their `users` select. A WhatsApp send counts as delivered for `recordNotification`, so the hourly cron
  doesn't resend.
- A failure posts once to the admin Telegram (bad template, contact disabled), the same as other channel
  errors.

### 6. Templates (submit in SendPulse → WhatsApp bot → Templates, category **Utility**, `en`)

| name | body | button |
|---|---|---|
| `moodeng_due_tomorrow` | Hi {{1}}, your Moodeng loan of {{2}} USDC is due {{3}}. Repay on time to keep growing your credit level. | URL "Repay now" → `https://moodeng.app/repay` |
| `moodeng_due_today` | Hi {{1}}, your Moodeng loan of {{2}} USDC is due today ({{3}}). Tap below to repay. | same |
| `moodeng_overdue` | Hi {{1}}, your Moodeng loan of {{2}} USDC is overdue. Repay now to protect your credit level, or reply here if you need help. | same |

`{{3}}` reuses the aggregate's `dueLabel` that push already uses, so the wording is identical across
channels. Utility templates must stay non-promotional: no "unlock bigger loans" upsell.

### 7. Existing borrowers

There are 13 funded borrowers with no push subscription. A dashboard banner (`DashboardV2`) shows the same
`RemindersCard` to any borrower with an open loan and neither a push subscription nor a WhatsApp contact.
Push still goes first; WhatsApp is the fallback.

## Build order (each step shippable on its own, flag-gated)

| # | Who | What | Rollback |
|---|---|---|---|
| 0 | George | SendPulse: "Confirm WhatsApp" + STOP flows; submit 3 templates; send me the WhatsApp bot id | none |
| 1 | me | Migration (cols + guard + kill switch) | additive |
| 2 | me | `sendpulse-messenger-verify` WhatsApp branch; test with a second phone (you can't message your own business number) | Messenger path untouched |
| 3 | me | `test_push` action + `sw.js` ack | unused until 4 |
| 4 | me | `RemindersCard` + gate change, behind `VITE_REMINDERS_V2` | flag off |
| 5 | me | `sendWhatsAppTemplate` + fan-out | `borrower_whatsapp_enabled=false` |
| 6 | me | Dashboard banner for existing borrowers | flag off |

## Test matrix (before flipping flags)

- Android Chrome: all 4 steps pass → push on.
- Android Chrome with notifications blocked: step 2 fails → WhatsApp → verified → Continue.
- iPhone Safari (not installed): step 1 fails immediately → WhatsApp is the default, with Home Screen as the secondary option.
- iPhone Home Screen app (iOS 16.4+): push passes.
- Facebook in-app browser: step 1 fails → WhatsApp.
- Facebook verified, no reminders → Continue disabled. WhatsApp verified, no Facebook → Continue disabled.
- STOP → `notif_whatsapp=false` → the next cron run skips WhatsApp.
- Cron: push borrower gets push only for "due tomorrow", both for "due today"; WhatsApp-only borrower gets the template; no double send on the next hourly run.

## Open decisions (George)

1. **Gate for everyone:** borrowers whose browser can't do push (in-app or iPhone Safari) currently pass
   with **no** reminder channel. Should they be required to set up WhatsApp? *Recommend yes. It's one tap.*
2. **iPhone not on the Home Screen:** WhatsApp as the default, with "Add to Home Screen" as a secondary link?
   *Recommend yes.*
3. **Double-send:** WhatsApp in addition to working push for "due today" + "overdue"? *Recommend yes.*
4. **Template language:** English only first, Taglish later? *Recommend English first; it gets approved faster.*
5. **Rates:** check SendPulse's utility rate for PH/ID destinations. Only the US rate ($0.006) has been
   confirmed so far.
