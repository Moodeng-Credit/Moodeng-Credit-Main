import { describe, expect, it } from 'vitest';

import { shouldShowCashOutTab } from '@/lib/bottomNavCashOut';
import type { Loan } from '@/types/loanTypes';

const NOW = Date.parse('2026-11-13T13:00:00Z');
const HOUR = 60 * 60 * 1000;

const loan = (overrides: Partial<Loan> = {}): Loan =>
   ({
      id: 'loan-1',
      borrowerUser: 'me',
      loanStatus: 'Lent',
      repaymentStatus: 'Pending',
      fundedAt: new Date(NOW - 2 * HOUR).toISOString(),
      ...overrides
   }) as Loan;

describe('shouldShowCashOutTab', () => {
   it('shows Cash out for a loan funded in the last 24h', () => {
      expect(shouldShowCashOutTab([loan()], 'me', NOW)).toBe(true);
   });

   it('switches back to Repay after 24h', () => {
      expect(shouldShowCashOutTab([loan({ fundedAt: new Date(NOW - 25 * HOUR).toISOString() })], 'me', NOW)).toBe(false);
   });

   it('ignores paid, unfunded and other people’s loans', () => {
      expect(shouldShowCashOutTab([loan({ repaymentStatus: 'Paid' })], 'me', NOW)).toBe(false);
      expect(shouldShowCashOutTab([loan({ loanStatus: 'Pending' })], 'me', NOW)).toBe(false);
      expect(shouldShowCashOutTab([loan({ borrowerUser: 'someone-else' })], 'me', NOW)).toBe(false);
      expect(shouldShowCashOutTab([loan({ fundedAt: undefined })], 'me', NOW)).toBe(false);
      expect(shouldShowCashOutTab([loan()], undefined, NOW)).toBe(false);
   });
});
