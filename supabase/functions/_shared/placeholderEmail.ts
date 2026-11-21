// Accounts that signed up without an email (Telegram, LINE, phone) get a made-up address nobody
// reads, because public.users.email is NOT NULL: telegram_<id>@moodeng.app, line_<id>@…,
// phone_<id>@…, guest_<id>@… (phone/guest sign-ups), tiktok_<id>@…. Mail sent there is lost (or bounces and hurts our sender reputation), so the shared
// email sender refuses it. Same pattern as isPlaceholderEmail in borrowerNotificationDelivery.ts.
export const isPlaceholderEmail = (email: string | null | undefined): boolean =>
   /^(telegram|line|phone|guest|tiktok)_[^@]+@moodeng\.(app|credit)$/i.test((email ?? '').trim());

// Cal.com needs an email for every attendee, and its Google Calendar invite goes to it. For people with
// a placeholder that bounced (Nov 2026: "Delivery Status Notification" for phone_…@moodeng.app). They
// get a real inbox of ours instead: support@ takes +tags, and email-inbound drops mail sent to them
// so it never opens a support ticket. The borrower hears about the call on Messenger, SMS and push.
export const CALL_INBOX_TAG = 'call-';
export const callInboxFor = (userId: string) => `support+${CALL_INBOX_TAG}${userId.replace(/-/g, '').slice(0, 12)}@moodeng.app`;
export const isCallInbox = (address: string | null | undefined) => /^support\+call-[0-9a-f]+@moodeng\.app$/i.test((address ?? '').trim());

export class PlaceholderEmailError extends Error {
   readonly code = 'placeholder_email';
   constructor() {
      super('Skipped: this account has no real email address (placeholder)');
      this.name = 'PlaceholderEmailError';
   }
}
