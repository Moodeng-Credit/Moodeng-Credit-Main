import { describe, expect, it } from 'vitest';

import { getAuthConfirmDestination, getAuthEmailOtpType, isPasswordRecoveryRedirect, sessionHasRecoveryAmr } from '@/app/auth/confirm/page';

const fakeAccessToken = (payload: Record<string, unknown>) => {
   const base64url = (input: string) => btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
   const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
   const body = base64url(JSON.stringify(payload));
   return `${header}.${body}.signature`;
};

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

   it('detects a recovery session from the access token amr claim, even without a recovery URL or event', () => {
      const token = fakeAccessToken({ amr: [{ method: 'recovery', timestamp: 123 }] });
      expect(sessionHasRecoveryAmr(token)).toBe(true);
   });

   it('does not flag a normal password/oauth session as recovery', () => {
      const token = fakeAccessToken({ amr: [{ method: 'password', timestamp: 123 }] });
      expect(sessionHasRecoveryAmr(token)).toBe(false);
   });

   it('handles missing or malformed tokens without throwing', () => {
      expect(sessionHasRecoveryAmr(null)).toBe(false);
      expect(sessionHasRecoveryAmr(undefined)).toBe(false);
      expect(sessionHasRecoveryAmr('not-a-jwt')).toBe(false);
   });
});
