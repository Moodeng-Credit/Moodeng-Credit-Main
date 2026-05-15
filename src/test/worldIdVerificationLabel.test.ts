import { describe, expect, it } from 'vitest';

import { getWorldIdVerificationLabel } from '@/lib/worldIdVerificationLabel';

describe('getWorldIdVerificationLabel', () => {
   it('shows borrower-specific text for active borrower accounts', () => {
      expect(getWorldIdVerificationLabel({ isWorldId: 'ACTIVE', userRole: 'borrower' })).toBe('Verified Borrower');
   });

   it('shows lender-specific text for active lender accounts', () => {
      expect(getWorldIdVerificationLabel({ isWorldId: 'ACTIVE', userRole: 'lender' })).toBe('Verified Lender');
   });

   it('falls back when an active account has no role yet', () => {
      expect(getWorldIdVerificationLabel({ isWorldId: 'ACTIVE', userRole: null })).toBe('Verified');
   });

   it('shows not verified for inactive accounts regardless of role', () => {
      expect(getWorldIdVerificationLabel({ isWorldId: 'INACTIVE', userRole: 'borrower' })).toBe('Not Verified');
   });
});
