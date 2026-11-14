// Booking the borrower video call on Cal.com: the merged free times, and booking one. Shared by
// calcom-round-robin (the app's booking page, signed-in borrower) and sendpulse-messenger-verify
// (Indonesia's WhatsApp bot, which books for the person behind a linked WhatsApp contact), so both
// book the same way: same hosts, cooldown, Zoom link, saved call, reminders and team alerts.
// Moved here unchanged from calcom-round-robin/index.ts (2026-10-25).
import { ATTENDANCE_RESET, meetingIdFromJoinUrl } from './attendance.ts';
import { adminUserUrl, OPEN_IN_ADMIN_TEXT } from './adminCards.ts';
import { postDiscord } from './discord.ts';
import { bookingBotAnswers, loadBookingBotMode } from './bookingBotSwitch.ts';
import { formatCallTimeForTeam, newConfirmToken, sendBookedMessenger, sendTextReminderAsk } from './videoCall.ts';
import {
   bookingCooldownUntil,
   clusterSlots,
   dayIsFull,
   dropBusySlots,
   dropMorningAfterLateNight,
   hostsFreeAt,
   isGoodCallTime,
   mergeSlots,
   orderHostsToTry,
   preferHost,
   PREFERRED_HOST,
   preferSoonSlots,
   recheckRange,
   teamGuests,
   zoomFallbackWarning,
   isZoomJoinUrl,
   zoomPaused
} from '../calcom-round-robin/lib.ts';
import { cancelCalBooking } from './calcomCancel.ts';
import { callInboxFor, isPlaceholderEmail } from './placeholderEmail.ts';
import { changeTimeButton } from './callReschedule.ts';
import { testAccountRow } from './testAccount.ts';
import { loadIdStatus, sendIdTelegram } from './idTrack.ts';
import { CAL_BASE, CALL_MINUTES, fetchAccountEmail, fetchSlots, resolveEventTypeId } from './calcomSlots.ts';
import { fetchGeorgeBusy } from './googleBusy.ts';
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
      zoomFallbackWarning(joinUrl, hostId) +
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


// Start times of everyone else's booked calls between `from` and `to` (test accounts and the
// borrower's own booking left out — a rebook replaces theirs). Feeds the daily cap and clustering;
// never sent to the borrower.
const bookedCallStarts = async (svc: Svc, userId: string, from: string, to: string): Promise<string[]> => {
   const { data, error } = await svc
      .from('users')
      .select('video_call_starts_at')
      .not('video_call_booking_uid', 'is', null)
      .gte('video_call_starts_at', from)
      .lt('video_call_starts_at', to)
      .or('is_test.is.null,is_test.eq.false')
      .neq('id', userId);
   if (error) console.error('calcom-round-robin: could not read booked calls', error.message);
   return ((data ?? []) as Array<{ video_call_starts_at: string | null }>).map((r) => r.video_call_starts_at).filter((s): s is string => Boolean(s));
};

// The "You're booked" message offers the Messenger bot's questions ("type QUESTIONS") to people the bot
// answers who haven't answered them in the last 30 days (a bot booking already has). Best-effort: false on error.
// Text reminders are on, we could text them (they book in Manila time) and we have no number yet.
const wantsTextReminderAsk = async (svc: Svc, userId: string): Promise<boolean> => {
   try {
      const { data } = await svc.rpc('call_sms_status', { p_user: userId });
      const s = (data ?? {}) as { enabled?: boolean; eligible?: boolean; number?: string | null };
      return s.enabled === true && s.eligible === true && !s.number;
   } catch {
      return false;
   }
};

const offerBotQuestions = async (svc: Svc, userId: string): Promise<boolean> => {
   try {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [mode, { data: u }, { data: done }] = await Promise.all([
         loadBookingBotMode(svc),
         svc.from('users').select('is_test').eq('id', userId).maybeSingle(),
         svc.from('booking_bot_answers').select('id').eq('user_id', userId).in('kind', ['answers', 'held_off']).gte('created_at', since).limit(1)
      ]);
      return bookingBotAnswers(mode, (u as { is_test?: boolean | null } | null)?.is_test) && !(done ?? []).length;
   } catch {
      return false;
   }
};

type Resolved = Array<{ id: string; apiKey: string; eventTypeId: number }>;

