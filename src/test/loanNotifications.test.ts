import { afterEach, describe, expect, it } from 'vitest';

import { buildLoanNotificationEmail, getReminderWindows } from '../../supabase/functions/_shared/loanNotifications';

afterEach(() => {
   delete process.env.VITE_SITE_URL;
});

const baseLoan = {
   tracking_id: 'LOAN-123',
   loan_amount: 250,
   total_repayment_amount: 275,
   due_date: '2026-01-15T00:00:00.000Z',
   funded_at: '2026-01-10T00:00:00.000Z',
   borrower_user: 'sam',
   lender_user: 'lender-01'
};

const recipient = {
   username: 'sam',
   email: 'sam@example.com'
};

describe('buildLoanNotificationEmail', () => {
   it('builds a funded email', () => {
      const result = buildLoanNotificationEmail('funded', baseLoan, recipient);

      expect(result.subject).toBe('Your loan has been funded!');
      expect(result.text).toContain('Great news!');
      expect(result.text).toContain('$250.00');
      expect(result.text).toContain('ID: LOAN-123');
      expect(result.text).toContain('lender-01');
      expect(result.text).toContain('Jan 10, 2026');
      expect(result.text).toContain('Your USDC is ready in your wallet!');
      expect(result.text).toContain('$275.00');
      expect(result.text).toContain('Jan 15, 2026');
      expect(result.text).toContain('support@moodeng.app');
   });

   it('builds an urgent reminder email', () => {
      const result = buildLoanNotificationEmail('urgent_reminder', null, recipient, {
         count: 2,
         totalAmount: 550
      });

      expect(result.subject).toBe('Urgent reminder: loans due in 3 days');
      expect(result.text).toContain('Hiii! Moodeng here');
      expect(result.text).toContain('2 loans');
      expect(result.text).toContain('Total to Repay: $550.00');
      expect(result.text).toContain('Good Standing');
      expect(result.text).toContain('support@moodeng.app');
   });

   it('builds a final reminder email with dashboard link', () => {
      process.env.VITE_SITE_URL = 'https://moodeng.app';

      const result = buildLoanNotificationEmail('final_reminder', null, recipient, {
         count: 1,
         totalAmount: 275
      });

      expect(result.subject).toBe('Final reminder: repayment due in 24 hours');
      expect(result.text).toContain('Final splash! 💦');
      expect(result.text).toContain('$275.00');
      expect(result.text).toContain('https://moodeng.app/dashboard');
      expect(result.text).toContain('support@moodeng.app');
   });

   it('builds a weekly digest email', () => {
      const result = buildLoanNotificationEmail('weekly_digest', null, recipient, {
         count: 3,
         totalAmount: 825
      });

      expect(result.subject).toBe('Your Weekly Moodeng Credit Digest');
      expect(result.text).toContain('Your Weekly Moodeng Credit Digest 📊');
      expect(result.text).toContain('Active Loans: 3');
      expect(result.text).toContain('Total Outstanding: $825.00');
      expect(result.text).toContain('Current Tier: [Tier Name]');
      expect(result.text).toContain('trust layer');
      expect(result.text).toContain('support@moodeng.app');
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
