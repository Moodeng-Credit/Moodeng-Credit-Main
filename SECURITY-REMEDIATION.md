# Security Remediation Runbook — Client-Writable State Lockdown

> **Purpose:** self-contained execution plan to close the vulnerability John disclosed
> (client can forge loan REPAID/Lent + self-set credit limit / verification, with zero
> on-chain transactions). Written so a fresh session — any model — can pick this up and
> execute thing-by-thing without re-investigating.
>
> **Status legend:** ⬜ not started · 🟡 drafted, not applied · ✅ done & verified
>
> **Key rotation is PARKED** by owner decision (2026-07-10). Do NOT rotate keys as part of
> this runbook. See "Deferred" at the bottom — it's tracked, just not now.

---

## The one principle

> The browser may **REQUEST** an action. Only verified server-side code (service-role Edge
> Functions) may **WRITE** authoritative state — money, verification, credit. Enforce it with
> **database triggers**, not just RLS, so a policy typo can never silently reopen the hole.

---

## Root cause (confirmed in code)

Two exploit classes, same shape — the client writes authoritative columns directly and nothing
verifies reality first.

| # | Table | Where | Problem |
|---|-------|-------|---------|
| 1 | `loans` | `src/store/slices/loanSlice.ts:362` (`updateLoanStatus`) | Client writes `repayment_status`/`loan_status`/`repaid_amount`/`hash`/lender fields directly; **no on-chain check**. RLS (`20260116000000_rename_loan_user_columns.sql:34-40`) gates *which row*, not *which columns*; `lender_user_id IS NULL` lets anyone self-claim as lender. Loan amount unbounded server-side. |
| 2 | `users` | `20241209000000_initial_schema.sql:71` | `"Users can update own data"` is `FOR UPDATE USING (auth.uid()=id)` with **no `WITH CHECK`, no column restriction**. Any logged-in user sets own `cs` (credit limit), `is_world_id='ACTIVE'` (verification), `mal`. |

---

## Execution flow (do phases in order)

```
                 ┌─────────────────────────────────────────────┐
                 │  PHASE 0 — Recon (read-only, do first)       │
                 │  • Backend hunt: find John's "still running"  │
                 │    infra (external hosts / webhooks / non-    │
                 │    Supabase servers)                          │
                 │  • Pull Supabase Security Advisor findings    │
                 └───────────────────────┬─────────────────────┘
                                         │
                 ┌───────────────────────▼─────────────────────┐
                 │  PHASE 1 — Loans (live-money hole; screenshot)│
                 │  1a. Finish confirm-loan-payment edge fn      │
                 │  1b. Move credit-progression logic INTO fn    │
                 │  1c. Repoint 4 client call sites → fn         │
                 │  1d. Trigger locks loan money columns         │
                 │  1e. Build + tests + deploy + verify          │
                 └───────────────────────┬─────────────────────┘
                                         │
                 ┌───────────────────────▼─────────────────────┐
                 │  PHASE 2 — Verification lock                  │
                 │  Trigger blocks client writes to              │
                 │  is_world_id / is_didit / liveness_status /   │
                 │  nullifier_hash (webhooks already write them) │
                 └───────────────────────┬─────────────────────┘
                                         │
                 ┌───────────────────────▼─────────────────────┐
                 │  PHASE 3 — Credit / limits lock              │
                 │  Trigger blocks client writes to             │
                 │  cs / mal / nal / credit_progression_paused  │
                 │  (needs Phase 1b done first)                 │
                 └───────────────────────┬─────────────────────┘
                                         │
                 ┌───────────────────────▼─────────────────────┐
                 │  PHASE 4 — Sweep + hardening                 │
                 │  award_points forgery, USING(true) policies, │
                 │  WITH CHECK on users/loans, audit-log table, │
                 │  attack-simulation tests                     │
                 └─────────────────────────────────────────────┘
```

**Sequencing invariant (critical):** each phase ships **"new server path + column lock" as ONE
deployable unit**. If a lock trigger lands before its server-side write path exists, normal user
funding/repay/credit flows break in production. Never merge a lock without its function.

---

## PHASE 0 — Recon (read-only)  ⬜

- [ ] **Backend hunt.** Grep for the "still running" backend John built. Look in `src/`, env
      files, and configs for: non-Supabase API base URLs, webhook targets, hardcoded server
      hosts, cron/queue services, anything pointing at infra the owner doesn't recognize.
      Suggested: `grep -rniE "https?://[a-z0-9.-]+" src/ | grep -viE "supabase|base\.org|alchemy|coinbase|localhost|moodeng|didit|worldcoin|resend|telegram|google|vercel"`
      then chase anything unfamiliar. Report what/where/whose-account.
- [ ] **Supabase Security Advisor.** Pull findings via Supabase MCP `get_advisors` (type
      `security`) for the ACTIVE project (see [[moodeng-supabase-projects]] — the "dev"-labeled
      `qplmmxynzxzkfxtayoqr` is the NEW/live one). Cross-reference with the known list in
      [[supabase-security-advisor-findings]].

---

