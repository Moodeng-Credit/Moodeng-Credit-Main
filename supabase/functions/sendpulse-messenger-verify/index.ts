import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { personName, stampDecisionCards } from '../_shared/adminCards.ts';
import { postDiscord } from '../_shared/discord.ts';
import { buildFacebookConnectedAlert, type LoanRecord } from '../_shared/facebookConnectedAlert.ts';
import { extractMessengerCodes } from '../_shared/messengerCodes.ts';
import { claimContactRows } from '../_shared/messengerContactLog.ts';
import { messengerVerifiedStamp } from '../_shared/messengerStuckAlert.ts';
import { verificationFollowUpText } from '../_shared/messengerStatusFollowUp.ts';
import {
   findMessengerContactIdByCode,
   getMessengerContact,
   getWhatsAppContact,
   messengerDisplayName,
   normalizeWhatsAppPhone,
   sendMessengerMessage
} from '../_shared/sendpulse.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

// SendPulse → Moodeng bridge for Facebook Messenger contact verification.
//
// SendPulse is connected to the Moodeng Credit page and rides SendPulse's OWN pre-approved Meta app,
// so public Messenger works with no Meta App Review on our side. A SendPulse chatbot flow captures the
// borrower's one-time code (from the ?ref= on the m.me link, or a code they type) plus their Messenger
// identity, and POSTs it here via the flow's "External Request" step. We match the code against
// contact_verification_codes (channel='messenger') and stamp users.messenger_verified_at + messenger_psid.
//
// Auth: a shared secret in the `x-sendpulse-secret` header (SENDPULSE_VERIFY_SECRET) — SendPulse can't
// present a Supabase JWT, so verify_jwt is off for this function (see config.toml) and this header is
// the gate. Returns { ok } so the SendPulse flow can branch (confirm success/failure to the borrower).

const SECRET = Deno.env.get('SENDPULSE_VERIFY_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sendpulse-secret'
};
const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// SendPulse may send a bare ref ("MDNG-3D66AD") or a typed message ("mdng 3d66ad hi", "verify MDNG-3D66AD").
// extractMessengerCodes only ever yields the exact MDNG-XXXXXX shape, and lookups below use eq — never
// ilike, whose % and _ wildcards let "MDNG-%" confirm whichever code happened to be pending.

// deno-lint-ignore no-explicit-any
type Svc = any;

// First-time connection → the KYC Telegram group + Discord #kyc, with who they are and their
// repayment record. Best-effort: a failed ping must never fail the borrower's verification.
const announceConnected = async (svc: Svc, userId: string, contactId: string | null, flowName: string | null) => {
   try {
      const [{ data: borrower }, { data: loans }, { data: chatRow }, contact, { data: sharing }] = await Promise.all([
         svc
            .from('users')
            .select('username, display_name, email, is_didit, is_world_id, didit_id_status, didit_decline_reason')
            .eq('id', userId)
            .maybeSingle(),
         svc.from('loans').select('funded_at, due_date, repaid_at, is_test').eq('borrower_user_id', userId),
         svc.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle(),
         contactId ? getMessengerContact(contactId) : Promise.resolve(null),
         contactId ? svc.from('users').select('username').eq('messenger_psid', contactId).neq('id', userId) : Promise.resolve({ data: [] })
      ]);
      if (!borrower) return;
      // Any "Facebook not confirmed" / "Is this them?" card about them is resolved now.
      await stampDecisionCards(
         svc,
         'messenger',
         userId,
         messengerVerifiedStamp(personName(borrower), 'auto (their code reached the bot)', messengerDisplayName(contact) ?? flowName)
      );
      const alsoLinkedTo = ((sharing ?? []) as Array<{ username: string | null }>).map((u) =>
         u.username ? `@${u.username}` : 'another account'
      );
      const text = buildFacebookConnectedAlert(
         borrower,
         messengerDisplayName(contact) ?? flowName,
         (loans ?? []) as LoanRecord[],
         Date.now(),
         alsoLinkedTo
      );
      const chat = (chatRow as { value?: string } | null)?.value;
      if (chat)
         await sendTelegramMessage(chat, text).catch((err: unknown) =>
            console.error('sendpulse-messenger-verify: telegram ping failed', err)
         );
      await postDiscord({ content: text }, { prefer: ['DISCORD_KYC_WEBHOOK_URL'] });
   } catch (err) {
      console.error('sendpulse-messenger-verify: announce failed', err instanceof Error ? err.message : err);
   }
};

