# Sign-up & login inside Facebook's browser — technical plan

Status: **plan only** (2026-10-16). Nothing built, no PR. Companion to
[WHATSAPP_REMINDERS_PLAN.md](WHATSAPP_REMINDERS_PLAN.md).

## Goal

Someone taps a Moodeng link in Facebook or Messenger, and signs up or logs in **without leaving
Facebook's browser** and with as few taps as possible. Long term that means "Continue with Facebook".
Until then, email + password that works fully in-app.

## Current state (verified 2026-10-16)

| Thing | State |
|---|---|
| Routes | `/sign-in` → `SignInPage.tsx`, `/sign-up` → `SignUpPage.tsx` (the `views/login/*` forms are not routed) |
| Google | OAuth redirect (`signInWithOAuth`). **Always fails in Facebook's browser** (Google returns `403 disallowed_useragent`), but the button is still shown there. |
| Facebook | Grey "coming soon" tile. **Supabase Facebook provider is already enabled** with a Meta app client id; "Allow users without an email" is **off**. Meta app is not Live for the public (needs business verification). |
| Telegram / LINE | Edge functions `telegram-login` / `line-login` verify the provider signature and mint the session server-side (`_shared/mintSession.ts`, #1039). No passwords. |
| Email confirmation | **ON.** It was switched off for a few hours on 2026-10-16 and switched back on because of the takeover risk in A2; no one signed up in that window. With it off, email sign-ups get a session immediately and the existing screens already handle that (`SignUpPage` → `/auth-success?type=created` → role onboarding). |
| In-app notice | `InAppBrowserNotice` (mounted globally in `App.tsx`) pushes people **out** to Chrome/Safari, which is the opposite of the new goal on auth pages. |
| Triggers on `auth.*` | The A1/A2 guard below (migration `20261016120000`). |
| Last 30 days | 55 Google sign-ups, 26 email sign-ups (3 never confirmed, never signed in). |

## Phase 0 — Telegram/LINE guessable passwords: already fixed

The old login functions used a password derived from the provider id plus the first 8 characters of the
bot token (for Telegram that's the public bot id). Fixed on `staging` in #1039 (server-minted sessions,
`_shared/mintSession.ts`), and the live functions run that code. Checked 2026-10-16: none of the 10
synthetic Telegram accounts still opens with the old derived password.

## Phase A — make "Confirm email OFF" safe (shipped dormant: does nothing while confirmation is ON)

### A1. Track whether an email is actually proven

```sql
alter table public.users add column if not exists email_proven boolean not null default false;
update public.users set email_proven = true;  -- everyone before the switch was confirmed or OAuth
```

The column is set `true` when the person:
- signs in with Google or Facebook (the provider vouches for the email),
- completes a password reset (they read a code from that inbox), or
- does the optional in-app "verify email" step (A6).

New email/password sign-ups start `false`. Clients can't write it: add it to the existing users guard
trigger from `20260924150000_loan_access_gate.sql`.

### A2. Close the account-takeover hole

**Attack:** someone signs up with `victim@gmail.com` and a password (now auto-confirmed). Later the real
owner taps "Sign in with Google", and Supabase auto-links them into the attacker's account, where the
attacker's password still works. Supabase's built-in defence only removes *unconfirmed* identities, and
with confirmation off everything counts as confirmed.

**Fix:** an `AFTER INSERT` trigger on `auth.identities` for `provider in ('google','facebook')`.
- When the user's `email_proven` is `false`:
  - wipe the password (`auth.users.encrypted_password = ''`),
  - delete that user's **older** sessions (`auth.sessions where created_at < now()`; refresh tokens
    cascade),
  - set `email_proven = true`,
  - post a security alert (existing `securityAlerts` path / Telegram admin).
- It runs atomically inside the link, so it doesn't depend on the client.
- It would be the first trigger on the `auth` schema; Supabase documents triggers on auth tables as
  supported. Test it end-to-end on the **local stack** (`pnpm run dev:local`) before prod.
- Backstop: a daily sweep (in an existing cron function) that repeats the same check.

### A3. Password reset also locks out others

In `reset-password`, after setting the new password, delete the user's other sessions and set
`email_proven = true`. That covers the reverse case, where the attacker registered first and the owner
recovers the account by email.

### A4. Reserved domains

Block email sign-ups at `@moodeng.app` / `@moodeng.credit`. Those are the synthetic Telegram/LINE
addresses, and pre-registering one would break that person's first Telegram login. Add the check to the
client and to `email_exists`-style validation on the server.

### A5. Typo guard

On sign-up, suggest corrections for common domain typos (`gmial.com`, `gmail.con`, `yaho.com`,
`hotmial.com`, …), using a small local list with no library. Then show a one-line "Is this your email?
**maria@gmail.com**" before submitting. An unproven typo means password reset can never reach them.

### A6. What we send to unproven emails — decision

Loan emails include amounts and dates. With an unproven address, that could be a stranger's inbox.
- **Option 1 (recommended):** send loan/transaction emails only when `email_proven`. Unproven users still
  get push, Messenger and WhatsApp.
- **Option 2:** send anyway.

There's also an optional non-blocking "Verify your email" card in profile: we send an 8-digit code with
our own email sender from an existing function, and they type it in the same tab.

## Phase B — Facebook-browser sign-up/in UX

