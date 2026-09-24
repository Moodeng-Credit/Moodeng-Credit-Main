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
   video_call_starts_at: string | null;
   video_call_timezone?: string | null;
   video_call_confirm_token?: string | null;
   video_call_confirmed_at?: string | null;
};

// Right after booking — the borrower just tapped through Messenger, so the 24h window is open.
export const sendBookedMessenger = (u: CallUser) => {
   if (!u.video_call_starts_at) return Promise.resolve({ ok: false as const, reason: 'no_call' });
   const when = formatCallTime(u.video_call_starts_at, u.video_call_timezone);
   return sendMessengerMessage(u.messenger_psid, {
      text: `📅 You're booked for a quick video call with the Moodeng team: ${when}.\n\nWe'll send the link by email and remind you here before it starts.`,
      card: confirmCard('Will you make it?', u.video_call_confirm_token)
   });
};

// Day-before (stage 1) and hour-before (stage 2). Only lands if we're still inside the 24h window
// (sendMessengerMessage checks); push + Telegram cover the rest.
export const sendReminderMessenger = (u: CallUser, stage: 1 | 2) => {
   if (!u.video_call_starts_at) return Promise.resolve({ ok: false as const, reason: 'no_call' });
   const when = formatCallTime(u.video_call_starts_at, u.video_call_timezone);
   const text =
      stage === 2
         ? `⏰ Your Moodeng video call starts in under an hour — ${when}. The join link is in your email.`
         : `👋 Reminder: your Moodeng video call is coming up — ${when}.`;
   return sendMessengerMessage(u.messenger_psid, {
      text,
      card: u.video_call_confirmed_at ? undefined : confirmCard('Still coming?', u.video_call_confirm_token)
   });
};
