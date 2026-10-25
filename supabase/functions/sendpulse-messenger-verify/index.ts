import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { personName, stampDecisionCards } from '../_shared/adminCards.ts';
import { postDiscord } from '../_shared/discord.ts';
import { buildFacebookConnectedAlert, type LoanRecord } from '../_shared/facebookConnectedAlert.ts';
import { loadOnboardingTimeline, signupLines, timelineLines } from '../_shared/onboardingTimeline.ts';
import { extractMessengerCodes } from '../_shared/messengerCodes.ts';
import { decideTimingMatch, type TimingAttempt } from '../_shared/messengerTimingMatch.ts';
import { claimContactRows } from '../_shared/messengerContactLog.ts';
import { messengerVerifiedStamp } from '../_shared/messengerStuckAlert.ts';
import { CONNECTED_BY_TIMING_TEXT, continueLinkText, type NotYetReason, notYetReplyText, verificationFollowUpText } from '../_shared/messengerStatusFollowUp.ts';
import {
   findMessengerContactIdByCode,
   getMessengerContact,
   getWhatsAppContact,
   messengerDisplayName,
   normalizeWhatsAppPhone,
   sendMessengerMessage
} from '../_shared/sendpulse.ts';
import { loadBorrowSteps, loadNextStep } from '../_shared/botNextStep.ts';
import { saveBotLocale } from '../_shared/messengerSupport.ts';
import { callTelegramApi, sendTelegramMessage } from '../_shared/telegram.ts';
import { testAccountRow } from '../_shared/testAccount.ts';
import { whatsappContactCard } from '../_shared/whatsappContactCard.ts';

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
      const [{ data: borrower }, { data: loans }, { data: chatRow }, contact, { data: sharing }, onboarding] = await Promise.all([
         svc
            .from('users')
            .select('username, display_name, email, is_didit, is_world_id, didit_id_status, didit_decline_reason, is_test')
            .eq('id', userId)
            .maybeSingle(),
         svc.from('loans').select('funded_at, due_date, repaid_at, is_test').eq('borrower_user_id', userId),
         svc.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle(),
         contactId ? getMessengerContact(contactId) : Promise.resolve(null),
         contactId ? svc.from('users').select('username').eq('messenger_psid', contactId).neq('id', userId) : Promise.resolve({ data: [] }),
         loadOnboardingTimeline(svc, userId)
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
         alsoLinkedTo,
         [...signupLines(onboarding), ...timelineLines(onboarding)]
      );
      const chat = (chatRow as { value?: string } | null)?.value;
      if (chat)
         await sendTelegramMessage(chat, borrower.is_test ? `${text}\n🧪 Test account` : text, borrower.is_test ? {} : { inlineKeyboard: testAccountRow(userId) }).catch((err: unknown) =>
            console.error('sendpulse-messenger-verify: telegram ping failed', err)
         );
      await postDiscord({ content: text }, { prefer: ['DISCORD_KYC_WEBHOOK_URL'] });
   } catch (err) {
      console.error('sendpulse-messenger-verify: announce failed', err instanceof Error ? err.message : err);
   }
};

