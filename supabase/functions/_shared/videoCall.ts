// Shared bits for the borrower video call: time formatting, the Messenger "✅ I'll be there"
// confirm link, and the booked / reminder messages. Used by calcom-round-robin (on booking),
// video-call-reminders (cron) and video-call-confirm (the button's target).

import { type MessengerCard, sendMessengerMessage } from './sendpulse.ts';

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');

// The link behind the Messenger button. verify_jwt is off for video-call-confirm; the random,
// single-booking token is the whole credential (it only marks "I'll be there", nothing more).
export const buildConfirmUrl = (token: string) => `${SUPABASE_URL}/functions/v1/video-call-confirm?t=${encodeURIComponent(token)}`;
/** The ✅ link inside the calendar event (counts only in the last 2h before the call). */
export const buildCalendarConfirmUrl = (token: string) => `${buildConfirmUrl(token)}&src=cal`;
/** "📅 Add to my calendar": .ics on iPhone/desktop, Google Calendar on Android (callCalendar.ts). */
export const buildCalendarUrl = (token: string) => `${SUPABASE_URL}/functions/v1/video-call-confirm?ics=${encodeURIComponent(token)}`;
const ADD_TO_CALENDAR = '📅 Add to calendar';

export const newConfirmToken = () => crypto.randomUUID().replace(/-/g, '');

// Cal.com's own reschedule page for a booking. Works for the borrower and for us (George / Emma,
// signed in to Cal.com): the new time comes back as a reschedule of the current booking, which
// calcom-webhook accepts and turns into the new call (fresh reminders, new confirm).
export const buildRescheduleUrl = (bookingUid: string) => `https://cal.com/reschedule/${encodeURIComponent(bookingUid)}`;
const CHANGE_TIME = '🔄 Change time';

// "Fri, Sep 25, 10:00 AM (Bangkok)" in the borrower's own time zone (falls back to Bangkok — most
// borrowers are TH/PH, and the label always names the zone so it's never ambiguous).
export const formatCallTime = (iso: string, timeZone?: string | null): string => {
   const zone = timeZone || 'Asia/Bangkok';
   let when: string;
   try {
      when = new Date(iso).toLocaleString('en-US', {
         timeZone: zone,
         weekday: 'short',
         month: 'short',
         day: 'numeric',
         hour: 'numeric',
         minute: '2-digit'
      });
   } catch {
      return formatCallTime(iso, 'Asia/Bangkok');
   }
   const city = zone.split('/').pop()?.replace(/_/g, ' ') ?? zone;
   return `${when} (${city} time)`;
};

// Team-facing: Bangkok time, plus the borrower's own clock when it differs, so the host can say
// "see you at 11 your time". "Fri, Sep 25, 10:00 AM (Bangkok time) · 11:00 AM their time (Manila)".
export const formatCallTimeForTeam = (iso: string, borrowerZone?: string | null): string => {
   const team = formatCallTime(iso, 'Asia/Bangkok');
   if (!borrowerZone || borrowerZone === 'Asia/Bangkok') return team;
   const clock = (zone: string, withDay: boolean) =>
      new Date(iso).toLocaleString('en-US', {
         timeZone: zone,
         ...(withDay ? { weekday: 'short' as const } : {}),
         hour: 'numeric',
         minute: '2-digit'
      });
   let theirs: string;
   try {
      theirs = clock(borrowerZone, false);
   } catch {
      return team; // unknown zone name — Bangkok alone is still unambiguous
   }
   if (theirs === clock('Asia/Bangkok', false)) return team; // same wall clock (e.g. Jakarta)
   const otherDay = clock(borrowerZone, true).split(' ')[0] !== clock('Asia/Bangkok', true).split(' ')[0];
   const city = borrowerZone.split('/').pop()?.replace(/_/g, ' ') ?? borrowerZone;
   return `${team} · ${otherDay ? clock(borrowerZone, true) : theirs} their time (${city})`;
};

