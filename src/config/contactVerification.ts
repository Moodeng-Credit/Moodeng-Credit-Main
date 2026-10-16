/**
 * End-of-application "how we reach you" step — WhatsApp verification + the no-referral-code
 * video-call gate.
 *
 * Both numbers/links below are today's test-stage values (Meta's WhatsApp Cloud API test number;
 * Calendly's own booking pages) and are meant to move to env vars once the real PH SIM and any
 * production Calendly links are ready — VITE_ vars take over here without a code change.
 */

// digits-only, no '+', the format wa.me needs. The real business number (George's +66, connected through
// SendPulse on 2026-10-16), replacing Meta's test number.
export const WHATSAPP_BUSINESS_NUMBER = import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER || '66951659077';
// How the number reads on screen, for people who send their code by hand.
export const WHATSAPP_BUSINESS_NUMBER_DISPLAY = import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER_DISPLAY || '+66 95 165 9077';

// Facebook is required (George): WhatsApp is not offered as a way to "reach you" instead of Messenger,
// only as the reminders channel where notifications can't work (WhatsAppRemindersCard, switched on with
// the borrower_whatsapp_card_enabled setting; sending is borrower_whatsapp_enabled). VITE_WHATSAPP_VERIFY_ENABLED=true would bring back the old
// "WhatsApp instead of Messenger" card.
export const WHATSAPP_VERIFY_ENABLED = import.meta.env.VITE_WHATSAPP_VERIFY_ENABLED === 'true';

// Borrowers the team already knows well — they skip the "how can we reach you" (Facebook) card at
// request time. Both of Belle's accounts (George, 2026-09-24).
export const CONTACT_STEP_EXEMPT_USER_IDS: ReadonlySet<string> = new Set([
   '28cd3b3e-a975-48ab-9db3-a23f74c01d42', // d.rosebellejane
   'a629dfa3-ebe0-4365-b267-294b19a6ead1' // enadrosebellejane
]);

// Which end-of-request steps a borrower gets:
//   * brand-new borrower   → Facebook card + video call (unless they applied a referral code);
//   * existing borrower    → Facebook card only (had a funded loan before — no call needed);
//   * already had the call → Facebook card only (an admin marked them Showed up once; deleting a
//                            request and making a new one never asks for another call);
//   * exempt (Belle)       → neither.
// ContactsStep skips itself with a checkmark when Facebook is already verified.
export const requestContactSteps = ({
   userId,
   isExistingBorrower,
   hasAppliedReferral,
   hasAttendedCall = false
}: {
   userId: string;
   isExistingBorrower: boolean;
   hasAppliedReferral: boolean;
   hasAttendedCall?: boolean;
}): { contacts: boolean; videoCall: boolean } => {
   if (CONTACT_STEP_EXEMPT_USER_IDS.has(userId)) return { contacts: false, videoCall: false };
   return { contacts: true, videoCall: !isExistingBorrower && !hasAppliedReferral && !hasAttendedCall };
};

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

// Android: m.me links never reach the Messenger app from Chrome. A test on George's Android phone
// (moodeng.app/messenger-test.html, 2026-10-10) tried m.me in the same tab, in a new tab, and as an
// intent to com.facebook.orca with and without a fallback: nothing opened, or a tab flashed shut. It
// matches PostHog: no Android borrower on Chrome 154+ has got in through the link, while iPhones
// always do. A direct link to the Page's chat does open Messenger there, but it can't carry the code,
// so on Android the borrower pastes the code into the chat and the SendPulse "Confirm Facebook (typed
// code)" flow confirms it. messenger.com itself redirects to facebook.com/messages since April 2026,
// so without the app this still lands somewhere they can message the Page.
export const MESSENGER_PAGE_CHAT_LINK = `https://www.messenger.com/t/${MESSENGER_PAGE_ID}`;

// What the Android button opens: Messenger's own app link to the Page's chat. On George's phone with
// his personal account (2026-10-11) this was the only link that opened the chat; the messenger.com
// link above had only been tried while Messenger was logged in as the Page itself. It can't carry
// the code either, so the bot connects them by timing (sendpulse-events) or they paste the code.
export const MESSENGER_APP_CHAT_LINK = `fb-messenger://user-thread/${MESSENGER_PAGE_ID}`;

export const isAndroidBrowser = (userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : '') =>
   /android/i.test(userAgent);

// A computer (laptop/desktop), not a phone or tablet: no Android/iPhone/iPad user agent (iPads report
// as Macs, so a touch Mac counts as an iPad) and a mouse or trackpad as the main pointer. On computers
// the m.me code never reached our bot (0 of 4 attempts, Sep–Oct 2026: m.me bounces through
// messenger.com to facebook.com/messages and loses it), so ContactsStep shows a QR for the phone
// instead, plus copy-and-paste on the computer itself. Anything unsure stays on the phone flows.
export const isDesktopBrowser = () => {
   if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
   const ua = navigator.userAgent;
   if (/android|iphone|ipad|ipod|mobile/i.test(ua)) return false;
   if (/macintosh|mac os x/i.test(ua) && navigator.maxTouchPoints > 1) return false;
   return Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches);
};

// What the desktop QR opens on the phone: our own page (MessengerHandoff), which gives each phone the
// way into Messenger that works there — m.me with the code on iPhone, copy-and-paste on Android.
export const MESSENGER_CODE_PATTERN = /^MDNG-[A-Z0-9]{4,12}$/;
export const buildMessengerHandoffLink = (code: string, origin: string = window.location.origin) => `${origin}/fb/${code}`;

// Support "Message us" links (EXTERNAL_LINKS.support) are m.me links too, so on Android they never
// opened Messenger either. Android gets the app link to the Page's chat (the ref tag only rides along
// elsewhere); custom schemes open in place, not in a new tab.
export const messengerSupportLink = (link: string) => (isAndroidBrowser() ? MESSENGER_APP_CHAT_LINK : link);
export const externalLinkTarget = (href: string) => (href.startsWith('https:') ? '_blank' : undefined);
export const openMessengerSupport = (link: string) => {
   const href = messengerSupportLink(link);
   if (externalLinkTarget(href)) window.open(href, '_blank', 'noopener');
   else window.location.href = href;
};
