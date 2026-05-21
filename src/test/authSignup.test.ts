import { describe, expect, it } from 'vitest';

import { isObfuscatedExistingSignupUser } from '@/store/slices/authSlice';

describe('signup existing auth detection', () => {
   it('detects Supabase obfuscated signup responses for already-confirmed users', () => {
      expect(isObfuscatedExistingSignupUser({ identities: [] })).toBe(true);
   });

   it('keeps normal signup responses eligible for email code verification', () => {
      expect(
         isObfuscatedExistingSignupUser({
            identities: [{ id: 'identity-id' }]
         } as Parameters<typeof isObfuscatedExistingSignupUser>[0])
      ).toBe(false);
      expect(isObfuscatedExistingSignupUser(null)).toBe(false);
   });
});
