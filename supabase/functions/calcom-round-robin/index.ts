import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { postDiscord } from '../_shared/discord.ts';
import { formatCallTimeForTeam, newConfirmToken, sendBookedMessenger } from '../_shared/videoCall.ts';
import { hostsFreeAt, mergeSlots, orderHostsToTry, preferSoonSlots, recheckRange } from './lib.ts';

// Free round-robin booking for the no-referral video call — the paid Cal.com Teams feature, built
// ourselves on the free API. The borrower sees one anonymous "Moodeng team" time list; we read each
// host's open slots, merge them, and when they pick a time we book whichever host is free behind
// the scenes (spread evenly). No host is ever shown, and it's $0.
//
// Two actions (POST JSON): { action: 'slots', timeZone } returns the merged available start times;
// { action: 'book', start, timeZone } books the slot and stamps users.video_call_scheduled_at.
// Optional { host: 'emma' | 'george' } on both pins the call to one host — referred borrowers book
// Emma's exchange-setup call (how to deposit and repay locally) instead of the round-robin.
// verify_jwt is on, so only a signed-in borrower can call it; we take their identity from the JWT,
// never from the body, so nobody can book as someone else. The host Cal.com API keys live only in
// this function's env, never in the client.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const EVENT_SLUG = '15min'; // both hosts' "Video interview" events use this slug
const DAYS_AHEAD = 14;

const HOSTS = [
   { id: 'george', apiKey: Deno.env.get('CALCOM_API_KEY_GEORGE') ?? '' },
   { id: 'emma', apiKey: Deno.env.get('CALCOM_API_KEY_EMMA') ?? '' }
].filter((h) => h.apiKey);

const CAL_BASE = 'https://api.cal.com/v2';

const CORS = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const ymd = (d: Date) => d.toISOString().slice(0, 10);

// Resolve a host's "Video interview" event type id (slug EVENT_SLUG) from their account.
const resolveEventTypeId = async (apiKey: string): Promise<number | null> => {
   const res = await fetch(`${CAL_BASE}/event-types`, { headers: { Authorization: `Bearer ${apiKey}` } });
   if (!res.ok) return null;
   const body = await res.json();
   for (const group of body?.data?.eventTypeGroups ?? []) {
      for (const et of group?.eventTypes ?? []) {
         if (et?.slug === EVENT_SLUG) return et.id as number;
      }
   }
   return null;
};

// Flattened list of available start strings for a host between two YMD dates.
const fetchSlots = async (apiKey: string, eventTypeId: number, start: string, end: string, timeZone: string): Promise<string[]> => {
   const url = `${CAL_BASE}/slots?eventTypeId=${eventTypeId}&start=${start}&end=${end}&timeZone=${encodeURIComponent(timeZone)}`;
   const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}`, 'cal-api-version': '2024-09-04' } });
   if (!res.ok) return [];
   const body = await res.json();
   const days = body?.data ?? {};
   const out: string[] = [];
   for (const list of Object.values(days) as Array<Array<{ start?: string }>>) {
      for (const slot of list) if (slot?.start) out.push(slot.start);
   }
   return out;
};

type Attendee = { name: string; email: string; timeZone: string; language: string };

// Returns the created booking uid, or an error tag. 'taken' means the slot was no longer free.
const createBooking = async (
   apiKey: string,
   eventTypeId: number,
   start: string,
   attendee: Attendee,
   metadata: Record<string, string>
): Promise<{ uid: string; joinUrl: string | null } | { error: 'taken' | 'other' }> => {
   const res = await fetch(`${CAL_BASE}/bookings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'cal-api-version': '2024-08-13', 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, eventTypeId, attendee, metadata })
   });
   const body = await res.json().catch(() => ({}));
   if (res.ok && body?.data?.uid) {
      // The meeting's join link: `location` when it's a URL (Zoom / Cal Video), else the older meetingUrl.
      const location = typeof body.data.location === 'string' && /^https?:\/\//.test(body.data.location) ? body.data.location : null;
      const meetingUrl = typeof body.data.meetingUrl === 'string' && /^https?:\/\//.test(body.data.meetingUrl) ? body.data.meetingUrl : null;
      return { uid: body.data.uid as string, joinUrl: location ?? meetingUrl };
   }
   const msg = String(body?.message ?? body?.error?.message ?? '').toLowerCase();
   return { error: msg.includes('no longer available') || msg.includes('already') || msg.includes('busy') ? 'taken' : 'other' };
};

