import { describe, expect, it } from 'vitest';

import type { RepayStreak } from '@/lib/friendReferrals';
import type { Loan } from '@/types/loanTypes';
import { FAST_REPAY_NOTICE_SNOOZE_MS, getFastRepayNotice, isFastRepayNoticeDue } from '@/views/dashboard-v2/fastRepayNotice';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Nov 24 2026, 10:00 Manila.
const NOW = Date.parse('2026-11-24T02:00:00Z');
const firstVoucher: RepayStreak = { current: 0, best: 0, nextStep: 1, toGo: 1, nextPhp: 50 };
const noRewardsLeft: RepayStreak = { current: 0, best: 0, nextStep: null, toGo: null, nextPhp: null };

const loan = (over: Partial<Loan> & { fundedHoursAgo?: number; dueInDays?: number } = {}): Loan => {
   const { fundedHoursAgo = 3, dueInDays = 30, ...rest } = over;
   return {
      id: 'loan-1',
      loanAmount: 15,
      totalRepaymentAmount: 16.5,
      repaidAmount: 0,
      loanStatus: 'Lent',
      dueTimezone: 'Asia/Manila',
      fundedAt: new Date(NOW - fundedHoursAgo * HOUR).toISOString(),
      dueDate: new Date(NOW + dueInDays * DAY).toISOString(),
      ...rest
   } as Loan;
};

const notice = (loans: Loan[], over: Partial<Parameters<typeof getFastRepayNotice>[0]> = {}) =>
   getFastRepayNotice({
      loans,
      now: NOW,
      currentLimit: 15,
      isVerified: true,
      joinedAt: '2026-11-20T00:00:00Z',
      streak: firstVoucher,
      locale: 'en',
      ...over
   });

describe('fast-repay notice: who sees it', () => {
   it('a full-limit loan funded 3h ago: shows the level-up, the 48h mark and the food window', () => {
      const result = notice([loan()]);
      expect(result?.loanId).toBe('loan-1');
      expect(result?.countsFrom.toISOString()).toBe(new Date(NOW - 3 * HOUR + 48 * HOUR).toISOString());
      expect(result?.levelUp).toEqual({ from: 15, to: 25 });
      expect(result?.rewardLine).toMatch(/^Pay .+ – .+ → ₱50 food$/);
      expect(result?.reward?.label).toBe('₱50 food');
      expect(result?.reward?.from).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
   });

   it('nothing once the 48 hours are over', () => {
      expect(notice([loan({ fundedHoursAgo: 49 })])).toBeNull();
   });

   it('a small (trust-building) loan: no level-up, only the food window', () => {
      const result = notice([loan({ loanAmount: 5, totalRepaymentAmount: 5.5 })]);
      expect(result?.levelUp).toBeNull();
      expect(result?.rewardLine).toContain('₱50 food');
   });

   it('nothing when waiting gains nothing (small loan, no streak reward left)', () => {
      expect(notice([loan({ loanAmount: 5, totalRepaymentAmount: 5.5 })], { streak: noRewardsLeft })).toBeNull();
   });

   it('never says wait when the loan is due before the 48 hours are up', () => {
      expect(notice([loan({ dueInDays: 1 })])).toBeNull();
   });

   it('never says wait when another open loan is overdue or due within 2 days', () => {
      const dueSoon = loan({ id: 'loan-2', fundedHoursAgo: 20 * 24, dueInDays: 2 });
      expect(notice([loan(), dueSoon])).toBeNull();
      const overdue = loan({ id: 'loan-3', fundedHoursAgo: 40 * 24, dueInDays: -3 });
      expect(notice([loan(), overdue])).toBeNull();
   });

   it('ignores paid and refunded loans', () => {
      expect(notice([loan({ repaidAmount: 16.5 })])).toBeNull();
      expect(notice([loan({ refundedAt: new Date(NOW).toISOString() })])).toBeNull();
   });
});

describe('fast-repay notice: 24-hour snooze', () => {
   it('shows when never seen, hides for 24h after closing, then shows again', () => {
      expect(isFastRepayNoticeDue(null, NOW)).toBe(true);
      expect(isFastRepayNoticeDue(NOW - 2 * HOUR, NOW)).toBe(false);
      expect(isFastRepayNoticeDue(NOW - FAST_REPAY_NOTICE_SNOOZE_MS, NOW)).toBe(true);
   });
});
