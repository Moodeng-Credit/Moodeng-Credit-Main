import { describe, expect, it } from 'vitest';

import { calculateLenderDiversity } from '@/utils/diversityScore';
import type { Loan } from '@/types/loanTypes';

const makeLoan = (id: string, lenderUser: string, amount = 15): Loan => ({
   id,
   trackingId: id,
   borrowerUser: 'borrower-1',
   lenderUser,
   loanAmount: amount,
   repaidAmount: 0,
   totalRepaymentAmount: amount,
   reason: 'Test loan',
   loanStatus: 'Lent',
   repaymentStatus: 'Unpaid',
   dueDate: '2026-05-10T00:00:00.000Z',
   coin: 'USDC',
   hash: [],
   createdAt: '2026-05-01T00:00:00.000Z',
   updatedAt: '2026-05-01T00:00:00.000Z',
   fundedAt: '2026-05-01T00:00:00.000Z'
});

describe('calculateLenderDiversity', () => {
   it('counts distinct lenders as unique lenders', () => {
      const result = calculateLenderDiversity([
         makeLoan('loan-1', 'lender-a'),
         makeLoan('loan-2', 'lender-a'),
         makeLoan('loan-3', 'lender-b')
      ]);

      expect(result.uniqueLenders).toBe(2);
      expect(result.repeatLenders).toBe(1);
      expect(result.distribution).toEqual([
         { name: 'lender-a', count: 2, percent: '67%', percentValue: 67 },
         { name: 'lender-b', count: 1, percent: '33%', percentValue: 33 }
      ]);
   });

   it('penalizes borrowers whose loans are concentrated with one lender', () => {
      const concentrated = calculateLenderDiversity([
         makeLoan('loan-1', 'lender-a'),
         makeLoan('loan-2', 'lender-a'),
         makeLoan('loan-3', 'lender-a'),
         makeLoan('loan-4', 'lender-a'),
         makeLoan('loan-5', 'lender-b')
      ]);

      expect(concentrated.score).toBe(25);
   });

   it('rewards a broad spread across lenders', () => {
      const spread = calculateLenderDiversity([
         makeLoan('loan-1', 'lender-a'),
         makeLoan('loan-2', 'lender-b'),
         makeLoan('loan-3', 'lender-c'),
         makeLoan('loan-4', 'lender-d'),
         makeLoan('loan-5', 'lender-e')
      ]);

      expect(spread.score).toBe(100);
   });
});