// WhatsApp connected → a one-line note plus a Telegram contact card in the KYC chat, so George can
// tap "Add to contacts" and see who's messaging instead of a bare number. Best-effort.
const announceWhatsAppContact = async (svc: Svc, userId: string, phone: string | null) => {
   try {
      if (!phone) return;
      const [{ data: borrower }, { data: kyc }, { data: chatRow }] = await Promise.all([
         svc.from('users').select('username, display_name, is_test').eq('id', userId).maybeSingle(),
         svc
            .from('kyc_identities')
            .select('first_name, last_name')
            .eq('user_id', userId)
            .not('first_name', 'is', null)
            .order('fetched_at', { ascending: false })
            .limit(1),
         svc.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle()
      ]);
      const chat = (chatRow as { value?: string } | null)?.value;
      if (!borrower || borrower.is_test || !chat) return;
      const card = whatsappContactCard(phone, {
         kycFirstName: kyc?.[0]?.first_name,
         kycLastName: kyc?.[0]?.last_name,
         displayName: borrower.display_name,
         username: borrower.username
      });
      if (!card) return;
      const who = borrower.username ? ` (@${borrower.username})` : '';
      await sendTelegramMessage(chat, `💬 ${personName(borrower)}${who} connected WhatsApp: ${card.phone_number}\nTap the card → Add to contacts.`);
      await callTelegramApi('sendContact', { chat_id: chat, ...card });
   } catch (err) {
      console.error('sendpulse-messenger-verify: whatsapp contact card failed', err instanceof Error ? err.message : err);
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
      const { data: user } = await svc
         .from('users')
         .select('is_world_id, is_didit, didit_id_status, signup_browser')
         .eq('id', userId)
         .maybeSingle();
      const parts = user ? [verificationFollowUpText(user), continueLinkText(user.signup_browser)].filter(Boolean) : [];
      const text = parts.length ? parts.join('\n\n') : null;
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

// Not confirmed yet (no code, a wrong one, an expired one): tell them what to do, with a link back to
// Moodeng, instead of leaving them stranded in the chat. Sent a few seconds later, and skipped when they
// got connected in the meantime: tapping Continue in a brand-new chat also lets sendpulse-events connect
// them by timing (Android), and they shouldn't read "paste your code" right before "you're connected".
const NOT_YET_DELAY_MS = 8_000;

// No code, but they came in through our button: if exactly one borrower tapped "Open Messenger" in the
// last minute and this Facebook account isn't anyone's Moodeng line yet, they're that borrower, so
// connect them (the same timing rule sendpulse-events uses for brand-new chatters; this one also covers
// people who had messaged the Page before, which SendPulse doesn't report when they tap Continue).
// Confirms through this same endpoint, so every rule and alert of a code confirmation applies.
const connectByTiming = async (svc: Svc, contactId: string, at: number): Promise<boolean> => {
   const { data: linked } = await svc.from('users').select('id').eq('messenger_psid', contactId).limit(1);
   if (linked?.length) return false;
   const { data: rows } = await svc
      .from('contact_verification_codes')
      .select('code, user_id, chat_opened_at, expires_at')
      .eq('channel', 'messenger')
      .is('verified_at', null)
      .gt('chat_opened_at', new Date(at - 2 * 60 * 1000).toISOString());
   const live = ((rows ?? []) as Array<TimingAttempt & { expires_at: string }>).filter((r) => Date.parse(r.expires_at) > Date.now());
   if (!live.length) return false;
   const { data: users } = await svc
      .from('users')
      .select('id, user_role, account_status, messenger_verified_at')
      .in('id', [...new Set(live.map((r) => r.user_id))]);
   const eligible = new Set(
      ((users ?? []) as Array<{ id: string; user_role: string | null; account_status: string | null; messenger_verified_at: string | null }>)
         .filter((u) => !u.messenger_verified_at && u.user_role !== 'lender' && (!u.account_status || u.account_status === 'active'))
         .map((u) => u.id)
   );
   const decision = decideTimingMatch(at, live.filter((r) => eligible.has(r.user_id)));
   if (decision.kind !== 'auto') {
      if (decision.kind === 'ambiguous') console.log(`sendpulse-messenger-verify: no code, ${decision.userIds.length} borrowers tapped together, not guessing`);
      return false;
   }
   const res = await fetch(`${SUPABASE_URL}/functions/v1/sendpulse-messenger-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sendpulse-secret': SECRET },
      body: JSON.stringify({ code: decision.attempt.code, contact_id: contactId, quiet: true })
   });
   const result = ((await res.json().catch(() => null)) as { ok?: boolean; already?: boolean } | null) ?? {};
   const seconds = Math.max(0, Math.round((at - Date.parse(decision.attempt.chat_opened_at)) / 1000));
   console.log(`sendpulse-messenger-verify: no code → matched by timing (${seconds}s after the tap): ${result.ok ? (result.already ? 'already' : 'connected') : 'refused'}`);
   return Boolean(result.ok);
};

const replyNotYet = (svc: Svc, contactId: string | null, reason: NotYetReason) => {
   if (!contactId) {
      console.log(`sendpulse-messenger-verify: ${reason}, no contact id to reply to`);
      return;
   }
   const at = Date.now();
   const reply = (async () => {
      try {
         await new Promise((resolve) => setTimeout(resolve, NOT_YET_DELAY_MS));
         const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
         const { data: connected } = await svc
            .from('users')
            .select('id')
            .eq('messenger_psid', contactId)
            .gte('messenger_verified_at', since)
            .limit(1);
         if (connected?.length) {
            console.log(`sendpulse-messenger-verify: ${reason} reply skipped, connected meanwhile`);
            return;
         }
         if (reason === 'no_code' && (await connectByTiming(svc, contactId, at))) {
            const sent = await sendMessengerMessage(contactId, { text: CONNECTED_BY_TIMING_TEXT });
            console.log(`sendpulse-messenger-verify: connected-by-timing reply → ${sent.ok ? 'sent' : `not sent (${sent.reason})`}`);
            return;
         }
         const result = await sendMessengerMessage(contactId, { text: notYetReplyText(reason) });
         console.log(`sendpulse-messenger-verify: ${reason} reply → ${result.ok ? 'sent' : `not sent (${result.reason})`}`);
      } catch (err) {
         console.error('sendpulse-messenger-verify: not-yet reply failed', err instanceof Error ? err.message : err);
      }
   })();
   if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(reply);
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
   locale?: string;
   // From sendpulse-events re-checking a message the SendPulse flow also handles: no "not yet" reply.
   quiet?: boolean;
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
      const card = announceWhatsAppContact(svc, String(pending.user_id), phone);
      if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(card);
      else await card;
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

   // The bot menu's 🌐 Language buttons (a SendPulse "API request" step copied from the Confirm Facebook
   // flow, so it carries this function's x-sendpulse-secret): {"action":"locale","locale":"fil","psid":"{{contact_id}}"}.
   if (body.action === 'locale') {
      const contactId = body.psid ? String(body.psid).trim() : '';
      const locale = body.locale === 'fil' || body.locale === 'en' ? body.locale : null;
      if (!contactId || !locale) return json({ ok: false, error: 'bad_request' }, 400);
      await saveBotLocale(createClient(SUPABASE_URL, SERVICE_KEY), contactId, locale);
      return json({ ok: true, locale });
   }

   // The bot menu's ✅ How do I verify?: {"action":"next_step","psid":"{{contact_id}}","locale":"{{lang}}"}.
   // Replies with the next step for this person's account (botNextStep.ts). `sent` false → the flow's
   // Error branch shows the general text instead.
   if (body.action === 'next_step') {
      const contactId = body.psid ? String(body.psid).trim() : '';
      if (!contactId) return json({ ok: false, error: 'bad_request' }, 400);
      const flowLocale = body.locale === 'fil' || body.locale === 'en' ? body.locale : null;
      const { stage, locale, reply } = await loadNextStep(createClient(SUPABASE_URL, SERVICE_KEY), contactId, flowLocale);
      const [button, ...moreButtons] = reply.buttons;
      const card = button ? { title: reply.cardTitle, button, moreButtons } : undefined;
      const sent = await sendMessengerMessage(contactId, { text: reply.text, card });
      if (!sent.ok) {
         console.error(`[next_step] send failed for ${contactId} (${stage}): ${sent.reason}`);
         return json({ ok: false, stage, error: sent.reason }, 502);
      }
      return json({ ok: true, stage, locale });
   }

   // The bot menu's 📝 How to borrow: {"action":"how_to_borrow","psid":"{{contact_id}}","locale":"{{lang}}"}.
   // The six steps ticked off for this person, or the step card + sign-up button if they have no account.
   if (body.action === 'how_to_borrow') {
      const contactId = body.psid ? String(body.psid).trim() : '';
      if (!contactId) return json({ ok: false, error: 'bad_request' }, 400);
      const flowLocale = body.locale === 'fil' || body.locale === 'en' ? body.locale : null;
      const { stage, locale, reply } = await loadBorrowSteps(createClient(SUPABASE_URL, SERVICE_KEY), contactId, flowLocale);
      const [button, ...moreButtons] = reply.buttons;
      const card = button ? { title: reply.cardTitle, imageUrl: reply.imageUrl, button, moreButtons } : undefined;
      const sent = await sendMessengerMessage(contactId, { text: reply.text, card });
      if (!sent.ok) {
         console.error(`[how_to_borrow] send failed for ${contactId} (${stage}): ${sent.reason}`);
         return json({ ok: false, stage, error: sent.reason }, 502);
      }
      return json({ ok: true, stage, locale });
   }

   // Accept whichever field SendPulse is configured to send the code in.
   const raw = String(body.code ?? body.ref ?? body.message ?? '').trim();
   const psid = body.psid ? String(body.psid) : null;
   const svc = createClient(SUPABASE_URL, SERVICE_KEY);
   const replyTo = body.quiet ? null : ((body.contact_id ? String(body.contact_id) : null) ?? psid);
   if (!raw) {
      replyNotYet(svc, replyTo, 'no_code');
      return json({ ok: false, error: 'no_code' });
   }

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
         replyNotYet(svc, replyTo, 'expired');
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

   // Opening the confirm link twice sends the code twice. The first request uses it up, so the second
   // used to find nothing and answer "that link didn't work or has expired" right after the success
   // message. A code confirmed in the last few minutes is a repeat, not a failure.
   const recentCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
   for (const cand of codes) {
      const { data: repeat } = await svc
         .from('contact_verification_codes')
         .select('id')
         .eq('code', cand)
         .eq('channel', 'messenger')
         .gte('verified_at', recentCutoff)
         .limit(1);
      if (repeat?.length) return json({ ok: true, already: true });
   }

   // No pending code matched — tell the flow so it can ask the borrower to recheck the code.
   replyNotYet(svc, replyTo, codes.length ? 'no_match' : 'no_code');
   return json({ ok: false, error: 'no_match' });
});
