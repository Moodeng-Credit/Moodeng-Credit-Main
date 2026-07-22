# Moodeng Fraud Detection Masterplan

**Status:** authoritative implementation blueprint. Written 2026-07-22 after a full audit of the
fraud/security infrastructure in this repo.
**Audience:** any engineer or coding agent implementing the phases below. Every phase is specified
so it can be built without re-deriving design decisions. Follow the specs literally; where a spec
says "investigate", the investigation itself is the task.

---

## 0. Executive summary

Moodeng is a P2P lending platform. The core fraud risk is **self-lending**: one human controlling
both a borrower account and a lender account (to farm credit score, launder funds, or exit-scam
lenders' trust signals). Secondary risks: sybil account farms, bot signups, and identity fraud.

The platform already has **two separate detection engines**, a privacy-preserving IP pipeline,
KYC, and admin review tooling. What it lacks, in priority order:

1. **Delivery** — alerts go to a single email inbox only (Phase 0/1 adds Telegram; partially done).
2. **Trust** — nothing verifies the detectors themselves are alive. The daily scan was silently
   broken for 11 days (2026-06-29 → 2026-07-10, `abs(interval)` bug, see migration
   `20260710050000`) and nobody knew. **This is the most important gap.**
3. **Unification** — the two engines have separate alert stores, formats, and delivery paths.
4. **Latency** — everything is batch (daily). On 3-day loans, a 24 h detection delay can be too late.
5. **Prevention** — everything is detect-and-review; nothing ever blocks (deliberate; revisit last).

The phases in §4 fix these in that order. Do them **in order**, one phase per branch/PR.

---

## 1. Inventory — what exists today (verified against code)

### 1.1 Engine A: daily wallet/IP fraud scan
- **DB function:** `public.scan_wallet_fraud_signals(ip_window_days int default 14)` — latest
  definition in migration `20260722000000_fraud_alert_telegram_and_cross_role_ip.sql`.
- **Edge function:** `supabase/functions/fraud-signal-scan/index.ts`.
- **Cron:** pg_cron job `wallet-fraud-signal-scan-daily`, `45 0 * * *` (00:45 UTC), posts to the
  edge function using vault secrets `SUPABASE_PROJECT_URL` + `SUPABASE_SECRET_KEY`.
- **Signals** (dedup ledger = `public.fraud_signal_alerts`, unique on `(signal_type, subject_key)`;
  each finding alerts exactly once, ever):

  | ID | signal_type | Severity | What it catches | subject_key |
  |----|-------------|----------|-----------------|-------------|
  | A | `shared_wallet` | critical if borrower+lender, else warning | Same wallet on 2+ accounts | wallet address |
  | B | `self_deal_wallet` | critical | One loan, same wallet both sides | loan id |
  | C | `counterparty_shared_wallet` | critical | Loan counterparties share any historical wallet | loan_id:wallet |
  | D | `counterparty_shared_ip` | warning | Loan counterparties share a login IP (window) | loan_id:ip_hash |
  | E | `datacenter_ip` | warning | Logins from hosting/VPN ASNs | user_id:asn_org |
  | F | `impossible_travel` | critical | Same user, 2 locations, >500 km, >900 km/h | user_id:t1:t2 |
  | G | `subnet_cluster` | warning | 3+ accounts in one /24 (or /48) block | subnet_hash |
  | H | `cross_role_shared_ip` | warning | Borrower account + lender account share an IP, **no loan required** | borrower_id:lender_id |

- **Delivery:** email (Resend) to `FRAUD_ALERT_EMAIL` **and** (since Phase 0) Telegram group from
  setting `fraud_alert_chat_id` (fallback `kyc_alert_chat_id`), channels independent.
- **Muting:** `public.fraud_detection_whitelist` (mutes an account) and
  `fraud_signal_alerts.review_status` (`open`/`ignored`/`confirmed`, per-finding).

### 1.2 Engine B: Consensus Risk Score (CRS)
- **DB:** `public.compute_risk_score(uuid)` → `public.risk_scores` (0–100, bands
  Low/Medium/High/Critical), cached on `users.current_risk_score/current_risk_band`.
  Defined in `20260506003000_consensus_risk_score.sql`. Triggers on signup, loan request,
  repayment, point events, daily batch.
- **Edge function:** `supabase/functions/risk-score-recompute/index.ts`. Own alert taxonomy:
  `self_lending_hard_match` (critical), `sybil_cluster` (high), `paired_new_accounts` (high),
  `critical_band` (medium). Own dedup store `public.risk_alerts` (24 h window per user+signal).
- **Delivery:** email only, to its own `ALERT_TO`. **Not connected to Engine A in any way.**

### 1.3 IP pipeline (feeds Engine A signals D–H)
- Frontend: `src/lib/recordSessionIp.ts`, called from `src/store/slices/authSlice.ts` (~line 233),
  throttled to once per 10 min per session.
- Edge function: `supabase/functions/record-session-ip/index.ts` → salted SHA-256 of IP and of its
  /24 (v6: /48) subnet into `public.auth_ip_log`, enriched via MaxMind GeoLite2 (city, lat/lon,
  ASN, `is_hosting`). Raw IPs are **never stored** — keep it that way.
- **Silent failure modes (fix in Phase 2):** returns HTTP 200 no-ops when `IP_HASH_SALT` is unset
  or the user is unauthenticated; geo silently degrades without `MAXMIND_ACCOUNT_ID`/`MAXMIND_LICENSE_KEY`.

### 1.4 Other relevant systems
- **KYC:** Didit (`didit-webhook`, `_shared/diditNotifications.ts`) — already sends Telegram to
  setting `kyc_alert_chat_id`.
- **Admin tools:** `src/app/admin/` — `FraudAlertQueue.tsx`, `SelfLendingSection.tsx`,
  `SelfLendingGraph.tsx`, `SelfLendingMap.tsx`; DB `admin_get_detection_overview()` (shared
  wallet/IP/subnet/canonical-email cross-listings; Gmail dot/plus normalization via
  `app_private.canonical_email`).
- **Telegram plumbing:** `_shared/telegram.ts` (`sendTelegramMessage`); `telegram_bot_settings`
  table (key/value); the `webhook` function replies with a group's chat_id when it sees a
  `/chatid`-style message (see `supabase/functions/webhook/index.ts` ~line 41) — use this to
  discover a group's chat id.
- **Wallet history:** `public.wallet_usage_log`, append-only via trigger
  `app_private.log_wallet_usage` on `users.wallet_address`, backfilled from loans.

### 1.5 Configuration surface (all must exist in prod for full coverage)

| Kind | Name | Used by | If missing |
|------|------|---------|-----------|
| env | `IP_HASH_SALT` | record-session-ip | **All IP signals silently blind** |
| env | `RESEND_API_KEY`, `RESEND_FROM` | all email | Email alerts throw |
| env | `TELEGRAM_API_TOKEN` (or `TELEGRAM_BOT_TOKEN`) | all Telegram | Telegram alerts throw |
| env | `MAXMIND_ACCOUNT_ID`, `MAXMIND_LICENSE_KEY` | record-session-ip | Signals E/F silently degrade |
| env | `FRAUD_ALERT_EMAIL` | fraud-signal-scan | falls back to founder Gmail |
| env | `FRAUD_ALERT_TELEGRAM_CHAT_ID` | fraud-signal-scan | falls back to settings |
| setting | `fraud_alert_chat_id` | fraud-signal-scan | falls back to `kyc_alert_chat_id` |
| setting | `kyc_alert_chat_id` | diditNotifications | KYC Telegram no-ops |
| vault | `SUPABASE_PROJECT_URL`, `SUPABASE_SECRET_KEY` | all pg_cron → edge calls | **Crons silently no-op** |

---

## 2. Design principles (binding for all phases)

1. **Fail loud.** No new code path may swallow an error invisibly. If a component degrades
   (missing config, failed send), that fact must itself reach the Telegram group — via the
   heartbeat (Phase 2) if not immediately.
2. **Detection ≠ punishment.** Signals alert humans; they never auto-block (until Phase 6, which
   is gated on an explicit product decision).
3. **Privacy:** never store raw IPs, only salted hashes. Never widen RLS. New tables: RLS enabled,
   `select` for `app_private.is_moodeng_admin()`, writes via service role / SECURITY DEFINER only.
4. **One alert, once.** Every alert has a stable dedup key. Never re-fire a known finding.
   Never change existing `signal_type` or `subject_key` formats (would re-fire history).
5. **One delivery layer.** All security alerts eventually flow through one shared module with one
   format and one destination set (Phase 3). Email stays as the redundant second channel.
6. **Severity taxonomy** (use everywhere, including message prefixes):
   `🔴 critical` = act today; `🟠 high` = review within 24 h; `🟡 warning` = review this week;
   `ℹ️ info` = heartbeat/FYI.
7. **Migrations:** never edit an existing migration file. New file per change, timestamped after
   the latest, idempotent (`if not exists` / `on conflict do nothing` / `create or replace`).
   When changing `scan_wallet_fraud_signals`, copy the FULL latest body and modify — the function
   is replaced wholesale.
8. **Repo conventions:** TypeScript 3-space indent; edge-function shared code in
   `supabase/functions/_shared/`; pure (no `Deno.*` at module top) formatting/logic modules so
   vitest can import them; tests in `src/test/*.test.ts` importing via relative path
   (see `src/test/fraudNotifications.test.ts` as the pattern). Telegram messages are plain text
   (no parse_mode).
9. **Verification before merge:** `pnpm install && pnpm type-check && pnpm test` must pass.
   Each phase lists additional manual verification.

---

## 3. Already done (Phase 0) — commit `bca4f567`

- `_shared/fraudNotifications.ts`: pure `describeFraudSignal` + `buildFraudAlertMessage`.
- `fraud-signal-scan/index.ts`: dual-channel delivery (email + Telegram), independent failures,
  500 only if BOTH channels fail; returns `delivery` status in the response body.
- Migration `20260722000000`: seeds `fraud_alert_chat_id` from `kyc_alert_chat_id`; adds signal H.
- Tests: `src/test/fraudNotifications.test.ts`.

**Not yet deployed.** Phase 1 below operationalizes it.

### Phase 2 — DONE in code (not yet deployed)

- Migration `20260722010000`: `public.security_job_runs` run ledger (RLS admin-read, service-role writes).
- `_shared/securityJobRuns.ts`: `recordJobRun()` helper (never throws).
- `fraud-signal-scan` and `risk-score-recompute` now write one ledger row per invocation
  (scan: every run incl. error/no-signal paths; CRS: batch runs only).
- `_shared/securityHeartbeat.ts`: pure `buildHeartbeat()` — 5 checks, message formatting, 26h logic.
- `supabase/functions/security-heartbeat/index.ts`: gathers facts, always sends one Telegram
  message, emails on failure/undeliverable, records its own ledger row.
- Migration `20260722020000`: pg_cron `security-heartbeat-daily` at 09:00 UTC.
- Tests: `src/test/securityHeartbeat.test.ts` (11 cases incl. the 11-day-outage scenario).
- **config.toml finding:** `fraud-signal-scan` has NO `[functions.*]` entry, so it runs with the
  default `verify_jwt` and authenticates via the cron's service-role bearer token.
  `security-heartbeat` mirrors this exactly — intentionally no config.toml entry.
- **Deploy checklist (Phase 1 + 2 together):** run migrations `20260722000000`, `_010000`,
  `_020000`; `supabase functions deploy fraud-signal-scan risk-score-recompute security-heartbeat`;
  add the group-description rule "no ℹ️ heartbeat by 10:00 UTC = incident".

---

## 4. The phases

### Phase 1 — Deploy & configure alert delivery (ops, no new code)

1. Merge Phase 0 branch to the default branch; run the migration
   (`supabase db push` or the project's normal migration deploy).
2. Deploy the edge function: `supabase functions deploy fraud-signal-scan`.
3. Decide the destination group. Default: the KYC alerts group (the most recently created group;
   already seeded). To use a different group: add the bot to that group, get the chat id (send a
   message; the `webhook` function echoes `Telegram chat_id for this group: …`), then
   `update telegram_bot_settings set value = '<chat_id>' where key = 'fraud_alert_chat_id';`
4. Manual end-to-end test: `curl -X POST <PROJECT_URL>/functions/v1/fraud-signal-scan -H
   "Authorization: Bearer <service role key>" -H "Content-Type: application/json" -d '{}'` —
   expect JSON with `delivery: { email: true, telegram: true }` (or "No new fraud signals";
   to force a message, temporarily delete one row from `fraud_signal_alerts` for a known benign
   finding and re-run, then mark it ignored).
5. Verify every row of the §1.5 config table exists in the prod environment. Record gaps.

**Acceptance:** a fraud-scan message has actually appeared in the Telegram group.

### Phase 2 — Watch the watchers (heartbeat, run ledger, config self-check)

This phase makes silence itself an alarm. It would have caught the 11-day outage on day one.

**2a. Run ledger.** New migration creating:
```sql
create table if not exists public.security_job_runs (
  id           uuid primary key default gen_random_uuid(),
  job_name     text not null,            -- 'fraud-signal-scan', 'risk-score-recompute', ...
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  ok           boolean,
  signal_count integer,
  detail       jsonb not null default '{}'::jsonb   -- delivery status, error text, params
);
create index if not exists security_job_runs_job_time_idx
  on public.security_job_runs (job_name, started_at desc);
```
RLS: enabled; admin select; no client writes (service role only). `fraud-signal-scan` writes one
row per invocation (insert at start, update at end — or single insert at end with both
timestamps; the simple single-insert is fine). On any caught error, `ok=false` and
`detail.error` set. Do the same in `risk-score-recompute`.

**2b. Heartbeat edge function.** New `supabase/functions/security-heartbeat/index.ts` +
pure helper `_shared/securityHeartbeat.ts` (formatting + threshold logic, unit-testable).
Checks, in order:
1. `security_job_runs`: latest `fraud-signal-scan` run with `ok=true` within the last 26 h.
2. `auth_ip_log`: at least 1 row with `last_seen_at` in the last 24 h (canary that the IP
   pipeline is alive; if the app had zero logins that's worth knowing too).
3. `risk_scores`: at least 1 row `computed_at` in the last 26 h (CRS alive).
4. Config presence: every env var in §1.5 that the heartbeat can see
   (`Deno.env.get(...) != null`), plus settings `fraud_alert_chat_id` non-empty, plus
   a live Telegram `getMe` call (proves the token works).
5. Unreviewed backlog: count of `fraud_signal_alerts` with `review_status='open'` older than
   7 days (nagging metric, not a failure).

Output — ALWAYS send exactly one Telegram message to the fraud group (and email on failure only):
- All green: `ℹ️ Security heartbeat — all systems OK. Scan: ran 03:45, N signals. IP log: N
  logins/24h. CRS: alive. Open findings: N.`
- Any check failed: prefix `🔴 SECURITY HEARTBEAT FAILURE` + one line per failed check with the
  exact remediation ("IP_HASH_SALT is unset — IP detection is BLIND. Set it in Supabase
  edge function secrets.").

Write a `security_job_runs` row for the heartbeat itself.

**2c. Cron.** New migration scheduling pg_cron job `security-heartbeat-daily` at `0 9 * * *`
(09:00 UTC — during the team's waking hours, distinct from the 00:45 scan), same pg_net pattern as
`20260629000000_wallet_fraud_detection.sql` §5. Also add `[functions.security-heartbeat]`
`verify_jwt = false` to `supabase/config.toml` ONLY if the other cron-called functions do so —
check how `fraud-signal-scan` is configured and mirror it (it relies on the service-role bearer
token; keep that).

**2d. Team rule (put in the Telegram group description):** "If no ℹ️ heartbeat arrives by 10:00
UTC, the security system itself is down — treat as an incident."

**Tests:** unit tests for the pure helper: message for all-green, message for each failure type,
26 h boundary logic. **Acceptance:** heartbeat message observed in the group two days running;
killing a check locally (e.g. point it at an empty table) produces the 🔴 variant.

### Phase 3 — Unify delivery (one security feed)

**3a. Shared dispatcher.** New `_shared/securityAlerts.ts`:
```ts
export type SecurityAlert = {
   source: 'fraud-scan' | 'risk-score' | 'realtime' | 'heartbeat' | 'kyc';
   severity: 'critical' | 'high' | 'warning' | 'info';
   title: string;        // one line, no emoji (dispatcher adds severity emoji)
   body: string;         // plain text
};
export const deliverSecurityAlert = async (supabase, alert: SecurityAlert) => { ... }
```
Behavior: resolve destination exactly like `getFraudAlertChatId` in `fraud-signal-scan/index.ts`
(env → `fraud_alert_chat_id` → `kyc_alert_chat_id`); send Telegram `«emoji» [source] title\n\nbody`;
send email with subject `«emoji» Moodeng [source]: title` for severity ≥ warning; record each
attempt in a new table `security_alert_deliveries` (migration:
`id, source, severity, title, telegram_ok bool, email_ok bool, error text, created_at`; RLS
admin-read). Never throw to the caller; return the delivery record.

**3b. Migrate callers.** `fraud-signal-scan` and `security-heartbeat` call the dispatcher instead
of their inline delivery. **Do not change** their dedup logic or message content beyond the
`[source]` prefix.

**3c. Route Engine B (CRS) through it.** In `risk-score-recompute/index.ts`, replace the inline
`sendEmail` in `maybeSendAlert` with `deliverSecurityAlert` (severity mapping: critical→critical,
high→high, medium→warning). Keep the `risk_alerts` insert exactly as is (it's the dedup ledger and
the admin UI reads it). Result: self-lending hard matches and sybil clusters now reach Telegram.

**3d. Unified admin feed (small).** New DB view `public.admin_security_feed` union-ing
`fraud_signal_alerts` (source `fraud-scan`) and `risk_alerts` (source `risk-score`) with columns
`(source, severity, signal_type, subject, details, review_status, created_at)`; admin-gated
SECURITY DEFINER RPC or RLS-guarded view following the pattern of `admin_get_detection_overview`.
Surface it in `src/app/admin/` as one "Security feed" list (reuse `FraudAlertQueue.tsx` patterns).

**Tests:** unit test the dispatcher's formatting + severity→channel matrix with a mocked fetch.
**Acceptance:** one forced CRS alert and one forced scan alert both appear in the same Telegram
group with consistent formatting, and both appear in the admin feed.

### Phase 4 — Real-time checks at the moments that matter

Batch stays; these add immediate alerts at the three highest-risk events. All use the existing
pattern: DB trigger → `net.http_post` (vault secrets) → edge function → dispatcher. Copy the
trigger pattern from `private.notify_loan_request_telegram` in `20260525000000`.

**4a. Loan funded (highest value).** Trigger on `public.loans` when `lender_user_id` becomes
non-null (`after update of lender_user_id ... when (old.lender_user_id is distinct from
new.lender_user_id and new.lender_user_id is not null)`) → new edge function
`loan-funding-fraud-check`, which for THAT loan pair runs the targeted overlap checks:
same wallet now or in `wallet_usage_log`; shared `ip_hash` or `subnet_hash` in `auth_ip_log`
(14-day window); same `users.chat_id`; same `app_private.canonical_email(email)`. Any hit →
`deliverSecurityAlert` severity critical, title
`Loan <tracking_id> funded with linked accounts (<overlap kinds>)`, and insert into
`fraud_signal_alerts` as `signal_type='realtime_funding_overlap'`,
`subject_key=<loan_id>` (idempotent — check-before-insert like the scan does; if the row exists,
do not re-alert). Respect the whitelist (skip only when BOTH parties are whitelisted, matching
scan blocks B–D).

**4b. Signup linked to opposite role.** Extend `detectAlerts` in `risk-score-recompute` (it
already fires on the signup trigger): new HIGH alert `signup_linked_opposite_role` when a new
account's canonical email, `chat_id`, or wallet matches an existing account whose `user_role` is
the opposite. Dedup via the existing `risk_alerts` mechanism. (This is the real-time version of
scan signal H — the "borrower creating a lender account" moment itself.)

**4c. Role changes (investigate first).** Grep `src/` and `supabase/` for any path that updates
`users.user_role` after signup. If one exists: add an AFTER UPDATE OF user_role trigger →
dispatcher alert (`🟠 <username> changed role borrower→lender; N active loans, risk score X`).
If none exists, document that fact in this file (§7) and add a CHECK/trigger preventing role
flips outside the service role, so the invariant "roles don't silently change" is enforced.

**Tests:** unit-test the overlap-describing helpers; SQL logic is exercised by a manual staging
run (create two linked test accounts — see `20260718000000_separate_test_users_and_loans.sql`
for how test users are segregated — fund a loan between them, expect the alert within seconds).
**Acceptance:** the staged self-lending loan produces a 🔴 Telegram alert at funding time.

### Phase 5 — Tuning & alert hygiene (after 2 weeks of live data)

1. Review `security_alert_deliveries` + the group history: which signals fired, which were false
   positives (household members sharing IP is the expected noise source for D/H).
2. Add thresholds ONLY where noise is proven: e.g. signal H requires `shared_ip_count >= 2`
   distinct IPs or one side having an active loan; E requires ≥3 hosting logins. Each change =
   new migration replacing the scan function, with the reasoning in the migration comment.
3. Wire `review_status` workflow into the unified admin feed (buttons: confirm / ignore) if not
   already usable there; confirmed findings should page the group (`🔴 CONFIRMED by <admin>`).
4. Weekly digest (optional): Monday heartbeat includes 7-day totals by signal type.

### Phase 6 — Prevention (GATED: requires an explicit product decision by the founder)

Do not build until approved. Spec when approved:
- New table `public.loan_review_holds (loan_id, reason, created_at, released_at, released_by)`.
- In the funding path (find it: grep for where loans transition to funded/`Lent` —
  `buy-loan-note`, `admin-fund-loan`, `confirm-loan-payment`), when Phase 4a's check returns a
  **wallet-level** match (deterministic identifiers only — never IP-only, too noisy to block on),
  insert a hold and return a "under review" state instead of completing funding; admin release
  button in the Security feed. Everything else remains alert-only.

### Phase 7 — Platform hygiene (parallel track, independent of the above)

1. **Dependencies:** Dependabot reports 155 vulnerabilities (2 critical, 53 high) on the default
   branch. Triage: `pnpm audit --prod` first; upgrade direct deps with critical/high advisories;
   document unfixable transitive ones. One PR per breaking upgrade.
2. **RLS review:** confirm every fraud table (`wallet_usage_log`, `auth_ip_log`,
   `fraud_signal_alerts`, `risk_scores`, `risk_alerts`, `security_job_runs`,
   `security_alert_deliveries`) is RLS-enabled admin-read-only. `supabase/migrations/2026071*`
   files show the hardening patterns already used.
3. **Secrets audit:** verify no plaintext secrets in the repo (all `.env*` values are dotenvx
   `encrypted:` — keep it that way); rotate `IP_HASH_SALT` only with a documented plan (rotating
   it orphans all existing IP hashes — old hashes stop matching new logins; if ever rotated,
   note the date and expect a 14-day detection gap).
4. **Runbook** (add `docs/SECURITY_RUNBOOK.md`): for each alert type — what it means, expected
   false-positive causes, first response steps (check admin Self-lending page → whitelist or
   confirm → if confirmed: freeze decision is manual today).

---

## 5. Iteration protocol for the implementing agent

1. One phase (or sub-phase) per branch/PR. Never combine phases.
2. Before coding: re-read the current state of every file you'll touch — earlier phases may have
   changed them since this document was written.
3. Never edit existing migrations; never change existing `signal_type`/`subject_key` values.
4. After coding: `pnpm install && pnpm type-check && pnpm test` (all must pass), plus the phase's
   manual acceptance test on staging.
5. Every new table: RLS enabled + admin-read policy + service-role writes, in the same migration.
6. Every new SECURITY DEFINER function: `set search_path = public, pg_temp`, `revoke all ... from
   public`, explicit grants — copy the style of `scan_wallet_fraud_signals`.
7. If reality contradicts this document (a table is missing, a function moved), STOP, update this
   document in the same PR, and proceed from the corrected fact — the document is the map,
   the code is the territory.
8. Keep messages/formatting in pure `_shared/*.ts` modules with vitest coverage; edge-function
   `index.ts` files stay thin (I/O only).

## 6. Definition of done (whole program)

- [ ] Phase 0 merged (commit `bca4f567`) and deployed; Telegram alerts observed live.
- [ ] Heartbeat arrives daily; a deliberately broken check produces the 🔴 variant.
- [ ] Both engines + heartbeat deliver through one dispatcher into one Telegram group,
      with email as redundant channel; deliveries recorded in `security_alert_deliveries`.
- [ ] Funding a staged self-lending loan alerts within seconds, not next-day.
- [ ] Signup with an identifier linked to the opposite role alerts immediately.
- [ ] Admin has ONE feed showing all findings with review workflow.
- [ ] Config table §1.5 fully populated in prod; heartbeat proves it continuously.
- [ ] Runbook exists; group description carries the "no heartbeat by 10:00 UTC = incident" rule.
- [ ] Dependabot criticals/highs triaged.

## 7. Open questions / decisions for the founder

1. Which Telegram group is the permanent security feed? (Currently defaults to the KYC group.)
2. Phase 6 prevention: should deterministic self-lending matches HOLD funding, or stay
   alert-only? (Everything today is alert-only by design.)
3. Who besides the founder should be in the alert group / on the alert email?
4. Role-change policy (Phase 4c): is switching borrower↔lender ever legitimate on one account?
   Current product answer appears to be "no single account holds both roles" — confirm.
