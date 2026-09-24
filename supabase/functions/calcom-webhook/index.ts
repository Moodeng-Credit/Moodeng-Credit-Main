import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { ATTENDANCE_RESET, meetingIdFromJoinUrl } from '../_shared/attendance.ts';
import { postDiscord } from '../_shared/discord.ts';
import { BORROWER_COLUMNS, getAdminChatId, notifyBorrower, who } from '../_shared/loanAccess.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';
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
      // Our own booking (calcom-round-robin) already stamped this exact time, and Cal.com then echoes
      // BOOKING_CREATED — possibly late or retried. Only a genuinely new time restarts the reminder
      // ladder and clears the old "I'll be there" / attendance; an echo must not re-send reminders.
      const { data: current } = await supabase
         .from('users')
         .select('video_call_starts_at')
         .eq('id', booking.userId)
         .maybeSingle();
      const currentMs = Date.parse((current as { video_call_starts_at?: string | null } | null)?.video_call_starts_at ?? '');
      const timeMoved = !booking.startsAt || currentMs !== Date.parse(booking.startsAt);
      const { error } = await supabase
         .from('users')
         .update({
            video_call_host: booking.host,
            video_call_starts_at: booking.startsAt,
            video_call_booking_uid: booking.bookingUid,
            ...(timeMoved
               ? {
                    video_call_scheduled_at: new Date().toISOString(),
                    video_call_reminder_stage: 0,
                    video_call_confirmed_at: null,
                    video_call_outcome: null,
                    video_call_outcome_at: null,
                    ...ATTENDANCE_RESET
                 }
               : {}),
            // Keep the join link (and the Zoom meeting id attendance is matched on) in step with the
            // (possibly moved) booking — never a stale one.
            ...(booking.joinUrl ? { video_call_join_url: booking.joinUrl, video_call_meeting_id: meetingIdFromJoinUrl(booking.joinUrl) } : {})
         })
         .eq('id', booking.userId);
      if (error) console.error('calcom-webhook: mark scheduled failed', error);

      // A pending call request stays open until a week after the call — follow the new time.
      if (booking.startsAt) {
         const { error: expiryError } = await supabase
            .from('loan_access_requests')
            .update({ expires_at: new Date(Date.parse(booking.startsAt) + 7 * 86400000).toISOString() })
            .eq('user_id', booking.userId)
            .eq('status', 'pending')
            .eq('kind', 'call');
         if (expiryError) console.error('calcom-webhook: move request expiry failed', expiryError.message);
      }
      return jsonResponse({ ok: true });
   }

   if (CANCELLED_EVENTS.has(booking.triggerEvent)) {
      // Reopen the gate for exactly the booking that was cancelled. Matching on the uid (not just
      // the user) means a stale cancel for a call the borrower already rebooked can't wipe the new
      // one — the uid won't match the row's current video_call_booking_uid.
      if (!booking.bookingUid) {
         return jsonResponse({ ok: true });
      }
      const { data: released, error } = await supabase
         .from('users')
         .update({
            video_call_scheduled_at: null,
            video_call_host: null,
            video_call_starts_at: null,
            video_call_booking_uid: null,
            video_call_join_url: null
         })
         .eq('video_call_booking_uid', booking.bookingUid)
         .select('id');
      if (error) console.error('calcom-webhook: reopen gate failed', error);

      // Connect → Approve → Apply: a borrower whose call was their reach-out would otherwise sit on
      // "See you on the call" with no call and no way to rebook. Close their pending call request,
      // put them back to 'none' (they can book again), and tell them + the admins.
      for (const row of (released ?? []) as Array<{ id: string }>) {
         const { data: closed } = await supabase
            .from('loan_access_requests')
            .update({ status: 'expired', decided_at: new Date().toISOString(), decided_by: 'booking-cancelled' })
            .eq('user_id', row.id)
            .eq('status', 'pending')
            .eq('kind', 'call')
            .select('id');
         if (!closed?.length) continue;
         const { data: borrower } = await supabase
            .from('users')
            .update({ loan_access_status: 'none' })
            .eq('id', row.id)
            .eq('loan_access_status', 'pending')
            .select(BORROWER_COLUMNS)
            .maybeSingle();
         if (!borrower) continue;
         await notifyBorrower(supabase, borrower, 'call_cancelled');
         const text = `🗓️ ${who(borrower)} cancelled their call — their request is closed and they've been asked to rebook.`;
         try {
            const chat = await getAdminChatId(supabase);
            if (chat) await sendTelegramMessage(chat, text);
         } catch (err) {
            console.error('calcom-webhook: admin telegram failed', err instanceof Error ? err.message : err);
         }
         await postDiscord({ content: text }, { prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'] });
      }
      return jsonResponse({ ok: true });
   }

   return jsonResponse({ ok: true });
});
