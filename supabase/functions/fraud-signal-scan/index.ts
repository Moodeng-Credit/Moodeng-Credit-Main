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

   const signals = ((data?.signals ?? []) as FraudSignal[]) ?? [];
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
