# Openfort instant wallet — go-live runbook

Everything in code is **done and merged to `staging`** (PRs #700, #701, #702) and running in
**test mode** (Base Sepolia). This is the checklist to (1) validate it on staging and (2) flip
it to production. Steps marked 🫵 need a human (browser login, account, or money); the rest I can
do once you've unblocked them.

Project: `pro_6b092fb7-96a1-47fa-93ab-ad8fa0df760f` · gas policy (test): `pol_532f044b-5e67-4b9d-a77d-571f4e3d72ac`
Gas-webhook URL: `https://qplmmxynzxzkfxtayoqr.supabase.co/functions/v1/openfort-gas-webhook`

---

## Part A — Validate on staging (test mode, free)

0. ✅ DONE 07-23 — **Supabase third-party auth enabled on the Openfort project** (without
   this, wallet creation fails with "We couldn't finish creating your wallet"; Openfort's API
   returns `OAuth Config with provider supabase not found`). Config lives in the Openfort
   dashboard → Authentication → Providers → **Third Party Authentication → Supabase**:
   - Supabase project URL: `https://qplmmxynzxzkfxtayoqr.supabase.co`
   - Supabase **anon (public) API key** — NOT the JWT secret and NOT service_role
     (Openfort uses it as the `apikey` when calling Supabase to verify user tokens;
     JWT secret gives `Invalid API key`).
   ⚠️ If the Supabase anon key is ever rotated/revoked, update this Openfort setting at the
   same time or instant wallets break again. Verify anytime with the repro script
   (scratchpad `openfort_auth_repro.py`): expect HTTP 200 with a `usr_…` id.
1. 🫵 Go to **https://staging.dashboard.moodeng.app** and log in **as a borrower**
   (if your account isn't a borrower, sign up fresh and pick Borrower).
2. 🫵 Open **`/onboarding/wallet?instant=1`** → tap **Create my wallet**.
   Expect: a few seconds, then **"Wallet Connected"**. That's a real Openfort wallet on Sepolia.
3. If it errors, copy the message — I'll fix it.

## Part B — Authenticate the CLI + wire the gas alert

4. 🫵 In a terminal: `openfort login` (opens a browser, saves your API key).
5. Then **I** can, or you can run:
   - **Register the low-gas webhook** (fires the Telegram alert):
     ```bash
     openfort subscriptions create --topic balance.project \
       --triggers '[{"type":"webhook","target":"https://qplmmxynzxzkfxtayoqr.supabase.co/functions/v1/openfort-gas-webhook?token=YOUR_TOKEN"}]'
     ```
   - 🫵 **Set the $0.50 threshold**: dashboard → Notifications → **Events** → `balance.project` → threshold `0.50`.
   - 🫵 **Set the webhook token secret** (locks the webhook so only Openfort can trigger it):
     ```bash
     supabase secrets set OPENFORT_WEBHOOK_TOKEN=YOUR_TOKEN --project-ref qplmmxynzxzkfxtayoqr
     ```
     (use the same `YOUR_TOKEN` as in the webhook URL above — any long random string).
6. **Gas-policy spend cap** (security — cap sponsored spend so nobody can drain it):
   set a per-policy spending limit + rate limit on `pol_532f…` (dashboard → Gas policy, or
   `openfort policies update`). I can help build the rules once the CLI is authed.

## Part C — Flip to production (real Base, real money)

7. 🫵 In the Openfort dashboard, switch **Test → Live**, then collect:
   - `pk_live_…` (live publishable key)
   - live **Shield** keys (publishable + secret + encryption share)
   - a **live gas policy** id on Base **mainnet** (with a spend cap)
8. 🫵 **Fund** the live gas balance (Billing → Gas). Base fees are ~1–2¢/tx, so a small top-up lasts.
9. **I** swap env + secrets and redeploy:
   - `.env.production` (and/or `.env.staging`): `VITE_OPENFORT_PUBLISHABLE_KEY=pk_live_…`,
     `VITE_OPENFORT_SHIELD_PUBLISHABLE_KEY=…`, `VITE_OPENFORT_POLICY_ID=<live>`, **remove**
     `VITE_OPENFORT_CHAIN_ID` (defaults to Base mainnet 8453).
   - Supabase secrets: `OPENFORT_SHIELD_SECRET_KEY`, `OPENFORT_SHIELD_ENCRYPTION_SHARE` → live values.
   - Redeploy `openfort-shield-session` + rebuild the site.
10. Going live also fixes the one test-mode caveat: on mainnet, repayment confirmation works
    end-to-end (no Sepolia-hash-vs-mainnet mismatch).

---

## Hand me any of these and I'll take it from there
- The result of the staging test (success or error)
- "logged in" → I register the gas subscription + help set the spend cap
- The live keys (Part C step 7) → I do the env swap + redeploy
