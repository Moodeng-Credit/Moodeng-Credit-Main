import type { OtpChannel } from '@/store/slices/authSlice';

export type OtpErrorView = {
   message: string;
   /** Move them to the email tab (non-PH number, or SMS not available right now). */
   switchToEmail?: boolean;
   nonPh?: boolean;
};

const BANNED_MESSAGE = 'This account has been closed. If you think this is a mistake, contact support on Telegram.';

/**
 * Turns a signInWithOtp / verifyOtp failure into something a borrower can act on. Messages from
 * our Send SMS hook (cooldown, daily cap, non-PH) already read well and are passed through.
 */
export function describeOtpError(err: unknown, channel: OtpChannel): OtpErrorView {
   const e = (err ?? {}) as { message?: unknown; status?: unknown; code?: unknown };
   const message = typeof e.message === 'string' ? e.message : '';
   const lower = message.toLowerCase();

   if (e.code === 'user_banned' || /\bbanned\b/.test(lower)) return { message: BANNED_MESSAGE };

   if (lower.includes('philippine numbers only')) {
      return { message: 'SMS codes work for Philippine numbers only. Use your email instead', switchToEmail: true, nonPh: true };
   }

   // Our hook's own limits: keep their wording ("Wait a minute…", "Too many codes…").
   if (lower.startsWith('wait a minute') || lower.startsWith('too many codes')) {
      return { message, switchToEmail: lower.startsWith('too many codes') && channel === 'sms' };
   }

   if (
      e.status === 429 ||
      e.code === 'over_sms_send_rate_limit' ||
      e.code === 'over_email_send_rate_limit' ||
      lower.includes('rate limit') ||
      lower.includes('for security purposes') ||
      lower.includes('too many')
   ) {
      return { message: 'Please wait a minute before asking for another code.' };
   }

   if (channel === 'sms' && lower.includes('not available right now')) return { message, switchToEmail: true };

   if (
      channel === 'sms' &&
      (e.code === 'phone_provider_disabled' ||
         e.code === 'sms_send_failed' ||
         lower.includes('phone provider') ||
         lower.includes('phone signups are disabled') ||
         lower.includes('error sending') ||
         lower.includes('hook'))
   ) {
      return { message: "We couldn't send a text right now. Use your email instead.", switchToEmail: true };
   }

   if (lower.includes('failed to fetch') || lower.includes('load failed') || lower.includes('network')) {
      return { message: 'Could not reach the server. Check your connection and try again.' };
   }

   if (lower.includes('invalid') && lower.includes('email')) return { message: 'Check your email address and try again.' };
   if (lower.includes('invalid') && lower.includes('phone')) return { message: 'Check your mobile number and try again.' };

   return { message: message || 'Something went wrong. Try again in a moment.' };
}
