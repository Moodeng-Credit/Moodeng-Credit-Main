import { adminUserUrl, OPEN_IN_ADMIN_TEXT } from './adminCards.ts';
import { postDiscord } from './discord.ts';
import { isInternalRequest } from './internalAuth.ts';
import {
   buildRemindersHealthAlert,
   buildRemindersStuckAlert,
   buildRemindersStuckMessage,
   type MessengerOutcome,
   parseRemindersStuckFailure,
   REMINDERS_REALERT_AFTER_MS,
   REMINDERS_STUCK_REASONS,
   type RemindersStuckOs,
   type RemindersStuckReason,
   shouldAlertRemindersHealth
} from './remindersStuck.ts';
import { findMessengerContactIdByCode, getMessengerContact, isInsideMessagingWindow, sendMessengerMessage } from './sendpulse.ts';
import { sendTelegramMessage } from './telegram.ts';

// Served by messenger-stuck-alerts for any request whose body has `reminders: true` (the project is
// at Supabase's edge-function limit, so this lives inside an existing function instead of its own).
//
// Called by the onboarding Facebook step (ContactsStep) when a borrower's reminders can't turn on:
// { reason: 'failed' | 'blocked' | 'in_app', os, failures? }.
//   1. The bot messages them on Messenger how to fix it in Chrome/Safari (they just connected, so
//      Messenger's 24h window is open).
//   2. The team gets a line in the KYC Telegram group and Discord #kyc.
// Also { mode: 'daily_check' } from pg_cron (internal secret only): alerts the team when borrowers
// reached the reminders card in the last 24h but no phone signed up for reminders.
// Wording lives in _shared/remindersStuck.ts. users.reminders_stuck_alerted_at keeps it to once per
// borrower per day. verify_jwt stays on: the caller is the signed-in borrower, and only ever about
// themselves.

export const REMINDERS_CORS = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...REMINDERS_CORS, 'Content-Type': 'application/json' } });

const OSES: readonly RemindersStuckOs[] = ['android', 'ios', 'other'];

// deno-lint-ignore no-explicit-any
type Svc = any;

const sendTeamAlert = async (svc: Svc, text: string, userLink?: { text: string; url: string }) => {
   const { data: chatRow } = await svc.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle();
   const kycChatId = (chatRow as { value?: string } | null)?.value;
   if (kycChatId) {
      await sendTelegramMessage(kycChatId, userLink ? `${text}\n${userLink.text}: ${userLink.url}` : text).catch((err: unknown) =>
         console.error('reminders: telegram send failed', err instanceof Error ? err.message : err)
      );
   }
   await postDiscord(
      { content: userLink ? `${text}\n${userLink.text}: <${userLink.url}>` : text },
      { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }
   );
};

// Daily (pg_cron): borrowers reached the reminders card but no phone signed up → tell the team.
const runDailyCheck = async (svc: Svc) => {
   const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
   const count = async (table: string, column: string) => {
      const { count: n, error } = await svc.from(table).select('id', { count: 'exact', head: true }).gte(column, since);
      if (error) throw new Error(`${table}: ${error.message}`);
      return n ?? 0;
   };
   const reached = await count('users', 'messenger_verified_at');
   const subscribed = await count('push_subscriptions', 'created_at');
   const stuck = await count('users', 'reminders_stuck_alerted_at');
   const alerted = shouldAlertRemindersHealth(reached, subscribed);
   if (alerted) await sendTeamAlert(svc, buildRemindersHealthAlert({ reached, subscribed, stuck }));
   return { reached, subscribed, stuck, alerted };
};

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

// deno-lint-ignore no-explicit-any
export const handleRemindersStuck = async (req: Request, body: any, svc: Svc): Promise<Response> => {
   if (body?.mode === 'daily_check') {
      if (!(await isInternalRequest(svc, req))) return json({ error: 'unauthorized' }, 401);
      try {
         return json({ ok: true, ...(await runDailyCheck(svc)) });
      } catch (err) {
         console.error('reminders: daily check failed', err instanceof Error ? err.message : err);
         return json({ error: 'daily_check_failed' }, 500);
      }
   }

   const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
   const { data: auth } = token ? await svc.auth.getUser(token) : { data: null };
   const userId = auth?.user?.id;
   if (!userId) return json({ error: 'unauthorized' }, 401);

   const reason = REMINDERS_STUCK_REASONS.includes(body?.reason) ? (body.reason as RemindersStuckReason) : null;
   if (!reason) return json({ error: 'invalid_reason' }, 400);
   const os: RemindersStuckOs = OSES.includes(body?.os) ? body.os : 'other';
   const failure = reason === 'failed' ? parseRemindersStuckFailure(body?.failure) : null;
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
         if (!result.ok) console.error('reminders: messenger send failed', result.reason);
      }
   }

   const text = buildRemindersStuckAlert(borrower, reason, os, messenger, failures, failure);
   await sendTeamAlert(svc, text, { text: OPEN_IN_ADMIN_TEXT, url: adminUserUrl(borrower.id, borrower.username) });

   return json({ ok: true, messenger });
};
