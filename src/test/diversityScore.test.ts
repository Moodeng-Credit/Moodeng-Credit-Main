import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calculateLenderDiversity } from '@/utils/diversityScore';

import { type User, WorldId } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';

const makeLoan = (id: string, lenderUser: string, amount = 15, fundedAt = '2026-05-01T00:00:00.000Z'): Loan => ({
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
   createdAt: fundedAt,
   updatedAt: fundedAt,
   fundedAt
});

const makeUserProfile = (id: string, createdAt = '2025-01-01T00:00:00.000Z'): User => ({
   id,
   username: id,
   email: `${id}@example.com`,
   isWorldId: WorldId.ACTIVE,
   mal: 0,
   nal: 0,
   cs: 0,
   createdAt,
   updatedAt: createdAt
});

const userProfiles = ['lender-a', 'lender-b', 'lender-c', 'lender-d', 'lender-e'].reduce<Record<string, User>>((acc, lenderId, index) => {
   acc[lenderId] = makeUserProfile(lenderId, `2025-0${index + 1}-01T00:00:00.000Z`);
   return acc;
}, {});

describe('calculateLenderDiversity', () => {
   beforeEach(() => {
      vi.setSystemTime(new Date('2026-05-04T00:00:00.000Z'));
   });

   afterEach(() => {
      vi.useRealTimers();
   });

   it('counts distinct lenders as unique lenders', () => {
      const result = calculateLenderDiversity(
         [makeLoan('loan-1', 'lender-a'), makeLoan('loan-2', 'lender-a'), makeLoan('loan-3', 'lender-b')],
         userProfiles
      );

      expect(result.uniqueLenders).toBe(2);
      expect(result.repeatLenders).toBe(1);
      expect(result.distribution).toEqual([
         { name: 'lender-a', count: 2, percent: '67%', percentValue: 67 },
         { name: 'lender-b', count: 1, percent: '33%', percentValue: 33 }
      ]);
   });

   it('penalizes borrowers whose loans are concentrated with one lender', () => {
      const concentrated = calculateLenderDiversity(
         [
            makeLoan('loan-1', 'lender-a'),
            makeLoan('loan-2', 'lender-a'),
            makeLoan('loan-3', 'lender-a'),
            makeLoan('loan-4', 'lender-a'),
            makeLoan('loan-5', 'lender-b')
         ],
         userProfiles
      );

      const spread = calculateLenderDiversity(
         [
            makeLoan('loan-1', 'lender-a'),
            makeLoan('loan-2', 'lender-b'),
            makeLoan('loan-3', 'lender-c'),
            makeLoan('loan-4', 'lender-d'),
            makeLoan('loan-5', 'lender-e')
         ],
         userProfiles
      );

      expect(concentrated.score).toBeLessThan(spread.score);
   });

   it('rewards a broad spread across lenders', () => {
      const spread = calculateLenderDiversity(
         [
            makeLoan('loan-1', 'lender-a'),
            makeLoan('loan-2', 'lender-b'),
            makeLoan('loan-3', 'lender-c'),
            makeLoan('loan-4', 'lender-d'),
            makeLoan('loan-5', 'lender-e')
         ],
         userProfiles
      );

      expect(spread.score).toBeGreaterThanOrEqual(90);
   });

   it('lowers points when lenders are brand new and coordinated', () => {
      const coordinatedProfiles = {
         'lender-a': makeUserProfile('lender-a', '2026-04-30T00:00:00.000Z'),
         'lender-b': makeUserProfile('lender-b', '2026-04-30T00:00:00.000Z'),
         'lender-c': makeUserProfile('lender-c', '2026-04-30T00:00:00.000Z')
      };

      const coordinated = calculateLenderDiversity(
         [makeLoan('loan-1', 'lender-a'), makeLoan('loan-2', 'lender-b'), makeLoan('loan-3', 'lender-c')],
         coordinatedProfiles
      );

      const established = calculateLenderDiversity(
         [makeLoan('loan-1', 'lender-a'), makeLoan('loan-2', 'lender-b'), makeLoan('loan-3', 'lender-c')],
         userProfiles
      );

      expect(coordinated.score).toBeLessThan(established.score);
   });
});
