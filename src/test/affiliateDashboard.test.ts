import { describe, expect, it } from 'vitest';

import {
   affiliateMilestones,
   type AffiliateReferral,
   affiliateTotals,
   friendChecks,
   newPayouts,
   nextAffiliatePayday,
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

   it('puts each friend on step 1–4: signed up → approved/rejected → has a loan → repaid', () => {
      expect(referralStep(base)).toBe(1);
      expect(referralStep({ ...base, access: 'pending' })).toBe(1);
      expect(referralStep({ ...base, access: 'approved' })).toBe(2);
      expect(referralStep({ ...base, access: 'rejected' })).toBe(2);
      expect(referralStep({ ...base, access: 'approved', borrowed: true })).toBe(3);
      expect(referralStep({ ...base, borrowed: true, repaid: true })).toBe(4);
   });

   it('shows the team’s call before the first loan', () => {
      expect(referralStage({ ...base, access: 'none' })).toBe('signed_up');
      expect(referralStage({ ...base, access: 'pending' })).toBe('checking');
      expect(referralStage({ ...base, access: 'approved' })).toBe('approved');
      expect(referralStage({ ...base, access: 'rejected' })).toBe('rejected');
      // A loan already taken outranks a later status change.
      expect(referralStage({ ...base, access: 'rejected', borrowed: true })).toBe('borrowed');
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

   it('shows documents then call status for friends not approved yet', () => {
      const now = new Date('2026-11-19T12:00:00Z');
      const labels = (r: AffiliateReferral) => friendChecks(r, now).checks.map((c) => c.label);
      expect(labels({ ...base, screening: 'not_started' })).toEqual(['Pre-screening not done']);
      expect(friendChecks({ ...base, screening: 'need_more' }, now).todo).toBe('Ask them to answer our questions on Messenger');
      expect(labels({ ...base, screening: 'under_review' })).toEqual(['Documents under review']);
      expect(labels({ ...base, screening: 'validated' })).toEqual(['Documents validated', 'Call to be booked']);
      const booked = friendChecks({ ...base, screening: 'validated', access: 'pending', call_at: '2026-11-20T05:00:00Z' }, now);
      expect(booked.checks[1]).toMatchObject({ label: 'Call booked', at: '2026-11-20T05:00:00Z' });
      expect(labels({ ...base, screening: 'validated', access: 'pending', call_at: '2026-11-18T05:00:00Z' })).toEqual([
         'Documents validated',
         'Call done'
      ]);
      expect(labels({ ...base, call_missed: true })).toEqual(['Missed the call']);
      expect(friendChecks({ ...base, access: 'approved', screening: 'validated' }, now).checks).toEqual([]);
      expect(friendChecks({ ...base, borrowed: true }, now).checks).toEqual([]);
   });
});

describe('funded-friend rewards (pay on funding, paid on the 15th and 30th)', () => {
   it('a funded friend is owed before they repay, then paid', () => {
      const funded = { ...base, borrowed: true, funded_reward: true, payout_status: 'unpaid' as const };
      expect(referralStage(funded)).toBe('owed');
      expect(referralStage({ ...funded, payout_status: 'paid' })).toBe('paid');
      const totals = affiliateTotals([funded]);
      expect(totals.owed).toBe(10);
      expect(totals.earned).toBe(10);
      expect(totals.repaid).toBe(0);
   });

   it('an old-rule friend with a loan still waits for repayment', () => {
      expect(referralStage({ ...base, borrowed: true })).toBe('borrowed');
   });

   it('picks the next payday in Bangkok time', () => {
      const day = (iso: string) => nextAffiliatePayday(new Date(iso)).toISOString().slice(0, 10);
      expect(day('2026-11-27T03:00:00Z')).toBe('2026-11-30');
      expect(day('2026-12-15T03:00:00Z')).toBe('2026-12-15');
      expect(day('2026-12-16T03:00:00Z')).toBe('2026-12-30');
      expect(day('2026-12-31T03:00:00Z')).toBe('2027-01-15');
      expect(day('2027-02-20T03:00:00Z')).toBe('2027-02-28');
      // 23:30 UTC on the 15th is already the 16th in Bangkok.
      expect(day('2026-12-15T23:30:00Z')).toBe('2026-12-30');
   });
});
