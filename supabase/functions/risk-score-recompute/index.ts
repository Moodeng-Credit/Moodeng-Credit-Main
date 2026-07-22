// Pure orchestrator. Calls compute_risk_score(uuid), and when critical or
// high-severity fraud signals fire, sends an admin alert email via Resend.
// Never blocks anything. Score is advisory; alerts are informational.
//
// Modes:
//   POST { user_id }            single-user (action trigger / admin button)
//   POST { batch: true }        recompute every user (cron / admin button)
//   Optional body: { trigger: 'loan_request' | 'repayment' | 'manual' | 'daily_batch' | 'signup' }
//
// Required env:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   ADMIN_API_TOKEN              (matches X-Admin-Token request header)
//   RESEND_API_KEY               (already set; used by _shared/email.ts)
//   RISK_ALERT_TO                (admin email; defaults to georgemlerner@gmail.com)
//   RESEND_FROM                  (already set; defaults to support@moodeng.app)
//
// Dedup: an alert for the same user_id + signal_key won't re-fire within 24h.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/email.ts';
import { recordJobRun } from '../_shared/securityJobRuns.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN_TOKEN  = Deno.env.get('ADMIN_API_TOKEN')!;
const ALERT_TO     = Deno.env.get('RISK_ALERT_TO') || 'georgemlerner@gmail.com';

const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type SignalKey = 'I' | 'V' | 'R' | 'N' | 'A' | 'E' | 'B';
interface SignalNode { score: number; weight: number; factors: string[] }
type Breakdown = Record<SignalKey, SignalNode>;

// ----- Alert detection ------------------------------------------------------
// Returns the alerts that should fire for this score, if any.
// Each alert has a signal_key used as the dedup grain.

interface Alert {
  severity: 'critical' | 'high' | 'medium';
  signal_key: string;
  factors: string[];
  message: string;
}

function detectAlerts(score: number, band: string, breakdown: Breakdown): Alert[] {
  const alerts: Alert[] = [];
  const networkFactors = breakdown.N?.factors ?? [];

  // CRITICAL: hard self-lending identifier match. Deterministic; never false.
  const hardMatch = networkFactors.find((f) => f.startsWith('self_lending_hard_match='));
  if (hardMatch) {
    alerts.push({
      severity: 'critical',
      signal_key: 'self_lending_hard_match',
      factors: networkFactors.filter((f) => f.startsWith('self_lending_hard_match=')),
      message: `Self-lending detected: borrower and lender share a strong identifier (${hardMatch}). This pattern only happens when a single human controls both accounts.`
    });
  }

  // HIGH: sybil cluster (3+ short-lived accounts in chain)
  const cluster = networkFactors.find((f) => f.startsWith('sybil_cluster_size='));
  if (cluster) {
    alerts.push({
      severity: 'high',
      signal_key: 'sybil_cluster',
      factors: networkFactors.filter((f) => f.startsWith('sybil_cluster_size=')),
      message: `Sybil cluster detected: ${cluster}. Multiple short-lived accounts are transacting in a chain.`
    });
  }

  // HIGH: paired new accounts (<14d, <1h signup delta, transacted together)
  const paired = networkFactors.find((f) => f.startsWith('paired_new_account_<1h_signup_delta='));
  if (paired) {
    alerts.push({
      severity: 'high',
      signal_key: 'paired_new_accounts',
      factors: networkFactors.filter((f) => f.startsWith('paired_new_account_<1h_signup_delta=')),
      message: `Paired new accounts detected: ${paired}. Two accounts created within an hour of each other are already transacting.`
    });
  }

  // MEDIUM: score crossed into Critical band (>= 75) — generic "high-risk now"
  if (score >= 75 && alerts.length === 0) {
    alerts.push({
      severity: 'medium',
      signal_key: 'critical_band',
      factors: [`band=${band}`, `score=${score}`],
      message: `Account scored Critical (${score}/100) without a hard fraud signal. Likely repayment or velocity driven.`
    });
  }

  return alerts;
}

// ----- Dedup + send ---------------------------------------------------------