// Supabase's edge runtime keeps a function alive for work registered here after the response is sent.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const FOLLOW_UP_DELAY_MS = 5_000;

// The SendPulse flow answers "✅ Your Facebook is confirmed! Head back to the Moodeng app" itself,
// after this function returns. That's all a borrower heard, even when their ID review had already
// been approved (kryshia, 2026-10-01: approved 14:39, connected Facebook 14:57, never told on
// Messenger). So once the first connection lands, follow up with where their verification stands.
// Sent a few seconds later, so it reads after the flow's own confirmation; they've just messaged
// the Page, so Meta's 24h window is open. Nothing is sent when there's nothing to add.
const followUpWithStatus = async (svc: Svc, userId: string, contactId: string | null) => {
   try {
      if (!contactId) return;
      await new Promise((resolve) => setTimeout(resolve, FOLLOW_UP_DELAY_MS));
      const { data: user } = await svc.from('users').select('is_world_id, is_didit, didit_id_status').eq('id', userId).maybeSingle();
      const text = user ? verificationFollowUpText(user) : null;
      if (!text) {
         console.log(`sendpulse-messenger-verify: no status follow-up for ${userId.slice(0, 8)} (not verified or in review)`);
         return;
      }
      const result = await sendMessengerMessage(contactId, { text });
      console.log(
         `sendpulse-messenger-verify: status follow-up for ${userId.slice(0, 8)} → ${result.ok ? 'sent' : `not sent (${result.reason})`}`
      );
   } catch (err) {
      console.error('sendpulse-messenger-verify: status follow-up failed', err instanceof Error ? err.message : err);
   }
};

// WhatsApp reminders opt-in (channel 'whatsapp'). Same idea as Messenger, on the WhatsApp bot: the
// borrower sends "Verify my Moodeng account: MDNG-XXXXXX" (pre-filled by the app's wa.me link, or the
// code they copied) to our business number, and SendPulse's "Confirm WhatsApp" flow (keyword MDNG)
// posts {"channel":"whatsapp","message":"{{last_message}}","contact_id":"{{contact_id}}","phone":"{{phone}}"}.
// A "STOP" flow posts {"channel":"whatsapp","action":"opt_out","contact_id":"{{contact_id}}"}.
// The number on file comes from SendPulse's contact when it has one; the flow's {{phone}} is the
// fallback (this endpoint is behind the shared secret either way).
type VerifyBody = {
   code?: string;
   ref?: string;
   message?: string;
   psid?: string;
   contact_id?: string;
   name?: string;
   channel?: string;
   action?: string;
   phone?: string;
};

