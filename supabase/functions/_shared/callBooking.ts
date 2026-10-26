// Booking the borrower video call on Cal.com: the merged free times, and booking one. Shared by
// calcom-round-robin (the app's booking page, signed-in borrower) and sendpulse-messenger-verify
// (Indonesia's WhatsApp bot, which books for the person behind a linked WhatsApp contact), so both
// book the same way: same hosts, cooldown, Zoom link, saved call, reminders and team alerts.
// Moved here unchanged from calcom-round-robin/index.ts (2026-10-25).
import { ATTENDANCE_RESET, meetingIdFromJoinUrl } from './attendance.ts';
import { adminUserUrl, OPEN_IN_ADMIN_TEXT } from './adminCards.ts';
import { postDiscord } from './discord.ts';
import { formatCallTimeForTeam, newConfirmToken, sendBookedMessenger } from './videoCall.ts';
import { bookingCooldownUntil, hostsFreeAt, mergeSlots, orderHostsToTry, preferSoonSlots, recheckRange, teamGuests } from '../calcom-round-robin/lib.ts';
import { cancelCalBooking } from './calcomCancel.ts';
import { changeTimeButton } from './callReschedule.ts';
import { testAccountRow } from './testAccount.ts';
import { CAL_BASE, fetchAccountEmail, fetchSlots, resolveEventTypeId } from './calcomSlots.ts';
import { needsPreKycGate } from './preKycGate.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

// What the HTTP handler answers: same bodies and statuses as before the move.
export type CallBookingReply = { status: number; body: Record<string, unknown> };
const reply = (body: Record<string, unknown>, status = 200): CallBookingReply => ({ status, body });

/** The borrower being booked: their id, and their sign-in email (the profile email wins). */
export type CallUser = { id: string; email?: string | null };

const DAYS_AHEAD = 14;

export const HOSTS = [
   { id: 'george', apiKey: Deno.env.get('CALCOM_API_KEY_GEORGE') ?? '' },
   { id: 'emma', apiKey: Deno.env.get('CALCOM_API_KEY_EMMA') ?? '' }
].filter((h) => h.apiKey);


// Whose calendar (open hours + Zoom) every call is booked on unless the request pins another host.
const CALL_HOST = 'emma';

const ymd = (d: Date) => d.toISOString().slice(0, 10);

type Attendee = { name: string; email: string; timeZone: string; language: string };

// Every call should be on Zoom, so ask for it explicitly rather than trusting each host's event
// default (Emma's kept handing out Cal Video links). Cal.com only accepts a location that's on the
// event type, so if a host's event has no Zoom we fall back to their default instead of failing.
const ZOOM_LOCATION = { type: 'integration', integration: 'zoom' };

