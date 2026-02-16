import { describe, expect, it } from 'vitest';

import { calculateTrustScore, getTrustScoreColor, getTrustScoreLevel } from '@/lib/trustScore';
import type { User } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';

const baseUser: User = {
   id: 'user-1',
   username: 'moodeng',
   email: 'user@moodeng.xyz',
   isWorldId: 'INACTIVE',
   mal: 1,
   nal: 0,
   cs: 20,
   creditProgressionPaused: false,
   createdAt: '2025-01-01T00:00:00.000Z',
   updatedAt: '2025-01-02T00:00:00.000Z'
};

const createLoan = (overrides: Partial<Loan>): Loan => ({
   id: 'loan-1',
   trackingId: 'TRACK-1',
   borrowerUser: 'user-1',
   lenderUser: 'lender-1',
   loanAmount: 20,
   repaidAmount: 20,
   totalRepaymentAmount: 20,
   reason: 'Test',
   loanStatus: 'Lent',
   repaymentStatus: 'Paid',
   dueDate: '2025-02-01T00:00:00.000Z',
   coin: 'USDC',
   hash: [],
   createdAt: '2025-01-10T00:00:00.000Z',
   updatedAt: '2025-01-20T00:00:00.000Z',
   ...overrides
});

describe('Trust Score Calculation', () => {
   it('calculates base score of 50 for new unverified user with no loans', () => {
      const result = calculateTrustScore(baseUser, []);

      expect(result.score).toBe(50);
      expect(result.level).toBe('Fair');
      expect(result.percentage).toBe(50);
   });

   it('adds +10 verification bonus for World ID verified users', () => {
      const verifiedUser = { ...baseUser, isWorldId: 'ACTIVE' as const };
      const result = calculateTrustScore(verifiedUser, []);

      expect(result.score).toBe(60);
      expect(result.level).toBe('Fair');
   });

   it('adds +5 for each on-time repayment', () => {
      const loans = [
         createLoan({
            dueDate: '2025-02-01T00:00:00.000Z',
            updatedAt: '2025-01-31T00:00:00.000Z' // paid before due date
         }),
         createLoan({
            id: 'loan-2',
            dueDate: '2025-03-01T00:00:00.000Z',
            updatedAt: '2025-02-28T00:00:00.000Z' // paid before due date
         })
      ];

      const result = calculateTrustScore(baseUser, loans);

      expect(result.score).toBe(60); // 50 base + 5 + 5
      expect(result.level).toBe('Fair');
   });

   it('subtracts -10 for each late repayment', () => {
      const loans = [
         createLoan({
            dueDate: '2025-02-01T00:00:00.000Z',
            updatedAt: '2025-02-05T00:00:00.000Z' // paid after due date
         })
      ];

      const result = calculateTrustScore(baseUser, loans);

      expect(result.score).toBe(40); // 50 base - 10
      expect(result.level).toBe('Fair');
   });

   it('combines verification, on-time, and late repayments correctly', () => {
      const verifiedUser = { ...baseUser, isWorldId: 'ACTIVE' as const };
      const loans = [
         createLoan({
            id: 'loan-1',
            dueDate: '2025-02-01T00:00:00.000Z',
            updatedAt: '2025-01-31T00:00:00.000Z' // on time
         }),
         createLoan({
            id: 'loan-2',
            dueDate: '2025-03-01T00:00:00.000Z',
            updatedAt: '2025-01-31T00:00:00.000Z' // on time
         }),
         createLoan({
            id: 'loan-3',
            dueDate: '2025-04-01T00:00:00.000Z',
            updatedAt: '2025-04-05T00:00:00.000Z' // late
         })
      ];

      const result = calculateTrustScore(verifiedUser, loans);

      expect(result.score).toBe(60); // 50 base + 10 verified + 5 + 5 - 10
   });

   it('clamps score at maximum of 100', () => {
      const verifiedUser = { ...baseUser, isWorldId: 'ACTIVE' as const };
      const loans = Array.from({ length: 20 }, (_, i) =>
         createLoan({
            id: `loan-${i}`,
            dueDate: '2025-02-01T00:00:00.000Z',
            updatedAt: '2025-01-31T00:00:00.000Z'
         })
      );

      const result = calculateTrustScore(verifiedUser, loans);

      expect(result.score).toBe(100);
      expect(result.level).toBe('Excellent');
   });

   it('clamps score at minimum of 0', () => {
      const loans = Array.from({ length: 10 }, (_, i) =>
         createLoan({
            id: `loan-${i}`,
            dueDate: '2025-02-01T00:00:00.000Z',
            updatedAt: '2025-02-05T00:00:00.000Z' // all late
         })
      );

      const result = calculateTrustScore(baseUser, loans);

      expect(result.score).toBe(0);
      expect(result.level).toBe('Poor');
   });

   it('only counts fully repaid loans', () => {
      const loans = [
         createLoan({
            repaidAmount: 10,
            totalRepaymentAmount: 20, // not fully repaid
            dueDate: '2025-02-01T00:00:00.000Z',
            updatedAt: '2025-01-31T00:00:00.000Z'
         })
      ];

      const result = calculateTrustScore(baseUser, loans);

      expect(result.score).toBe(50); // should not add any points
   });

   it('only processes loans with Paid status', () => {
      const loans = [
         createLoan({
            repaymentStatus: 'Unpaid' // not paid yet
         })
      ];

      const result = calculateTrustScore(baseUser, loans);

      expect(result.score).toBe(50); // should not affect score
   });
});

describe('Trust Score Levels', () => {
   it('assigns Poor level for scores 0-39', () => {
      expect(getTrustScoreLevel(0)).toBe('Poor');
      expect(getTrustScoreLevel(39)).toBe('Poor');
   });

   it('assigns Fair level for scores 40-69', () => {
      expect(getTrustScoreLevel(40)).toBe('Fair');
      expect(getTrustScoreLevel(69)).toBe('Fair');
   });

   it('assigns Good Standing level for scores 70-89', () => {
      expect(getTrustScoreLevel(70)).toBe('Good Standing');
      expect(getTrustScoreLevel(89)).toBe('Good Standing');
   });

   it('assigns Excellent level for scores 90-100', () => {
      expect(getTrustScoreLevel(90)).toBe('Excellent');
      expect(getTrustScoreLevel(100)).toBe('Excellent');
   });
});

describe('Trust Score Colors', () => {
   it('returns correct colors for each level', () => {
      expect(getTrustScoreColor('Poor')).toBe('#ef4444');
      expect(getTrustScoreColor('Fair')).toBe('#f97316');
      expect(getTrustScoreColor('Good Standing')).toBe('#22c55e');
      expect(getTrustScoreColor('Excellent')).toBe('#10b981');
   });
});
