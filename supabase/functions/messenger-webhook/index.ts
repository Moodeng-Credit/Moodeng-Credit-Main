import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { extractVerifications, type MessengerWebhookPayload } from './parse.ts';

// Facebook Messenger webhook — the auto-confirm engine for the "Facebook" option on the
// loan-application contacts step, mirroring whatsapp-webhook.
//
// Flow: the borrower taps m.me/<page>?ref=MDNG-XXXXXX (the code comes from
// public.start_contact_verification('messenger')). Opening that link and starting the thread with
// our Page makes Messenger deliver a referral event here carrying that same ref plus the sender's
// Page-scoped ID (PSID). We match the ref against contact_verification_codes (channel='messenger')
// and, if it's live, flip users.messenger_verified_at and stamp users.messenger_psid with the
// PSID — the id we can actually message them on, never anything the borrower typed. A short reply
// via the Send API closes the loop for the borrower without them switching back to the app.
//
// Note on the proof: unlike wa.me, m.me can't pre-fill message text, so the referral fires when
// the borrower OPENS the thread via our coded link rather than when they type. That's the right
// bar for this step — the goal is "do we have a working line to reach them," and a captured PSID
// is exactly that reachable line.
//
// Two request shapes, same endpoint (standard Meta webhook pattern):
//   GET  — the one-time handshake Meta does when you save the Callback URL. Echo hub.challenge iff
//          hub.verify_token matches our secret.
//   POST — event delivery. We look for a referral ref on the messaging events (it can ride on a
//          bare `referral`, a `postback.referral`, or a `message.referral`) and ignore the rest
//          with a 200 so Meta doesn't retry forever.

const VERIFY_TOKEN = Deno.env.get('MESSENGER_VERIFY_TOKEN') ?? '';
const PAGE_ACCESS_TOKEN = Deno.env.get('MESSENGER_PAGE_ACCESS_TOKEN') ?? '';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const textResponse = (body: string, status = 200) => new Response(body, { status });

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Best-effort confirmation reply via the Send API. Never throws into the caller — a failed reply
// shouldn't turn a successful verification into a 500 that makes Meta redeliver the webhook.
const sendConfirmationReply = async (psid: string) => {
   if (!PAGE_ACCESS_TOKEN) return;
   try {
      await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN)}`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            recipient: { id: psid },
            messaging_type: 'RESPONSE',
            message: {
               text:
                  "Hi, this is Moodeng Credit 👋 Thanks — you're verified here. " +
                  "We'll only message you on Messenger if you ever need help, like withdrawing or extending a loan."
            }
         })
      });
   } catch (err) {
      console.error('messenger-webhook: confirmation reply failed', err);
   }
};

serve(async (req) => {
   const url = new URL(req.url);

   // --- Meta's webhook verification handshake (GET) -------------------------------------------
   if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge') ?? '';

      if (mode === 'subscribe' && VERIFY_TOKEN && token === VERIFY_TOKEN) {
         return textResponse(challenge, 200);
      }
      return textResponse('Forbidden', 403);
   }

   if (req.method !== 'POST') {
      return textResponse('Method Not Allowed', 405);
   }

   if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('messenger-webhook: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
      // Still 200 — a misconfigured env var is our problem, not something Meta should retry on.
      return jsonResponse({ ok: true });
   }

   let payload: MessengerWebhookPayload;
   try {
      payload = await req.json();
   } catch {
      return jsonResponse({ ok: true });
   }

   const verifications = extractVerifications(payload);

   if (verifications.length === 0) {
      return jsonResponse({ ok: true });
   }

   const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

   for (const { code, psid } of verifications) {
      const { data: pending, error: lookupError } = await supabase
         .from('contact_verification_codes')
         .select('id, user_id, expires_at')
         .eq('code', code)
         .eq('channel', 'messenger')
         .is('verified_at', null)
         .maybeSingle();

      if (lookupError) {
         console.error('messenger-webhook: lookup failed', lookupError);
         continue;
      }
      if (!pending) continue; // Unknown or already-consumed code — ignore, not an error.
      if (new Date(pending.expires_at).getTime() < Date.now()) continue; // Expired — needs a fresh code.

      const now = new Date().toISOString();

      const { error: markError } = await supabase
         .from('contact_verification_codes')
         .update({ verified_at: now, sender_psid: psid })
         .eq('id', pending.id);
      if (markError) {
         console.error('messenger-webhook: mark verified failed', markError);
         continue;
      }

      const { error: userError } = await supabase
         .from('users')
         .update({ messenger_psid: psid, messenger_verified_at: now })
         .eq('id', pending.user_id);
      if (userError) {
         console.error('messenger-webhook: user update failed', userError);
      }

      await sendConfirmationReply(psid);
   }

   return jsonResponse({ ok: true });
});
