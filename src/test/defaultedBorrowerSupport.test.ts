import { describe, expect, it } from 'vitest';

import { calculateDefaultedBorrowerSupport, type DefaultableLoan } from '@/lib/defaultedBorrowerSupport';

const makeLoan = (overrides: Partial<DefaultableLoan>): DefaultableLoan => ({
   due_date: '2026-05-01T00:00:00.000Z',
   loan_status: 'Lent',
   repayment_status: 'Unpaid',
   repaid_amount: 0,
   total_repayment_amount: 50,
   ...overrides
});

describe('calculateDefaultedBorrowerSupport', () => {
   it('sums outstanding amounts for overdue borrower loans', () => {
      const support = calculateDefaultedBorrowerSupport(
         [
            makeLoan({ total_repayment_amount: 50, repaid_amount: 10 }),
            makeLoan({ total_repayment_amount: 35, repaid_amount: 5, repayment_status: 'Partial' })
         ],
         new Date('2026-05-07T00:00:00.000Z')
      );

      expect(support).toEqual({ count: 2, overdueAmount: 70 });
   });

   it('ignores paid, pending, future, and fully repaid loans', () => {
      const support = calculateDefaultedBorrowerSupport(
         [
            makeLoan({ repayment_status: 'Paid', total_repayment_amount: 50, repaid_amount: 50 }),
            makeLoan({ loan_status: 'Requested', total_repayment_amount: 50, repaid_amount: 0 }),
            makeLoan({ due_date: '2026-05-10T00:00:00.000Z', total_repayment_amount: 50, repaid_amount: 0 }),
            makeLoan({ repayment_status: 'Partial', total_repayment_amount: 50, repaid_amount: 50 })
         ],
         new Date('2026-05-07T00:00:00.000Z')
      );

      expect(support).toEqual({ count: 0, overdueAmount: 0 });
   });
});
