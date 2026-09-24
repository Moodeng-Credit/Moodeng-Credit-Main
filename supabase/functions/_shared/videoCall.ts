// Shared bits for the borrower video call: time formatting, the Messenger "✅ I'll be there"
// confirm link, and the booked / reminder messages. Used by calcom-round-robin (on booking),
// video-call-reminders (cron) and video-call-confirm (the button's target).

import { type MessengerCard, sendMessengerMessage } from './sendpulse.ts';

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');

// The link behind the Messenger button. verify_jwt is off for video-call-confirm; the random,
// single-booking token is the whole credential (it only marks "I'll be there", nothing more).
export const buildConfirmUrl = (token: string) => `${SUPABASE_URL}/functions/v1/video-call-confirm?t=${encodeURIComponent(token)}`;

export const newConfirmToken = () => crypto.randomUUID().replace(/-/g, '');

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

const confirmCard = (title: string, token: string | null | undefined): MessengerCard | undefined =>
   token
      ? {
           title,
           subtitle: "Tap below so we know you're coming.",
           button: { title: "✅ I'll be there", url: buildConfirmUrl(token) }
        }
      : undefined;

type CallUser = {
   messenger_psid: string | null;
   video_call_host?: string | null;
   video_call_join_url?: string | null;
   video_call_starts_at: string | null;
   video_call_timezone?: string | null;
   video_call_confirm_token?: string | null;
   video_call_confirmed_at?: string | null;
};

// Right after booking — the borrower just tapped through Messenger, so the 24h window is open.
export const sendBookedMessenger = (u: CallUser) => {
   if (!u.video_call_starts_at) return Promise.resolve({ ok: false as const, reason: 'no_call' });
   const when = formatCallTime(u.video_call_starts_at, u.video_call_timezone);
   // Emma's "Confirm the initial meeting" script, with this booking's own join link.
   const withWhom = u.video_call_host === 'emma' ? 'Emma Moodeng' : 'the Moodeng team';
   const link = u.video_call_join_url
      ? `You can join from your computer, tablet or phone:\n${u.video_call_join_url}`
      : 'The join link is in your email.';
   return sendMessengerMessage(u.messenger_psid, {
      text:
         `📅 Thank you for confirming! Your meeting with ${withWhom} is on ${when} via Zoom.\n${link}\n\n` +
         'To make it smooth, please have ready:\n1. Your original physical ID or passport — account approval depends on passing this compliance check (legal, financial and GDPR rules)\n' +
         '2. Camera on, a well-lit room, and your phone nearby\n\n' +
         'To get funded after the meeting, connect with Emma Moodeng on Facebook: https://www.facebook.com/emmamoodengcredit',
      card: confirmCard('Will you make it?', u.video_call_confirm_token)
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
         : `👋 Just a quick reminder about our meeting scheduled for ${when}. Please let us know here if that time still works for you or if you'd prefer to reschedule. Looking forward to meeting you!`;
   return sendMessengerMessage(u.messenger_psid, {
      text,
      card: u.video_call_confirmed_at ? undefined : confirmCard('Still coming?', u.video_call_confirm_token)
   });
};

const joinLine = (u: CallUser) => (u.video_call_join_url ? `Tap to join: ${u.video_call_join_url}` : 'The Zoom link is in your email.');

// ~2h before, only if they haven't tapped "I'll be there": the last call before the slot is freed.
export const sendKeepSpotMessenger = (u: CallUser) => {
   if (!u.video_call_starts_at) return Promise.resolve({ ok: false as const, reason: 'no_call' });
   const when = formatCallTime(u.video_call_starts_at, u.video_call_timezone);
   return sendMessengerMessage(u.messenger_psid, {
      text: `🙋 Still coming to our meeting at ${when}? Tap ✅ below to keep your spot — unconfirmed spots are released 1 hour before so someone else can book.`,
      card: confirmCard('Keep your spot?', u.video_call_confirm_token)
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
