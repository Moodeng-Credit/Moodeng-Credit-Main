import { describe, expect, it } from 'vitest';

import { getAuthConfirmDestination, getAuthEmailOtpType, isPasswordRecoveryRedirect } from '@/app/auth/confirm/page';

describe('auth confirm recovery routing', () => {
   it('recognizes Supabase recovery redirects with a recovery type', () => {
      expect(isPasswordRecoveryRedirect(new URL('https://staging.dashboard.moodeng.app/auth/confirm?type=recovery&code=abc'))).toBe(true);
   });

   it('recognizes recovery redirects that use next reset-password', () => {
      expect(isPasswordRecoveryRedirect(new URL('https://staging.dashboard.moodeng.app/auth/confirm?next=/reset-password&code=abc'))).toBe(
         true
      );
   });

   it('keeps recovery users on reset-password after the session is stored', () => {
      expect(getAuthConfirmDestination(true, 'borrower')).toBe('/reset-password');
   });

   it('keeps normal email confirmation routing unchanged', () => {
      expect(getAuthConfirmDestination(false, 'borrower')).toBe('/dashboard');
      expect(getAuthConfirmDestination(false, null)).toBe('/auth-success?type=created');
   });

   it('accepts signup token hash redirects from email confirmation links', () => {
      expect(getAuthEmailOtpType(new URL('https://staging.dashboard.moodeng.app/auth/confirm?token_hash=abc&type=signup'))).toBe('signup');
   });

   it('accepts email token hash redirects from link-only confirmation emails', () => {
      expect(getAuthEmailOtpType(new URL('https://staging.dashboard.moodeng.app/auth/confirm?token_hash=abc&type=email'))).toBe('email');
   });
});
