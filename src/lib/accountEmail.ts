import { getAuthRedirectUrl } from '@/lib/authRedirect';
import { isPlaceholderEmail } from '@/lib/phoneAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Phone-only accounts (and Telegram/LINE ones) have no real email. They can add one while
// creating their wallet and confirm it later with a code, without leaving Facebook's browser.

export const DUPLICATE_EMAIL_MESSAGE = 'This email already has a Moodeng account. Log in with it instead?';

/** Fired after an email is added, confirmed or changed, so every useAccountEmail re-reads. */
export const ACCOUNT_EMAIL_CHANGED_EVENT = 'moodeng:account-email-changed';

export function notifyAccountEmailChanged(): void {
   if (typeof window !== 'undefined') window.dispatchEvent(new Event(ACCOUNT_EMAIL_CHANGED_EVENT));
}

/** A real, confirmed email on the account (not empty, not a telegram_/line_/phone_ placeholder). */
export function hasRealEmail(authEmail?: string | null, profileEmail?: string | null): boolean {
   const real = (email?: string | null) => Boolean(email?.trim()) && !isPlaceholderEmail(email);
   return real(authEmail) || (!authEmail && real(profileEmail));
}

export function isValidEmail(email: string): boolean {
   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function describeEmailChangeError(err: unknown): { message: string; duplicate?: boolean } {
   const e = (err ?? {}) as { message?: unknown; code?: unknown; status?: unknown };
   const message = typeof e.message === 'string' ? e.message : '';
   const lower = message.toLowerCase();
   if (
      e.code === 'email_exists' ||
      lower.includes('already been registered') ||
      lower.includes('already registered') ||
      lower.includes('already exists')
   ) {
      return { message: DUPLICATE_EMAIL_MESSAGE, duplicate: true };
   }
   if (
      e.status === 429 ||
      e.code === 'over_email_send_rate_limit' ||
      lower.includes('rate limit') ||
      lower.includes('for security purposes')
   ) {
      return { message: 'Please wait a minute before asking for another email.' };
   }
   if (lower.includes('invalid') && lower.includes('email')) return { message: 'Check your email address and try again.' };
   if (lower.includes('failed to fetch') || lower.includes('load failed') || lower.includes('network')) {
      return { message: 'Could not reach the server. Check your connection and try again.' };
   }
   return { message: message || 'Could not save your email. Try again in a moment.' };
}

/**
 * Adds/changes the account email as a PENDING change: Supabase emails a code + link to the new
 * address and only switches the account email once it is confirmed. Nothing waits on that.
 */
export async function requestEmailChange(email: string): Promise<{ pendingEmail: string }> {
   const nextEmail = email.trim().toLowerCase();
   const { data, error } = await getSupabaseBrowserClient().auth.updateUser(
      { email: nextEmail },
      { emailRedirectTo: getAuthRedirectUrl() }
   );
   if (error) throw error;
   notifyAccountEmailChanged();
   return { pendingEmail: data.user?.new_email || nextEmail };
}

export async function resendEmailChange(email: string): Promise<void> {
   const { error } = await getSupabaseBrowserClient().auth.resend({ type: 'email_change', email });
   if (error) throw error;
}

// "Confirm your email" on the dashboard can be put away for a few days (per address).
const DISMISS_KEY = 'moodeng:confirm-email-dismissed';
const DISMISS_MS = 3 * 24 * 60 * 60 * 1000;

export function isConfirmEmailReminderDismissed(email: string, now = Date.now()): boolean {
   try {
      const saved = JSON.parse(localStorage.getItem(DISMISS_KEY) ?? 'null') as { email?: string; at?: number } | null;
      return saved?.email === email && typeof saved.at === 'number' && now - saved.at < DISMISS_MS;
   } catch {
      return false;
   }
}

export function dismissConfirmEmailReminder(email: string, now = Date.now()): void {
   try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify({ email, at: now }));
   } catch {
      // ignore (private mode / storage disabled)
   }
}
