import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

// Receives Openfort's low-gas-balance webhook and tells George (Telegram admin group + email) so the
// sponsored-gas tank gets topped up before Instant Wallets stop working. When it's empty, every
// Instant Wallet repay and cash-out fails with a gas error (Nov 22 2026: $0.01 left, a borrower
// couldn't repay on his due date and nobody knew).
//
// Openfort owns the threshold: `balance.project` events (POST /v1/events {topic, threshold: "0.30"})
// fire to the `balance.project` subscription whose webhook trigger points here (?token=…). Openfort
// has no "get balance" API for secret keys (/payment/v1/balance needs a dashboard session), so this
// webhook is the only signal. Openfort re-sends roughly every 24h while the balance stays low.
//
// verify_jwt=false (Openfort has no Supabase JWT). Gated on a shared token in the URL (?token=…,
// checked against OPENFORT_WEBHOOK_TOKEN), plus a 6h debounce as a backstop.
//
// Test: POST {"test": true} with the token → sends a clearly marked TEST alert, skips the debounce.

const CHAT_KEY = 'kyc_alert_chat_id';
const ALERTED_AT_KEY = 'openfort_gas_alerted_at';
const DEBOUNCE_MS = 6 * 60 * 60 * 1000;
const TOP_UP_URL = 'https://dashboard.openfort.io/pro_6b092fb7-96a1-47fa-93ab-ad8fa0df760f/live';
const alertEmailRecipient = (): string => Deno.env.get('FRAUD_ALERT_EMAIL')?.trim() || 'georgemlerner@gmail.com';

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

serve(async (req) => {
   if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

   try {
      // Shared-token gate: only accept calls that carry the token we set when registering the
      // webhook. If the token isn't configured yet, accept but log — so it works pre-config.
      const expectedToken = (Deno.env.get('OPENFORT_WEBHOOK_TOKEN') ?? '').trim();
      if (expectedToken) {
         const url = new URL(req.url);
         const got = url.searchParams.get('token') ?? req.headers.get('x-openfort-webhook-token') ?? '';
         if (got !== expectedToken) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
      } else {
         console.warn('openfort-gas-webhook: OPENFORT_WEBHOOK_TOKEN not set — accepting unauthenticated');
      }

      const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      const isTest = payload?.test === true;
      // Best-effort extraction — the alert fires regardless of shape, since Openfort only sends
      // this when the balance is already below the configured threshold.
      const data = (payload?.data ?? payload) as Record<string, unknown>;
      const type = String(payload?.type ?? payload?.event ?? data?.type ?? 'balance.project');
      const balance = data?.balance ?? data?.amount ?? data?.remaining;
      const threshold = data?.threshold ?? data?.limit;
      const currency = String(data?.currency ?? 'USD');

      const supaUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      if (!supaUrl || !serviceKey) return jsonResponse({ ok: false, error: 'no_supabase_env' });
      const supabase = createClient(supaUrl, serviceKey);

      const getSetting = async (key: string): Promise<string> => {
         const { data: row } = await supabase.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
         return ((row as { value?: string } | null)?.value ?? '').trim();
      };
      const setSetting = async (key: string, value: string): Promise<void> => {
         await supabase.from('telegram_bot_settings').upsert({ key, value }, { onConflict: 'key' });
      };

      // Debounce: at most one alert per 6h (Openfort may re-fire while the balance stays low).
      const lastAlertedAt = Number.parseInt(await getSetting(ALERTED_AT_KEY), 10);
      const now = Date.now();
      if (!isTest && Number.isFinite(lastAlertedAt) && now - lastAlertedAt < DEBOUNCE_MS) {
         return jsonResponse({ ok: true, skipped: 'debounced' });
      }

      const testTag = isTest ? '[TEST] ' : '';
      const balanceText = balance != null ? `Balance: ${balance}${threshold != null ? ` / ${threshold}` : ''} ${currency}` : 'Below $0.30';
      const consequence = "When it hits $0, Instant Wallet borrowers can't repay or cash out (they see an error).";

      let telegramOk = false;
      let emailOk = false;
      const errors: string[] = [];

      const chatId = await getSetting(CHAT_KEY);
      if (chatId) {
         try {
            await sendTelegramMessage(
               chatId,
               `⛽ <b>${testTag}Openfort gas is low</b>\n` +
                  `${balanceText}\n` +
                  `${consequence}\n` +
                  `Top up: ${TOP_UP_URL} → Add credits`
            );
            telegramOk = true;
         } catch (err) {
            errors.push(`telegram: ${err instanceof Error ? err.message : String(err)}`);
         }
      } else {
         errors.push('telegram: kyc_alert_chat_id not set');
      }

      try {
         await sendEmail(
            alertEmailRecipient(),
            `${testTag}⛽ Openfort gas is low — top up`,
            `${balanceText}\n\n${consequence}\n\nTop up here: ${TOP_UP_URL} → Add credits\n\n(event: ${type})`
         );
         emailOk = true;
      } catch (err) {
         errors.push(`email: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (!isTest && (telegramOk || emailOk)) await setSetting(ALERTED_AT_KEY, String(now));
      console.log(JSON.stringify({ evt: 'openfort_gas_low_alert', type, balance, threshold, isTest, telegramOk, emailOk, errors }));

      return jsonResponse({ ok: telegramOk || emailOk, telegramOk, emailOk, errors });
   } catch (err) {
      console.error('openfort-gas-webhook error:', err);
      return jsonResponse({ ok: false, error: 'exception' }, 500);
   }
});
