import { afterEach, describe, expect, it } from 'vitest';

import {
   buildLoanNotificationEmail,
   buildLoanNotificationTelegram,
   getLoanOutstandingAmount,
   getReminderWindows
} from '../../supabase/functions/_shared/loanNotifications';

afterEach(() => {
   delete process.env.VITE_SITE_URL;
});

const baseLoan = {
   tracking_id: 'LOAN-123',
   loan_amount: 250,
   total_repayment_amount: 275,
   repaid_amount: 25,
   due_date: '2026-01-15T00:00:00.000Z',
   funded_at: '2026-01-10T00:00:00.000Z',
   created_at: '2026-01-01T00:00:00.000Z',
   borrower_user_id: '11111111-1111-1111-1111-111111111111',
   lender_user_id: '22222222-2222-2222-2222-222222222222',
   lender_username: 'lender-01'
};

const recipient = {
   username: 'sam',
   telegram_username: 'jimmymoodengcredit',
   email: 'sam@example.com',
   trust_points_total: 123000000
};

const recipientWithOpportunity = {
   ...recipient,
   trust_points_reward: 20000000,
   trust_points_reward_kind: 'potential' as const
};

const recipientWithEarnedReward = {
   ...recipient,
   trust_points_reward: 20000000,
   trust_points_reward_kind: 'earned' as const
};

const expectSupportChannels = (html: string) => {
   expect(html).toContain('https://t.me/jimmymoodengcredit?text=');
   expect(html).toContain('https://www.facebook.com/profile.php?id=61589106561061');
   expect(html).toContain('Telegram');
   expect(html).toContain('Facebook');
   expect(html).not.toContain('https://t.me/share/url');
};

