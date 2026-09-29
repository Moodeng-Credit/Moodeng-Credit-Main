import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { postDiscord } from '../_shared/discord.ts';
import { PAGE_INBOX_URL } from '../_shared/loanAccess.ts';
import { decideAutoMatch, MATCH_WINDOW_MS, type OpenAttempt } from '../_shared/messengerAutoMatch.ts';
import { buildMatchSuggestionCard, messengerStuckKeyboard } from '../_shared/messengerStuckAlert.ts';
import {
   getMessengerContact,
   MESSENGER_PAGE_ID,
   messengerDisplayName,
   SENDPULSE_BOT_ID,
   sendMessengerMessage
} from '../_shared/sendpulse.ts';
import { parseSendPulseEvents, type SendPulseEvent } from '../_shared/sendpulseEvents.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

// SendPulse bot webhooks → a second chance to confirm Facebook when the m.me code got lost.
//
// Set up in SendPulse → the Moodeng Credit bot → Bot settings → Webhooks, events "Bot subscription"
// and "Incoming message", URL:
//   https://<project>.supabase.co/functions/v1/sendpulse-events?secret=<SENDPULSE_EVENTS_SECRET>
// SendPulse can't send a Supabase JWT or custom headers here, so verify_jwt is off in config.toml and
// the secret in the URL is the gate. It's its own secret, not SENDPULSE_VERIFY_SECRET: request URLs
// land in Supabase's logs, and this one must not also unlock sendpulse-messenger-verify.
// Fail-closed: no secret configured → nothing is accepted.
//
// For each subscribe / message FROM a person:
//   1. It carries an MDNG code (typed in any form, or the mdng_code their link set) → hand it to
//      sendpulse-messenger-verify, exactly as the SendPulse flows do. Catches typed codes the
//      keyword trigger missed ("mdng 3d66ad"). Idempotent with the flows: whichever lands first wins.
//   2. No code → compare the Facebook name (read back from SendPulse's API, never trusted from the
//      payload) with borrowers who tapped "Verify via Messenger" in the last 30 minutes
//      (_shared/messengerAutoMatch.ts). One strong match → confirm through the same endpoint and tell
//      the person in Messenger; anything less certain → an "Is this them?" card for the team.
// Always answers 200 so SendPulse doesn't retry; failures are logged.

