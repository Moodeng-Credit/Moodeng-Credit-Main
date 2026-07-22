import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';
import { buildFraudAlertMessage, FraudSignal } from '../_shared/fraudNotifications.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const ALERT_EMAIL = Deno.env.get('FRAUD_ALERT_EMAIL') ?? 'georgemlerner@gmail.com';

type AdminSupabase = ReturnType<typeof createClient>;

// Destination group for Telegram fraud alerts. Env override first, then the
// fraud_alert_chat_id setting (seeded from the KYC alerts group), then the KYC
// alerts group itself so alerts flow even before the new setting is configured.
const getFraudAlertChatId = async (supabase: AdminSupabase): Promise<string | undefined> => {
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

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }
   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   const body = await req.json().catch(() => ({}));
   const ipWindowDays = typeof body.ipWindowDays === 'number' ? body.ipWindowDays : 14;

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   const { data, error } = await supabase.rpc('scan_wallet_fraud_signals', { ip_window_days: ipWindowDays });
   if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
   }

   const signals = ((data?.signals ?? []) as FraudSignal[]) ?? [];
   if (!signals.length) {
      return new Response(JSON.stringify({ message: 'No new fraud signals' }), { status: 200, headers: corsHeaders });
   }

   const { subject, text } = buildFraudAlertMessage(signals);

   // Deliver on both channels independently — a Telegram outage must not silence
   // the email (or vice versa). Fail the run only when neither got through.
   const delivery: { email: boolean; telegram: boolean; errors: string[] } = { email: false, telegram: false, errors: [] };

   try {
      await sendEmail(ALERT_EMAIL, subject, text);
      delivery.email = true;
   } catch (err) {
      delivery.errors.push(`email: ${err instanceof Error ? err.message : String(err)}`);
   }

   try {
      const chatId = await getFraudAlertChatId(supabase);
      if (chatId) {
         await sendTelegramMessage(chatId, text);
         delivery.telegram = true;
      } else {
         delivery.errors.push('telegram: fraud_alert_chat_id is not configured');
      }
   } catch (err) {
      delivery.errors.push(`telegram: ${err instanceof Error ? err.message : String(err)}`);
   }

   if (!delivery.email && !delivery.telegram) {
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
