import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { adminUserUrl, OPEN_IN_ADMIN_TEXT } from '../_shared/adminCards.ts';
import { postDiscord } from '../_shared/discord.ts';
import {
   buildRemindersStuckAlert,
   buildRemindersStuckMessage,
   type MessengerOutcome,
   REMINDERS_REALERT_AFTER_MS,
   REMINDERS_STUCK_REASONS,
   type RemindersStuckOs,
   type RemindersStuckReason
} from '../_shared/remindersStuck.ts';
import { findMessengerContactIdByCode, getMessengerContact, isInsideMessagingWindow, sendMessengerMessage } from '../_shared/sendpulse.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

// Called by the onboarding Facebook step (ContactsStep) when a borrower's reminders can't turn on:
// { reason: 'failed' | 'blocked' | 'in_app', os, failures? }.
//   1. The bot messages them on Messenger how to fix it in Chrome/Safari (they just connected, so
//      Messenger's 24h window is open).
//   2. The team gets a line in the KYC Telegram group and Discord #kyc.
// Wording lives in _shared/remindersStuck.ts. users.reminders_stuck_alerted_at keeps it to once per
// borrower per day. verify_jwt stays on: the caller is the signed-in borrower, and only ever about
// themselves.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const OSES: readonly RemindersStuckOs[] = ['android', 'ios', 'other'];

// deno-lint-ignore no-explicit-any
type Svc = any;

// The stored id should be the SendPulse contact id; older verifications may hold something else, so
// fall back to the contact the verification code was saved on (same as admin-messenger).
const findContact = async (svc: Svc, userId: string, storedId: string | null) => {
   if (storedId) {
      const contact = await getMessengerContact(storedId);
      if (contact) return { id: storedId, contact };
   }
   const { data: codes } = await svc
      .from('contact_verification_codes')
      .select('code')
      .eq('user_id', userId)
      .eq('channel', 'messenger')
      .not('verified_at', 'is', null)
      .order('verified_at', { ascending: false })
      .limit(1);
   const code = (codes as Array<{ code: string }> | null)?.[0]?.code;
   const contactId = code ? await findMessengerContactIdByCode(code) : null;
   const contact = contactId ? await getMessengerContact(contactId) : null;
   return contactId && contact ? { id: contactId, contact } : null;
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
   if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
   if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'not_configured' }, 500);

   const svc = createClient(SUPABASE_URL, SERVICE_KEY);
   const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
   const { data: auth } = token ? await svc.auth.getUser(token) : { data: null };
   const userId = auth?.user?.id;
   if (!userId) return json({ error: 'unauthorized' }, 401);

   const body = await req.json().catch(() => ({}));
   const reason = REMINDERS_STUCK_REASONS.includes(body?.reason) ? (body.reason as RemindersStuckReason) : null;
   if (!reason) return json({ error: 'invalid_reason' }, 400);
   const os: RemindersStuckOs = OSES.includes(body?.os) ? body.os : 'other';
   const failures = Number.isInteger(body?.failures) && body.failures > 0 && body.failures < 1000 ? (body.failures as number) : undefined;

   // Claim today's alert first, so a double report (two tabs, a retry) can't message them twice.
   const now = Date.now();
   const { data: borrower } = await svc
      .from('users')
      .update({ reminders_stuck_alerted_at: new Date(now).toISOString() })
      .eq('id', userId)
      .or(`reminders_stuck_alerted_at.is.null,reminders_stuck_alerted_at.lt."${new Date(now - REMINDERS_REALERT_AFTER_MS).toISOString()}"`)
      .select('id, username, display_name, facebook_name, email, messenger_psid, messenger_verified_at')
      .maybeSingle();
   if (!borrower) return json({ ok: true, skipped: 'already_alerted' });

   let messenger: MessengerOutcome = 'not_connected';
   if (borrower.messenger_verified_at) {
      const found = await findContact(svc, borrower.id, borrower.messenger_psid);
      if (!found) messenger = 'failed';
      else if (!isInsideMessagingWindow(found.contact, now)) messenger = 'window_closed';
      else {
         const text = buildRemindersStuckMessage(reason, os, borrower.facebook_name || borrower.display_name);
         const result = await sendMessengerMessage(found.id, { text });
         messenger = result.ok ? 'sent' : 'failed';
         if (!result.ok) console.error('reminders-stuck: messenger send failed', result.reason);
      }
   }

   const text = buildRemindersStuckAlert(borrower, reason, os, messenger, failures);
   const { data: chatRow } = await svc.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle();
   const kycChatId = (chatRow as { value?: string } | null)?.value;
   if (kycChatId) {
      await sendTelegramMessage(kycChatId, `${text}\n${OPEN_IN_ADMIN_TEXT}: ${adminUserUrl(borrower.id, borrower.username)}`).catch(
         (err: unknown) => console.error('reminders-stuck: telegram send failed', err instanceof Error ? err.message : err)
      );
   }
   await postDiscord(
      { content: `${text}\n${OPEN_IN_ADMIN_TEXT}: <${adminUserUrl(borrower.id, borrower.username)}>` },
      { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }
   );

   return json({ ok: true, messenger });
});
