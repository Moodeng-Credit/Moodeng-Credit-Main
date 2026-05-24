import { describe, expect, it } from 'vitest';

import { buildEmailConfirmationPath } from '@/lib/authPaths';
import { isObfuscatedExistingSignupUser } from '@/store/slices/authSlice';

describe('signup existing auth detection', () => {
   it('detects Supabase obfuscated signup responses for already-confirmed users', () => {
      expect(isObfuscatedExistingSignupUser({ identities: [] })).toBe(true);
   });

   it('keeps normal signup responses eligible for email confirmation', () => {
      expect(
         isObfuscatedExistingSignupUser({
            identities: [{ id: 'identity-id' }]
         } as Parameters<typeof isObfuscatedExistingSignupUser>[0])
      ).toBe(false);
      expect(isObfuscatedExistingSignupUser(null)).toBe(false);
   });

   it('sends new signup users to the email-link confirmation screen', () => {
      expect(buildEmailConfirmationPath('new.user@example.com')).toBe('/auth-success?type=verify&email=new.user%40example.com');
      expect(buildEmailConfirmationPath('')).toBe('/auth-success?type=verify');
   });
});
