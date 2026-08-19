import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { checkCronAuth } from '../_shared/cronAuth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { buildFraudAlertMessage, FraudSignal } from '../_shared/fraudNotifications.ts';
import { recordJobRun } from '../_shared/securityJobRuns.ts';
import { deliverSecurityAlert } from '../_shared/securityAlerts.ts';

const JOB_NAME = 'fraud-signal-scan';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }
   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   // Default verify_jwt accepts the public anon key, so the shared cron secret is what
   // actually keeps a full scan (and its Telegram alert) from being triggered by anyone.
   const auth = checkCronAuth(req, Deno.env.get('ADMIN_API_TOKEN'), corsHeaders);
   if (!auth.ok) return auth.response;

   const startedAt = new Date().toISOString();
   const body = await req.json().catch(() => ({}));
   const ipWindowDays = typeof body.ipWindowDays === 'number' ? body.ipWindowDays : 14;

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   const { data, error } = await supabase.rpc('scan_wallet_fraud_signals', { ip_window_days: ipWindowDays });
   if (error) {
      // The scan itself failed (e.g. the abs(interval) crash of 2026-06-29). Record it
      // so the heartbeat sees a broken pipeline instead of mistaking silence for health.
      await recordJobRun(supabase, JOB_NAME, { startedAt, ok: false, detail: { error: error.message } });
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
   }

   // Embedded-wallet face signals are written by didit-webhook as they happen, so they can't
   // be produced by the scan above — it would have no way to detect them after the fact.
   // They're collected here instead and ride the same delivery path, rather than growing a
   // second alerting channel that would need its own destinations and its own monitoring.
   const { data: faceData, error: faceError } = await supabase.rpc('scan_wallet_face_signals', {
      stuck_grant_minutes: typeof body.stuckGrantMinutes === 'number' ? body.stuckGrantMinutes : 60
   });
   if (faceError) {
      // Don't lose the wallet/IP signals we already have because the face scan failed —
      // record the fault and carry on with what we could gather.
      console.error('[fraud-signal-scan] wallet face scan failed:', faceError.message);
   }

   // Follow-the-money convergence (Part A): one on-chain destination fed by many borrowers
   // (the 2026-08-15 mule pattern) + fast off-ramps. Populated by trace-loan-fund-flow.
   // Rides the same delivery path; a failure here must not drop the wallet/IP/face signals.
   const { data: payoutData, error: payoutError } = await supabase.rpc('scan_payout_convergence', {
      fast_offramp_hours: typeof body.fastOfframpHours === 'number' ? body.fastOfframpHours : 24
   });
   if (payoutError) {
      console.error('[fraud-signal-scan] payout convergence scan failed:', payoutError.message);
   }

   // Per-borrower mule-risk score (MULE_HUNTER-style 2-hop fraud density over the
   // loan_fund_flow graph). Emits a deduped high_mule_risk signal the first time a
   // borrower crosses the threshold. Tolerates the RPC being absent (prototype not
   // yet applied) so it can never break the wallet/IP/face/convergence signals.
   const { data: muleData, error: muleError } = await supabase.rpc('scan_mule_risk', {
      min_score: typeof body.muleMinScore === 'number' ? body.muleMinScore : 60,
      fast_offramp_hours: typeof body.fastOfframpHours === 'number' ? body.fastOfframpHours : 24
   });
   if (muleError) {
      console.error('[fraud-signal-scan] mule-risk scan failed (RPC may not be deployed yet):', muleError.message);
   }

   const signals = [
      ...(((data?.signals ?? []) as FraudSignal[]) ?? []),
      ...(((faceData?.signals ?? []) as FraudSignal[]) ?? []),
      ...(((payoutData?.signals ?? []) as FraudSignal[]) ?? []),
      ...(((muleData?.signals ?? []) as FraudSignal[]) ?? [])
   ];
   if (!signals.length) {
      await recordJobRun(supabase, JOB_NAME, { startedAt, ok: true, signalCount: 0, detail: { message: 'no new signals' } });
      return new Response(JSON.stringify({ message: 'No new fraud signals' }), { status: 200, headers: corsHeaders });
   }

   const { title, detail, criticalCount } = buildFraudAlertMessage(signals);

   // Deliver through the unified dispatcher (Phase 3): one format, one destination
   // set, both channels attempted, every attempt recorded in security_alert_deliveries.
   // Severity is critical when any critical signal fired, else warning.
   const delivery = await deliverSecurityAlert(supabase, {
      source: 'fraud-scan',
      severity: criticalCount > 0 ? 'critical' : 'warning',
      title,
      body: detail
   });

   const delivered = delivery.telegram_ok || delivery.email_ok;
   await recordJobRun(supabase, JOB_NAME, {
      startedAt,
      ok: delivered,
      signalCount: signals.length,
      detail: { delivery }
   });

   if (!delivered) {
      return new Response(JSON.stringify({ error: 'All alert channels failed', count: signals.length, delivery }), {
         status: 500,
         headers: corsHeaders
      });
   }

   return new Response(JSON.stringify({ message: 'Fraud signals delivered', count: signals.length, delivery }), {
      status: 200,
      headers: corsHeaders
   });
});
