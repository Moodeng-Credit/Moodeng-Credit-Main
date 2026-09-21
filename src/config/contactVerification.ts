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

export const VIDEO_CALL_HOSTS = {
   george: {
      id: 'george' as const,
      name: 'George',
      photo: '/team/george.jpeg',
      // Slug is a historical leftover ("30min") from before the event's duration was changed to
      // 15 minutes — the URL didn't need to change with it.
      calendlyUrl: 'https://calendly.com/moodengcredit/30min'
   },
   emma: {
      id: 'emma' as const,
      name: 'Emma',
      photo: '/team/emma-moodeng.jpeg',
      calendlyUrl: 'https://calendly.com/emma-moodengcredit/15-minute-meeting'
   }
};

export type VideoCallHostId = keyof typeof VIDEO_CALL_HOSTS;

export const buildWhatsAppVerifyLink = (code: string) =>
   `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent(`Verify my Moodeng account: ${code}`)}`;
