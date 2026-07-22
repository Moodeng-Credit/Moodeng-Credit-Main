import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendTelegramMessage } from './telegram.ts';

// Telegram alert for when the DeepSeek API starts failing (out of credits, bad
// key, outage). Without this the AI features degrade silently: Mecha hands every
// question to a human and the loan-input effort check waves everything through —
// and the only trace is a function log nobody watches.
//
// Destination = telegram_bot_settings key 'kyc_alert_chat_id' (the admin KYC
// group — per George, that's where operational alerts should land). No-ops when
// unset. Never throws — an alert failure must not fail the caller.
//
// Debounced in-memory: one alert per window per isolate. Supabase may run a few
// isolates so a burst can produce a couple of pings, but never one per request.

const ALERT_WINDOW_MS = 6 * 60 * 60 * 1000; // 6h between alerts per isolate
let lastAlertAt = 0;

// Balance lookup so the alert says WHY it's failing: $0.00 → top up; healthy
// balance → DeepSeek outage or a key problem. Best-effort with a short timeout.
const fetchBalanceLine = async (apiKey: string): Promise<string> => {
   try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 4000);
      let res: Response;
      try {
         res = await fetch('https://api.deepseek.com/user/balance', {
            signal: ctrl.signal,
            headers: { Authorization: `Bearer ${apiKey}` }
         });
      } finally {
         clearTimeout(timeout);
      }
      if (!res.ok) return `Balance: could not check (HTTP ${res.status})`;
      const data = await res.json();
      const info = data?.balance_infos?.[0];
      if (!info) return 'Balance: could not check';
      const line = `Balance: ${info.total_balance} ${info.currency}`;
      return data?.is_available === false ? `${line} — ACCOUNT UNAVAILABLE (top up needed)` : line;
   } catch {
      return 'Balance: could not check';
   }
};

const statusHint = (status: number): string => {
   if (status === 402) return 'payment required — almost certainly OUT OF CREDITS';
   if (status === 401 || status === 403) return 'auth failed — API key invalid or revoked';
   if (status === 429) return 'rate limited by DeepSeek';
   if (status >= 500) return 'DeepSeek server error — likely an outage on their side';
   return 'unexpected error';
};

/**
 * Post a debounced "DeepSeek is failing" alert to the admin KYC Telegram group.
 * @param source which function saw the failure (e.g. 'support-chat')
 * @param status HTTP status DeepSeek returned
 */
export const alertDeepSeekFailure = async (source: string, status: number): Promise<void> => {
   try {
      const now = Date.now();
      if (now - lastAlertAt < ALERT_WINDOW_MS) return;
      lastAlertAt = now;

      const url = Deno.env.get('SUPABASE_URL') ?? '';
      const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      if (!url || !key) return;
      const supabase = createClient(url, key);
      const { data: setting } = await supabase
         .from('telegram_bot_settings')
         .select('value')
         .eq('key', 'kyc_alert_chat_id')
         .maybeSingle();
      const chatId = (setting as { value?: string } | null)?.value?.trim();
      if (!chatId) {
         console.error('deepseekAlert: kyc_alert_chat_id not set — cannot alert');
         return;
      }

      const apiKey = Deno.env.get('DEEPSEEK_API_KEY') ?? '';
      const balanceLine = apiKey ? await fetchBalanceLine(apiKey) : 'Balance: no API key set';

      const text =
         `🤖⚠️ <b>DeepSeek API is failing</b> — AI features are degraded.\n` +
         `Mecha is handing every question to a human, and the loan-reason effort check is off (fails open).\n\n` +
         `Source: ${source}\n` +
         `HTTP ${status} (${statusHint(status)})\n` +
         `${balanceLine}\n\n` +
         `Top up / check: https://platform.deepseek.com`;

      await sendTelegramMessage(chatId, text);
      console.log(JSON.stringify({ evt: 'deepseek_failure_alert_sent', source, status }));
   } catch (err) {
      console.error('deepseekAlert: failed to send alert', err);
   }
};
