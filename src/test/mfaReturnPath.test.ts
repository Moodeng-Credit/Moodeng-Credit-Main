import { describe, expect, it } from 'vitest';

import { MFA_DEFAULT_RETURN_PATH, safeMfaReturnPath } from '@/lib/mfaReturnPath';

describe('safeMfaReturnPath', () => {
   it('returns the blocked internal path so the user lands where they were headed', () => {
      expect(safeMfaReturnPath({ pathname: '/lender/dashboard' })).toBe('/lender/dashboard');
      expect(safeMfaReturnPath({ pathname: '/account/settings', search: '?section=security' })).toBe(
         '/account/settings?section=security'
      );
   });

   it('refuses protocol-relative and backslash-smuggled hosts (open-redirect guard)', () => {
      expect(safeMfaReturnPath({ pathname: '//evil.example' })).toBe(MFA_DEFAULT_RETURN_PATH);
      expect(safeMfaReturnPath({ pathname: '/\\evil.example' })).toBe(MFA_DEFAULT_RETURN_PATH);
   });

   it('refuses absolute URLs and embedded schemes', () => {
      expect(safeMfaReturnPath({ pathname: 'https://evil.example/steal' })).toBe(MFA_DEFAULT_RETURN_PATH);
      expect(safeMfaReturnPath({ pathname: '/javascript:alert(1)' })).toBe(MFA_DEFAULT_RETURN_PATH);
      expect(safeMfaReturnPath({ pathname: '/redirect?to=https://evil.example' })).toBe(MFA_DEFAULT_RETURN_PATH);
   });

   it('never bounces back to the challenge the user just cleared', () => {
      expect(safeMfaReturnPath({ pathname: '/mfa-challenge' })).toBe(MFA_DEFAULT_RETURN_PATH);
   });

   it('falls back to the dashboard for missing or malformed router state', () => {
      expect(safeMfaReturnPath(undefined)).toBe(MFA_DEFAULT_RETURN_PATH);
      expect(safeMfaReturnPath(null)).toBe(MFA_DEFAULT_RETURN_PATH);
      expect(safeMfaReturnPath('/dashboard')).toBe(MFA_DEFAULT_RETURN_PATH);
      expect(safeMfaReturnPath({})).toBe(MFA_DEFAULT_RETURN_PATH);
      expect(safeMfaReturnPath({ pathname: '' })).toBe(MFA_DEFAULT_RETURN_PATH);
      expect(safeMfaReturnPath({ pathname: 'relative/path' })).toBe(MFA_DEFAULT_RETURN_PATH);
   });

   it('ignores a non-string or malformed search fragment rather than concatenating garbage', () => {
      expect(safeMfaReturnPath({ pathname: '/dashboard', search: 123 })).toBe('/dashboard');
      expect(safeMfaReturnPath({ pathname: '/dashboard', search: 'section=security' })).toBe('/dashboard');
   });
});
