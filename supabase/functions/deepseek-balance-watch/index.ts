import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendTelegramMessage } from '../_shared/telegram.ts';

// Hourly credit watch for the shared DeepSeek account (Mecha support-chat +
// check-loan-input). Alerts the admin KYC Telegram group when the balance drops
// to 25% of its high-water mark — i.e. a quarter of the tank left — so credits
// get topped up BEFORE the AI features degrade (the reactive dead-API alert in
// _shared/deepseekAlert.ts is the last line, this is the early warning).
//
// "100%" self-calibrates: the peak balance is tracked in telegram_bot_settings,
// so every top-up raises the peak and re-arms the alert automatically.
// Scheduled via pg_cron (see migration *_deepseek_balance_watch_cron.sql).

const LOW_FRACTION = 0.25;

const PEAK_KEY = 'deepseek_balance_peak';
const ALERTED_KEY = 'deepseek_low_alerted';
const CHAT_KEY = 'kyc_alert_chat_id';

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

serve(async () => {
   try {
      const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
      if (!apiKey) return jsonResponse({ ok: false, error: 'no_api_key' });

      const url = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      if (!url || !serviceKey) return jsonResponse({ ok: false, error: 'no_supabase_env' });
      const supabase = createClient(url, serviceKey);

      const balRes = await fetch('https://api.deepseek.com/user/balance', {
         headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!balRes.ok) {
         console.error('deepseek-balance-watch: balance fetch failed', balRes.status);
         return jsonResponse({ ok: false, error: 'balance_fetch_failed', status: balRes.status });
      }
      const data = await balRes.json();
      const info = data?.balance_infos?.[0] as { currency?: string; total_balance?: string } | undefined;
      const balance = Number.parseFloat(info?.total_balance ?? '');
      if (!Number.isFinite(balance)) return jsonResponse({ ok: false, error: 'unparseable_balance' });
      const currency = info?.currency ?? 'USD';

      const getSetting = async (key: string): Promise<string> => {
         const { data: row } = await supabase.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
         return ((row as { value?: string } | null)?.value ?? '').trim();
      };
      const setSetting = async (key: string, value: string): Promise<void> => {
         await supabase.from('telegram_bot_settings').upsert({ key, value }, { onConflict: 'key' });
      };

      const storedPeak = Number.parseFloat(await getSetting(PEAK_KEY));
      const alerted = (await getSetting(ALERTED_KEY)) === '1';

      // Balance above the stored peak = a top-up happened. New 100%, re-arm.
      if (!Number.isFinite(storedPeak) || balance > storedPeak) {
         await setSetting(PEAK_KEY, balance.toFixed(2));
         if (alerted) await setSetting(ALERTED_KEY, '');
         console.log(JSON.stringify({ evt: 'deepseek_balance_peak', peak: balance, currency }));
         return jsonResponse({ ok: true, balance, peak: balance, pct: 100, alerted: false });
      }

      const pct = storedPeak > 0 ? (balance / storedPeak) * 100 : 0;

      if (pct <= LOW_FRACTION * 100 && !alerted) {
         const chatId = await getSetting(CHAT_KEY);
         if (chatId) {
            await sendTelegramMessage(
               chatId,
               `🔋 <b>DeepSeek credits at ${pct.toFixed(0)}%</b> — a quarter of the tank left.\n` +
                  `Balance: ${balance.toFixed(2)} ${currency} (of a ${storedPeak.toFixed(2)} ${currency} top-up)\n` +
                  `Mecha and the loan-reason check run on this account — top up before it runs dry.\n\n` +
                  `https://platform.deepseek.com`
            );
            await setSetting(ALERTED_KEY, '1');
            console.log(JSON.stringify({ evt: 'deepseek_low_balance_alert', balance, peak: storedPeak, pct }));
         } else {
            console.error('deepseek-balance-watch: kyc_alert_chat_id not set — cannot alert');
         }
      }

      return jsonResponse({ ok: true, balance, peak: storedPeak, pct: Math.round(pct), alerted: alerted || pct <= LOW_FRACTION * 100 });
   } catch (err) {
      console.error('deepseek-balance-watch error:', err);
      return jsonResponse({ ok: false, error: 'exception' }, 500);
   }
});
