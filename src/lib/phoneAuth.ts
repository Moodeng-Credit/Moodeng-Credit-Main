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

/** +639171234567 → "0917 123 4567", the way people write their own number. */
export function formatPhLocal(e164: string): string {
   const local = e164.replace(/^\+63/, '');
   if (!/^9\d{9}$/.test(local)) return e164;
   return `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

const envNumber = (value: unknown, fallback: number, min: number, max: number): number => {
   const n = Number(value);
   return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

/**
 * Code lengths must match Supabase Auth: email OTP length is 8 on our project (the code screen has
 * said 8 digits since #1163); the SMS OTP length is Supabase's default 6 unless changed in
 * Auth > Providers > Phone. Set VITE_SMS_OTP_LENGTH if it is changed.
 */
export const EMAIL_CODE_LENGTH = 8;
export const SMS_CODE_LENGTH = envNumber(import.meta.env.VITE_SMS_OTP_LENGTH, 6, 6, 10);

/**
 * How long a code works, to tell "expired" from "wrong" (Supabase says "expired or invalid" for
 * both). Email: Supabase's default 1 hour. SMS: set to 10 minutes in Auth > Providers > Phone
 * (Supabase's default 60 seconds is too short for slow texts); VITE_SMS_OTP_EXPIRY_SECONDS if not.
 */
export const EMAIL_CODE_TTL_SECONDS = 3600;
export const SMS_CODE_TTL_SECONDS = envNumber(import.meta.env.VITE_SMS_OTP_EXPIRY_SECONDS, 600, 30, 86400);

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

/**
 * Guest accounts (email-first sign-up in Facebook's browser) keep this placeholder in
 * public.users until they confirm their email; the database then swaps in the real address.
 */
export function guestPlaceholderEmail(userId: string): string {
   return `guest_${userId.replace(/-/g, '')}@moodeng.app`;
}

/** A guest account: signed up with an email it hasn't confirmed yet. */
export function isGuestEmail(email?: string | null): boolean {
   return /^guest_[^@]+@moodeng\.app$/i.test((email ?? '').trim());
}

/** Placeholder addresses for accounts that signed up without an email (Telegram, LINE, phone, guests). */
export function isPlaceholderEmail(email?: string | null): boolean {
   return /^(telegram|line|phone|guest)_[^@]+@moodeng\.(app|credit)$/i.test((email ?? '').trim());
}

export const SMS_TEST_FLAG_KEY = 'moodeng:sms-login-test';

// Paused 16 Oct 2026: Semaphore delivers nothing until a sender name (MOODENG) is approved, so the
// phone tab is hidden even where VITE_SMS_LOGIN_ENABLED is on. Set to false once SEMAPHORE_SENDER_NAME
// is in Vault. ?sms=1 still turns it on for testers.
export const SMS_LOGIN_PAUSED = true;

/**
 * Whether the phone (SMS code) tab is offered. Off until Semaphore and the Send SMS hook are set
 * up: then set VITE_SMS_LOGIN_ENABLED=true. Before that, testers can turn it on for their browser
 * with ?sms=1 (off again with ?sms=0). Email codes always work.
 */
export function isSmsLoginEnabled(): boolean {
   if (!SMS_LOGIN_PAUSED && import.meta.env.VITE_SMS_LOGIN_ENABLED === 'true') return true;
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
 * Show the passwordless sign-up screen (phone or email code, no password) to everyone, not only
 * inside in-app browsers. One-line switch once it has proven itself there.
 */
export const PASSWORDLESS_SIGNUP_EVERYWHERE = false;

/** Sign-up uses the passwordless screen in in-app browsers (or everywhere, see above; ?passwordless=1 to preview). */
export function showPasswordlessSignup(isInAppBrowser: boolean): boolean {
   if (PASSWORDLESS_SIGNUP_EVERYWHERE || isInAppBrowser) return true;
   try {
      return new URLSearchParams(window.location.search).get('passwordless') === '1';
   } catch {
      return false;
   }
}
