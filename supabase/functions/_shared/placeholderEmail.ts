// Accounts that signed up without an email (Telegram, LINE, phone) get a made-up address nobody
// reads, because public.users.email is NOT NULL: telegram_<id>@moodeng.app, line_<id>@…,
// phone_<id>@…. Mail sent there is lost (or bounces and hurts our sender reputation), so the shared
// email sender refuses it. Same pattern as isPlaceholderEmail in borrowerNotificationDelivery.ts.
export const isPlaceholderEmail = (email: string | null | undefined): boolean =>
   /^(telegram|line|phone)_[^@]+@moodeng\.(app|credit)$/i.test((email ?? '').trim());

export class PlaceholderEmailError extends Error {
   readonly code = 'placeholder_email';
   constructor() {
      super('Skipped: this account has no real email address (placeholder)');
      this.name = 'PlaceholderEmailError';
   }
}
