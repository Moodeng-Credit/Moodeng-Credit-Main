import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { postDiscord } from '../_shared/discord.ts';
import { PAGE_INBOX_URL } from '../_shared/loanAccess.ts';
import {
   buildMessengerStuckAlert,
   LOOKBACK_MS,
   messengerStuckKeyboard,
   REALERT_AFTER_MS,
   shouldAlertStuck,
   STUCK_AFTER_MS,
   type StuckBorrower,
   type StuckCode
} from '../_shared/messengerStuckAlert.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

// Cron-driven (every 5 min): borrowers who tapped "Verify via Messenger" 10+ minutes ago and still
// aren't confirmed → a card in the KYC Telegram group (with a "Mark Facebook verified" button,
// handled by telegram-webhook) and a line in Discord #kyc. Timing and wording live in
// _shared/messengerStuckAlert.ts.
//
// start_contact_verification keeps at most one open code per borrower per channel, so each open
// code here is that borrower's latest attempt. users.messenger_stuck_alerted_at keeps it to one
// ping per borrower per day.
//
// verify_jwt stays on (no config.toml entry → project default), and the pg_cron job calls it with
// the service key, so only a valid project token reaches it.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

serve(async (req) => {
   if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
   if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'not_configured' }, 500);

   const svc = createClient(SUPABASE_URL, SERVICE_KEY);
   const now = Date.now();

   const { data: codes, error: codesError } = await svc
      .from('contact_verification_codes')
      .select('code, user_id, created_at')
      .eq('channel', 'messenger')
      .is('verified_at', null)
      .lt('created_at', new Date(now - STUCK_AFTER_MS).toISOString())
      .gt('created_at', new Date(now - LOOKBACK_MS).toISOString());
   if (codesError) {
      console.error('messenger-stuck-alerts: code lookup failed', codesError.message);
      return json({ error: 'lookup_failed' }, 500);
   }
   if (!codes?.length) return json({ ok: true, alerted: 0 });

   const { data: borrowers, error: usersError } = await svc
      .from('users')
      .select('id, username, display_name, email, user_role, messenger_verified_at, messenger_stuck_alerted_at')
      .in(
         'id',
         (codes as StuckCode[]).map((c) => c.user_id)
      );
   if (usersError) {
      console.error('messenger-stuck-alerts: user lookup failed', usersError.message);
      return json({ error: 'lookup_failed' }, 500);
   }
   const byId = new Map((borrowers as StuckBorrower[]).map((b) => [b.id, b]));

   const { data: chatRow } = await svc.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle();
   const kycChatId = (chatRow as { value?: string } | null)?.value;

   let alerted = 0;
   for (const code of codes as StuckCode[]) {
      const borrower = byId.get(code.user_id);
      if (!borrower || !shouldAlertStuck(borrower, now)) continue;

      // Claim the alert before sending, so two overlapping runs can't both post it.
      const nowIso = new Date(now).toISOString();
      const { data: claimed } = await svc
         .from('users')
         .update({ messenger_stuck_alerted_at: nowIso })
         .eq('id', borrower.id)
         .or(`messenger_stuck_alerted_at.is.null,messenger_stuck_alerted_at.lt."${new Date(now - REALERT_AFTER_MS).toISOString()}"`)
         .select('id')
         .maybeSingle();
      if (!claimed) continue;

      const text = buildMessengerStuckAlert(borrower, code, now);
      if (kycChatId) {
         await sendTelegramMessage(kycChatId, text, { inlineKeyboard: messengerStuckKeyboard(borrower.id, PAGE_INBOX_URL) }).catch(
            (err: unknown) => console.error('messenger-stuck-alerts: telegram send failed', err instanceof Error ? err.message : err)
         );
      }
      await postDiscord(
         { content: `${text}\n(The button is on the card in the Telegram KYC group.)` },
         { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }
      );
      alerted += 1;
   }

   return json({ ok: true, alerted });
});
