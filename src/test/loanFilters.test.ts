import { afterEach, describe, expect, it, vi } from 'vitest';

import { filterLoans } from '@/utils/loanFilters';

import { type User, WorldId } from '@/types/authTypes';
import { type Loan, LoanStatus, RepaymentStatus } from '@/types/loanTypes';

const makeLoan = (overrides: Partial<Loan> = {}): Loan => ({
   id: 'loan-1',
   trackingId: 'LOAN-1',
   borrowerWallet: '0xborrower',
   lenderWallet: '',
   borrowerUser: 'borrower-1',
   lenderUser: '',
   loanAmount: 10,
   repaidAmount: 0,
   totalRepaymentAmount: 12,
   reason: 'Groceries',
   loanStatus: LoanStatus.REQUESTED,
   repaymentStatus: RepaymentStatus.UNPAID,
   dueDate: '2026-06-01T00:00:00.000Z',
   coin: 'USDC',
   hash: [],
   createdAt: '2026-05-20T00:00:00.000Z',
   updatedAt: '2026-05-20T00:00:00.000Z',
   ...overrides
});

const makeUser = (overrides: Partial<User> = {}): User => ({
   id: 'borrower-1',
   username: 'borrower',
   email: 'borrower@moodeng.local',
   isWorldId: WorldId.ACTIVE,
   mal: 1,
   nal: 0,
   cs: 20,
   accountStatus: 'active',
   userRole: 'borrower',
   createdAt: '2026-05-01T00:00:00.000Z',
   updatedAt: '2026-05-01T00:00:00.000Z',
   ...overrides
});

