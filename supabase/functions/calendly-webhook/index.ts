import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Calendly webhook — the "did they actually book it" gate for the no-referral-code video call.
//
// A borrower with no referral code has to schedule (not complete) a short interview with George
// or Emma before they can post a loan request. We never trust the client's own "I scheduled it"
// tap — nothing stops someone closing the Calendly tab without booking and clicking through
// anyway. The real gate is video_call_scheduled_at, set only here, when Calendly's own
// `invitee.created` event confirms a real booking. Same pattern as the WhatsApp webhook: the
// scheduling link we hand the borrower carries their user id as a `utm_content` tracking param,
// Calendly echoes it back in the webhook payload, and we use it to find the right user — no
// email/name matching, so no chance of crediting the wrong person's booking.
//
// Calendly signs each request with a `Calendly-Webhook-Signature` header shaped
// `t=<unix_ts>,v1=<hex hmac>` — the HMAC is SHA-256 over `${t}.${rawBody}` keyed with the signing
// key Calendly hands back when the subscription is created (POST /webhook_subscriptions).

const SIGNING_KEY = Deno.env.get('CALENDLY_WEBHOOK_SIGNING_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// The one Calendly event type UUID we can identify by URI (George's, from this connected
// account). Emma's account isn't connected here, so anything that isn't George's event type is
// assumed to be hers — there are only ever two links a borrower can be sent to.
const GEORGE_EVENT_TYPE_URI = 'https://api.calendly.com/event_types/GGGFAWQGJFGNNJQP';

type CalendlyInviteePayload = {
   event?: string; // scheduled_event URI
   tracking?: { utm_content?: string | null };
   scheduled_event?: { start_time?: string; event_type?: string };
};

type CalendlyWebhookBody = {
   event: string; // e.g. 'invitee.created'
   payload: CalendlyInviteePayload;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

// Constant-time-ish compare is nice to have but not critical here — this isn't a login check,
// and a timing side-channel on a webhook signature (attacker would need a valid t= and a huge
// number of attempts against our own endpoint) isn't the realistic threat model. Keep it simple.
const verifySignature = async (rawBody: string, header: string | null): Promise<boolean> => {
   if (!SIGNING_KEY || !header) return false;

   const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
   const t = parts.t;
   const v1 = parts.v1;
   if (!t || !v1) return false;

   const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SIGNING_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign'
   ]);
   const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${rawBody}`));
   return toHex(signature) === v1;
};

serve(async (req) => {
   if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
   }

   if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('calendly-webhook: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
      return jsonResponse({ ok: true });
   }

   const rawBody = await req.text();

   const validSignature = await verifySignature(rawBody, req.headers.get('Calendly-Webhook-Signature'));
   if (!validSignature) {
      console.error('calendly-webhook: signature verification failed');
      return new Response('Forbidden', { status: 403 });
   }

   let body: CalendlyWebhookBody;
   try {
      body = JSON.parse(rawBody);
   } catch {
      return jsonResponse({ ok: true });
   }

   if (body.event !== 'invitee.created') {
      // We don't care about invitee.canceled, routing_form_submission.created, etc. — a canceled
      // booking still leaves video_call_scheduled_at set, which is intentional: the point of the
      // gate is "a real human is expecting to talk to you," and a borrower who cancels can always
      // rebook before the call, or we catch a no-show the normal way (the call itself).
      return jsonResponse({ ok: true });
   }

   const userId = body.payload.tracking?.utm_content;
   if (!userId) {
      console.error('calendly-webhook: invitee.created with no utm_content tracking id');
      return jsonResponse({ ok: true });
   }

   const eventTypeUri = body.payload.scheduled_event?.event_type ?? '';
   const host = eventTypeUri === GEORGE_EVENT_TYPE_URI ? 'george' : 'emma';
   const startsAt = body.payload.scheduled_event?.start_time ?? null;

   const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
   const { error } = await supabase
      .from('users')
      .update({ video_call_scheduled_at: new Date().toISOString(), video_call_host: host, video_call_starts_at: startsAt })
      .eq('id', userId);

   if (error) {
      console.error('calendly-webhook: user update failed', error);
   }

   return jsonResponse({ ok: true });
});