// Best-effort team alert when a call is booked — on top of the Cal.com calendar invite the hosts
// already get. Posts to Telegram and/or Discord only if their env is set, and never throws into the
// booking flow (a failed ping must not fail the booking).
const notifyTeamBooking = async (
   hostId: string,
   start: string,
   attendee: { name: string; email: string; timeZone: string },
   tgChat: string
) => {
   const text = `📅 New Moodeng call booked\nHost: ${hostId}\nWith: ${attendee.name} (${attendee.email})\nWhen: ${formatCallTimeForTeam(start, attendee.timeZone)}`;

   // tgChat is the admins-only channel (telegram_bot_settings.team_group_chat_id), resolved by the
   // caller — never the lender or support group.
   const tgToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || Deno.env.get('TELEGRAM_API_TOKEN');
   if (tgToken && tgChat) {
      try {
         await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: tgChat, text })
         });
      } catch (err) {
         console.error('calcom-round-robin: telegram booking notify failed', err);
      }
   }

   // Prefers a dedicated bookings channel, falls back to the shared team channel (DISCORD_TEAM_WEBHOOK_URL).
   await postDiscord({ content: text }, { prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'] });
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
   if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
   if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || HOSTS.length === 0) {
      console.error('calcom-round-robin: missing env / no host API keys configured');
      return json({ error: 'not_configured' }, 500);
   }

   // Identity comes from the JWT, never the body.
   const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
   });
   const { data: auth } = await authClient.auth.getUser();
   const user = auth?.user;
   if (!user) return json({ error: 'unauthorized' }, 401);

   let payload: { action?: string; start?: string; timeZone?: string; host?: string };
   try {
      payload = await req.json();
   } catch {
      return json({ error: 'bad_request' }, 400);
   }
   const timeZone = payload.timeZone || 'UTC';

   const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

   // Resolve each host's event type id once per request.
   const resolved: Array<{ id: string; apiKey: string; eventTypeId: number }> = [];
   for (const host of HOSTS) {
      const eid = await resolveEventTypeId(host.apiKey);
      if (eid) resolved.push({ ...host, eventTypeId: eid });
   }
   if (resolved.length === 0) return json({ error: 'no_events' }, 500);

   // Pinned host (e.g. Emma for referred borrowers): only that host's calendar is offered/booked.
   // If that host isn't configured (no API key / event type), fall back to the whole team rather
   // than leave the borrower unable to book at all — and log it so it gets fixed.
   if (payload.host) {
      const pinned = resolved.filter((h) => h.id === payload.host);
      if (pinned.length > 0) resolved.splice(0, resolved.length, ...pinned);
      else console.error(`calcom-round-robin: host '${payload.host}' not configured — falling back to round-robin`);
   }

   if (payload.action === 'slots') {
      // From yesterday's UTC date: Cal.com reads date-only bounds in the borrower's zone, and it
      // never returns past times anyway — so this can't lose "later today" for anyone.
      const start = ymd(new Date(Date.now() - 86400000));
      const end = ymd(new Date(Date.now() + DAYS_AHEAD * 86400000));
      const perHost = await Promise.all(resolved.map((h) => fetchSlots(h.apiKey, h.eventTypeId, start, end, timeZone)));
      return json({ slots: preferSoonSlots(mergeSlots(perHost), Date.now()) });
   }

   if (payload.action === 'book') {
      // Slots arrive with the borrower's offset (…T07:00:00.000+08:00); book and store the instant in
      // UTC so Cal.com, the database and every reminder agree on one unambiguous time.
      const startMs = payload.start ? Date.parse(payload.start) : NaN;
      if (Number.isNaN(startMs)) return json({ error: 'missing_start' }, 400);
      if (startMs <= Date.now()) return json({ ok: false, error: 'slot_taken' });
      const start = new Date(startMs).toISOString();

      // Re-check who's actually free at this instant right now (availability may have moved).
      const range = recheckRange(start);
      const perHostMap: Record<string, string[]> = {};
      await Promise.all(
         resolved.map(async (h) => {
            perHostMap[h.id] = await fetchSlots(h.apiKey, h.eventTypeId, range.from, range.to, timeZone);
         })
      );
      const free = hostsFreeAt(start, perHostMap);
      if (free.length === 0) return json({ ok: false, error: 'slot_taken' });

      const { data: prof } = await svc.from('users').select('email, display_name, username').eq('id', user.id).maybeSingle();
      const email = prof?.email || user.email;
      if (!email) return json({ ok: false, error: 'no_email' });
      const attendee: Attendee = { name: prof?.display_name || prof?.username || 'Moodeng borrower', email, timeZone, language: 'en' };

      // Try the seeded host first, then the other(s) if the first races and loses the slot.
      for (const hostId of orderHostsToTry(free, `${user.id}:${start}`)) {
         const host = resolved.find((h) => h.id === hostId);
         if (!host) continue;
         const result = await createBooking(host.apiKey, host.eventTypeId, start, attendee, {
            moodeng_user_id: user.id,
            moodeng_host: hostId
         });
         if ('uid' in result) {
            // Source of truth: we made the booking, so stamp the gate directly (the signed webhook
            // will also fire and land on the same values).
            const confirmToken = newConfirmToken();
            const { data: booked } = await svc
               .from('users')
               .update({
                  video_call_scheduled_at: new Date().toISOString(),
                  video_call_host: hostId,
                  video_call_starts_at: start,
                  video_call_booking_uid: result.uid,
                  video_call_timezone: timeZone,
                  video_call_join_url: result.joinUrl,
                  // Fresh booking → restart the reminder ladder (see video-call-reminders) and
                  // clear the last call's confirm/attendance.
                  video_call_reminder_stage: 0,
                  video_call_confirm_token: confirmToken,
                  video_call_confirmed_at: null,
                  video_call_outcome: null,
                  video_call_outcome_at: null
               })
               .eq('id', user.id)
               .select(
                  'messenger_psid, video_call_host, video_call_starts_at, video_call_timezone, video_call_join_url, video_call_confirm_token, video_call_confirmed_at'
               )
               .maybeSingle();
            // Messenger confirmation with the "✅ I'll be there" button — best-effort, never blocks.
            if (booked) {
               const sent = await sendBookedMessenger(booked);
               if (!sent.ok) console.log('calcom-round-robin: messenger confirmation skipped:', sent.reason);
            }
            let teamChat = Deno.env.get('TELEGRAM_TEAM_GROUP_CHAT_ID') || '';
            if (!teamChat) {
               const { data: setting } = await svc.from('telegram_bot_settings').select('value').eq('key', 'team_group_chat_id').maybeSingle();
               teamChat = ((setting as { value?: string } | null)?.value) ?? '';
            }
            await notifyTeamBooking(hostId, start, attendee, teamChat);
            return json({ ok: true, host: hostId, start });
         }
         if (result.error !== 'taken') break;
      }
      return json({ ok: false, error: 'slot_taken' });
   }

   return json({ error: 'unknown_action' }, 400);
});
