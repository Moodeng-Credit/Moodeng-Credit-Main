import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { postDiscord } from '../_shared/discord.ts';
import { buildFacebookConnectedAlert, type LoanRecord } from '../_shared/facebookConnectedAlert.ts';
import { extractMessengerCodes } from '../_shared/messengerCodes.ts';
import { findMessengerContactIdByCode, getMessengerContact, messengerDisplayName } from '../_shared/sendpulse.ts';
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
         svc.from('users').select('username, display_name, email').eq('id', userId).maybeSingle(),
         svc.from('loans').select('funded_at, due_date, repaid_at, is_test').eq('borrower_user_id', userId),
         svc.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle(),
         contactId ? getMessengerContact(contactId) : Promise.resolve(null),
         contactId ? svc.from('users').select('username').eq('messenger_psid', contactId).neq('id', userId) : Promise.resolve({ data: [] })
      ]);
      if (!borrower) return;
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

   let body: { code?: string; ref?: string; message?: string; psid?: string; contact_id?: string; name?: string };
   try {
      body = await req.json();
   } catch {
      return json({ ok: false, error: 'bad_request' }, 400);
   }

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
      const { error: userError } = await svc
         .from('users')
         .update({ messenger_verified_at: nowIso, ...(contactId ? { messenger_psid: contactId } : {}) })
         .eq('id', pending.user_id);
      if (userError) {
         console.error('sendpulse-messenger-verify: user update failed', userError.message);
      } else if (!(before as { messenger_verified_at?: string | null } | null)?.messenger_verified_at) {
         await announceConnected(svc, pending.user_id, contactId, body.name ? String(body.name) : null);
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
   return json({ ok: false, error: 'no_match' });
});