// Returns the created booking uid, or an error tag. 'taken' means the slot was no longer free.
const createBooking = async (
   apiKey: string,
   eventTypeId: number,
   start: string,
   attendee: Attendee,
   metadata: Record<string, string>,
   guests: string[] = []
): Promise<{ uid: string; joinUrl: string | null } | { error: 'taken' | 'other' }> => {
   for (const location of [ZOOM_LOCATION, null]) {
      const res = await fetch(`${CAL_BASE}/bookings`, {
         method: 'POST',
         headers: { Authorization: `Bearer ${apiKey}`, 'cal-api-version': '2024-08-13', 'Content-Type': 'application/json' },
         body: JSON.stringify({ start, eventTypeId, attendee, metadata, ...(guests.length ? { guests } : {}), ...(location ? { location } : {}) })
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body?.data?.uid) {
         // The meeting's join link: `location` when it's a URL (Zoom / Cal Video), else the older meetingUrl.
         const joinLocation = typeof body.data.location === 'string' && /^https?:\/\//.test(body.data.location) ? body.data.location : null;
         const meetingUrl = typeof body.data.meetingUrl === 'string' && /^https?:\/\//.test(body.data.meetingUrl) ? body.data.meetingUrl : null;
         return { uid: body.data.uid as string, joinUrl: joinLocation ?? meetingUrl };
      }
      const msg = String(body?.message ?? body?.error?.message ?? '').toLowerCase();
      if (msg.includes('no longer available') || msg.includes('already') || msg.includes('busy')) return { error: 'taken' };
      if (location) console.error(`calcom-round-robin: Zoom location refused (${msg || res.status}) — booking with the host's default location`);
   }
   return { error: 'other' };
};

// Best-effort team alert when a call is booked — on top of the Cal.com calendar invite the hosts
// already get. Posts to Telegram and/or Discord only if their env is set, and never throws into the
// booking flow (a failed ping must not fail the booking).
const notifyTeamBooking = async (
   hostId: string,
   start: string,
   attendee: { name: string; email: string; timeZone: string },
   joinUrl: string | null,
   tgChat: string,
   // deno-lint-ignore no-explicit-any
   borrower?: { svc: any; id: string; username?: string | null; isTest?: boolean | null }
) => {
   const text =
      `📅 New Moodeng call booked\nHost: ${hostId}\nWith: ${attendee.name} (${attendee.email})\nWhen: ${formatCallTimeForTeam(start, attendee.timeZone)}` +
      `\nJoin: ${joinUrl ?? 'no link on the booking — check the host’s Cal.com'}` +
      (borrower?.isTest ? '\n🧪 Test account' : '');

   // tgChat is the admins-only channel (telegram_bot_settings.team_group_chat_id), resolved by the
   // caller — never the lender or support group.
   const tgToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || Deno.env.get('TELEGRAM_API_TOKEN');
   if (tgToken && tgChat) {
      try {
         await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // 🔄 Change time: the bot lists the free times and moves the booking (callReschedule.ts).
            // 🧪 Test account?: one tap (+ confirm) marks a team test booking (testAccount.ts).
            body: JSON.stringify({
               chat_id: tgChat,
               text,
               ...(borrower ? { reply_markup: { inline_keyboard: [[changeTimeButton(borrower.id)], ...testAccountRow(borrower.id, borrower.isTest)] } } : {})
            })
         });
      } catch (err) {
         console.error('calcom-round-robin: telegram booking notify failed', err);
      }
   }

   // Prefers a dedicated bookings channel, falls back to the shared team channel (DISCORD_TEAM_WEBHOOK_URL).
   // Remembered under the borrower's loan_access ref: edited to SHOWED UP / NO-SHOW / APPROVED.
   await postDiscord(
      { content: borrower ? `${text}\n${OPEN_IN_ADMIN_TEXT}: <${adminUserUrl(borrower.id, borrower.username)}>` : text },
      {
         prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'],
         ...(borrower ? { ref: { svc: borrower.svc, kind: 'loan_access', refId: borrower.id } } : {})
      }
   );
};


type Resolved = Array<{ id: string; apiKey: string; eventTypeId: number }>;

// Each host's event type, the pinned host, and the no-show cooldown: a reply to send back, or the hosts.
const prepare = async (svc: Svc, user: CallUser, pin?: string | null): Promise<CallBookingReply | { resolved: Resolved }> => {
   // Resolve each host's event type id once per request.
   const resolved: Array<{ id: string; apiKey: string; eventTypeId: number }> = [];
   for (const host of HOSTS) {
      const eid = await resolveEventTypeId(host.apiKey);
      if (eid) resolved.push({ ...host, eventTypeId: eid });
   }
   if (resolved.length === 0) return reply({ error: 'no_events' }, 500);

   // Every call goes on one host's calendar — Emma's by default, whose Cal.com makes the calls on the
   // shared support@ Zoom (George's made Cal Video links) — and the other cofounder is invited as a
   // guest, so whoever's free joins. If that host isn't configured (no API key / event type), fall
   // back to the whole team rather than leave the borrower unable to book — and log it to get fixed.
   const bookingHost = pin || CALL_HOST;
   const pinned = resolved.filter((h) => h.id === bookingHost);
   if (pinned.length > 0) resolved.splice(0, resolved.length, ...pinned);
   else console.error(`calcom-round-robin: host '${bookingHost}' not configured — falling back to round-robin`);

   // Two strikes: repeat no-shows wait a week before they can take another slot from the hosts.
   // Gated flows record a no-show on the access request; the open flow only on the user, so both
   // are counted (public.video_call_no_shows logs every open-flow no-show).
   const [{ data: strikes }, { data: openFlowStrikes }] = await Promise.all([
      svc.from('loan_access_requests').select('decided_at').eq('user_id', user.id).eq('status', 'no_show'),
      svc.from('video_call_no_shows').select('recorded_at').eq('user_id', user.id).eq('active', true).eq('kind', 'no_show')
   ]);
   const cooldownUntil = bookingCooldownUntil(
      [
         ...((strikes ?? []) as Array<{ decided_at: string | null }>).map((r) => r.decided_at),
         ...((openFlowStrikes ?? []) as Array<{ recorded_at: string | null }>).map((r) => r.recorded_at)
      ],
      Date.now()
   );
   if (cooldownUntil) {
      return reply({ ok: false, error: 'cooldown', until: cooldownUntil, slots: [] });
   }

   return { resolved };
};

