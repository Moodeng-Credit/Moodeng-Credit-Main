// Shared bits for the borrower video call: time formatting, the Messenger "✅ I'll be there"
// confirm link, and the booked / reminder messages. Used by calcom-round-robin (on booking),
// video-call-reminders (cron) and video-call-confirm (the button's target).

import { type MessengerCard, sendMessengerMessage } from './sendpulse.ts';

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');

// The link behind the Messenger button. verify_jwt is off for video-call-confirm; the random,
// single-booking token is the whole credential (it only marks "I'll be there", nothing more).
export const buildConfirmUrl = (token: string) => `${SUPABASE_URL}/functions/v1/video-call-confirm?t=${encodeURIComponent(token)}`;

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
const callCard = (title: string, u: CallUser, opts: { confirm?: boolean } = {}): MessengerCard | undefined => {
   const confirm = opts.confirm === true && !u.video_call_confirmed_at && u.video_call_confirm_token;
   const change = u.video_call_booking_uid ? { title: CHANGE_TIME, url: buildRescheduleUrl(u.video_call_booking_uid) } : null;
   if (confirm) {
      return {
         title,
         subtitle: change ? "Tap ✅ so we know you're coming — or pick a new time." : "Tap below so we know you're coming.",
         button: { title: "✅ I'll be there", url: buildConfirmUrl(confirm) },
         ...(change ? { moreButtons: [change] } : {})
      };
   }
   return change ? { title: "Can't make it?", subtitle: 'Pick a new time that works for you.', button: change } : undefined;
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
const CONFIRM_NOTICE = "⚠️ 1 hour before, we'll message you here with a ✅ I'll be there button. Tap it, or the call is cancelled.";

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
      card: callCard('Will you make it?', u)
   });
};

// The call moved (the borrower or the team rescheduled it on Cal.com): the new time, the join link,
// and the ✅ / 🔄 card again (the move cleared their "I'll be there").
export const sendMovedMessenger = (u: CallUser) => {
   if (!u.video_call_starts_at) return Promise.resolve({ ok: false as const, reason: 'no_call' });
   const when = formatCallTime(u.video_call_starts_at, u.video_call_timezone);
   return sendMessengerMessage(u.messenger_psid, {
      text: `📅 Your meeting with Moodeng has moved to ${when} via Zoom.\n${joinLine(u)}\n\nPlease have your ID or passport ready.\n\n${CONFIRM_NOTICE}`,
      card: callCard('See you then?', u)
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
         ? `⏰ Our meeting starts in under an hour — ${when}. ${u.video_call_join_url ? `Join here: ${u.video_call_join_url}` : 'The Zoom link is in your email.'} Please have your ID or passport ready.`
         : `👋 Just a quick reminder about our meeting scheduled for ${when}. Please let us know here if that time still works for you or if you'd prefer to reschedule. Remember: 1 hour before, tap ✅ I'll be there to confirm — otherwise the meeting is cancelled automatically. Looking forward to meeting you!`;
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
      text: `⏰ Our meeting is in 1 hour — ${when}. Please tap ✅ I'll be there below within 30 minutes to confirm you're coming. If you don't confirm, the meeting is cancelled automatically. Need a different time? Tap 🔄 Change time.`,
      card: callCard('Confirm your meeting', u, { confirm: true })
   });
};

// At the start time — the single most effective no-show nudge.
export const sendStartingMessenger = (u: CallUser) => {
   if (!u.video_call_starts_at) return Promise.resolve({ ok: false as const, reason: 'no_call' });
   return sendMessengerMessage(u.messenger_psid, {
      text: `👋 Our meeting is starting now! ${joinLine(u)}
Please have your ID or passport ready.`
   });
};

// A few minutes in and Zoom hasn't seen them: one friendly nudge, with a way out.
export const sendWaitingMessenger = (u: CallUser) => {
   if (!u.video_call_starts_at) return Promise.resolve({ ok: false as const, reason: 'no_call' });
   return sendMessengerMessage(u.messenger_psid, {
      text: `🙂 We're ready for you! ${joinLine(u)}
Can't make it? Just reply here and we'll find a new time.`
   });
};