// The card under a call message: ✅ I'll be there (only in the confirm window, until they tap it)
// and 🔄 Change time, so a borrower who can't make it picks a new time instead of not showing up.
const callCard = (title: string, u: CallUser, opts: { confirm?: boolean; calendar?: boolean } = {}): MessengerCard | undefined => {
   const confirm = opts.confirm === true && !u.video_call_confirmed_at && u.video_call_confirm_token;
   const change = u.video_call_booking_uid ? { title: CHANGE_TIME, url: buildRescheduleUrl(u.video_call_booking_uid) } : null;
   if (confirm) {
      return {
         title,
         subtitle: change ? 'Tap ✅ = ID ready + video on. Or pick a new time.' : 'Tap ✅ = ID ready + video on.',
         button: { title: "✅ I'll be there", url: buildConfirmUrl(confirm) },
         ...(change ? { moreButtons: [change] } : {})
      };
   }
   // Booked / moved: the calendar button first (the phone's own reminder works after Messenger's
   // 24h window closes), then Change time.
   const calendar = u.video_call_confirm_token ? { title: ADD_TO_CALENDAR, url: buildCalendarUrl(u.video_call_confirm_token) } : null;
   if (opts.calendar && calendar) {
      return {
         title: 'Add it to your calendar 📅',
         subtitle: 'Your phone reminds you 1 hour before.',
         button: calendar,
         ...(change ? { moreButtons: [change] } : {})
      };
   }
   return change ? { title: "Can't make it?", subtitle: 'Pick a new time.', button: change } : undefined;
};

type CallUser = {
   messenger_psid: string | null;
   video_call_host?: string | null;
   video_call_join_url?: string | null;
   video_call_starts_at: string | null;
   video_call_timezone?: string | null;
   video_call_confirm_token?: string | null;
   video_call_confirmed_at?: string | null;
   video_call_booking_uid?: string | null;
};

// Told at booking (and when the call moves): the ✅ button only comes 1h before, and skipping it
// cancels the call. The borrower page (ConnectStep) says the same.
const CONFIRM_NOTICE = "⚠️ 1 hour before, we'll message you here with a ✅ I'll be there button. Tap it to confirm you'll have your ID and video on, or the call is cancelled.\n📅 Tap Add to calendar below so your phone reminds you too.";

// Right after booking — the borrower just tapped through Messenger, so the 24h window is open.
export const sendBookedMessenger = (u: CallUser) => {
   if (!u.video_call_starts_at) return Promise.resolve({ ok: false as const, reason: 'no_call' });
   const when = formatCallTime(u.video_call_starts_at, u.video_call_timezone);
   // Emma's "Confirm the initial meeting" script, with this booking's own join link.
   // Every call sits on Emma's calendar with George invited, and whoever's free takes it.
   const withWhom = 'George or Emma from Moodeng';
   const link = u.video_call_join_url ? `Join on Zoom: ${u.video_call_join_url}` : 'The Zoom link is in your email.';
   // Short and friendly (George, 2026-10-29): the old version read like a compliance notice.
   return sendMessengerMessage(u.messenger_psid, {
      text:
         `📅 You're booked! 15-min video call with ${withWhom}\n🗓️ ${when}\n${link}\n\n` +
         'Bring 🪪 your original ID or passport and 📷 camera on. That\'s it!\n\n' +
         `${CONFIRM_NOTICE}\n\n` +
         'After the call, add Emma on Facebook so we can fund you: https://www.facebook.com/emmamoodengcredit',
      card: callCard('Will you make it?', u, { calendar: true })
   });
};