/** Free call times for this borrower (empty during a no-show cooldown). */
export const listCallSlots = async (svc: Svc, user: CallUser, timeZone: string, pin?: string | null): Promise<CallBookingReply> => {
   const prepared = await prepare(svc, user, pin);
   if ('status' in prepared) return prepared;
   const { resolved } = prepared;
   // From yesterday's UTC date: Cal.com reads date-only bounds in the borrower's zone, and it
   // never returns past times anyway — so this can't lose "later today" for anyone.
   const start = ymd(new Date(Date.now() - 86400000));
   const end = ymd(new Date(Date.now() + DAYS_AHEAD * 86400000));
   const perHost = await Promise.all(resolved.map((h) => fetchSlots(h.apiKey, h.eventTypeId, start, end, timeZone)));
   return reply({ slots: preferSoonSlots(mergeSlots(perHost), Date.now()) });
};

/** Books `startRaw` for this borrower and saves it on their account (see the comments inside). */
export const bookCall = async (svc: Svc, user: CallUser, startRaw: string | null | undefined, timeZone: string, pin?: string | null): Promise<CallBookingReply> => {
   const prepared = await prepare(svc, user, pin);
   if ('status' in prepared) return prepared;
   const { resolved } = prepared;
   // Slots arrive with the borrower's offset (…T07:00:00.000+08:00); book and store the instant in
   // UTC so Cal.com, the database and every reminder agree on one unambiguous time.
   const startMs = startRaw ? Date.parse(startRaw) : NaN;
   if (Number.isNaN(startMs)) return reply({ error: 'missing_start' }, 400);
   if (startMs <= Date.now()) return reply({ ok: false, error: 'slot_taken' });
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
   if (free.length === 0) return reply({ ok: false, error: 'slot_taken' });

   const { data: prof } = await svc
      .from('users')
      .select('email, display_name, username, video_call_booking_uid, video_call_starts_at, video_call_host, video_call_scheduled_at, video_call_outcome, is_test')
      .eq('id', user.id)
      .maybeSingle();
   // One booking per person: a quick double-book is refused, and booking again replaces the old
   // slot (cancelled on Cal.com once the new one is made), so nobody can hold every slot.
   if (prof?.video_call_scheduled_at && Date.now() - Date.parse(prof.video_call_scheduled_at) < 60_000) {
      return reply({ ok: false, error: 'too_fast' });
   }
   const previousBooking =
      prof?.video_call_booking_uid && prof.video_call_starts_at && Date.parse(prof.video_call_starts_at) > Date.now()
         ? { uid: prof.video_call_booking_uid as string, host: (prof.video_call_host as string | null) ?? null }
         : null;
   const email = prof?.email || user.email;
   if (!email) return reply({ ok: false, error: 'no_email' });
   const attendee: Attendee = { name: prof?.display_name || prof?.username || 'Moodeng borrower', email, timeZone, language: 'en' };

   // Every configured host (not just the pinned/free ones), so the other cofounder is always invited.
   const emailsByHost: Record<string, string | null> = {};
   await Promise.all(
      HOSTS.map(async (h) => {
         emailsByHost[h.id] = await fetchAccountEmail(h.apiKey);
      })
   );

   // Try the seeded host first, then the other(s) if the first races and loses the slot.
   for (const hostId of orderHostsToTry(free, `${user.id}:${start}`)) {
      const host = resolved.find((h) => h.id === hostId);
      if (!host) continue;
      const metadata = { moodeng_user_id: user.id, moodeng_host: hostId };
      const guests = teamGuests(hostId, emailsByHost, email);
      let result = await createBooking(host.apiKey, host.eventTypeId, start, attendee, metadata, guests);
      // The guest invite is a nice-to-have: if Cal.com refuses it, book the borrower without it.
      if ('error' in result && result.error === 'other' && guests.length) {
         console.error('calcom-round-robin: booking with team guests failed — retrying without them');
         result = await createBooking(host.apiKey, host.eventTypeId, start, attendee, metadata);
      }
      if ('uid' in result) {
         // Source of truth: we made the booking, so stamp the gate directly (the signed webhook
         // will also fire and land on the same values).
         const confirmToken = newConfirmToken();
         // "Attended" normally sticks (one call is all a borrower needs) — except for someone the
         // pre-KYC gate is holding: they must attend this new call, and a kept 'attended' skipped
         // its reminders, the team's call cards and the admin panel's buttons.
         const keepAttended = prof?.video_call_outcome === 'attended' && !(await needsPreKycGate(svc, user.id));
         const { data: booked } = await svc
            .from('users')
            .update({
               video_call_scheduled_at: new Date().toISOString(),
               video_call_host: hostId,
               video_call_starts_at: start,
               video_call_booking_uid: result.uid,
               video_call_timezone: timeZone,
               video_call_join_url: result.joinUrl,
               // Lets zoom-webhook match "participant joined" events to this booking.
               video_call_meeting_id: meetingIdFromJoinUrl(result.joinUrl),
               ...ATTENDANCE_RESET,
               // Fresh booking → restart the reminder ladder (see video-call-reminders) and
               // clear the last call's confirm/attendance. "Attended" is never cleared: the call
               // is a one-time thing, so a borrower who already showed up keeps that for good.
               video_call_reminder_stage: 0,
               video_call_confirm_token: confirmToken,
               video_call_confirmed_at: null,
               ...(keepAttended ? {} : { video_call_outcome: null, video_call_outcome_at: null })
            })
            .eq('id', user.id)
            .select(
               'messenger_psid, video_call_host, video_call_starts_at, video_call_timezone, video_call_join_url, video_call_confirm_token, video_call_confirmed_at, video_call_booking_uid'
            )
            .maybeSingle();
         // Messenger confirmation with the "✅ I'll be there" button — best-effort, never blocks.
         if (booked) {
            const sent = await sendBookedMessenger(booked);
            if (!sent.ok) console.log('calcom-round-robin: messenger confirmation skipped:', sent.reason);
         }
         // Bookings go to the call-changes ("rearrange meetings") group with their 🔄 Change time
         // button; the team group only until that group is set.
         const { data: callChanges } = await svc.from('telegram_bot_settings').select('value').eq('key', 'call_changes_chat_id').maybeSingle();
         let teamChat = ((callChanges as { value?: string } | null)?.value) || Deno.env.get('TELEGRAM_TEAM_GROUP_CHAT_ID') || '';
         if (!teamChat) {
            const { data: setting } = await svc.from('telegram_bot_settings').select('value').eq('key', 'team_group_chat_id').maybeSingle();
            teamChat = ((setting as { value?: string } | null)?.value) ?? '';
         }
         await notifyTeamBooking(hostId, start, attendee, result.joinUrl, teamChat, { svc, id: user.id, username: prof?.username, isTest: prof?.is_test });
         // Free the slot they had before. Our row already points at the new booking, so the cancel
         // webhook for the old uid matches nothing and sends no "your call was cancelled".
         if (previousBooking && previousBooking.uid !== result.uid) {
            const cancelled = await cancelCalBooking(previousBooking.host, previousBooking.uid, 'Rebooked to a new time.');
            if (!cancelled) console.error(`calcom-round-robin: could not cancel previous booking ${previousBooking.uid}`);
         }
         return reply({ ok: true, host: hostId, start });
      }
      if (result.error !== 'taken') break;
   }
   return reply({ ok: false, error: 'slot_taken' });
};