describe('buildLoanNotificationEmail', () => {
   it('builds a funded email', () => {
      const result = buildLoanNotificationEmail('funded', baseLoan, recipientWithOpportunity);

      expect(result.subject).toBe('Your loan has been funded');
      expect(result.text).toContain('Your loan LOAN-123 has been funded.');
      expect(result.text).toContain('$250.00 USDC');
      expect(result.text).toContain('Total to repay: $275.00 USDC');
      expect(result.text).toContain('Trust point opportunity: +20 pts');
      expect(result.text).toContain('lender-01');
      expect(result.text).toContain('Jan 10, 2026, 00:00 UTC');
      expect(result.text).toContain('Jan 15, 2026, 00:00 UTC');
      expect(result.text).toContain('support@moodeng.app');
      expect(result.html).toContain('Moodeng Credit');
      expect(result.html).toContain('Your loan has been funded');
      expect(result.html).toContain('Loan count');
      expect(result.html).toContain('Repayment due');
      expect(result.html).toContain('Trust point opportunity');
      expect(result.html).toContain('+20 pts');
      expect(result.html).not.toContain('123 pts');
      expectSupportChannels(result.html);
      expect(result.html).toContain('$250.00');
      expect(result.html).toContain('USDC');

      // Ensure no blank lines anywhere (Gmail collapse prevention)
      expect(result.text).not.toMatch(/\n\s*\n/);
   });

   it('builds an urgent reminder email', () => {
      const result = buildLoanNotificationEmail('urgent_reminder', null, recipientWithOpportunity, {
         count: 2,
         totalAmount: 525,
         dueLabel: '3 days',
         nextDueDate: '2026-01-15T00:00:00.000Z'
      });

      expect(result.subject).toBe('Your loan is coming due');
      expect(result.text).toContain('2 loans');
      expect(result.text).toContain('coming due in 3 days');
      expect(result.text).toContain('Due date: Jan 15, 2026, 00:00 UTC');
      expect(result.text).toContain('Total to repay: $525.00 USDC');
      expect(result.text).toContain('Trust point opportunity: +20 pts');
      expect(result.text).toContain('support@moodeng.app');
      expect(result.html).toContain('Your loans are coming due');
      expect(result.html).toContain('Loans due');
      expect(result.html).toContain('Due date');
      expect(result.html).toContain('Good Standing');
      expect(result.html).toContain('Trust point opportunity');
      expect(result.html).toContain('+20 pts');
      expect(result.html).not.toContain('123 pts');
      expectSupportChannels(result.html);
      expect(result.html).toContain('$525.00');
      expect(result.html).toContain('USDC');

      // Ensure no blank lines anywhere (Gmail collapse prevention)
      expect(result.text).not.toMatch(/\n\s*\n/);
   });

   it('builds a final reminder email with dashboard link', () => {
      process.env.VITE_SITE_URL = 'https://moodeng.app';

      const result = buildLoanNotificationEmail('final_reminder', null, recipientWithOpportunity, {
         count: 1,
         totalAmount: 250,
         dueLabel: '24 hours',
         nextDueDate: '2026-01-15T00:00:00.000Z'
      });

      expect(result.subject).toBe('Your repayment is due soon');
      expect(result.text).toContain('1 loan due within 24 hours');
      expect(result.text).toContain('Due date: Jan 15, 2026, 00:00 UTC');
      expect(result.text).toContain('$250.00 USDC');
      expect(result.text).toContain('Trust point opportunity: +20 pts');
      expect(result.text).toContain('https://moodeng.app/repay');
      expect(result.text).toContain('support@moodeng.app');
      expect(result.html).toContain('Your loan is due soon');
      expect(result.html).toContain('Loans due');
      expect(result.html).toContain('Due date');
      expect(result.html).toContain('Trust point opportunity');
      expect(result.html).toContain('+20 pts');
      expect(result.html).not.toContain('123 pts');
      expectSupportChannels(result.html);

      // Ensure no blank lines anywhere (Gmail collapse prevention)
      expect(result.text).not.toMatch(/\n\s*\n/);
   });

   it('builds a weekly digest email', () => {
      const result = buildLoanNotificationEmail('weekly_digest', null, recipient, {
         count: 3,
         totalAmount: 825,
         nextDueDate: '2026-01-15T00:00:00.000Z'
      });

      expect(result.subject).toBe('Your weekly Moodeng Credit digest');
      expect(result.text).toContain('weekly Moodeng Credit digest');
      expect(result.text).toContain('Active loans: 3');
      expect(result.text).toContain('Next due date: Jan 15, 2026, 00:00 UTC');
      expect(result.text).toContain('Total outstanding: $825.00 USDC');
      expect(result.text).toContain('Trust point note: Open Moodeng to review available milestones.');
      expect(result.text).toContain('support@moodeng.app');
      expect(result.html).toContain('Your weekly loan digest');
      expect(result.html).toContain('Active loans');
      expect(result.html).toContain('Next due date');
      expect(result.html).toContain('Trust points');
      expect(result.html).toContain('Review');
      expect(result.html).not.toContain('123 pts');
      expectSupportChannels(result.html);

      // Ensure no blank lines anywhere (Gmail collapse prevention)
      expect(result.text).not.toMatch(/\n\s*\n/);
   });

   it('builds an overdue email', () => {
      const result = buildLoanNotificationEmail('overdue', null, recipientWithOpportunity, {
         count: 1,
         totalAmount: 240,
         dueLabel: '2 days',
         nextDueDate: '2026-01-13T00:00:00.000Z'
      });

      expect(result.subject).toBe('Your loan is overdue');
      expect(result.text).toContain('1 loan overdue');
      expect(result.text).toContain('Due date: Jan 13, 2026, 00:00 UTC');
      expect(result.text).toContain('Overdue by: 2 days');
      expect(result.text).toContain('Overdue amount: $240.00 USDC');
      expect(result.text).toContain('Trust point opportunity: +20 pts');
      expect(result.html).toContain('Your loan is overdue');
      expect(result.html).toContain('Loan overdue');
      expect(result.html).toContain('Due date');
      expect(result.html).toContain('Overdue by');
      expect(result.html).toContain('Trust point opportunity');
      expect(result.html).toContain('+20 pts');
      expect(result.html).not.toContain('123 pts');
      expectSupportChannels(result.html);

      // Ensure no blank lines anywhere (Gmail collapse prevention)
      expect(result.text).not.toMatch(/\n\s*\n/);
   });

   it('builds a repayment received email', () => {
      const result = buildLoanNotificationEmail(
         'repayment_received',
         {
            ...baseLoan,
            repaid_amount: 275,
            repayment_status: 'Paid',
            updated_at: '2026-01-12T00:00:00.000Z'
         },
         recipientWithEarnedReward
      );

      expect(result.subject).toBe('Your repayment was received');
      expect(result.text).toContain('Your repayment for loan LOAN-123 was received.');
      expect(result.text).toContain('Amount repaid: $275.00 USDC');
      expect(result.text).toContain('Paid on: Jan 12, 2026, 00:00 UTC');
      expect(result.text).toContain('Original due date: Jan 15, 2026, 00:00 UTC');
      expect(result.text).toContain('Trust points earned: +20 pts');
      expect(result.html).toContain('Your repayment was received');
      expect(result.html).toContain('Loan count');
      expect(result.html).toContain('Loan status');
      expect(result.html).toContain('Paid on');
      expect(result.html).toContain('Trust points earned');
      expect(result.html).toContain('+20 pts');
      expect(result.html).not.toContain('123 pts');
      expectSupportChannels(result.html);

      // Ensure no blank lines anywhere (Gmail collapse prevention)
      expect(result.text).not.toMatch(/\n\s*\n/);
   });

   it('builds a request expired email', () => {
      process.env.VITE_SITE_URL = 'https://moodeng.app';

      const result = buildLoanNotificationEmail('request_expired', baseLoan, recipient);

      expect(result.subject).toBe('Your loan request expired');
      expect(result.text).toContain('Your loan request LOAN-123 expired before it was funded.');
      expect(result.text).toContain('Requested amount: $250.00 USDC');
      expect(result.text).toContain('Posted on: Jan 1, 2026, 00:00 UTC');
      expect(result.text).toContain('Contact support if you need help connecting with a lender');
      expect(result.text).toContain('https://moodeng.app/support');
      expect(result.html).toContain('Your loan request expired');
      expect(result.html).toContain('Request status');
      expect(result.html).toContain('Contact support');
      expect(result.html).toContain('Support can help');
      expectSupportChannels(result.html);

      // Ensure no blank lines anywhere (Gmail collapse prevention)
      expect(result.text).not.toMatch(/\n\s*\n/);
   });

   it('calculates outstanding amount from the DB repayment fields', () => {
      expect(getLoanOutstandingAmount(baseLoan)).toBe(250);
      expect(getLoanOutstandingAmount({ total_repayment_amount: 100, repaid_amount: 125 })).toBe(0);
   });
});

