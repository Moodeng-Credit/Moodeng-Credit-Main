# admin-loan-request-removed

Removes a pending loan request and tells the borrower why, with a reason the admin picks and an
optional personal note. Deployed to `[Dev]Moodeng` (`qplmmxynzxzkfxtayoqr`), v1, `verify_jwt: false`
(auth is enforced in the function body — see below).

Commit this file to `supabase/functions/admin-loan-request-removed/index.ts` in
`Moodeng-Credit-Main`. It imports the existing `../_shared/email.ts` and `../_shared/telegram.ts`
unchanged, so nothing else in the repo needs to move.

## Auth

Two accepted callers, checked in this order:

1. `x-notification-secret: <SUPABASE_SECRET_KEY>` — the same vault secret the cron jobs use, verified
   through `verify_internal_notification_secret`. For pg_net / system callers.
2. `Authorization: Bearer <user JWT>` — must map to an `admin_users` row that is `active` with role
   `owner`, `admin`, or `support`. This is the admin-panel path; `actor_user_id` is recorded.

Anything else gets 401/403. `verify_jwt` is off at the gateway only so path 1 can reach the code —
same pattern as `loan-request-expired-notifications`.

## Request

```jsonc
POST /functions/v1/admin-loan-request-removed
{
  "loanId": "uuid",              // optional; if present and still pending, it is deleted here
  "borrowerUserId": "uuid",      // required only when the loan row is already gone
  "trackingId": "LOAN-…",        // display only; taken from the loan when loanId is given
  "loanAmount": 15,              // display only; same
  "reasonCode": "speculative_investment",
  "personalMessage": "free text, max 1000 chars",  // required when reasonCode is "other"
  "canReapply": true,            // default true
  "channels": { "email": true, "telegram": true },
  "dryRun": false                // true renders the message and sends nothing
}
```

Response: `{ removed, alreadyRemoved, emailSent, telegramSent, subject, errors[] }`, or
`{ dryRun: true, wouldRemove, preview: { subject, text } }`.

## Reason codes (the admin-panel dropdown)

| code | label |
| --- | --- |
| `speculative_investment` | Speculative / investment use |
| `prohibited_use` | Prohibited use (gambling, lending on, etc.) |
| `unclear_reason` | Reason unclear or incomplete |
| `duplicate_request` | Duplicate of an open request |
| `not_eligible_yet` | Not eligible yet |
| `needs_verification` | Needs verification before we can list it |
| `test_request` | Test / non-genuine request |
| `other` | Other (write your own message) — `personalMessage` required |

Each code carries the borrower-facing paragraph; the personal note is appended as
"A note from the team: …". Copy lives in the `REASONS` map in `index.ts` — edit there, redeploy.

## Side effects

- Deletes the loan **only** when `loan_status = 'Requested'` and no lender is attached; a funded loan
  returns 409 instead. Writes `loan_request_delete_events` first, so the existing delete trail holds.
- Email via Resend from `support@moodeng.app` (`RESEND_FROM`).
- Telegram only if the borrower has a `chat_id` **and** `telegram_bot_settings.borrower_notifications_enabled = 'true'`.
- Always writes `admin_audit_logs` with `action = 'loan_request_removed'` and the full reason,
  personal message, and per-channel delivery result in `metadata`.

## Admin panel wiring (still to do — needs the app repo)

The backend is live; the UI is not. In the admin loan-request view, the "remove" action should call
this function with the borrower's session JWT: reason dropdown from the table above, optional
message textarea, a "can re-apply" toggle, and a **Preview** button that posts `dryRun: true` and
shows `preview.text` before the admin commits. That replaces whatever direct `loans` delete the
panel does today — worth removing that path so every removal is notified and audited.

## Known inconsistency

`admin-loan-notify` tells borrowers to write to `support@moodengcredit.com`, but all mail actually
sends from `support@moodeng.app`. This function points at the Telegram support handle and "reply to
this email" instead, to avoid sending people to an address I can't verify receives mail. Worth
picking one and making it consistent across the notification functions.
