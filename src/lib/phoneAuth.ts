// Phone sign-in is Philippines only: SMS codes go out through Semaphore, a PH-only gateway.
// Everyone else (Indonesia, Filipinos abroad on foreign SIMs, other countries) uses email.

export const SMS_NON_PH_MESSAGE = 'SMS codes work for Philippine numbers only. Use your email instead';

export type PhPhoneCheck =
   /** A complete PH mobile number, in E.164 (+639XXXXXXXXX). */
   | { kind: 'ok'; e164: string }
   /** Nothing typed yet, or a PH number that is still being typed. */
   | { kind: 'incomplete' }
   /** Clearly another country's number (+62…, +971…, 00 81…, or too long for a PH mobile). */
   | { kind: 'non_ph' }
   /** Not a PH mobile number (e.g. a landline, or 02…). */
   | { kind: 'invalid' };

const PH_MOBILE_DIGITS = 10; // 9XXXXXXXXX

// "9XXXXXXXXX" so far (or empty): check whether it can still become a PH mobile number.
const checkLocal = (local: string): PhPhoneCheck => {
   if (local.length === 0) return { kind: 'incomplete' };
   if (local[0] !== '9') return { kind: 'invalid' };
   if (local.length < PH_MOBILE_DIGITS) return { kind: 'incomplete' };
   if (local.length === PH_MOBILE_DIGITS) return { kind: 'ok', e164: `+63${local}` };
   return { kind: 'non_ph' };
};

/**
 * Reads whatever someone typed or pasted into the "+63" phone field and says whether it is a PH
 * mobile number. Accepts 09XX XXX XXXX, 9XX XXX XXXX, 639XX…, +63 9XX… and 0063 9XX…, with any
 * spaces, dashes, dots or brackets.
 */
export function checkPhPhone(raw: string): PhPhoneCheck {
   const trimmed = raw.trim();
   const hasPlus = trimmed.startsWith('+');
   const digits = trimmed.replace(/\D/g, '');

   if (hasPlus || digits.startsWith('00')) {
      const afterPrefix = hasPlus ? digits : digits.slice(2);
      if (afterPrefix.length === 0) return { kind: 'incomplete' };
      if (afterPrefix === '6') return { kind: 'incomplete' };
      if (!afterPrefix.startsWith('63')) return { kind: 'non_ph' };
      return checkLocal(afterPrefix.slice(2));
   }

   if (digits.length === 0) return { kind: 'incomplete' };
   if (digits.startsWith('63')) return checkLocal(digits.slice(2));
   if (digits === '6') return { kind: 'incomplete' };
   if (digits.startsWith('0')) {
      if (digits.length === 1) return { kind: 'incomplete' };
      return digits[1] === '9' ? checkLocal(digits.slice(1)) : { kind: 'invalid' };
   }
   if (digits.startsWith('9')) return checkLocal(digits);
   // Starts with 1-8 (and not 63): a foreign number typed without its +, or a typo.
   return digits.length >= PH_MOBILE_DIGITS ? { kind: 'non_ph' } : { kind: 'invalid' };
}

/** +639171234567 → "+63 917 123 4567" for display. */
export function formatPhPhone(e164: string): string {
   const local = e164.replace(/^\+63/, '');
   if (!/^9\d{9}$/.test(local)) return e164;
   return `+63 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/** A neutral username for phone sign-ups: never the number itself. */
export function generatePhoneUsername(random: () => number = Math.random): string {
   const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
   let suffix = '';
   for (let i = 0; i < 6; i += 1) suffix += alphabet[Math.floor(random() * alphabet.length)];
   return `moodeng-${suffix}`;
}

/**
 * public.users.email is NOT NULL, so phone-only accounts get a placeholder nobody reads, like
 * Telegram's telegram_<id>@moodeng.app. Built from the account id, never the phone number.
 */
export function phonePlaceholderEmail(userId: string): string {
   return `phone_${userId.replace(/-/g, '')}@moodeng.app`;
}

/** Placeholder addresses for accounts that signed up without an email (Telegram, LINE, phone). */
export function isPlaceholderEmail(email?: string | null): boolean {
   return /^(telegram|line|phone)_[^@]+@moodeng\.(app|credit)$/i.test((email ?? '').trim());
}

export const SMS_TEST_FLAG_KEY = 'moodeng:sms-login-test';

/**
 * Whether the phone (SMS code) tab is offered. Off until Semaphore and the Send SMS hook are set
 * up: then set VITE_SMS_LOGIN_ENABLED=true. Before that, testers can turn it on for their browser
 * with ?sms=1 (off again with ?sms=0). Email codes always work.
 */
export function isSmsLoginEnabled(): boolean {
   if (import.meta.env.VITE_SMS_LOGIN_ENABLED === 'true') return true;
   try {
      const flag = new URLSearchParams(window.location.search).get('sms');
      if (flag === '1') localStorage.setItem(SMS_TEST_FLAG_KEY, '1');
      if (flag === '0') localStorage.removeItem(SMS_TEST_FLAG_KEY);
      return localStorage.getItem(SMS_TEST_FLAG_KEY) === '1';
   } catch {
      return false;
   }
}

/**
 * Show the passwordless sign-up screen (Phone | Email, no password) to everyone, not only inside
 * Facebook/Messenger's browser. One-line switch once it has proven itself there.
 */
export const PASSWORDLESS_SIGNUP_EVERYWHERE = false;

/** Sign-up uses the passwordless screen in Facebook/Messenger's browser (or everywhere, see above; ?passwordless=1 to preview). */
export function showPasswordlessSignup(isFacebookBrowser: boolean): boolean {
   if (PASSWORDLESS_SIGNUP_EVERYWHERE || isFacebookBrowser) return true;
   try {
      return new URLSearchParams(window.location.search).get('passwordless') === '1';
   } catch {
      return false;
   }
}
