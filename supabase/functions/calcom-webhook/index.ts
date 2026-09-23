import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { extractBooking, verifySignature, type CalcomWebhookBody } from './parse.ts';

// Cal.com webhook — the server-side "did they actually book it" gate for the no-referral video
// call, replacing the client-asserted mark_video_call_scheduled RPC.
//
// A borrower with no referral code books George or Emma inside an inline Cal.com embed. We pass
// their user id and chosen host through the embed's metadata (moodeng_user_id / moodeng_host);
// Cal.com echoes it back here on BOOKING_CREATED, signed with x-cal-signature-256. We verify the
// signature against the raw body, then set users.video_call_scheduled_at for that borrower — the
// only place it's set now. A BOOKING_CANCELLED/REJECTED for the same booking uid reopens the gate,
// so a canceled call no longer counts as "scheduled." Same source-of-truth pattern as the
// WhatsApp/Messenger webhooks.

const WEBHOOK_SECRET = Deno.env.get('CALCOM_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const SCHEDULED_EVENTS = new Set(['BOOKING_CREATED', 'BOOKING_RESCHEDULED']);
const CANCELLED_EVENTS = new Set(['BOOKING_CANCELLED', 'BOOKING_REJECTED']);

serve(async (req) => {
   if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
   }

   if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('calcom-webhook: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
      // Still 200 — a misconfigured env var is our problem, not something Cal.com should retry on.
      return jsonResponse({ ok: true });
   }

   const rawBody = await req.text();

   const valid = await verifySignature(rawBody, req.headers.get('x-cal-signature-256'), WEBHOOK_SECRET);
   if (!valid) {
      console.error('calcom-webhook: signature verification failed');
      return new Response('Forbidden', { status: 403 });
   }

   let body: CalcomWebhookBody;
   try {
      body = JSON.parse(rawBody);
   } catch {
      return jsonResponse({ ok: true });
   }

   const booking = extractBooking(body);
   if (!booking) {
      return jsonResponse({ ok: true });
   }

   const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

   if (SCHEDULED_EVENTS.has(booking.triggerEvent)) {
      if (!booking.userId) {
         console.error('calcom-webhook: booking with no moodeng_user_id metadata', booking.triggerEvent);
         return jsonResponse({ ok: true });
      }
      const { error } = await supabase
         .from('users')
         .update({
            video_call_scheduled_at: new Date().toISOString(),
            video_call_host: booking.host,
            video_call_starts_at: booking.startsAt,
            video_call_booking_uid: booking.bookingUid
         })
         .eq('id', booking.userId);
      if (error) console.error('calcom-webhook: mark scheduled failed', error);
      return jsonResponse({ ok: true });
   }

   if (CANCELLED_EVENTS.has(booking.triggerEvent)) {
      // Reopen the gate for exactly the booking that was cancelled. Matching on the uid (not just
      // the user) means a stale cancel for a call the borrower already rebooked can't wipe the new
      // one — the uid won't match the row's current video_call_booking_uid.
      if (!booking.bookingUid) {
         return jsonResponse({ ok: true });
      }
      const { error } = await supabase
         .from('users')
         .update({
            video_call_scheduled_at: null,
            video_call_host: null,
            video_call_starts_at: null,
            video_call_booking_uid: null
         })
         .eq('video_call_booking_uid', booking.bookingUid);
      if (error) console.error('calcom-webhook: reopen gate failed', error);
      return jsonResponse({ ok: true });
   }

   return jsonResponse({ ok: true });
});
