import { describe, expect, it } from 'vitest';

import { buildLoanNotificationEmail, getCloseToDefaultWindow } from '../../supabase/functions/_shared/loanNotifications';

const baseLoan = {
   tracking_id: 'LOAN-123',
   loan_amount: 250,
   total_repayment_amount: 275,
   due_date: '2026-01-15T00:00:00.000Z',
   borrower_user: 'sam'
};

const recipient = {
   username: 'sam',
   email: 'sam@example.com'
};

describe('buildLoanNotificationEmail', () => {
   it('builds a funded email', () => {
      const result = buildLoanNotificationEmail('funded', baseLoan, recipient);

      expect(result.subject).toContain('funded');
      expect(result.text).toContain('Loan ID: LOAN-123');
      expect(result.text).toContain('$250.00');
      expect(result.text).toContain('Jan 15, 2026');
   });

   it('builds a close-to-default email', () => {
      const result = buildLoanNotificationEmail('close_to_default', baseLoan, recipient);

      expect(result.subject).toContain('close to default');
      expect(result.text).toContain('approaching its due date');
      expect(result.text).toContain('Outstanding balance');
   });

   it('builds an overdue email', () => {
      const result = buildLoanNotificationEmail('outstanding', baseLoan, recipient);

      expect(result.subject).toContain('overdue');
      expect(result.text).toContain('now overdue');
   });
});

describe('getCloseToDefaultWindow', () => {
   it('returns an end date shifted by the configured days', () => {
      const referenceDate = new Date('2026-01-01T00:00:00.000Z');
      const { start, end } = getCloseToDefaultWindow(referenceDate, 3);

      expect(start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2026-01-04T00:00:00.000Z');
   });
});
