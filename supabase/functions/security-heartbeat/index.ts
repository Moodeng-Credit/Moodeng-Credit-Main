import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';
import { callTelegramApi, sendTelegramMessage } from '../_shared/telegram.ts';
import { buildHeartbeat, HeartbeatInput } from '../_shared/securityHeartbeat.ts';
import { recordJobRun } from '../_shared/securityJobRuns.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const JOB_NAME = 'security-heartbeat';
const ALERT_EMAIL = Deno.env.get('FRAUD_ALERT_EMAIL') ?? 'georgemlerner@gmail.com';

type AdminSupabase = ReturnType<typeof createClient>;

// Same resolution order as fraud-signal-scan: env override, then fraud_alert_chat_id,
// then the kyc_alert_chat_id fallback.
const resolveFraudChatId = async (supabase: AdminSupabase): Promise<string | undefined> => {
   const fromEnv = Deno.env.get('FRAUD_ALERT_TELEGRAM_CHAT_ID')?.trim();
   if (fromEnv) return fromEnv;
   const { data } = await supabase
      .from('telegram_bot_settings')
      .select('key, value')
      .in('key', ['fraud_alert_chat_id', 'kyc_alert_chat_id']);
   const settings = (data ?? []) as Array<{ key: string; value?: string | null }>;
   const byKey = (key: string) => settings.find((s) => s.key === key)?.value?.trim();
   return byKey('fraud_alert_chat_id') || byKey('kyc_alert_chat_id') || undefined;
};

const countSince = async (supabase: AdminSupabase, table: string, column: string, cutoffIso: string): Promise<number> => {
   const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).gte(column, cutoffIso);
   return count ?? 0;
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }
   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   const startedAt = new Date().toISOString();
   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   const now = new Date();

   // --- Gather facts -------------------------------------------------------
   const { data: lastScan } = await supabase
      .from('security_job_runs')
      .select('started_at, finished_at')
      .eq('job_name', 'fraud-signal-scan')
      .eq('ok', true)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
   const scanRow = lastScan as { started_at?: string; finished_at?: string } | null;
   const scanLastOkAt = scanRow?.finished_at ?? scanRow?.started_at ?? null;

   const ipCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
   const riskCutoff = new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString();
   const backlogCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

   const ipLogins24h = await countSince(supabase, 'auth_ip_log', 'last_seen_at', ipCutoff);
   const riskScores26h = await countSince(supabase, 'risk_scores', 'computed_at', riskCutoff);

   const { count: backlogCount } = await supabase
      .from('fraud_signal_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('review_status', 'open')
      .lt('created_at', backlogCutoff);
   const openFindingsOver7d = backlogCount ?? 0;

   // Config presence.
   const has = (name: string) => (Deno.env.get(name)?.trim() ?? '') !== '';
   const missingCriticalEnv: string[] = [];
   if (!has('IP_HASH_SALT')) missingCriticalEnv.push('IP_HASH_SALT');
   if (!has('RESEND_API_KEY')) missingCriticalEnv.push('RESEND_API_KEY');
   if (!has('TELEGRAM_API_TOKEN') && !has('TELEGRAM_BOT_TOKEN')) missingCriticalEnv.push('TELEGRAM_API_TOKEN');
   const missingDegradedEnv: string[] = [];
   if (!has('MAXMIND_ACCOUNT_ID')) missingDegradedEnv.push('MAXMIND_ACCOUNT_ID');
   if (!has('MAXMIND_LICENSE_KEY')) missingDegradedEnv.push('MAXMIND_LICENSE_KEY');

   const chatId = await resolveFraudChatId(supabase);
   const fraudChatIdConfigured = !!chatId;

   let telegramTokenWorks = false;
   try {
      await callTelegramApi('getMe', {});
      telegramTokenWorks = true;
   } catch (_err) {
      telegramTokenWorks = false;
   }

   const input: HeartbeatInput = {
      scanLastOkAt,
      ipLogins24h,
      riskScores26h,
      missingCriticalEnv,
      missingDegradedEnv,
      fraudChatIdConfigured,
      telegramTokenWorks,
      openFindingsOver7d,
      now
   };

   const { ok, message } = buildHeartbeat(input);

   // --- Deliver: always one Telegram message; email on failure only -------
   const delivery: { telegram: boolean; email: boolean; errors: string[] } = { telegram: false, email: false, errors: [] };

   if (chatId && telegramTokenWorks) {
      try {
         await sendTelegramMessage(chatId, message);
         delivery.telegram = true;
      } catch (err) {
         delivery.errors.push(`telegram: ${err instanceof Error ? err.message : String(err)}`);
      }
   } else {
      delivery.errors.push('telegram: unavailable (no chat id or bad token) — see message body');
   }

   // Email is the backstop: send it whenever the heartbeat is red OR Telegram could
   // not deliver, so a failure can never be fully silent.
   if (!ok || !delivery.telegram) {
      try {
         await sendEmail(ALERT_EMAIL, ok ? 'Moodeng security heartbeat' : '🔴 Moodeng SECURITY HEARTBEAT FAILURE', message);
         delivery.email = true;
      } catch (err) {
         delivery.errors.push(`email: ${err instanceof Error ? err.message : String(err)}`);
      }
   }

   await recordJobRun(supabase, JOB_NAME, {
      startedAt,
      ok: ok && (delivery.telegram || delivery.email),
      signalCount: input.missingCriticalEnv.length,
      detail: { heartbeat_ok: ok, delivery, facts: { ...input, now: undefined } }
   });

   return new Response(JSON.stringify({ heartbeat_ok: ok, delivery }), { status: 200, headers: corsHeaders });
});