describe('loanFilters', () => {
   afterEach(() => {
      vi.useRealTimers();
   });

   it('filters Credit Limit chips by borrower credit limit, not only requested amount', () => {
      const lowerRequestFromTwentyLimit = makeLoan({ id: 'lower-request', borrowerUser: 'borrower-20', loanAmount: 10 });
      const fortyLimitRequest = makeLoan({ id: 'forty-limit', borrowerUser: 'borrower-40', loanAmount: 15 });

      const result = filterLoans(
         [lowerRequestFromTwentyLimit, fortyLimitRequest],
         { amount: '15-30' },
         '',
         {
            'borrower-20': makeUser({ id: 'borrower-20', cs: 20 }),
            'borrower-40': makeUser({ id: 'borrower-40', cs: 40 })
         }
      );

      expect(result.map((loan) => loan.id)).toEqual(['lower-request']);
   });

   it('routes every Credit Limit bucket from borrower profile limits', () => {
      const loans = [
         makeLoan({ id: 'limit-15', borrowerUser: 'borrower-15' }),
         makeLoan({ id: 'limit-20', borrowerUser: 'borrower-20' }),
         makeLoan({ id: 'limit-40', borrowerUser: 'borrower-40' }),
         makeLoan({ id: 'limit-60', borrowerUser: 'borrower-60' }),
         makeLoan({ id: 'limit-80', borrowerUser: 'borrower-80' }),
         makeLoan({ id: 'limit-100', borrowerUser: 'borrower-100' })
      ];
      const profiles = {
         'borrower-15': makeUser({ id: 'borrower-15', cs: 15 }),
         'borrower-20': makeUser({ id: 'borrower-20', cs: 20 }),
         'borrower-40': makeUser({ id: 'borrower-40', cs: 40 }),
         'borrower-60': makeUser({ id: 'borrower-60', cs: 60 }),
         'borrower-80': makeUser({ id: 'borrower-80', cs: 80 }),
         'borrower-100': makeUser({ id: 'borrower-100', cs: 100 })
      };

      expect(filterLoans(loans, { amount: '15-30' }, '', profiles).map((loan) => loan.id)).toEqual(['limit-15', 'limit-20']);
      expect(filterLoans(loans, { amount: '30-50' }, '', profiles).map((loan) => loan.id)).toEqual(['limit-40']);
      expect(filterLoans(loans, { amount: '50-70' }, '', profiles).map((loan) => loan.id)).toEqual(['limit-60']);
      expect(filterLoans(loans, { amount: '70+' }, '', profiles).map((loan) => loan.id)).toEqual(['limit-80', 'limit-100']);
   });

   it('filters repayment percentage from the promised total repayment amount', () => {
      const tenToTwentyPercentRequest = makeLoan({ id: 'ten-to-twenty', loanAmount: 15, totalRepaymentAmount: 17 });
      const fiveToTenPercentRequest = makeLoan({ id: 'five-to-ten', loanAmount: 30, totalRepaymentAmount: 32 });

      const result = filterLoans([tenToTwentyPercentRequest, fiveToTenPercentRequest], { rate: '15' });

      expect(result.map((loan) => loan.id)).toEqual(['ten-to-twenty']);
   });

   it('routes every Repayment % bucket from the promised repayment amount', () => {
      const loans = [
         makeLoan({ id: 'rate-0-5', loanAmount: 100, totalRepaymentAmount: 104 }),
         makeLoan({ id: 'rate-5-10', loanAmount: 100, totalRepaymentAmount: 108 }),
         makeLoan({ id: 'rate-10-20', loanAmount: 100, totalRepaymentAmount: 115 }),
         makeLoan({ id: 'rate-20-plus', loanAmount: 100, totalRepaymentAmount: 130 })
      ];

      expect(filterLoans(loans, { rate: '2.5' }).map((loan) => loan.id)).toEqual(['rate-0-5']);
      expect(filterLoans(loans, { rate: '7.5' }).map((loan) => loan.id)).toEqual(['rate-5-10']);
      expect(filterLoans(loans, { rate: '15' }).map((loan) => loan.id)).toEqual(['rate-10-20']);
      expect(filterLoans(loans, { rate: '+' }).map((loan) => loan.id)).toEqual(['rate-20-plus']);
   });

   it('filters repayment date buckets from the due date', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-22T00:00:00.000Z'));

      const loans = [
         makeLoan({ id: 'due-week', dueDate: '2026-05-25T00:00:00.000Z' }),
         makeLoan({ id: 'due-month', dueDate: '2026-06-10T00:00:00.000Z' }),
         makeLoan({ id: 'due-sixty', dueDate: '2026-07-10T00:00:00.000Z' }),
         makeLoan({ id: 'due-ninety', dueDate: '2026-08-10T00:00:00.000Z' }),
         makeLoan({ id: 'due-after-ninety', dueDate: '2026-09-01T00:00:00.000Z' }),
         makeLoan({ id: 'due-plus', dueDate: '2026-10-15T00:00:00.000Z' })
      ];

      expect(filterLoans(loans, { loanTime: '7' }).map((loan) => loan.id)).toEqual(['due-week']);
      expect(filterLoans(loans, { loanTime: '30' }).map((loan) => loan.id)).toEqual(['due-week', 'due-month']);
      expect(filterLoans(loans, { loanTime: '60' }).map((loan) => loan.id)).toEqual(['due-week', 'due-month', 'due-sixty']);
      expect(filterLoans(loans, { loanTime: '120' }).map((loan) => loan.id)).toEqual(['due-after-ninety', 'due-plus']);
   });

   it('filters No Active Loans against active funded borrower loans', () => {
      const openRequest = makeLoan({ id: 'open-request', borrowerUser: 'borrower-1' });
      const activeFundedLoan = makeLoan({
         id: 'active-funded',
         borrowerUser: 'borrower-1',
         loanStatus: LoanStatus.LENT,
         repaymentStatus: RepaymentStatus.UNPAID
      });
      const cleanBorrowerRequest = makeLoan({ id: 'clean-request', borrowerUser: 'borrower-2' });

      const result = filterLoans([openRequest, activeFundedLoan, cleanBorrowerRequest], { borrowType: ['no-active'] });

      expect(result.map((loan) => loan.id)).toEqual(['clean-request']);
   });

   it('identifies beginner borrowers as starting-limit borrowers without completed funded loans', () => {
      const newBorrowerRequest = makeLoan({ id: 'new-borrower', borrowerUser: 'borrower-new' });
      const experiencedStartingLimitRequest = makeLoan({ id: 'experienced', borrowerUser: 'borrower-experienced' });
      const completedLoan = makeLoan({
         id: 'completed-loan',
         borrowerUser: 'borrower-experienced',
         loanStatus: LoanStatus.LENT,
         repaymentStatus: RepaymentStatus.PAID
      });

      const result = filterLoans(
         [newBorrowerRequest, experiencedStartingLimitRequest, completedLoan],
         { borrowType: ['beginner'] },
         '',
         {
            'borrower-new': makeUser({ id: 'borrower-new', cs: 15 }),
            'borrower-experienced': makeUser({ id: 'borrower-experienced', cs: 15 })
         }
      );

      expect(result.map((loan) => loan.id)).toEqual(['new-borrower']);
   });
});
