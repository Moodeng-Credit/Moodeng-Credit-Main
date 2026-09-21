import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// WhatsApp Cloud API webhook — the auto-confirm engine for the loan-application contacts step.
//
// Flow: the borrower taps a wa.me link pre-filled with "Verify my Moodeng account: MDNG-XXXXXX"
// (the code comes from public.start_whatsapp_verification()) and just hits send — no typing, no
// OTP round-trip. Meta delivers that message here. We pull the code out of the text, match it
// against contact_verification_codes, and if it's live (unexpired, unverified) we mark it
// verified and stamp users.whatsapp_number with the *sender's real wa_id* — never something the
// borrower typed, so there's no possibility of a typo'd or someone-else's number ending up on
// file. A short WhatsApp reply closes the loop for the borrower without them switching back to
// the app.
//
// Two request shapes, same endpoint (this is how Meta's Cloud API webhooks always work):
//   GET  — the one-time verification handshake Meta does when you click "Verify and save" on the
//          Callback URL field. Echo back hub.challenge iff hub.verify_token matches our secret.
//   POST — the actual event delivery. We only care about the `messages` field; everything else
//          (statuses, etc.) gets a 200 with no side effect so Meta doesn't retry it forever.

const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '';
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '';
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Matches the code shape start_whatsapp_verification() generates: MDNG-6 uppercase hex chars.
// Case-insensitive and tolerant of the borrower's phone autocapitalizing or a stray space, since
// this only has to match text WE pre-filled and THEY only tapped "send" on — but phones do things.
const CODE_PATTERN = /MDNG[-\s]?([A-Z0-9]{6})/i;

type WhatsAppMessage = {
   from: string; // sender's wa_id, E.164 digits without '+'
   text?: { body?: string };
   type?: string;
};

type WhatsAppWebhookPayload = {
   entry?: Array<{
      changes?: Array<{
         field?: string;
         value?: {
            messages?: WhatsAppMessage[];
         };
      }>;
   }>;
};

const textResponse = (body: string, status = 200) => new Response(body, { status });

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Best-effort confirmation reply. Never throws into the caller — a failed reply shouldn't turn a
// successful verification into a 500 that makes Meta redeliver the whole webhook.
const sendConfirmationReply = async (toWaId: string) => {
   if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return;
   try {
      await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
         method: 'POST',
         headers: {
            Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
         },
         body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: toWaId,
            type: 'text',
            text: {
               body:
                  "Hi, this is Moodeng Credit 👋 We're just confirming this WhatsApp number is yours. " +
                  "You're verified — we'll only message here if you ever need help, like withdrawing or extending a loan."
            }
         })
      });
   } catch (err) {
      console.error('whatsapp-webhook: confirmation reply failed', err);
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
      console.error('whatsapp-webhook: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
      // Still 200 — a misconfigured env var is our problem, not something Meta should retry on.
      return jsonResponse({ ok: true });
   }

   let payload: WhatsAppWebhookPayload;
   try {
      payload = await req.json();
   } catch {
      return jsonResponse({ ok: true });
   }

   const messages =
      payload.entry?.flatMap((entry) => entry.changes?.flatMap((change) => change.value?.messages ?? []) ?? []) ?? [];

   if (messages.length === 0) {
      // Status updates (sent/delivered/read) and other non-message events land here — nothing to
      // do, acknowledge so Meta doesn't retry.
      return jsonResponse({ ok: true });
   }

   const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

   for (const message of messages) {
      const body = message.text?.body ?? '';
      const match = body.match(CODE_PATTERN);
      if (!match) continue;

      const code = `MDNG-${match[1].toUpperCase()}`;
      const senderWaId = message.from;

      const { data: pending, error: lookupError } = await supabase
         .from('contact_verification_codes')
         .select('id, user_id, expires_at')
         .eq('code', code)
         .is('verified_at', null)
         .maybeSingle();

      if (lookupError) {
         console.error('whatsapp-webhook: lookup failed', lookupError);
         continue;
      }
      if (!pending) continue; // Unknown or already-consumed code — ignore, not an error.
      if (new Date(pending.expires_at).getTime() < Date.now()) continue; // Expired — borrower needs a fresh code.

      const now = new Date().toISOString();

      const { error: markError } = await supabase
         .from('contact_verification_codes')
         .update({ verified_at: now, sender_wa_id: senderWaId })
         .eq('id', pending.id);
      if (markError) {
         console.error('whatsapp-webhook: mark verified failed', markError);
         continue;
      }

      const { error: userError } = await supabase
         .from('users')
         .update({ whatsapp_number: senderWaId, whatsapp_verified_at: now })
         .eq('id', pending.user_id);
      if (userError) {
         console.error('whatsapp-webhook: user update failed', userError);
      }

      await sendConfirmationReply(senderWaId);
   }

   return jsonResponse({ ok: true });
});
