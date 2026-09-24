import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { markZoomSeen } from '../_shared/attendance.ts';
import { postDiscord } from '../_shared/discord.ts';
import { BORROWER_COLUMNS, type BorrowerRow, getAdminChatId, who } from '../_shared/loanAccess.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';
import { formatCallTimeForTeam } from '../_shared/videoCall.ts';
import { classifyZoomEvent, hmacSha256Hex, pickBooking, verifyZoomSignature } from './lib.ts';

// Zoom → "is the borrower actually here?", so hosts stop sitting in empty rooms.
//
// Each host (George, Emma) adds a small Zoom Marketplace app to their own Zoom account with Event
// Subscriptions pointing at  …/functions/v1/zoom-webhook?host=george  (or ?host=emma), subscribed to
// participant joined / left / joined waiting room / waiting for host / admitted. That app's Secret
// Token goes in ZOOM_WEBHOOK_SECRET_GEORGE / ZOOM_WEBHOOK_SECRET_EMMA.
//
// verify_jwt is OFF (Zoom can't send a Supabase token); every request is checked against the
// host's Secret Token instead (x-zm-signature), and only records attendance — nothing else.
//   * borrower first shows up (waiting room or call) → admins get "🟢 Maria is here — Join".
//   * joined / left times → the "did they show up?" card says "joined 11:02, stayed 14 min".
//   * any signed event → marks that host's Zoom as wired up, which is what allows
//     video-call-reminders to treat "never joined" as a no-show.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const HOSTS = new Set(['george', 'emma']);

const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type BookingRow = BorrowerRow & {
   video_call_host: string | null;
   video_call_starts_at: string | null;
   video_call_timezone: string | null;
   video_call_join_url: string | null;
   video_call_arrived_at: string | null;
   video_call_joined_at: string | null;
};

serve(async (req) => {
   if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
   const host = (new URL(req.url).searchParams.get('host') ?? '').toLowerCase();
   const secret = HOSTS.has(host) ? Deno.env.get(`ZOOM_WEBHOOK_SECRET_${host.toUpperCase()}`) ?? '' : '';
   if (!secret || !SUPABASE_URL || !SERVICE_KEY) return json({ error: 'not_configured' }, 404);

   const raw = await req.text();
   let body: Record<string, unknown>;
   try {
      body = JSON.parse(raw);
   } catch {
      return json({ error: 'bad_json' }, 400);
   }
   const event = classifyZoomEvent(body);

   // Zoom's endpoint check when the app is saved: echo the token, hashed with our secret.
   if (event.kind === 'validation') {
      return json({ plainToken: event.plainToken, encryptedToken: await hmacSha256Hex(secret, event.plainToken) });
   }

   const signed = await verifyZoomSignature(
      secret,
      req.headers.get('x-zm-request-timestamp'),
      raw,
      req.headers.get('x-zm-signature'),
      Date.now()
   );
   if (!signed) return json({ error: 'bad_signature' }, 401);

   const svc = createClient(SUPABASE_URL, SERVICE_KEY);
   await markZoomSeen(svc, host);
   if (event.kind === 'ignore' || event.isHost) return json({ ok: true });

   const atMs = Date.parse(event.at);
   const { data: rows, error } = await svc
      .from('users')
      .select(
         `${BORROWER_COLUMNS}, video_call_host, video_call_timezone, video_call_join_url, video_call_arrived_at, video_call_joined_at`
      )
      .eq('video_call_meeting_id', event.meetingId)
      .gt('video_call_starts_at', new Date(atMs - 4 * 60 * 60 * 1000).toISOString())
      .lt('video_call_starts_at', new Date(atMs + 4 * 60 * 60 * 1000).toISOString());
   if (error) {
      console.error('zoom-webhook: lookup failed', error.message);
      return json({ ok: true });
   }
   const booking = pickBooking((rows ?? []) as BookingRow[], atMs);
   if (!booking) return json({ ok: true, matched: false });

   if (event.kind === 'left') {
      await svc.from('users').update({ video_call_left_at: event.at }).eq('id', booking.id);
      return json({ ok: true });
   }

   // First sighting (waiting room or straight in) — claimed conditionally so Zoom's retries or two
   // near-simultaneous events can't ping the admins twice.
   const { data: firstArrival } = await svc
      .from('users')
      .update({ video_call_arrived_at: event.at })
      .eq('id', booking.id)
      .is('video_call_arrived_at', null)
      .select('id')
      .maybeSingle();
   if (event.kind === 'joined') {
      await svc.from('users').update({ video_call_joined_at: event.at }).eq('id', booking.id).is('video_call_joined_at', null);
   }

   if (firstArrival && booking.video_call_starts_at) {
      const where = event.kind === 'arrived' ? 'is in the waiting room' : 'just joined the call';
      const hostName = booking.video_call_host === 'emma' ? 'Emma' : booking.video_call_host === 'george' ? 'George' : 'Host';
      const text = [
         `🟢 ${who(booking)} ${where} now.`,
         `Call: ${formatCallTimeForTeam(booking.video_call_starts_at, booking.video_call_timezone)}`,
         `${hostName}, you can join now.`
      ].join('\n');
      try {
         const chat = await getAdminChatId(svc);
         if (chat) {
            await sendTelegramMessage(chat, text, {
               inlineKeyboard: booking.video_call_join_url ? [[{ text: '🎥 Join the call', url: booking.video_call_join_url }]] : undefined
            });
         }
      } catch (err) {
         console.error('zoom-webhook: telegram failed', err instanceof Error ? err.message : err);
      }
      // Discord can't carry the button, so the link goes in the text (suppressed preview via <…>).
      await postDiscord(
         { content: booking.video_call_join_url ? `${text}\nJoin: <${booking.video_call_join_url}>` : text },
         { prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'] }
      );
   }

   return json({ ok: true });
});
