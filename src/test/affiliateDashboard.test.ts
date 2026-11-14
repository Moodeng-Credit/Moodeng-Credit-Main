import { describe, expect, it } from 'vitest';

import {
   affiliateMilestones,
   type AffiliateReferral,
   affiliateTotals,
   newPayouts,
   referralStage,
   referralStep,
   splitCodes
} from '@/lib/affiliateDashboard';

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

   it('tracks claimed friends without ever owing money for them', () => {
      const claimed = { ...base, claimed: true, payout_amount: 0 };
      expect(referralStage({ ...claimed, borrowed: true, repaid: true })).toBe('repaid');
      expect(referralStage({ ...claimed, borrowed: true })).toBe('borrowed');
      const totals = affiliateTotals([
         { ...claimed, borrowed: true, repaid: true },
         { ...claimed, borrowed: true }
      ]);
      expect(totals).toEqual({ signedUp: 2, borrowed: 2, repaid: 1, earned: 0, paid: 0, owed: 0, pending: 0 });
   });

   it('shows the most-used code big and tucks the rest away', () => {
      const codes = [
         { code: 'UNUSED', boost_amount: 0, payout_amount: 10, is_active: true },
         { code: 'USED', boost_amount: 0, payout_amount: 10, is_active: true }
      ];
      const { main, others } = splitCodes(codes, [
         { ...base, code: 'USED' },
         { ...base, code: 'UNUSED', claimed: true }
      ]);
      expect(main?.code).toBe('USED');
      expect(others.map((c) => c.code)).toEqual(['UNUSED']);
      expect(splitCodes([], []).main).toBeNull();
   });

   it('puts each friend on step 1, 2 or 3', () => {
      expect(referralStep(base)).toBe(1);
      expect(referralStep({ ...base, borrowed: true })).toBe(2);
      expect(referralStep({ ...base, borrowed: true, repaid: true })).toBe(3);
   });

   it('counts milestones from code friends who repaid, never claimed ones', () => {
      const m = affiliateMilestones([
         { ...base, repaid: true },
         { ...base, repaid: true, claimed: true }
      ]);
      expect(m[0]).toMatchObject({ goal: 1, progress: 1, done: true });
      expect(m[1]).toMatchObject({ goal: 3, progress: 1, done: false });
   });

   it('pops up only payouts newer than the last one seen (14 days on a first visit)', () => {
      const now = Date.parse('2026-11-14T00:00:00Z');
      const paid = (paid_at: string) => ({ ...base, repaid: true, payout_status: 'paid' as const, paid_at });
      const list = [
         paid('2026-11-13T00:00:00Z'),
         paid('2026-10-01T00:00:00Z'),
         { ...base, repaid: true, payout_status: 'unpaid' as const }
      ];
      expect(newPayouts(list, null, now)).toEqual({ count: 1, amount: 10, latest: '2026-11-13T00:00:00Z' });
      expect(newPayouts(list, '2026-11-13T00:00:00Z', now).count).toBe(0);
   });
});
