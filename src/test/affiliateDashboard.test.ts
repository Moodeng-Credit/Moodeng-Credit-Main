import { describe, expect, it } from 'vitest';

import { type AffiliateReferral, affiliateTotals, referralStage } from '@/lib/affiliateDashboard';

const base: AffiliateReferral = {
   first_name: 'Ana',
   code: 'BELLE',
   joined_at: '2026-10-01T00:00:00Z',
   borrowed: false,
   repaid: false,
   payout_amount: 10,
   payout_status: null,
   paid_at: null
};

describe('affiliate dashboard', () => {
   it('walks a referral through signed up → borrowed → owed → paid', () => {
      expect(referralStage(base)).toBe('signed_up');
      expect(referralStage({ ...base, borrowed: true })).toBe('borrowed');
      expect(referralStage({ ...base, borrowed: true, repaid: true, payout_status: 'unpaid' })).toBe('owed');
      expect(referralStage({ ...base, borrowed: true, repaid: true, payout_status: 'paid' })).toBe('paid');
   });

   it('owes only repaid-but-unpaid friends, at each payout row’s own rate', () => {
      const totals = affiliateTotals([
         base,
         { ...base, borrowed: true },
         { ...base, borrowed: true, repaid: true, payout_status: 'unpaid', payout_amount: 5 },
         { ...base, borrowed: true, repaid: true, payout_status: 'paid' }
      ]);
      expect(totals).toEqual({ signedUp: 4, borrowed: 3, repaid: 2, earned: 15, paid: 10, owed: 5, pending: 10 });
   });
});