B1. **Auth pages in an in-app browser** (`detectInAppBrowser().isInApp`):
- Hide the Google button, which can't work there. Replace it with a small "Using Google? Open in Chrome"
  link that uses the existing `openInSystemBrowser`.
- Email form first; Facebook button on top once Phase C is live.

B2. **`InAppBrowserNotice`:** don't show it on `/sign-in`, `/sign-up`, `/auth-success` or role onboarding,
because it tells people to leave. Keep it where leaving is genuinely needed (wallet connect, Repay).

B3. **Fewer fields — decision.** The sign-up form asks for Username + Email + Password. The username can
be derived (`deriveUsername()` already falls back to the email prefix) and edited later in onboarding.
- **Recommend:** Email + Password only.

B4. **Password-manager tagging** (so saved logins fill in):
- `SignUpPage`:
  - Email `autoComplete="username"` + `name="email"`; it's the login id, so it's the one that should be
    saved.
  - Display-name `autoComplete="nickname"`. It's currently tagged `username`, so password managers save the
    wrong login.
  - Password `new-password`.
- `SignInPage`: email `username`, password `current-password`, plus `name`s (currently none).
- After successful sign-up/login: `if ('PasswordCredential' in window) navigator.credentials.store(new PasswordCredential({ id: email, password }))`.
  Chrome/Android shows "Save password?" right away; other browsers skip it safely.
- **Reality in Facebook's browser:**
  - Android autofill usually **fills**; the **save** prompt is less reliable.
  - iPhone can usually **fill** from iCloud Keychain but rarely **offers to save**.

B5. **Password rule:** show/hide eye on sign-up (sign-in has it), one field (no confirm), and a plain
"8+ characters" rule. Check the current `password_too_weak` rule and relax it if it asks for symbols.

## Phase C — Facebook Login (blocked on business verification)

**Prereqs (George):**
- A US phone number (virtual is fine), then finish business verification for **Building Credit Asia LLC**:
  Colorado ID `20268269529`, Denver address, Articles of Organization.
- Then, on the Meta app already wired into Supabase:
  - set privacy policy URL, terms URL, data-deletion instructions URL (a static `/data-deletion` page
    we add), icon, category;
  - request **Advanced Access** for `public_profile` + `email`;
  - switch to **Live**.
- Until then, add yourself and testers under App Roles to test.

**Code:**
- Replace the "coming soon" tile with
  `signInWithOAuth({ provider: 'facebook', options: { redirectTo, scopes: 'email' } })`.
- In an in-app browser, make it the **first, full-width** button.

**Decision — Facebook accounts with no email** (common in PH, where people register by phone):
- Supabase's "Allow users without an email" is off, so those people get an error.
- **Option 1:** keep it off and show "Your Facebook has no email; sign up with email instead."
- **Option 2:** turn it on. Then audit code that assumes `users.email`: `telegram-login`, `reset-password`,
  loan emails, admin email tool.
- **Recommend Option 1** to start, and log how often it happens.

**Notes:**
- Linking: Facebook's email is verified, so it auto-links to an existing Google/email account with the
  same address. A2 wipes any unproven password at that moment.
- Facebook Login gives an app-scoped id, **not** the Messenger PSID. The required Messenger confirmation
  step stays.
- **Test on device:** Facebook's browser on Android and iPhone. Does the dialog show "Continue as …"
  without asking for a password? Expected, but not verified.

## Phase D — WhatsApp code login (optional, later)

- Type your phone number; a WhatsApp authentication template brings a code; type it.
- Works in Facebook's browser because no link has to open.
- Wire it through Supabase phone auth plus the Send-SMS hook pointed at SendPulse. The hook endpoint lives
  in an existing function because of the function cap.
- Only worth doing after Facebook Login, for people without a usable Facebook email.
- The "tap to send" variant depends on a link-handoff test page (see the reminders plan).

## Measurement

PostHog (project 492261; `distinct_id` = Supabase user id):
- New events: `auth_view`, `auth_submit`, `auth_success`, `auth_error`.
- Properties: `{ method, in_app, app_name, os }`.
- Funnel: in-app vs normal browser, before/after each phase.
- The success metric is **in-app sign-up completion rate**.

## Order and size

| # | What | Size | Blocked by |
|---|---|---|---|
| 0 | Telegram/LINE passwordless session | — | done (#1039) |
| A1–A3 | `email_proven`, takeover trigger, reset hardening | M | done (tested in a rolled-back transaction on prod: 12/12) |
| A4 | Reserved domains | S | — |
| A5, B1–B5 | Typo guard, in-app auth layout, notice scoping, 2-field sign-up, password tagging | M | decisions B3 |
| A6 | Email-to-unproven policy (+ optional verify card) | S | decision |
| Measurement | PostHog auth events | S | — |
| C | Facebook Login | S code / L Meta | US number → business verification → App Live |
| D | WhatsApp code login | M | template approval; after C |

With A1–A3 live, "Confirm email" can be switched off again. Do A4 first, or at least alongside, so nobody
can pre-register a synthetic `@moodeng.app` address.

## Decisions for George

1. Email + Password only on sign-up, username later? *(Recommend yes.)*
2. Loan emails only to proven addresses? *(Recommend yes.)*
3. Facebook accounts with no email: friendly error first? *(Recommend yes.)*
