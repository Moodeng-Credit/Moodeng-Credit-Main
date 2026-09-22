/**
 * End-of-application "how we reach you" step — WhatsApp verification + the no-referral-code
 * video-call gate.
 *
 * Both numbers/links below are today's test-stage values (Meta's WhatsApp Cloud API test number;
 * Calendly's own booking pages) and are meant to move to env vars once the real PH SIM and any
 * production Calendly links are ready — VITE_ vars take over here without a code change.
 */

// digits-only, no '+', the format wa.me needs. Falls back to the current Meta test number.
export const WHATSAPP_BUSINESS_NUMBER = import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER || '15551939271';

// The Facebook Page username (the part after m.me/), used to build the coded verification link.
// Set VITE_MESSENGER_PAGE_USERNAME once the real Page is live.
export const MESSENGER_PAGE_USERNAME = import.meta.env.VITE_MESSENGER_PAGE_USERNAME || 'moodengcredit';

// Cal.com replaces Calendly for the video-call gate: its free plan has signed webhooks, so the
// calcom-webhook edge function can confirm a real booking server-side instead of trusting the
// client. `calLink` is the "<username>/<event-slug>" part after cal.com/ — set the real ones via
// env once George's and Emma's Cal.com event types exist (connected to the same Google Calendar
// their Calendly used, so availability and existing bookings carry over).
export const VIDEO_CALL_HOSTS = {
   george: {
      id: 'george' as const,
      name: 'George',
      photo: '/team/george.jpeg',
      calLink: import.meta.env.VITE_CALCOM_GEORGE_LINK || 'moodeng/interview-george'
   },
   emma: {
      id: 'emma' as const,
      name: 'Emma',
      photo: '/team/emma-moodeng.jpeg',
      calLink: import.meta.env.VITE_CALCOM_EMMA_LINK || 'moodeng/interview-emma'
   }
};

// The Cal.com origin the embed talks to — app.cal.com for cloud, or your self-hosted domain.
export const CALCOM_EMBED_ORIGIN = import.meta.env.VITE_CALCOM_EMBED_ORIGIN || 'https://app.cal.com';

// Single combined round-robin event for the whole Moodeng team (George + Emma): the borrower books
// one "video interview" link and Cal.com assigns whichever host is free, checking both calendars.
// This is the "<team/team-slug/event-slug>" part after cal.com/. Round-robin needs a Cal.com Teams
// (paid) plan; set VITE_CALCOM_TEAM_LINK once that team event exists. The calcom-webhook reads the
// assigned host back from the booking's organizer, so no host is chosen up front.
export const CALCOM_TEAM_LINK = import.meta.env.VITE_CALCOM_TEAM_LINK || 'team/moodeng/video-interview';

export type VideoCallHostId = keyof typeof VIDEO_CALL_HOSTS;

export const buildWhatsAppVerifyLink = (code: string) =>
   `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent(`Verify my Moodeng account: ${code}`)}`;

// m.me can't pre-fill message text the way wa.me can, so the code rides in the ?ref= param —
// Messenger hands it back to the messenger-webhook as a referral when the borrower opens the link.
export const buildMessengerVerifyLink = (code: string) =>
   `https://m.me/${MESSENGER_PAGE_USERNAME}?ref=${encodeURIComponent(code)}`;