## PHASE 1 — Loans  🟡 (code DONE, not yet deployed/applied)

**Progress 2026-07-10 (Fable session): all in-repo code done + green (tsc clean, eslint 0 errors, 9/9 tests pass). NOT yet deployed to Supabase / migration NOT yet applied — that's the remaining step (1d apply + 1e deploy), gated on owner OK since it's a live-prod change.**
- ✅ 1a/1b: `confirm-loan-payment/index.ts` rewritten as full server authority — on-chain/bundler verification + ported credit-progression + funding-points + notifications. Shared math in `supabase/functions/_shared/creditAndPoints.ts`.
- ✅ 1c: all 4 call sites repointed to new `confirmLoanPayment` thunk (Repay.tsx, UserPay.tsx, UserCard.tsx, BasePaymentReconciler.tsx); thunk + reducer cases added in loanSlice.ts; `updateLoanStatus` marked `@deprecated` (orphaned, pending removal).
- ⬜ 1d: apply migration `20260710000000_lock_down_loan_money_columns.sql` (VERIFY the `auth.role()` vs `current_user` service-role check first).
- ⬜ 1e: `deploy_edge_function confirm-loan-payment`, then end-to-end verify.

**FOLLOW-UPS discovered this session:**
- **Wallet-path 202 gap:** the Base Pay reconciler only recovers `method:'base'` payments. A wagmi (`method:'wallet'`) repay/fund that returns 202 (submitted but not yet mined when the function checks) currently just shows "still confirming" with no reconcile entry → could strand. Add a wallet-path reconcile path, or have the function poll briefly for wallet receipts.
- **Remove dead `updateLoanStatus`** (+ its old direct-`.update()` tests in loanFlow.test.ts) once 1d/1e are verified. Deferred to avoid a same-turn import-cascade cleanup.

**Already on disk (drafts):**
- `supabase/functions/confirm-loan-payment/index.ts` — verifies real USDC transfer (on-chain via
  Alchemy for wagmi path; via Base Pay bundler `eth_getUserOperationReceipt` for base path):
  checks recipient == expected wallet, amount >= required, no hash replay (`used_payment_hashes`),
  loan is in the right state, caller is allowed. Writes status with service-role key only.
- `supabase/migrations/20260710000000_lock_down_loan_money_columns.sql` — `used_payment_hashes`
  table + BEFORE UPDATE trigger rejecting client writes to loan money columns.

