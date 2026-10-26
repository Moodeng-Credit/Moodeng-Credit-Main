// Code-based confirmation avoids the PKCE/magic-link "code verifier not found in
// storage" error caused by email scanners prefetching the confirmation link before
// the user clicks it (same issue solved for password reset — see /forgot-password).
export function buildEmailConfirmationPath(email?: string): string {
   const trimmedEmail = email?.trim();
   return `/auth/verify-code${trimmedEmail ? `?email=${encodeURIComponent(trimmedEmail)}` : ''}`;
}

// Passwordless sign-in by SMS: same code screen, keyed by the E.164 number instead of an email.
export function buildPhoneCodePath(phone: string): string {
   return `/auth/verify-code?phone=${encodeURIComponent(phone)}`;
}

// Shared between /sign-up and /auth/verify-code: both send/resend the same signup
// confirmation email, so a resend on either page should lock the same 60s cooldown.
export const SIGNUP_RESEND_STORAGE_KEY = 'moodeng_signup_resend_at';

// Shared between /auth/verify-code and /auth/confirm: lets a failed magic-link
// recover into the code flow with the email already filled in.
export const PENDING_VERIFICATION_EMAIL_KEY = 'moodeng_pending_verification_email';

// SMS codes: the Send SMS hook refuses a second text to the same number within 60s, so the
// resend button locks for the same time.
export const SMS_RESEND_STORAGE_KEY = 'moodeng_sms_resend_at';
