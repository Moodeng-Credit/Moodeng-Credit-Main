import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildCalendarLinks, prefersIcsCalendar } from '@/lib/calendarLinks';
import { EMPTY_STREAK, parseMyRewards, type RepayStreak } from '@/lib/friendReferrals';
import { getRepayRewardLine, getStreakCardCopy, hasStreakToShow } from '@/views/dashboard-v2/dashboardV2Model';

import { buildDuePushPayload } from '../../supabase/functions/_shared/pushMessages';
import {
   buildRepayRewardLine,
   buildRewardReply,
   dueLabelFor,
   isRewardMessage,
   parseRepayRewardPreview
} from '../../supabase/functions/_shared/repayReward';

const streak = (over: Partial<RepayStreak>): RepayStreak => ({ current: 0, best: 0, nextStep: 1, toGo: 1, nextPhp: 50, ...over });

describe('repay streak: loan card', () => {
   it('names the food voucher when this payment earns it', () => {
      expect(getRepayRewardLine(streak({}), 5, 'en')).toBe('Pay on time → ₱50 food');
      expect(getRepayRewardLine(streak({}), 0, 'en')).toBe('Pay today → ₱50 food');
      expect(getRepayRewardLine(streak({ current: 2, best: 2, nextStep: 3 }), 3, 'fil')).toBe('Magbayad on time → ₱50 food');
   });

   it('shows the streak it grows, and on the due day the streak it saves', () => {
      const one = streak({ current: 1, best: 1, nextStep: 3, toGo: 2 });
      expect(getRepayRewardLine(one, 4, 'en')).toBe('Pay on time → 🔥 streak 2');
      expect(getRepayRewardLine(one, 0, 'en')).toBe('Pay today to keep your 🔥 1 streak');
   });

   it('says nothing for an overdue loan or with no streak rewards', () => {
      expect(getRepayRewardLine(streak({}), -1, 'en')).toBeNull();
      expect(getRepayRewardLine(EMPTY_STREAK, 3, 'en')).toBeNull();
      expect(hasStreakToShow(EMPTY_STREAK)).toBe(false);
   });

   it('card copy counts what is left', () => {
      expect(getStreakCardCopy(streak({ current: 1, best: 1, nextStep: 3, toGo: 2 }), 'en')).toEqual({
         title: '🔥 1 on time in a row',
         caption: '2 on-time payments to go → ₱50 food'
      });
      expect(getStreakCardCopy(streak({ current: 6, best: 6, nextStep: null, toGo: null, nextPhp: null }), 'en').caption).toBe(
         'Every streak treat earned. Keep it going!'
      );
   });

   it('parses the streak from get_my_rewards(), defaulting to none', () => {
      expect(parseMyRewards({ streak: { current: 2, best: 3, nextStep: 5, toGo: 3, nextPhp: 50 } }).streak).toEqual({
         current: 2,
         best: 3,
         nextStep: 5,
         toGo: 3,
         nextPhp: 50
      });
      expect(parseMyRewards({}).streak).toEqual(EMPTY_STREAK);
   });
});

describe('repay streak: reminders', () => {
   const preview = parseRepayRewardPreview({ current: 0, best: 0, nextStep: 1, toGo: 1, nextPhp: 50 });

   afterEach(() => vi.unstubAllGlobals());

   it('leads the push with the reward', () => {
      vi.stubGlobal('Deno', { env: { get: () => undefined } });
      const push = buildDuePushPayload('final_reminder', { loanCount: 1, totalAmount: 16.5, dueLabel: '24 hours', reward: preview }, 'en');
      expect(push.body.startsWith('🎁 Pay on time and get ₱50 food.')).toBe(true);
      const plain = buildDuePushPayload('final_reminder', { loanCount: 1, totalAmount: 16.5, dueLabel: '24 hours' }, 'en');
      expect(plain.body).not.toContain('₱');
   });

   it('never promises a reward on an overdue notice or in Indonesian', () => {
      expect(buildRepayRewardLine(preview, 'overdue')).toBeNull();
      expect(buildRepayRewardLine(preview, 'final_reminder', 'id')).toBeNull();
      expect(buildRepayRewardLine(null, 'final_reminder')).toBeNull();
   });

   it('on the due day asks to keep the streak', () => {
      const two = parseRepayRewardPreview({ current: 2, best: 4, nextStep: 5, toGo: 3, nextPhp: 50 });
      expect(buildRepayRewardLine(two, 'due_today')).toBe('🔥 Pay today to keep your 2 streak.');
      expect(buildRepayRewardLine(two, 'final_reminder')).toBe('🔥 Pay on time to reach streak 3. ₱50 food at streak 5.');
   });
});

describe('repay streak: REWARD on Messenger', () => {
   it('recognises the keyword only as the whole message', () => {
      expect(isRewardMessage('REWARD')).toBe(true);
      expect(isRewardMessage(' my rewards? ')).toBe(true);
      expect(isRewardMessage('reward ko')).toBe(true);
      expect(isRewardMessage('where is my reward voucher, it did not arrive')).toBe(false);
   });

   it('labels the due day in the loan zone', () => {
      const now = new Date('2026-12-12T18:00:00Z'); // Dec 13, 02:00 in Manila
      expect(dueLabelFor('2026-12-13T00:00:00+00:00', 'Asia/Manila', now)).toBe('today');
      expect(dueLabelFor('2026-12-14T00:00:00+00:00', 'Asia/Manila', now)).toBe('tomorrow');
      expect(dueLabelFor('2026-12-10T00:00:00+00:00', 'Asia/Manila', now)).toBe('now (overdue)');
   });

   it('builds the reply', () => {
      expect(buildRewardReply({ streak: 2, rewardLine: '🎁 Pay on time and get ₱50 food.', owed: 16.5, dueLabel: 'tomorrow' })).toBe(
         "🔥 2 on time in a row.\nYou have $16.50 due tomorrow.\n🎁 Pay on time and get ₱50 food.\nWe'll remind you here before it's due."
      );
   });
});

describe('add to calendar', () => {
   it('builds a Google link and an .ics with alerts', () => {
      const links = buildCalendarLinks({
         title: 'Repay Moodeng loan · $16.50',
         details: 'Repay today',
         start: new Date('2026-12-13T01:00:00Z'),
         minutes: 30,
         alertsMinutesBefore: [0, 1440]
      });
      expect(links.google).toContain('dates=20261213T010000Z/20261213T013000Z');
      expect(decodeURIComponent(links.ics)).toContain('TRIGGER:-PT1440M');
      expect(prefersIcsCalendar('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true);
      expect(prefersIcsCalendar('Mozilla/5.0 (Linux; Android 14)')).toBe(false);
   });
});
