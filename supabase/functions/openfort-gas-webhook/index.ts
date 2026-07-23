import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendTelegramMessage } from '../_shared/telegram.ts';

// Receives Openfort's low-gas-balance webhook and pings the admin KYC Telegram group so the
// sponsored-gas tank gets topped up before borrower wallets stop working. Openfort owns the
// threshold: configure a `balance.project` event at $0.50 in the dashboard (Notifications →
// Events) with a webhook pointing here, or register it via the CLI (`openfort subscriptions`).
// When the project's remaining gas credit drops below that threshold, Openfort POSTs here.
//
// Why a webhook (not a balance poller): Openfort has no clean "get balance" API, but it fires
// balance-threshold events natively — more reliable, and no Openfort secret key lives here.
//
// verify_jwt=false (Openfort has no Supabase JWT). We instead gate on a shared token in the
// URL (?token=…, checked against OPENFORT_WEBHOOK_TOKEN) so a random caller can't spam alerts,
// plus a 6h debounce as a backstop.

const CHAT_KEY = 'kyc_alert_chat_id';
const ALERTED_AT_KEY = 'openfort_gas_alerted_at';
const DEBOUNCE_MS = 6 * 60 * 60 * 1000;

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

      const payload = await req.json().catch(() => ({}) as Record<string, unknown>);
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
      if (Number.isFinite(lastAlertedAt) && now - lastAlertedAt < DEBOUNCE_MS) {
         return jsonResponse({ ok: true, skipped: 'debounced' });
      }

      const chatId = await getSetting(CHAT_KEY);
      if (!chatId) {
         console.error('openfort-gas-webhook: kyc_alert_chat_id not set — cannot alert');
         return jsonResponse({ ok: false, error: 'no_chat_id' });
      }

      const balanceLine =
         balance != null ? `Balance: ${balance}${threshold != null ? ` / ${threshold}` : ''} ${currency}\n` : '';
      await sendTelegramMessage(
         chatId,
         `⛽ <b>Openfort gas is low</b> — sponsored wallet fees are about to run out.\n` +
            balanceLine +
            `Borrowers with an instant wallet can't repay or cash out gaslessly once it's empty.\n` +
            `Top up the gas balance: https://dashboard.openfort.io → Billing → Gas\n\n` +
            `<i>(event: ${type})</i>`
      );
      await setSetting(ALERTED_AT_KEY, String(now));
      console.log(JSON.stringify({ evt: 'openfort_gas_low_alert', type, balance, threshold }));

      return jsonResponse({ ok: true, alerted: true });
   } catch (err) {
      console.error('openfort-gas-webhook error:', err);
      return jsonResponse({ ok: false, error: 'exception' }, 500);
   }
});
