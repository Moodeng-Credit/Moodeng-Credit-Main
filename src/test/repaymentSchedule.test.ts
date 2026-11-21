import { describe, expect, it } from 'vitest';

import { minimumRepayment } from '@/lib/loanPricing';
import {
   buildTwoPartSchedule,
   canSplitRepayment,
   currentDueDate,
   currentMilestone,
   describeSchedule,
   nextMilestone,
   parseRepaymentSchedule
} from '@/lib/repaymentSchedule';
import { buildTelegramLoanRequestMessage } from '../../supabase/functions/_shared/telegramLoanNotifications';
import { reminderRowCounts, reminderView } from '../../supabase/functions/_shared/repaymentSchedule';

const schedule = [
   { due: '2026-12-15', amount: 55 },
   { due: '2027-01-15', amount: 55 }
];

describe('two-payment schedule', () => {
   it('is offered only over $60 and for at least 4 weeks', () => {
      expect(canSplitRepayment(100, '2026-11-15', '2027-01-15')).toBe(true);
      expect(canSplitRepayment(60, '2026-11-15', '2027-01-15')).toBe(false);
      expect(canSplitRepayment(100, '2026-11-15', '2026-12-01')).toBe(false);
   });

   it('splits in half: first halfway, second on the date, odd cent on the second', () => {
      expect(buildTwoPartSchedule(110, '2026-11-15', '2027-01-15')).toEqual([
         { due: '2026-12-16', amount: 55 },
         { due: '2027-01-15', amount: 55 }
      ]);
      const odd = buildTwoPartSchedule(115.01, '2026-11-15', '2027-01-15');
      expect(odd[0].amount + odd[1].amount).toBeCloseTo(115.01, 2);
      expect(odd[1].amount).toBe(57.51);
   });

   it('tracks the next payment as money comes in', () => {
      expect(nextMilestone(schedule, 0)).toMatchObject({ index: 0, due: '2026-12-15', amountLeft: 55 });
      expect(nextMilestone(schedule, 20)).toMatchObject({ index: 0, amountLeft: 35 });
      expect(nextMilestone(schedule, 55)).toMatchObject({ index: 1, due: '2027-01-15', amountLeft: 55 });
      expect(nextMilestone(schedule, 70)).toMatchObject({ index: 1, amountLeft: 40 });
      expect(nextMilestone(schedule, 110)).toBeNull();
   });

   it('gives the app the next payment day, and the loan date when there is no schedule', () => {
      const loan = { dueDate: '2027-01-15T00:00:00.000Z', repaidAmount: 0, repaymentSchedule: schedule };
      expect(currentDueDate(loan)).toBe('2026-12-15T00:00:00.000Z');
      expect(currentDueDate({ ...loan, repaidAmount: 55 })).toBe('2027-01-15T00:00:00.000Z');
      expect(currentDueDate({ dueDate: '2027-01-15T00:00:00.000Z' })).toBe('2027-01-15T00:00:00.000Z');
      expect(currentMilestone({ repaidAmount: 0 })).toBeNull();
   });

   it('reads only well-formed schedules', () => {
      expect(parseRepaymentSchedule(schedule)).toEqual(schedule);
      expect(parseRepaymentSchedule(null)).toBeNull();
      expect(parseRepaymentSchedule([{ due: '2026-12-15', amount: 55 }])).toBeNull();
      expect(parseRepaymentSchedule([{ due: 'soon', amount: 55 }, { due: '2027-01-15', amount: 55 }])).toBeNull();
   });

   it('describes it for lenders', () => {
      expect(describeSchedule(schedule)).toBe('$55 Dec 15 · $55 Jan 15');
   });
});

describe('fair price for 2 parts', () => {
   it('charges 10% a month on what is still owed: $100 over 2 months is $115, not $120', () => {
      const now = new Date('2026-11-15T00:00:00Z');
      expect(minimumRepayment(100, '2027-01-14T00:00:00Z', now)?.amount).toBe(120);
      expect(minimumRepayment(100, '2027-01-14T00:00:00Z', now, { split: true })?.amount).toBe(115);
   });
});

describe('reminders for a split loan', () => {
   const row = {
      id: 'loan-1',
      due_date: '2027-01-15T00:00:00.000Z',
      total_repayment_amount: 110,
      repaid_amount: 0,
      repayment_schedule: schedule
   };

   it('remind about the next payment: its day and its amount', () => {
      const view = reminderView(row);
      expect(view.due_date).toBe('2026-12-15T00:00:00.000Z');
      expect(Number(view.total_repayment_amount) - Number(view.repaid_amount)).toBe(55);
      expect(view.reminders_count_after).toBeNull();
   });

   it("don't let the first payment's reminders block the second's", () => {
      const view = reminderView({ ...row, repaid_amount: 55 });
      expect(view.due_date).toBe('2027-01-15T00:00:00.000Z');
      expect(reminderRowCounts('2026-12-14T02:00:00Z', view.reminders_count_after)).toBe(false);
      expect(reminderRowCounts('2027-01-12T02:00:00Z', view.reminders_count_after)).toBe(true);
      expect(reminderRowCounts('2026-12-20T02:00:00Z', view.overdue_count_after)).toBe(false);
   });

   it('leave single-payment loans alone', () => {
      const plain = { ...row, repayment_schedule: null };
      expect(reminderView(plain)).toBe(plain);
   });
});

describe('Telegram new-request post', () => {
   it('lists both payments', () => {
      const text = buildTelegramLoanRequestMessage(
         {
            id: 'loan-1',
            loan_amount: 100,
            total_repayment_amount: 110,
            due_date: '2027-01-15T00:00:00.000Z',
            created_at: '2026-11-15T00:00:00.000Z',
            reason: 'Rent',
            repayment_schedule: schedule
         },
         [],
         null,
         'https://example.test/loan'
      );
      expect(text).toContain('🗓 2 payments: $55 Dec 15 · $55 Jan 15');
   });
});