// No Cal Video (George, 2026-11-14): hosts whose last booking came back without a Zoom link are left out
// for a while (lib.ts zoomPaused). Both cofounders' Cal.com on the one support@ Zoom login knock each
// other's connection out — each needs their own Zoom login.
const zoomKey = (hostId: string) => `zoom_broken_${hostId}`;
const zoomPausedHosts = async (svc: Svc): Promise<Set<string>> => {
   const { data, error } = await svc.from('telegram_bot_settings').select('key, value').in('key', HOSTS.map((h) => zoomKey(h.id)));
   if (error) console.error('calcom-round-robin: could not read Zoom pauses', error.message);
   const now = Date.now();
   return new Set(
      ((data ?? []) as Array<{ key: string; value: string | null }>)
         .filter((r) => zoomPaused(r.value, now))
         .map((r) => r.key.replace(/^zoom_broken_/, ''))
   );
};
const pauseHostZoom = async (svc: Svc, hostId: string, joinUrl: string | null) => {
   const { error } = await svc.from('telegram_bot_settings').upsert({ key: zoomKey(hostId), value: new Date().toISOString() }, { onConflict: 'key' });
   if (error) console.error('calcom-round-robin: could not save Zoom pause', error.message);
   const name = hostId === 'george' ? 'George' : 'Emma';
   const text =
      `⚠️ ${name}'s Zoom is disconnected in Cal.com — a booking came back ${joinUrl ? 'on Cal Video' : 'with no link'}, so it was cancelled and the borrower moved to a Zoom host (or asked to pick another time).\n` +
      `${name}'s times are hidden for 3 hours, then tried again automatically.\n` +
      `Fix: ${name}'s Cal.com → Settings → Apps → Zoom → reconnect with ${name}'s OWN Zoom login. Both Cal.coms on the shared support@ Zoom is why it keeps dropping.`;
   const tgToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || Deno.env.get('TELEGRAM_API_TOKEN');
   const { data: setting } = await svc.from('telegram_bot_settings').select('value').eq('key', 'team_group_chat_id').maybeSingle();
   const chat = Deno.env.get('TELEGRAM_TEAM_GROUP_CHAT_ID') || ((setting as { value?: string } | null)?.value ?? '');
   if (tgToken && chat) {
      try {
         await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chat, text })
         });
      } catch (err) {
         console.error('calcom-round-robin: Zoom alert failed', err);
      }
   }
   await postDiscord({ content: text }, { prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'] });
};

const eitherHostOn = async (svc: Svc): Promise<boolean> => {
   const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', 'calls_either_host').maybeSingle();
   return String((data as { value?: unknown } | null)?.value ?? '').toLowerCase() === 'true';
};

// Each host's event type, the pinned host, and the no-show cooldown: a reply to send back, or the hosts.
const prepare = async (svc: Svc, user: CallUser, pin?: string | null): Promise<CallBookingReply | { resolved: Resolved }> => {
   // Rejected is final (George, 2026-11-11): no times, no booking, on any channel — the app, the
   // Messenger bot and WhatsApp all come through here. An admin's /reopen lets them back in.
   const { data: access } = await svc.from('users').select('loan_access_status').eq('id', user.id).maybeSingle();
   if ((access as { loan_access_status?: string | null } | null)?.loan_access_status === 'rejected') {
      return reply({ ok: false, error: 'rejected', slots: [] });
   }

   // Resolve each host's event type id once per request.
   const resolved: Array<{ id: string; apiKey: string; eventTypeId: number }> = [];
   for (const host of HOSTS) {
      const eid = await resolveEventTypeId(host.apiKey);
      if (eid) resolved.push({ ...host, eventTypeId: eid });
   }
   if (resolved.length === 0) return reply({ error: 'no_events' }, 500);

   // Either cofounder (George, 2026-10-29): a time is offered when Emma OR George is free in their
   // own Cal.com (each copied nightly from their Calendly), and booked on Emma's when both are
   // (preferHost). The other cofounder is still invited as a guest. A request can pin one host.
   // Until telegram_bot_settings `calls_either_host` is 'true' (George's Cal.com needs Zoom first,
   // or his calls get Cal Video links), every call stays on Emma's calendar as before.
   if (!pin && !(await eitherHostOn(svc))) pin = 'emma';
   if (pin) {
      const pinned = resolved.filter((h) => h.id === pin);
      if (pinned.length > 0) resolved.splice(0, resolved.length, ...pinned);
      else console.error(`calcom-round-robin: host '${pin}' not configured — using every host`);
   }
   const paused = await zoomPausedHosts(svc);
   if (paused.size) {
      const usable = resolved.filter((h) => !paused.has(h.id));
      if (usable.length === 0) return reply({ ok: false, error: 'no_zoom', slots: [] });
      resolved.splice(0, resolved.length, ...usable);
   }

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
export const listCallSlots = async (svc: Svc, user: CallUser, timeZone: string, pin?: string | null, includeAll = false): Promise<CallBookingReply> => {
   const prepared = await prepare(svc, user, pin);
   if ('status' in prepared) return prepared;
   const { resolved } = prepared;
   // From yesterday's UTC date: Cal.com reads date-only bounds in the borrower's zone, and it
   // never returns past times anyway — so this can't lose "later today" for anyone.
   const start = ymd(new Date(Date.now() - 86400000));
   const end = ymd(new Date(Date.now() + DAYS_AHEAD * 86400000));
   const [perHost, georgeBusy, booked] = await Promise.all([
      Promise.all(resolved.map((h) => fetchSlots(h.apiKey, h.eventTypeId, start, end, timeZone))),
      fetchGeorgeBusy(svc, new Date().toISOString(), new Date(Date.now() + (DAYS_AHEAD + 1) * 86400000).toISOString()),
      bookedCallStarts(svc, user.id, new Date(Date.now() - 86400000).toISOString(), new Date(Date.now() + (DAYS_AHEAD + 2) * 86400000).toISOString())
   ]);
   // Max 4 calls a Bangkok day, and on a day that has calls only the times around them (the
   // nearest ones ⭐ recommended), so calls come in one block. `recommended` is a subset of `slots`.
   // George's own Google busy times only take away George's times; Emma's stand on their own.
   const hostSlots = perHost.map((slots, i) => (resolved[i].id === 'george' ? dropBusySlots(slots, georgeBusy, CALL_MINUTES) : slots));
   const free = mergeSlots(hostSlots);
   const emmaIndex = resolved.findIndex((h) => h.id === PREFERRED_HOST);
   // Evenings and weekend days lead as ⭐ (isGoodCallTime); late-night bookers get nothing before noon.
   const clustered = clusterSlots(
      dropMorningAfterLateNight(free, Date.now(), timeZone),
      booked,
      emmaIndex >= 0 ? hostSlots[emmaIndex] : [],
      (s) => isGoodCallTime(s, timeZone)
   );
   const slots = preferSoonSlots(clustered.slots, Date.now());
   const offered = new Set(slots);
   // includeAll (admin preview only): also every free time over the next two weeks, before the soonest-first cut.
   // Who would take each time (Emma when both are free), for "with Emma" / "with George" labels.
   const byHost = Object.fromEntries(resolved.map((h, i) => [h.id, hostSlots[i]]));
   const hosts = Object.fromEntries(slots.map((s) => [s, preferHost(hostsFreeAt(s, byHost))[0] ?? null]));
   return reply({ slots, recommended: clustered.recommended.filter((s) => offered.has(s)), hosts, ...(includeAll ? { all: clustered.slots } : {}) });
};

/** Books `startRaw` for this borrower and saves it on their account (see the comments inside). */
export const bookCall = async (svc: Svc, user: CallUser, startRaw: string | null | undefined, timeZone: string, pin?: string | null): Promise<CallBookingReply> => {
   // Indonesia track: the call is the last step — everything before it must be done first.
   const idStatus = await loadIdStatus(svc, user.id);
   if (idStatus?.market === 'ID' && idStatus.readyForCall !== true) {
      return reply({ ok: false, error: 'ID_ONBOARDING_INCOMPLETE', next: idStatus.next ?? null }, 409);
   }
   const prepared = await prepare(svc, user, pin);
   if ('status' in prepared) return prepared;
   const { resolved } = prepared;
   // Slots arrive with the borrower's offset (…T07:00:00.000+08:00); book and store the instant in
   // UTC so Cal.com, the database and every reminder agree on one unambiguous time.
   const startMs = startRaw ? Date.parse(startRaw) : NaN;
   if (Number.isNaN(startMs)) return reply({ error: 'missing_start' }, 400);
   if (startMs <= Date.now()) return reply({ ok: false, error: 'slot_taken' });
   const start = new Date(startMs).toISOString();

   // The daily cap, again here: the list may be stale, or the request made by hand.
   const dayCalls = await bookedCallStarts(svc, user.id, new Date(startMs - 86400000).toISOString(), new Date(startMs + 86400000).toISOString());
   if (dayIsFull(start, dayCalls)) return reply({ ok: false, error: 'day_full' });

   // Re-check who's actually free at this instant right now (availability may have moved).
   const range = recheckRange(start);
   const perHostMap: Record<string, string[]> = {};
   await Promise.all(
      resolved.map(async (h) => {
         perHostMap[h.id] = await fetchSlots(h.apiKey, h.eventTypeId, range.from, range.to, timeZone);
      })
   );
   let free = hostsFreeAt(start, perHostMap);
   // George only counts as free when his Google Calendar is clear too.
   if (free.includes('george')) {
      const georgeBusy = await fetchGeorgeBusy(svc, start, new Date(startMs + CALL_MINUTES * 60000).toISOString());
      if (dropBusySlots([start], georgeBusy, CALL_MINUTES).length === 0) free = free.filter((h) => h !== 'george');
   }
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
   const signInEmail = prof?.email || user.email;
   if (!signInEmail) return reply({ ok: false, error: 'no_email' });
   // A made-up sign-up address (phone, guest, Telegram…) would bounce Cal.com's invite: use our call inbox.
   const email = isPlaceholderEmail(signInEmail) ? callInboxFor(user.id) : signInEmail;
   const attendee: Attendee = { name: prof?.display_name || prof?.username || 'Moodeng borrower', email, timeZone, language: 'en' };

   // Every configured host (not just the pinned/free ones), so the other cofounder is always invited.
   const emailsByHost: Record<string, string | null> = {};
   await Promise.all(
      HOSTS.map(async (h) => {
         emailsByHost[h.id] = await fetchAccountEmail(h.apiKey);
      })
   );

   // Emma first when she's free, then the seeded order; the next one is tried if the first races and loses the slot.
   let zoomFailed = false;
   for (const hostId of preferHost(orderHostsToTry(free, `${user.id}:${start}`))) {
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
      // Cal Video (or no link) means this host's Zoom is broken: undo it, pause them, try the next free host.
      if ('uid' in result && !isZoomJoinUrl(result.joinUrl)) {
         console.error(`calcom-round-robin: ${hostId} booking came back without Zoom (${result.joinUrl ?? 'no link'}) — cancelling`);
         const undone = await cancelCalBooking(hostId, result.uid, 'Zoom link could not be created — rebooking on Zoom.');
         if (!undone) console.error(`calcom-round-robin: could not cancel non-Zoom booking ${result.uid}`);
         await pauseHostZoom(svc, hostId, result.joinUrl);
         zoomFailed = true;
         continue;
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
         // Indonesia track: the confirmation on Telegram, in WIB, with the join link.
         if (idStatus?.market === 'ID') {
            await sendIdTelegram(svc, user.id, 'call_booked', { callAt: start, joinUrl: booked?.video_call_join_url ?? result.joinUrl ?? null });
         }
         // Messenger confirmation with the "✅ I'll be there" button — best-effort, never blocks.
         let messengerSent = false;
         if (booked) {
            const sent = await sendBookedMessenger(booked, await offerBotQuestions(svc, user.id));
            messengerSent = sent.ok;
            if (!sent.ok) console.log('calcom-round-robin: messenger confirmation skipped:', sent.reason);
            // No mobile number on file (they didn't sign up by phone): ask for one, for the text reminder.
            if (sent.ok && (await wantsTextReminderAsk(svc, user.id))) {
               const asked = await sendTextReminderAsk(booked);
               if (!asked.ok) console.log('calcom-round-robin: text reminder ask skipped:', asked.reason);
            }
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
         return reply({ ok: true, host: hostId, start, messenger: messengerSent });
      }
      if (result.error !== 'taken') break;
   }
   // Only Cal Video was on offer at that time: they pick another (the paused host's times are gone now).
   if (zoomFailed) console.error('calcom-round-robin: no Zoom host free at that time — asking for another');
   return reply({ ok: false, error: 'slot_taken' });
};
