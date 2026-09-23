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

// Facebook first: the WhatsApp option stays hidden until a real business number is connected (the
// fallback above is Meta's sandbox number, not fit for real borrowers). Set
// VITE_WHATSAPP_VERIFY_ENABLED=true to bring it back. Borrowers already WhatsApp-verified still pass.
export const WHATSAPP_VERIFY_ENABLED = import.meta.env.VITE_WHATSAPP_VERIFY_ENABLED === 'true';

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
      calLink: import.meta.env.VITE_CALCOM_GEORGE_LINK || 'g.-l-4cmcyl/15min'
   },
   emma: {
      id: 'emma' as const,
      name: 'Emma',
      photo: '/team/emma-moodeng.jpeg',
      calLink: import.meta.env.VITE_CALCOM_EMMA_LINK || 'emma-moodengcredit/15min'
   }
};

// The Cal.com origin the embed talks to — app.cal.com for cloud, or your self-hosted domain.
export const CALCOM_EMBED_ORIGIN = import.meta.env.VITE_CALCOM_EMBED_ORIGIN || 'https://app.cal.com';

export type VideoCallHostId = keyof typeof VIDEO_CALL_HOSTS;

export const buildWhatsAppVerifyLink = (code: string) =>
   `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent(`Verify my Moodeng account: ${code}`)}`;

// Messenger verification runs through SendPulse (connected to the Moodeng Credit Page, riding its
// pre-approved Meta app — no App Review on our side). The link launches SendPulse's "Confirm
// Facebook" flow and hands it the one-time code as the mdng_code variable; the flow POSTs it to
// sendpulse-messenger-verify, which stamps users.messenger_verified_at. Opening the link is the whole
// action — nothing to type (first-time chatters tap Facebook's own "Get Started" once).
// Format is SendPulse's: ref={flow_id}__{variable}={value}. Left unencoded on purpose to match it
// exactly; codes are [A-Z0-9-] so there is nothing to escape.
export const MESSENGER_PAGE_ID = import.meta.env.VITE_MESSENGER_PAGE_ID || '1148756028310286';
export const SENDPULSE_CONFIRM_FB_FLOW_ID = import.meta.env.VITE_SENDPULSE_CONFIRM_FB_FLOW_ID || '3598d58c-7ade-4b7c-9f12-7ed39350fe41';

export const buildMessengerVerifyLink = (code: string) =>
   `https://m.me/${MESSENGER_PAGE_ID}?ref=${SENDPULSE_CONFIRM_FB_FLOW_ID}__mdng_code=${code}`;