// The call moved (the borrower or the team rescheduled it on Cal.com): the new time, the join link,
// and the ✅ / 🔄 card again (the move cleared their "I'll be there").
export const sendMovedMessenger = (u: CallUser) => {
   if (!u.video_call_starts_at) return Promise.resolve({ ok: false as const, reason: 'no_call' });
   const when = formatCallTime(u.video_call_starts_at, u.video_call_timezone);
   // Short (George, 2026-10-29: "text heavy… I wonder if people even read them").
   return sendMessengerMessage(u.messenger_psid, {
      text: `📅 Moved to ${when}. Same Zoom link:\n${u.video_call_join_url ?? 'in your email'}\n\n⏰ Tap ✅ 1 hour before to keep it.`,
      card: callCard('See you then?', u, { calendar: true })
   });
};

// Day-before (stage 1) and hour-before (stage 2). Only lands if we're still inside the 24h window
// (sendMessengerMessage checks); push + Telegram cover the rest.
export const sendReminderMessenger = (u: CallUser, stage: 1 | 2) => {
   if (!u.video_call_starts_at) return Promise.resolve({ ok: false as const, reason: 'no_call' });
   const when = formatCallTime(u.video_call_starts_at, u.video_call_timezone);
   // Emma's "Remind the initial meeting" script.
   const text =
      stage === 2
         ? `⏰ Starting soon: ${when}\n${u.video_call_join_url ? `Join: ${u.video_call_join_url}` : 'The Zoom link is in your email.'}\n🪪 Have your ID ready and 📷 video on.`
         : `👋 Reminder: your call is ${when} on Zoom.\n⏰ 1 hour before, tap ✅ to keep your spot.`;
   return sendMessengerMessage(u.messenger_psid, {
      text,
      card: callCard('Still coming?', u)
   });
};

const joinLine = (u: CallUser) => (u.video_call_join_url ? `Tap to join: ${u.video_call_join_url}` : 'The Zoom link is in your email.');

// 1h before, only if they haven't tapped "I'll be there": confirm in the next 30 min or it's cancelled.
export const sendConfirmAskMessenger = (u: CallUser) => {
   if (!u.video_call_starts_at) return Promise.resolve({ ok: false as const, reason: 'no_call' });
   const when = formatCallTime(u.video_call_starts_at, u.video_call_timezone);
   return sendMessengerMessage(u.messenger_psid, {
      text: `⏰ Your call is in 1 hour (${when}).\nBring 🪪 your original ID and turn on 📷 video.\nTap ✅ to confirm, or it's cancelled in 30 min.`,
      card: callCard('ID + video ready?', u, { confirm: true })
   });
};

// Right after they tap ✅ I'll be there. Messenger can't edit the card we sent, so this reply is what
// tells them the tap worked (the old card's buttons stay; a second tap just lands back in the app).
export const sendConfirmedMessenger = (u: CallUser) => {
   if (!u.video_call_starts_at) return Promise.resolve({ ok: false as const, reason: 'no_call' });
   const when = formatCallTime(u.video_call_starts_at, u.video_call_timezone);
   return sendMessengerMessage(u.messenger_psid, {
      text: `✅ Got it, your spot is saved! See you ${when}.\n${u.video_call_join_url ? `Join: ${u.video_call_join_url}` : 'The Zoom link is in your email.'}\n🪪 Have your ID ready and 📷 video on.`
   });
};

// At the start time — the single most effective no-show nudge.
export const sendStartingMessenger = (u: CallUser) => {
   if (!u.video_call_starts_at) return Promise.resolve({ ok: false as const, reason: 'no_call' });
   return sendMessengerMessage(u.messenger_psid, {
      text: `👋 We're starting now! ${joinLine(u)}`
   });
};

// A few minutes in and Zoom hasn't seen them: one friendly nudge, with a way out.
export const sendWaitingMessenger = (u: CallUser) => {
   if (!u.video_call_starts_at) return Promise.resolve({ ok: false as const, reason: 'no_call' });
   return sendMessengerMessage(u.messenger_psid, {
      text: `🙂 We're waiting for you! ${joinLine(u)}\nCan't make it? Reply here.`
   });
};
