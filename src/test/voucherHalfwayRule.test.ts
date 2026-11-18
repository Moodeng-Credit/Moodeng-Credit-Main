import { describe, expect, it } from 'vitest';

import type { RepayStreak } from '@/lib/friendReferrals';
import { getDueDayEnd, getRewardFromAt } from '@/lib/loanDeadline';
import { getRepayRewardLine, getRewardRuleCopy, getRewardWindow } from '@/views/dashboard-v2/dashboardV2Model';

import { formatHeld, repaidTimingLines } from '../../supabase/functions/_shared/rewardTiming';

const streak = (over: Partial<RepayStreak>): RepayStreak => ({ current: 0, best: 0, nextStep: 1, toGo: 1, nextPhp: 50, ...over });

describe('food vouchers: halfway rule', () => {
   // Funded Nov 16 22:04 Manila, due Dec 16 (30-day loan): halfway is Dec 1, so it counts from 00:00 Dec 1.
   const funded = '2026-11-16T14:04:22Z';
   const due = '2026-12-16T00:00:00Z';
   const zone = 'Asia/Manila';

   it('counts from the start of the halfway day, in the loan zone', () => {
      expect(getRewardFromAt(funded, due, zone)?.toISOString()).toBe('2026-11-30T16:00:00.000Z');
   });

   it('never sooner than 48 hours after funding (the fast-repay rule)', () => {
      const shortDue = '2026-11-17T00:00:00Z'; // due the next day
      expect(getRewardFromAt(funded, shortDue, zone)?.toISOString()).toBe('2026-11-18T14:04:22.000Z');
   });

   it('names the dates that count on the loan card before halfway, the plain line after', () => {
      const rewardFrom = getRewardFromAt(funded, due, zone)?.toISOString() ?? null;
      const card = { rewardFrom, deadline: getDueDayEnd(due, zone).toISOString(), zone };
      const window = getRewardWindow(card, Date.parse('2026-11-18T06:00:00Z'));
      expect(window).toEqual({ from: 'Dec 1', to: 'Dec 16' });
      expect(getRepayRewardLine(streak({}), 28, 'en', window)).toBe('Pay Dec 1 – Dec 16 → ₱50 food');
      expect(getRepayRewardLine(streak({ current: 1, best: 1, nextStep: 3, toGo: 2 }), 28, 'fil', window)).toBe(
         'Magbayad Dec 1 – Dec 16 → 🔥 streak 2'
      );
      expect(getRewardWindow(card, Date.parse('2026-12-02T00:00:00Z'))).toBeNull();
      expect(getRewardWindow({ ...card, rewardFrom: null })).toBeNull();
   });

   it('tells early repayers there is no reward and to message us', () => {
      expect(getRewardRuleCopy('en').earlyPaidBody).toBe("Early payments don't get the food reward. Want it anyway? Message us.");
      expect(getRewardRuleCopy('en').countsFrom('Dec 1')).toBe('🍗 Food reward counts from Dec 1. Paying now is fine.');
   });
});

describe('team cards: held time', () => {
   it('formats hours', () => {
      expect(formatHeld(39.7)).toBe('1d 16h');
      expect(formatHeld(5)).toBe('5h');
      expect(formatHeld(720)).toBe('30d');
   });

   it('flags an early repayment with the unlock command', () => {
      const early = {
         heldHours: 39.7,
         termHours: 721,
         rewardFrom: '2026-11-30T16:00:00Z',
         zone: 'Asia/Manila',
         early: true,
         unlocked: false
      };
      expect(repaidTimingLines(early, '@sample_borrower')).toEqual([
         '⏱ Held 1d 16h of 30d 1h · ⏩ paid early (rewards count from their Dec 1)',
         'No food voucher for this one. If they ask for it: /unlockreward @sample_borrower'
      ]);
      expect(repaidTimingLines({ ...early, early: false, heldHours: 600 }, '@sample_borrower')).toEqual(['⏱ Held 25d of 30d 1h']);
      expect(repaidTimingLines(null, '@sample_borrower')).toEqual([]);
   });
});