async function maybeSendAlert(
  userId: string,
  username: string | null,
  score: number,
  band: string,
  breakdown: Breakdown,
  alert: Alert
): Promise<void> {
  // Dedup: don't re-fire the same signal_key for the same user within 24h.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supa
    .from('risk_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('signal_key', alert.signal_key)
    .gt('created_at', since);

  if ((count ?? 0) > 0) return;

  const userLabel = username ?? userId.slice(0, 8);
  const subject = `[Moodeng risk ${alert.severity.toUpperCase()}] ${alert.signal_key.replace(/_/g, ' ')} — ${userLabel}`;
  const body = [
    `Severity:  ${alert.severity}`,
    `Signal:    ${alert.signal_key}`,
    `User:      ${userLabel}  (id ${userId})`,
    `Score:     ${score} / 100  (band ${band})`,
    ``,
    alert.message,
    ``,
    `Top factors that fired:`,
    ...alert.factors.map((f) => `  • ${f}`),
    ``,
    `Full signal breakdown:`,
    `  Identity:       ${breakdown.I.score}`,
    `  Velocity:       ${breakdown.V.score}`,
    `  Repayment:      ${breakdown.R.score}`,
    `  Network:        ${breakdown.N.score}  (this is where self-lending fires)`,
    `  Amount:         ${breakdown.A.score}`,
    `  Engagement:     ${breakdown.E.score}`,
    `  Bot pattern:    ${breakdown.B.score}`,
    ``,
    `Open the admin panel: https://staging.dashboard.moodeng.app/admin`,
    ``,
    `This is an informational alert. The platform did not block the user;`,
    `you should review and decide whether to add to watchlist or notify them.`
  ].join('\n');

  let emailSent = false;
  let emailError: string | null = null;
  try {
    await sendEmail(ALERT_TO, subject, body);
    emailSent = true;
  } catch (e) {
    emailError = e instanceof Error ? e.message : String(e);
    console.error(`risk alert email failed for ${userId} ${alert.signal_key}:`, emailError);
  }

  await supa.from('risk_alerts').insert({
    user_id: userId,
    severity: alert.severity,
    signal_key: alert.signal_key,
    factors: alert.factors,
    message: alert.message,
    email_to: ALERT_TO,
    email_sent: emailSent,
    email_error: emailError
  });
}

// ----- Compute one user -----------------------------------------------------

async function computeOne(userId: string, trigger: string) {
  const { data, error } = await supa.rpc('compute_risk_score', { p_user_id: userId });
  if (error) throw new Error(`compute_risk_score(${userId}): ${error.message}`);
  if (!data) throw new Error(`compute_risk_score(${userId}): no row returned`);

  if (trigger !== 'manual') {
    await supa.from('risk_scores').update({ trigger }).eq('id', data.id);
  }

  // Look up username for the email subject line. Best-effort.
  let username: string | null = null;
  try {
    const { data: u } = await supa.from('users').select('username').eq('id', userId).single();
    username = (u as { username: string | null } | null)?.username ?? null;
  } catch {
    // ignore
  }

  // Alerts.
  const breakdown = data.signal_breakdown as Breakdown;
  const alerts = detectAlerts(data.score as number, data.band as string, breakdown);
  for (const alert of alerts) {
    await maybeSendAlert(userId, username, data.score, data.band, breakdown, alert);
  }

  return {
    user_id:   userId,
    score:     data.score,
    band:      data.band,
    breakdown,
    alerts:    alerts.map((a) => ({ severity: a.severity, signal_key: a.signal_key }))
  };
}

// ----- HTTP handler ---------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (req.headers.get('X-Admin-Token') !== ADMIN_TOKEN) {
    return new Response('unauthorized', { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const trigger: string = body.trigger ?? (body.batch ? 'daily_batch' : 'manual');
  const startedAt = new Date().toISOString();

  try {
    if (body.batch === true) {
      const PAGE = 100;
      let offset = 0;
      const summary = {
        total: 0,
        by_band: { Low: 0, Medium: 0, High: 0, Critical: 0 } as Record<string, number>,
        alerts_fired: 0,
        errors: [] as Array<{ user_id: string; error: string }>
      };
      while (true) {
        const { data: users, error } = await supa
          .from('users')
          .select('id')
          .range(offset, offset + PAGE - 1);
        if (error) throw error;
        if (!users || users.length === 0) break;
        for (const u of users) {
          try {
            const r = await computeOne(u.id as string, trigger);
            summary.total += 1;
            summary.by_band[r.band] = (summary.by_band[r.band] ?? 0) + 1;
            summary.alerts_fired += r.alerts.length;
          } catch (e) {
            summary.errors.push({ user_id: u.id as string, error: (e as Error).message });
          }
        }
        if (users.length < PAGE) break;
        offset += PAGE;
      }
      // Record the batch run so the heartbeat can confirm the CRS engine is alive.
      // Only batch (cron) runs are logged; per-user manual recomputes would flood the ledger.
      await recordJobRun(supa, 'risk-score-recompute', {
        startedAt,
        ok: summary.errors.length === 0,
        signalCount: summary.alerts_fired,
        detail: { total: summary.total, by_band: summary.by_band, error_count: summary.errors.length }
      });
      return Response.json({ ok: true, batch: true, summary });
    }

    if (typeof body.user_id !== 'string') {
      return new Response('user_id required', { status: 400 });
    }
    const result = await computeOne(body.user_id, trigger);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    if (body.batch === true) {
      await recordJobRun(supa, 'risk-score-recompute', { startedAt, ok: false, detail: { error: (e as Error).message } });
    }
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
});