### 1a. Finish + sanity-check the edge function  ⬜
- [ ] Re-read `supabase/functions/confirm-loan-payment/index.ts` end-to-end.
- [ ] Confirm env vars it needs exist for the function: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY`, `ALCHEMY_ID` (optional; falls back to `mainnet.base.org`),
      `BASE_USDC_ADDRESS` (optional; defaults to canonical). Base Pay bundler URL is the same
      public one `@base-org/account`'s own `getPaymentStatus` uses — no secret needed.
- [ ] **Decide the repay-amount trust model.** Current draft derives repaid amount from the
      on-chain transfer value (good — can't over-credit). Confirm that's the intent vs. trusting
      a client-sent amount (do NOT trust client).
- [ ] Verify CORS origin handling matches other functions (see `check-didit-status` pattern).

### 1b. Move credit-progression logic server-side  ⬜  ← **do NOT skip; Phase 3 depends on it**
- [ ] The credit level-up / pause logic currently runs **client-side** in
      `src/store/slices/loanSlice.ts` ~lines 421-499 (reads borrower, computes
      `evaluateCreditProgression`, writes `users.cs` / `credit_progression_paused`).
- [ ] Move that whole block INTO `confirm-loan-payment` (the repay branch), using the
      service-role client, so it still runs when a repayment is verified. Reuse the logic in
      `src/lib/creditLeveling.ts` (`evaluateCreditProgression`) — port it to the function or
      share it. Once `users.cs` is locked in Phase 3, this is the ONLY writer.
- [ ] Keep the notification invokes (`loan-funded-notification`,
      `loan-repayment-received-notification`) — move them into the function too, or leave the
      client to fire them post-confirmation. Prefer moving them in so they only fire on real
      confirmation.

### 1c. Repoint client call sites  ⬜
Replace the direct `updateLoanStatus` money-writes with a call to the new function
(`supabase.functions.invoke('confirm-loan-payment', { body: { loanId, hash, method, action } })`).
The function returns the updated loan row; feed that back into the store.

Call sites (all currently dispatch `updateLoanStatus`):
- [ ] `src/views/repay/Repay.tsx:826` — repay (action `'repay'`).
- [ ] `src/components/UserPay.tsx:93` — alt repay UI (action `'repay'`).
- [ ] `src/views/dashboard/components/UserCard.tsx:226` — fund (action `'fund'`).
- [ ] `src/components/BasePaymentReconciler.tsx:26,29` — reconciler for fund + repay; must call
      the function too (it already has the hash; the function is idempotent via
      `used_payment_hashes`, so a re-run of an already-recorded hash returns 409 = already done).
- [ ] The `202 {retry:true}` response = "payment not confirmed on-chain yet" — reconciler should
      treat that as "try again later," NOT a failure (mirrors the existing Base Pay timeout logic
      in `src/lib/basePay.ts`).
- [ ] After this, `updateLoanStatus` in `loanSlice.ts` should either be deleted or reduced to
      NON-money fields only (it currently also handles expiry check + side effects — fold what's
      still needed into the function or a thin wrapper).

### 1d. Apply the lock migration  ⬜
- [ ] Review `supabase/migrations/20260710000000_lock_down_loan_money_columns.sql`.
- [ ] **VERIFY THE ROLE CHECK.** The trigger uses `auth.role() = 'service_role'`. Confirm this
      actually returns `service_role` inside a trigger when the service-role key is used. If not,
      switch to `current_user = 'service_role'` (PostgREST does `SET ROLE service_role` for that
      key, so `current_user` is the reliable signal). Test both before trusting it.
- [ ] Apply via Supabase MCP `apply_migration` to the ACTIVE project ONLY after 1a-1c are ready
      to deploy together.

### 1e. Deploy + verify  ⬜
- [ ] `pnpm build` (or repo's build) — fix type errors.
- [ ] Update `src/test/loanFlow.test.ts` — it currently asserts the client calls
      `supabase.from('loans').update(...)` directly (lines 86-153). After the repoint it should
      assert the function invoke instead. Add attack-sim cases (see Phase 4).
- [ ] Deploy function via Supabase MCP `deploy_edge_function`.
- [ ] **Verify end-to-end** (see `/verify` skill / preview workflow): a real repay flows through
      the function and marks Paid ONLY after confirmation; a direct
      `supabase.from('loans').update({repayment_status:'Paid'})` from the browser now **fails**
      (trigger rejects it).

---

## PHASE 2 — Verification lock  ⬜

- [ ] New migration: BEFORE UPDATE trigger on `users` rejecting client writes to `is_world_id`,
      `is_didit`, `is_world_id_passport`, `liveness_status`, `liveness_session_id`,
      `nullifier_hash` unless service role. (Same trigger pattern as Phase 1d — can be one shared
      trigger function keyed by column set, or a second `users`-specific one.)
- [ ] Confirm these are already written service-role by `verify-worldid` / `didit-webhook` /
      `check-didit-status` functions (they are — grep to confirm). User impact ≈ zero.
- [ ] Build + verify a browser cannot self-set `is_world_id='ACTIVE'`.

## PHASE 3 — Credit / limits lock  ⬜  (needs Phase 1b)

- [ ] Extend the `users` trigger to also reject client writes to `cs`, `mal`, `nal`,
      `credit_progression_paused`.
- [ ] Confirm the ONLY remaining writers are server-side: the moved credit logic (1b),
      `redeem_referral_code` RPC (`20260508000000`, writes `cs` — verify it's SECURITY DEFINER and
      safe), and any admin tools. Everything else must go through a function.
- [ ] Build + verify a browser cannot self-raise `cs`.

## PHASE 4 — Sweep + hardening  ⬜

- [ ] Fix findings in [[supabase-security-advisor-findings]]: `award_points` anon-forgeable,
      `scan_wallet_fraud_signals` PII leak to anon, `risk_disposable_email_domains` world-writable,
      edge-only RPCs left anon-executable.
- [ ] Audit broad `USING(true) WITH CHECK(true)` write policies (withdrawals
      `20260626000000:39`, telegram settings `20260601003000`, `20260525000000`) — tighten to
      service-role where the client shouldn't write.
- [ ] Add `WITH CHECK` clauses to `users` + `loans` UPDATE policies as defense-in-depth behind
      the triggers.
- [ ] Add an audit-log table capturing every sensitive state change (loans money cols, verification,
      credit) with who/when/old→new. Also useful for the investor conversation.
- [ ] **Attack-simulation tests** (the proof it's closed): a normal authenticated user tries to
      (a) mark someone's loan Paid, (b) self-claim as lender, (c) self-set `is_world_id='ACTIVE'`,
      (d) self-raise `cs`, (e) replay a used hash — ALL must fail.

---

## Deferred (tracked, NOT part of this runbook by owner decision)

- **Key rotation** — PARKED 2026-07-10. When resumed: rotate Supabase secret key + JWT secret
  (these bypass ALL of the above), plus World ID / Resend / Telegram / OAuth secrets and
  `PRIVATE_KEY`. This is the step that actually revokes John's residual access; the code fixes do
  not. Also verify the committed `.env` situation. Full detail in
  [[committed-env-secrets-rotation]]. **Reminder: until this is done, anyone holding an old
  secret-role key or the JWT secret can bypass every fix in this runbook.**
- **Cutting John's "still running" backend** — depends on Phase 0 recon identifying it.

---

## Cross-references (Claude Code memory)
- [[security-lockdown-john-disclosure]] — the disclosure + confirmed vuln + this plan
- [[committed-env-secrets-rotation]] — the parked key/secret item
- [[supabase-security-advisor-findings]] — Phase 4 known findings
- [[moodeng-supabase-projects]] — which project is live (apply migrations to the right one)