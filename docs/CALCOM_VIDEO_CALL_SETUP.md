# Cal.com video-call setup (no-referral gate)

This wires up the code already in this PR. The app is done and tested; these are the manual
Cal.com / Supabase / env steps that make it go live. Anyone can follow it — the only account-holder
steps (marked **[host]**) must be done by George and Emma, because they involve their own Google
Calendars.

The video-call step only appears for borrowers with **no referral code**. When one books, Cal.com
sends a signed webhook to our `calcom-webhook` function, which is the only thing that marks them
"scheduled." Until this setup is done, the booking screen loads but Continue can't unlock.

Concrete values for this project:
- Supabase project ref: `qplmmxynzxzkfxtayoqr`
- Webhook URL to give Cal.com: `https://qplmmxynzxzkfxtayoqr.supabase.co/functions/v1/calcom-webhook`

---

## Part A — Accounts + calendars  **[host]**

Do this once for **George** and once for **Emma** (either two personal accounts, or one Cal.com
team with both as members — either works).

1. Go to https://cal.com and sign up (free plan is enough).
2. Settings → **Connected calendars** → connect the **same Google Calendar** they use in Calendly.
   - This is what carries their real availability across, including calls already booked through
     Calendly, so there's no double-booking. Both tools read/write the one calendar.
3. Settings → **Availability** → confirm their working hours look right (it inherits from the
   calendar's busy/free, but the hours they're bookable are set here).

## Part B — Create the interview event type  **[host]**

1. **Event types → New.**
2. Title: `Video interview` · Duration: **15 min** · Location: your call tool (Cal Video, Google
   Meet, or Zoom).
3. Save. The public link is `cal.com/<username>/<slug>` — note the **`<username>/<slug>`** part
   (e.g. `moodeng/interview-george`). That's the `calLink` the app needs.
4. Repeat for the other host.

> Metadata pass-through: the app sends `moodeng_user_id` and `moodeng_host` as embed **metadata**,
> which Cal.com returns in the webhook payload — no event-type field needed. (If a future Cal.com
> change stops passing embed metadata, add two **hidden** booking questions named exactly
> `moodeng_user_id` and `moodeng_host`; the webhook parser already falls back to reading those.)

## Part C — Webhook  **[host or admin]**

1. Settings → **Developer → Webhooks → New** (set it at the team level, or on each account).
2. **Subscriber URL:** `https://qplmmxynzxzkfxtayoqr.supabase.co/functions/v1/calcom-webhook`
3. **Secret:** click generate (or type a long random string) and **copy it** — this becomes
   `CALCOM_WEBHOOK_SECRET`. Cal.com signs each delivery with it; our function rejects anything that
   doesn't match, so this is what makes the booking trustworthy.
4. **Event triggers:** enable **Booking Created**, **Booking Rescheduled**, **Booking Cancelled**,
   **Booking Rejected**.
5. Save.

## Part D — Deploy the function + migration  **[admin/dev]**

From the repo, with the Supabase CLI logged in:

```bash
# 1. Deploy the webhook (must be public — Cal.com calls it unauthenticated; the signature is the auth)
supabase functions deploy calcom-webhook --no-verify-jwt --project-ref qplmmxynzxzkfxtayoqr

# 2. Give the function the signing secret from Part C
supabase secrets set CALCOM_WEBHOOK_SECRET="<paste the secret>" --project-ref qplmmxynzxzkfxtayoqr

# 3. Apply the migration (adds video_call_booking_uid, revokes the old client-side RPC)
supabase db push --project-ref qplmmxynzxzkfxtayoqr
```

## Part E — Frontend env vars  **[admin/dev]**

Add to the app's env (the dotenvx `.env.*` files). These override the placeholder `calLink`s in
`src/config/contactVerification.ts`:

```
VITE_CALCOM_GEORGE_LINK=<george's username/slug>   # e.g. moodeng/interview-george
VITE_CALCOM_EMMA_LINK=<emma's username/slug>        # e.g. moodeng/interview-emma
# Optional — only if self-hosting Cal.com instead of cloud:
# VITE_CALCOM_EMBED_ORIGIN=https://your-cal-domain
```

Rebuild/redeploy the frontend so these take effect.

## Part F — Verify it works

1. Open a loan request as a test borrower **with no referral code**, reach the video-call step.
2. Pick a host, book a slot in the embedded scheduler, complete it.
3. Within a few seconds the step should flip to "You're booked with … — <date>" and Continue
   should enable on its own.
4. If it doesn't: check the function logs
   (`supabase functions logs calcom-webhook --project-ref qplmmxynzxzkfxtayoqr`). A `signature
   verification failed` line means the secret in Part C ≠ the one in Part D; a `no moodeng_user_id
   metadata` line means the embed metadata didn't come through (add the hidden fields from Part B).
5. Cancel the test booking in Cal.com and confirm the borrower's gate reopens (Continue goes back
   to disabled on reload).

## Handback checklist

Give the dev these three things and the wiring is done:
- [ ] `VITE_CALCOM_GEORGE_LINK` value (George's `username/slug`)
- [ ] `VITE_CALCOM_EMMA_LINK` value (Emma's `username/slug`)
- [ ] `CALCOM_WEBHOOK_SECRET` value (from the Cal.com webhook)

## Cleanup (after Cal.com is confirmed live)

The old Calendly path is left in place but unused and can be removed:
- `supabase/functions/calendly-webhook/`
- the `mark_video_call_scheduled` RPC
- `calendlyUrl` references (already replaced by `calLink`)
