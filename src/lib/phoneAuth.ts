import { isLikelyPhilippines } from '@/lib/isLikelyPhilippines';

// Phone sign-in is Philippines only: SMS codes go out through UniSMS, a PH-only gateway, on its
// shared "Unisoft" sender, which reaches Globe, TM and DITO but not Smart, TNT or Sun.
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

export type PhNetwork = 'globe' | 'dito' | 'smart';

// First four digits → network, from the NTC assignments as listed by FilipiKnow and Wikipedia
// (Oct 2026). Only prefixes both agree on: anything unclear (0924/0934/0944 moved from Sun to DITO,
// 0951, 0970, 0973, 0974…) is left out and treated as unknown, which never blocks anyone. People
// can also keep their number when they switch networks, so this is a hint, not a rule.
const GLOBE_PREFIXES = new Set(
   '0817 0904 0905 0906 0915 0916 0917 0926 0927 0935 0936 0937 0945 0952 0953 0954 0955 0956 0965 0966 0967 0975 0976 0977 0978 0979 0995 0996 0997'.split(
      ' '
   )
);
const DITO_PREFIXES = new Set('0895 0896 0897 0898 0991 0992 0993 0994'.split(' '));
// Smart, TNT and Sun (Smart's).
const SMART_PREFIXES = new Set(
   '0813 0907 0908 0909 0910 0911 0912 0913 0914 0918 0919 0920 0921 0922 0923 0925 0928 0929 0930 0931 0932 0933 0938 0939 0940 0941 0942 0943 0946 0947 0948 0949 0950 0960 0961 0962 0963 0964 0968 0969 0981 0985 0989 0998 0999'.split(
      ' '
   )
);

/** The network a PH mobile number (+639XXXXXXXXX) was issued on, or null when we can't tell. */
export function phNetwork(e164: string): PhNetwork | null {
   const local = e164.replace(/^\+63/, '');
   if (!/^9\d{9}$/.test(local)) return null;
   const prefix = `0${local.slice(0, 3)}`;
   if (GLOBE_PREFIXES.has(prefix)) return 'globe';
   if (DITO_PREFIXES.has(prefix)) return 'dito';
   if (SMART_PREFIXES.has(prefix)) return 'smart';
   return null;
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

/** True while the account still has the made-up phone sign-up handle, i.e. they never picked one. */
export function hasGeneratedUsername(username: string | null | undefined): boolean {
   return Boolean(username?.startsWith('moodeng-'));
}

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

/** What the username box keeps as they type: lowercase letters, digits, - and _ (it's a URL part). */
export function cleanUsernameInput(raw: string): string {
   return raw
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, USERNAME_MAX_LENGTH);
}

/** A starting suggestion from their name: "María Santos" → "mariasantos". Empty if nothing usable. */
export function suggestUsername(name: string): string {
   const base = cleanUsernameInput(name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '')).replace(/^[-_]+|[-_]+$/g, '');
   return base.length >= USERNAME_MIN_LENGTH && !hasGeneratedUsername(base) ? base : '';
}

/** Why a typed username can't be used, or null if it can (whether it's taken is checked separately). */
export function usernameProblem(username: string): string | null {
   if (username.length < USERNAME_MIN_LENGTH) return `Use at least ${USERNAME_MIN_LENGTH} letters or numbers.`;
   if (!/^[a-z0-9]/.test(username) || /[-_]$/.test(username)) return 'Start and end with a letter or number.';
   if (hasGeneratedUsername(username)) return 'Pick something of your own.';
   return null;
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

/** Placeholder addresses for accounts that signed up without an email (Telegram, LINE, TikTok, phone, guests). */
export function isPlaceholderEmail(email?: string | null): boolean {
   return /^(telegram|line|tiktok|phone|guest)_[^@]+@moodeng\.(app|credit)$/i.test((email ?? '').trim());
}

/** TikTok sign-ups: the tiktok-login edge fn gives them tiktok_<hash>@moodeng.app (TikTok shares no email). */
export function isTikTokAccountEmail(email?: string | null): boolean {
   return /^tiktok_[^@]+@moodeng\.app$/i.test((email ?? '').trim());
}

export const SMS_TEST_FLAG_KEY = 'moodeng:sms-login-test';

// On since 19 Oct 2026: codes go out through UniSMS (Semaphore never approved a sender name). The
// switch back off is this line.
export const SMS_LOGIN_ON = true;

/**
 * Whether the phone (SMS code) option is offered. ?sms=0 turns it off for this browser (and ?sms=1
 * back on), for testing either way. Email codes always work.
 */
export function isSmsLoginEnabled(): boolean {
   try {
      const flag = new URLSearchParams(window.location.search).get('sms');
      if (flag === '1' || flag === '0') localStorage.setItem(SMS_TEST_FLAG_KEY, flag);
      const stored = localStorage.getItem(SMS_TEST_FLAG_KEY);
      if (stored === '0') return false;
      if (stored === '1') return true;
   } catch {
      // Storage blocked: the default below.
   }
   return SMS_LOGIN_ON;
}

/**
 * Show the passwordless sign-up screen (phone or email code, no password) to everyone, not only
 * inside in-app browsers. One-line switch once it has proven itself there.
 */
export const PASSWORDLESS_SIGNUP_EVERYWHERE = false;

/**
 * Visitors in the Philippines (outside in-app browsers, which already lead with the code form) get
 * a GCash-style page: the +63 mobile number box first, Google/Telegram/email under it.
 */
export function showPhoneFirst(isInAppBrowser: boolean): boolean {
   return !isInAppBrowser && isSmsLoginEnabled() && isLikelyPhilippines();
}

/** Sign-up uses the passwordless screen in in-app browsers (or everywhere, see above; ?passwordless=1 to preview). */
export function showPasswordlessSignup(isInAppBrowser: boolean): boolean {
   if (PASSWORDLESS_SIGNUP_EVERYWHERE || isInAppBrowser) return true;
   try {
      return new URLSearchParams(window.location.search).get('passwordless') === '1';
   } catch {
      return false;
   }
}