const handleWhatsApp = async (svc: Svc, body: VerifyBody, nowIso: string): Promise<Response> => {
   const contactId = body.contact_id ? String(body.contact_id) : null;
   if (!contactId) return json({ ok: false, error: 'no_contact' });

   if (body.action === 'opt_out') {
      const { error } = await svc.from('users').update({ notif_whatsapp: false }).eq('whatsapp_contact_id', contactId);
      if (error) console.error('sendpulse-messenger-verify: whatsapp opt-out failed', error.message);
      return json({ ok: !error });
   }

   const raw = String(body.code ?? body.ref ?? body.message ?? '').trim();
   if (!raw) return json({ ok: false, error: 'no_code' });

   for (const cand of extractMessengerCodes(raw)) {
      const { data, error } = await svc
         .from('contact_verification_codes')
         .select('id, user_id, expires_at')
         .eq('code', cand)
         .eq('channel', 'whatsapp')
         .is('verified_at', null)
         .limit(1);
      if (error) {
         console.error('sendpulse-messenger-verify: whatsapp lookup failed', error.message);
         continue;
      }
      const pending = data?.[0];
      if (!pending) continue;
      if (new Date(pending.expires_at).getTime() < Date.now()) return json({ ok: false, error: 'expired' });

      const contact = await getWhatsAppContact(contactId);
      const phone = normalizeWhatsAppPhone(contact?.channel_data?.phone) ?? normalizeWhatsAppPhone(body.phone);

      const { data: claimed, error: codeError } = await svc
         .from('contact_verification_codes')
         .update({ verified_at: nowIso, ...(phone ? { sender_wa_id: phone } : {}) })
         .eq('id', pending.id)
         .is('verified_at', null)
         .select('id')
         .maybeSingle();
      if (codeError) {
         console.error('sendpulse-messenger-verify: whatsapp mark code failed', codeError.message);
         return json({ ok: false, error: 'update_failed' }, 500);
      }
      if (!claimed) return json({ ok: true, already: true });

      const { error: userError } = await svc
         .from('users')
         .update({
            whatsapp_verified_at: nowIso,
            whatsapp_contact_id: contactId,
            notif_whatsapp: true,
            ...(phone ? { whatsapp_number: phone } : {})
         })
         .eq('id', pending.user_id);
      if (userError) {
         console.error('sendpulse-messenger-verify: whatsapp user update failed', userError.message);
         return json({ ok: false, error: 'update_failed' }, 500);
      }
      console.log(`sendpulse-messenger-verify: WhatsApp reminders on for ${String(pending.user_id).slice(0, 8)}${phone ? '' : ' (no phone from SendPulse)'}`);
      return json({ ok: true });
   }

   // Sent twice (the pre-filled message, then the copied code): a code confirmed in the last few
   // minutes is a repeat, not a failure.
   const recentCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
   for (const cand of extractMessengerCodes(raw)) {
      const { data: repeat } = await svc
         .from('contact_verification_codes')
         .select('id')
         .eq('code', cand)
         .eq('channel', 'whatsapp')
         .gte('verified_at', recentCutoff)
         .limit(1);
      if (repeat?.length) return json({ ok: true, already: true });
   }
   return json({ ok: false, error: 'no_match' });
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
   if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

   // Shared-secret gate. Fail-closed once the secret is set; if it isn't configured yet, allow (so a
   // deploy-before-secret doesn't 401 every call) but log loudly.
   if (SECRET) {
      if (req.headers.get('x-sendpulse-secret') !== SECRET) return json({ ok: false, error: 'unauthorized' }, 401);
   } else {
      console.warn('sendpulse-messenger-verify: SENDPULSE_VERIFY_SECRET not set — accepting unauthenticated calls');
   }

   if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('sendpulse-messenger-verify: missing SUPABASE_URL / service key');
      return json({ ok: false, error: 'not_configured' }, 500);
   }

   let body: VerifyBody;
   try {
      body = await req.json();
   } catch {
      return json({ ok: false, error: 'bad_request' }, 400);
   }

   if (body.channel === 'whatsapp') return await handleWhatsApp(createClient(SUPABASE_URL, SERVICE_KEY), body, new Date().toISOString());

   // Accept whichever field SendPulse is configured to send the code in.
   const raw = String(body.code ?? body.ref ?? body.message ?? '').trim();
   const psid = body.psid ? String(body.psid) : null;
   if (!raw) return json({ ok: false, error: 'no_code' });

   const svc = createClient(SUPABASE_URL, SERVICE_KEY);
   const nowIso = new Date().toISOString();

   const codes = extractMessengerCodes(raw);
   for (const cand of codes) {
      const { data, error } = await svc
         .from('contact_verification_codes')
         .select('id, code, user_id, expires_at, verified_at')
         .eq('code', cand)
         .eq('channel', 'messenger')
         .is('verified_at', null)
         .limit(1);
      if (error) {
         console.error('sendpulse-messenger-verify: lookup failed', error.message);
         continue;
      }
      const pending = data?.[0];
      if (!pending) continue;

      if (new Date(pending.expires_at).getTime() < Date.now()) {
         return json({ ok: false, error: 'expired' });
      }

      // Borrowers only. Codes are minted inside the loan-application flow already; this is the
      // second net. We reject accounts explicitly marked 'lender' rather than requiring 'borrower',
      // because some real borrowers still have a NULL user_role. The code is NOT consumed on a
      // rejection, so nothing is lost if a role is later corrected.
      const { data: owner } = await svc.from('users').select('user_role').eq('id', pending.user_id).maybeSingle();
      if ((owner as { user_role?: string | null } | null)?.user_role === 'lender') {
         return json({ ok: false, error: 'not_borrower' });
      }

      // Store the SendPulse contact id (what the send API needs for reminders), looked up by the code
      // the flow saved on the contact; fall back to whatever id the flow's request carried.
      const contactId = (await findMessengerContactIdByCode(pending.code)) ?? (body.contact_id ? String(body.contact_id) : null) ?? psid;

      // Claim the code atomically: the SendPulse flow and sendpulse-events can confirm the same code
      // at the same moment, and only one of them should stamp it and announce it.
      const { data: claimed, error: codeError } = await svc
         .from('contact_verification_codes')
         .update({ verified_at: nowIso, sender_psid: contactId })
         .eq('id', pending.id)
         .is('verified_at', null)
         .select('id')
         .maybeSingle();
      if (codeError) {
         console.error('sendpulse-messenger-verify: mark code failed', codeError.message);
         return json({ ok: false, error: 'update_failed' }, 500);
      }
      if (!claimed) return json({ ok: true, already: true });

      const { data: before } = await svc.from('users').select('messenger_verified_at').eq('id', pending.user_id).maybeSingle();
      // Their Facebook name, from SendPulse's API (the flow's {{full_name}} is only a fallback).
      const facebookName =
         (contactId ? messengerDisplayName(await getMessengerContact(contactId)) : null) ??
         (body.name ? String(body.name).trim() || null : null);
      const { error: userError } = await svc
         .from('users')
         .update({
            messenger_verified_at: nowIso,
            ...(contactId ? { messenger_psid: contactId } : {}),
            ...(facebookName ? { facebook_name: facebookName } : {})
         })
         .eq('id', pending.user_id);
      if (contactId) await claimContactRows(svc, pending.user_id, contactId);
      if (userError) {
         console.error('sendpulse-messenger-verify: user update failed', userError.message);
      } else if (!(before as { messenger_verified_at?: string | null } | null)?.messenger_verified_at) {
         await announceConnected(svc, pending.user_id, contactId, body.name ? String(body.name) : null);
         const followUp = followUpWithStatus(svc, pending.user_id, contactId);
         if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(followUp);
      }

      return json({ ok: true });
   }

   // Opening the confirm link again sends the same code again. The first request used it up, so a repeat
   // finds nothing pending. That is not a failure: the borrower is already confirmed, so say so. This
   // used to be limited to 10 minutes, after which a borrower who re-tapped their old link (or "Open
   // Messenger again") heard "that link didn't work or has expired" even though they were verified
   // (iPhone test, 2026-10-16, 23:10 Bangkok: code verified 22:12, re-followed an hour later).
   // Nothing is changed here, so a code confirmed at any time is safe to answer ok.
   for (const cand of codes) {
      const { data: repeat } = await svc
         .from('contact_verification_codes')
         .select('id')
         .eq('code', cand)
         .eq('channel', 'messenger')
         .not('verified_at', 'is', null)
         .limit(1);
      if (repeat?.length) return json({ ok: true, already: true });
   }

   // No pending code matched — tell the flow so it can ask the borrower to recheck the code.
   return json({ ok: false, error: 'no_match' });
});