const EVENTS_SECRET = Deno.env.get('SENDPULSE_EVENTS_SECRET') ?? '';
// Sent on to sendpulse-messenger-verify, like the SendPulse flows do.
const VERIFY_SECRET = Deno.env.get('SENDPULSE_VERIFY_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const MAX_EVENTS = 20;
const MAX_SUGGESTIONS = 3;

const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// deno-lint-ignore no-explicit-any
type Svc = any;

type VerifyResult = { ok?: boolean; already?: boolean; error?: string };

// Same endpoint and secret the SendPulse flows use, so every confirmation follows one set of rules
// (live code, borrowers only, contact id lookup, the team's "Facebook connected" card).
const confirmCode = async (code: string, contactId: string, name: string | null): Promise<VerifyResult> => {
   try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sendpulse-messenger-verify`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'x-sendpulse-secret': VERIFY_SECRET },
         body: JSON.stringify({ code, contact_id: contactId, name })
      });
      return ((await res.json().catch(() => null)) as VerifyResult | null) ?? { ok: false, error: `http_${res.status}` };
   } catch (err) {
      console.error('sendpulse-events: confirm call failed', err instanceof Error ? err.message : err);
      return { ok: false, error: 'network' };
   }
};

const kycChat = async (svc: Svc) => {
   const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle();
   return (data as { value?: string } | null)?.value ?? null;
};

type Borrower = {
   id: string;
   username: string | null;
   display_name: string | null;
   email: string | null;
   user_role: string | null;
   account_status: string | null;
   messenger_verified_at: string | null;
};
type Kyc = { user_id: string; full_name: string | null; first_name: string | null; last_name: string | null };
type OpenCode = { id: string; code: string; user_id: string; created_at: string; suggested_contact_id: string | null };

const matchByName = async (svc: Svc, event: SendPulseEvent, contactId: string) => {
   // Already someone's Messenger line → a known borrower chatting, not a lost confirmation.
   const { data: known } = await svc.from('users').select('id').eq('messenger_psid', contactId).limit(1);
   if (known?.length) return;

   // The name comes from SendPulse's API, so a forged webhook can't pick whose name to match.
   const contact = await getMessengerContact(contactId);
   const facebookName = messengerDisplayName(contact);
   if (!facebookName) return;

   const since = new Date(event.at - MATCH_WINDOW_MS - 5 * 60 * 1000).toISOString();
   const { data: codes } = await svc
      .from('contact_verification_codes')
      .select('id, code, user_id, created_at, suggested_contact_id')
      .eq('channel', 'messenger')
      .is('verified_at', null)
      .gt('created_at', since);
   if (!codes?.length) return;

   const ids = (codes as OpenCode[]).map((c) => c.user_id);
   const [{ data: users }, { data: kycs }] = await Promise.all([
      svc.from('users').select('id, username, display_name, email, user_role, account_status, messenger_verified_at').in('id', ids),
      svc.from('kyc_identities').select('user_id, full_name, first_name, last_name').in('user_id', ids)
   ]);
   const userById = new Map(((users ?? []) as Borrower[]).map((u) => [u.id, u]));
   const kycByUser = new Map<string, Kyc[]>();
   for (const k of (kycs ?? []) as Kyc[]) kycByUser.set(k.user_id, [...(kycByUser.get(k.user_id) ?? []), k]);

   const namesFor = (u: Borrower) =>
      [
         u.display_name,
         ...(kycByUser.get(u.id) ?? []).flatMap((k) => [k.full_name, [k.first_name, k.last_name].filter(Boolean).join(' ')]),
         u.email,
         u.username
      ].filter((n): n is string => Boolean(n && n.trim()));

   const attempts: Array<OpenAttempt & { row: OpenCode; user: Borrower }> = [];
   for (const row of codes as OpenCode[]) {
      const user = userById.get(row.user_id);
      if (!user || user.messenger_verified_at || user.user_role === 'lender') continue;
      if (user.account_status && user.account_status !== 'active') continue;
      attempts.push({ code: row.code, user_id: row.user_id, created_at: row.created_at, names: namesFor(user), row, user });
   }

   const decision = decideAutoMatch(facebookName, event.at, attempts);
   if (decision.kind === 'none') return;

   const chat = await kycChat(svc);

   if (decision.kind === 'auto') {
      const attempt = attempts.find((a) => a.code === decision.attempt.code)!;
      const result = await confirmCode(attempt.code, contactId, facebookName);
      if (!result.ok || result.already) {
         if (!result.ok) console.error('sendpulse-events: auto-match confirm refused', attempt.code, result.error);
         return;
      }
      const note =
         `🤝 Matched by name: Facebook "${facebookName}" ↔ ${attempt.user.display_name || attempt.user.username || 'borrower'}` +
         `${attempt.user.username ? ` (@${attempt.user.username})` : ''}. Their code never reached the bot, but this chat opened ` +
         `right after they tapped Verify, and the names match. If it looks wrong, ask tech to reset their Facebook link.`;
      if (chat) await sendTelegramMessage(chat, note).catch((err: unknown) => console.error('sendpulse-events: telegram note failed', err));
      await postDiscord({ content: note }, { prefer: ['DISCORD_KYC_WEBHOOK_URL'] });
      await sendMessengerMessage(contactId, {
         text: "✅ Thanks! Your Facebook is now connected to Moodeng. Go back to the Moodeng app to continue — it's already updated."
      });
      return;
   }

   // Not sure → park the candidate on the code (the ✅ button then saves this chat too) and ask the team.
   for (const suggested of decision.attempts.slice(0, MAX_SUGGESTIONS)) {
      const attempt = attempts.find((a) => a.code === suggested.code)!;
      if (attempt.row.suggested_contact_id === contactId) continue; // Already asked about this chat.
      await svc
         .from('contact_verification_codes')
         .update({ suggested_contact_id: contactId, suggested_contact_name: facebookName, suggested_at: new Date().toISOString() })
         .eq('id', attempt.row.id)
         .is('verified_at', null);
      const text = buildMatchSuggestionCard(attempt.user, attempt.names.slice(0, 3), facebookName, attempt, event.at);
      if (chat) {
         await sendTelegramMessage(chat, text, {
            inlineKeyboard: messengerStuckKeyboard(attempt.user.id, PAGE_INBOX_URL, "✅ Yes, it's them")
         }).catch((err: unknown) => console.error('sendpulse-events: telegram card failed', err));
      }
      await postDiscord({ content: `${text}\n(Answer on the card in the Telegram KYC group.)` }, { prefer: ['DISCORD_KYC_WEBHOOK_URL'] });
   }
};

serve(async (req) => {
   if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
   if (!EVENTS_SECRET || !SUPABASE_URL || !SERVICE_KEY) {
      console.error('sendpulse-events: not configured (SENDPULSE_EVENTS_SECRET / SUPABASE_URL / service key)');
      return json({ ok: false, error: 'not_configured' }, 503);
   }
   const presented = new URL(req.url).searchParams.get('secret') ?? req.headers.get('x-sendpulse-secret') ?? '';
   if (presented !== EVENTS_SECRET) return json({ ok: false, error: 'unauthorized' }, 401);

   const body = await req.json().catch(() => null);
   const events = parseSendPulseEvents(body).slice(0, MAX_EVENTS);
   const svc = createClient(SUPABASE_URL, SERVICE_KEY);

   for (const event of events) {
      try {
         if (!event.fromPerson || !event.contactId) continue;
         // Our bot, by SendPulse bot id or by our Page id. Logged when skipped, so a SendPulse change in
         // how bots are identified shows up in the logs instead of silently switching this off.
         const ours = (!event.botId && !event.pageId) || event.botId === SENDPULSE_BOT_ID || event.pageId === MESSENGER_PAGE_ID;
         if (!ours) {
            console.warn('sendpulse-events: skipped an event from another bot', event.botId, event.pageId);
            continue;
         }

         if (event.codes.length) {
            for (const code of event.codes) await confirmCode(code, event.contactId, event.contactName);
            continue;
         }
         await matchByName(svc, event, event.contactId);
      } catch (err) {
         console.error('sendpulse-events: event failed', event.title, err instanceof Error ? err.message : err);
      }
   }

   return json({ ok: true, events: events.length });
});
