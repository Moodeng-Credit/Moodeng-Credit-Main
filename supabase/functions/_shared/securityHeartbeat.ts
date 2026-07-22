// Phase 2b: the dead-man's switch. Pure logic (no Deno APIs) so vitest can cover
// every branch. The edge function gathers the raw facts (DB queries, env presence,
// a live Telegram getMe) and hands them here; this module decides pass/fail and
// formats the single daily message.
//
// The core idea: SILENCE MUST BE AN ALARM. If this heartbeat stops arriving, or
// arrives red, the team knows the detection system itself — not just the fraudsters
// — needs attention. This is what was missing during the 11-day silent scan outage.

// A single subsystem check.
export type HeartbeatCheck = {
   name: string;
   ok: boolean;
   detail: string; // status when ok; remediation when not
   isFailure: boolean; // true => counts toward overall red; false => informational only
};

export type HeartbeatInput = {
   // ISO timestamp of the most recent SUCCESSFUL fraud-signal-scan run, or null if none.
   scanLastOkAt: string | null;
   // Rows written to auth_ip_log in the last 24h (canary that the IP pipeline is alive).
   ipLogins24h: number;
   // Rows written to risk_scores in the last 26h (canary that the CRS engine is alive).
   riskScores26h: number;
   // Critical env vars that are unset (IP_HASH_SALT, RESEND_API_KEY, Telegram token).
   missingCriticalEnv: string[];
   // Degraded env vars that are unset (MaxMind) — reduces coverage but not fatal.
   missingDegradedEnv: string[];
   // Whether a fraud alert chat id resolves (env or settings).
   fraudChatIdConfigured: boolean;
   // Whether a live Telegram getMe call succeeded (proves the token actually works).
   telegramTokenWorks: boolean;
   // Open fraud findings older than 7 days (a nag metric, never a failure).
   openFindingsOver7d: number;
   // Injectable clock for tests.
   now?: Date;
};

export type HeartbeatResult = {
   ok: boolean; // all failure-checks passed
   checks: HeartbeatCheck[];
   message: string;
};

const SCAN_MAX_AGE_MS = 26 * 60 * 60 * 1000; // scan runs 00:45; 26h covers clock drift + a missed edge
const RISK_MAX_AGE_MS = 26 * 60 * 60 * 1000;

const hoursAgo = (iso: string, now: Date): number => (now.getTime() - new Date(iso).getTime()) / 3_600_000;

export const buildHeartbeat = (input: HeartbeatInput): HeartbeatResult => {
   const now = input.now ?? new Date();
   const checks: HeartbeatCheck[] = [];

   // 1. Fraud scan ran and succeeded recently.
   if (input.scanLastOkAt && now.getTime() - new Date(input.scanLastOkAt).getTime() <= SCAN_MAX_AGE_MS) {
      checks.push({
         name: 'Fraud scan',
         ok: true,
         detail: `last OK run ${hoursAgo(input.scanLastOkAt, now).toFixed(1)}h ago`,
         isFailure: true
      });
   } else {
      checks.push({
         name: 'Fraud scan',
         ok: false,
         detail: input.scanLastOkAt
            ? `last OK run was ${hoursAgo(input.scanLastOkAt, now).toFixed(1)}h ago (>26h). The daily scan may be failing — check the fraud-signal-scan function logs and security_job_runs.`
            : 'no successful fraud-signal-scan run on record. The scan may never have run — check the pg_cron job wallet-fraud-signal-scan-daily and the function logs.',
         isFailure: true
      });
   }

   // 2. IP pipeline alive.
   if (input.ipLogins24h >= 1) {
      checks.push({ name: 'IP logging', ok: true, detail: `${input.ipLogins24h} login(s) recorded in 24h`, isFailure: true });
   } else {
      checks.push({
         name: 'IP logging',
         ok: false,
         detail: 'no logins recorded in auth_ip_log in the last 24h. Either nobody logged in, or the IP pipeline is dead (check IP_HASH_SALT and the record-session-ip function). ALL IP-based fraud signals are blind until this is fixed.',
         isFailure: true
      });
   }

   // 3. CRS engine alive.
   if (input.riskScores26h >= 1) {
      checks.push({ name: 'Risk scoring', ok: true, detail: `${input.riskScores26h} score(s) computed in 26h`, isFailure: true });
   } else {
      checks.push({
         name: 'Risk scoring',
         ok: false,
         detail: 'no risk_scores rows written in the last 26h. The CRS batch (risk-score-recompute) may be failing — check its cron and function logs.',
         isFailure: true
      });
   }

   // 4a. Critical config present.
   if (input.missingCriticalEnv.length === 0) {
      checks.push({ name: 'Critical config', ok: true, detail: 'all critical secrets present', isFailure: true });
   } else {
      checks.push({
         name: 'Critical config',
         ok: false,
         detail: `missing critical secrets: ${input.missingCriticalEnv.join(', ')}. Set them in the Supabase edge function secrets — detection is impaired until they exist.`,
         isFailure: true
      });
   }

   // 4b. Telegram delivery works (chat id resolves AND token is live).
   if (input.fraudChatIdConfigured && input.telegramTokenWorks) {
      checks.push({ name: 'Telegram delivery', ok: true, detail: 'chat id resolved and bot token verified', isFailure: true });
   } else {
      const reasons: string[] = [];
      if (!input.fraudChatIdConfigured) reasons.push('no fraud_alert_chat_id configured (and no kyc_alert_chat_id fallback)');
      if (!input.telegramTokenWorks) reasons.push('Telegram getMe failed — the bot token is missing or invalid');
      checks.push({
         name: 'Telegram delivery',
         ok: false,
         detail: `${reasons.join('; ')}. Fraud alerts cannot reach Telegram until fixed (email may still work).`,
         isFailure: true
      });
   }

   // 4c. Degraded (non-fatal) config — informational only.
   if (input.missingDegradedEnv.length > 0) {
      checks.push({
         name: 'Geo enrichment',
         ok: false,
         detail: `missing: ${input.missingDegradedEnv.join(', ')}. Datacenter-IP and impossible-travel signals are degraded (not fatal).`,
         isFailure: false
      });
   }

   // 5. Review backlog — a nag, never a failure.
   if (input.openFindingsOver7d > 0) {
      checks.push({
         name: 'Review backlog',
         ok: false,
         detail: `${input.openFindingsOver7d} open fraud finding(s) older than 7 days await review.`,
         isFailure: false
      });
   }

   const failures = checks.filter((c) => c.isFailure && !c.ok);
   const notes = checks.filter((c) => !c.isFailure && !c.ok);
   const ok = failures.length === 0;

   const lines: string[] = [];
   if (ok) {
      lines.push('ℹ️ Security heartbeat — all systems OK.');
      lines.push('');
      for (const c of checks.filter((x) => x.isFailure)) lines.push(`✅ ${c.name}: ${c.detail}`);
   } else {
      lines.push(`🔴 SECURITY HEARTBEAT FAILURE — ${failures.length} check(s) down.`);
      lines.push('');
      for (const c of failures) lines.push(`🔴 ${c.name}: ${c.detail}`);
      const passed = checks.filter((c) => c.isFailure && c.ok);
      if (passed.length) {
         lines.push('');
         lines.push('Still OK:');
         for (const c of passed) lines.push(`✅ ${c.name}: ${c.detail}`);
      }
   }
   if (notes.length) {
      lines.push('');
      lines.push('Notes:');
      for (const c of notes) lines.push(`🟡 ${c.name}: ${c.detail}`);
   }

   return { ok, checks, message: lines.join('\n') };
};