describe('buildLoanNotificationTelegram', () => {
   it('builds a funded Telegram notification', () => {
      process.env.VITE_SITE_URL = 'https://moodeng.app';

      const result = buildLoanNotificationTelegram('funded', baseLoan, recipient);

      expect(result.actionUrl).toBe('https://moodeng.app/repay');
      expect(result.text).toContain('Loan funded');
      expect(result.text).toContain('@jimmymoodengcredit');
      expect(result.text).toContain('LOAN-123');
      expect(result.text).toContain('$250.00 USDC');
      expect(result.text).toContain('$275.00 USDC');
      expect(result.text).toContain('https://moodeng.app/repay');
      expect(result.text).not.toContain('Credit Score');
   });

   it('builds amount coming due Telegram notifications', () => {
      const urgent = buildLoanNotificationTelegram('urgent_reminder', null, recipient, {
         count: 2,
         totalAmount: 525,
         dueLabel: '3 days'
      });
      const final = buildLoanNotificationTelegram('final_reminder', null, recipient, {
         count: 1,
         totalAmount: 250,
         dueLabel: '24 hours'
      });

      expect(urgent.text).toContain('Amount coming due');
      expect(urgent.text).toContain('2 loans due in 3 days');
      expect(urgent.text).toContain('Amount due: $525.00 USDC');
      expect(final.text).toContain('1 loan due within 24 hours');
      expect(final.text).toContain('stablecoins ready');
   });

   it('builds an overdue Telegram notification', () => {
      const result = buildLoanNotificationTelegram('overdue', null, recipient, {
         count: 1,
         totalAmount: 240
      });

      expect(result.text).toContain('Amount overdue');
      expect(result.text).toContain('1 loan overdue');
      expect(result.text).toContain('Amount overdue: $240.00 USDC');
      expect(result.text).toContain('get back on track');
   });

   it('builds a request expired Telegram notification', () => {
      process.env.VITE_SITE_URL = 'https://moodeng.app';

      const result = buildLoanNotificationTelegram('request_expired', baseLoan, recipient);

      expect(result.actionUrl).toBe('https://moodeng.app/support');
      expect(result.text).toContain('Loan request expired');
      expect(result.text).toContain('@jimmymoodengcredit');
      expect(result.text).toContain('LOAN-123');
      expect(result.text).toContain('$250.00 USDC');
      expect(result.text).toContain('help connecting with a lender');
      expect(result.text).toContain('https://moodeng.app/support');
   });
});

describe('getReminderWindows', () => {
   it('returns final and urgent windows based on hours', () => {
      const referenceDate = new Date('2026-01-01T00:00:00.000Z');
      const { final, urgent } = getReminderWindows(referenceDate, 72, 24);

      expect(final.start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(final.end.toISOString()).toBe('2026-01-02T00:00:00.000Z');
      expect(urgent.start.toISOString()).toBe('2026-01-02T00:00:00.000Z');
      expect(urgent.end.toISOString()).toBe('2026-01-04T00:00:00.000Z');
   });
});
