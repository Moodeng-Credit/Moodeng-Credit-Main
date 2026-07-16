import { type ReactNode, createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';

import { evaluateCreditProgression, isRepaidOnTime } from '@/lib/creditLeveling';
import type { User } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';
import LoanRequestModal from '@/views/dashboard/components/LoanRequestModal';
import { buildCreditLevels } from '@/views/profile/components/tabs/useDashboardData';

vi.mock('@/components/worldId/WorldIDVerification', () => ({
   default: ({ children }: { children: ({ open }: { open: () => void }) => ReactNode }) =>
      children({
         open: () => undefined
      })
}));

vi.mock('react-router-dom', async () => {
   const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

   return {
      ...actual,
      useNavigate: () => vi.fn()
   };
});

vi.mock('react-redux', async () => {
   const actual = await vi.importActual<typeof import('react-redux')>('react-redux');
   return {
      ...actual,
      useDispatch: () => vi.fn(),
      useSelector: () => undefined
   };
});

const baseUser: User = {
   id: 'user-1',
   username: 'moodeng',
   email: 'user@moodeng.xyz',
   isWorldId: 'ACTIVE',
   mal: 1,
   nal: 0,
   cs: 15,
   creditProgressionPaused: false,
   createdAt: '2025-01-01T00:00:00.000Z',
   updatedAt: '2025-01-02T00:00:00.000Z'
};

const createLoan = (overrides: Partial<Loan>): Loan => ({
   id: 'loan-1',
   trackingId: 'TRACK-1',
   borrowerUser: 'user-1',
   lenderUser: 'lender-1',
   loanAmount: 15,
   repaidAmount: 15,
   totalRepaymentAmount: 15,
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

describe('Credit leveling logic', () => {
   it('increments limit after on-time full repayment at the current limit', () => {
      const evaluation = evaluateCreditProgression({
         currentLimit: 15,
         isVerified: true,
         isPaused: false,
         repaidAmount: 25,
         totalRepaymentAmount: 25,
         cumulativeBorrowedAmount: 15,
         dueDate: '2025-02-01T00:00:00.000Z',
         paidAt: '2025-01-31T00:00:00.000Z'
      });

      expect(evaluation.shouldLevelUp).toBe(true);
      expect(evaluation.nextLimit).toBe(20);
   });

   it('progresses from the second tier to the next 20-dollar step', () => {
      const evaluation = evaluateCreditProgression({
         currentLimit: 20,
         isVerified: true,
         isPaused: false,
         repaidAmount: 25,
         totalRepaymentAmount: 25,
         cumulativeBorrowedAmount: 20,
         dueDate: '2025-02-01T00:00:00.000Z',
         paidAt: '2025-01-31T00:00:00.000Z'
      });

      expect(evaluation.shouldLevelUp).toBe(true);
      expect(evaluation.nextLimit).toBe(40);
   });

   it('pauses progression for late repayments and blocks level up', () => {
      const evaluation = evaluateCreditProgression({
         currentLimit: 20,
         isVerified: true,
         isPaused: false,
         repaidAmount: 25,
         totalRepaymentAmount: 25,
         cumulativeBorrowedAmount: 20,
         dueDate: '2025-02-01T00:00:00.000Z',
         paidAt: '2025-02-03T00:00:00.000Z'
      });

      expect(evaluation.shouldPause).toBe(true);
      expect(evaluation.shouldLevelUp).toBe(false);
   });

   it('treats a repayment made on the due date itself as on time', () => {
      const evaluation = evaluateCreditProgression({
         currentLimit: 20,
         isVerified: true,
         isPaused: false,
         repaidAmount: 25,
         totalRepaymentAmount: 25,
         cumulativeBorrowedAmount: 20,
         // due at midnight UTC, repaid later the same day — must not be flagged late
         dueDate: '2025-02-01T00:00:00.000Z',
         paidAt: '2025-02-01T12:24:00.000Z'
      });

      expect(evaluation.isLate).toBe(false);
      expect(evaluation.shouldPause).toBe(false);
      expect(evaluation.shouldLevelUp).toBe(true);
   });

   it('levels up when cumulative repayments reach the current limit', () => {
      const evaluation = evaluateCreditProgression({
         currentLimit: 40,
         isVerified: true,
         isPaused: false,
         repaidAmount: 10,
         totalRepaymentAmount: 10,
         cumulativeBorrowedAmount: 45,
         dueDate: '2025-02-01T00:00:00.000Z',
         paidAt: '2025-01-31T00:00:00.000Z'
      });

      expect(evaluation.shouldLevelUp).toBe(true);
      expect(evaluation.nextLimit).toBe(60);
   });
});

describe('isRepaidOnTime', () => {
   it('is on time for the whole due date and overdue the day after', () => {
      expect(isRepaidOnTime('2025-02-01T00:00:00.000Z', '2025-02-01T00:00:00.000Z')).toBe(true);
      expect(isRepaidOnTime('2025-02-01T23:59:59.000Z', '2025-02-01T00:00:00.000Z')).toBe(true);
      expect(isRepaidOnTime('2025-02-02T00:00:00.000Z', '2025-02-01T00:00:00.000Z')).toBe(false);
      expect(isRepaidOnTime('2025-01-31T12:00:00.000Z', '2025-02-01T00:00:00.000Z')).toBe(true);
   });
});

describe('LoanRequestModal borrowing gate', () => {
   const sharedProps = {
      clickOutsideRef: createRef<HTMLDivElement>(),
      isOpen: true,
      onClose: () => undefined,
      loanAmount: '',
      setLoanAmount: () => undefined,
      totalRepaymentAmount: '',
      setTotalRepaymentAmount: () => undefined,
      reason: '',
      setReason: () => undefined,
      days: '',
      today: '2025-01-01',
      handleDays: () => undefined,
      handleSubmit: () => undefined,
      onReferralApplied: () => undefined,
      isSubmitting: false,
      availableCreditLimit: 0
   };

   it('shows verification-required state for unverified users', () => {
      const markup = renderToStaticMarkup(
         createElement(LoanRequestModal, {
            ...sharedProps,
            showVerify: true,
            user: { ...baseUser, isWorldId: 'INACTIVE' }
         })
      );

      expect(markup).toContain('One quick step to request a loan');
      expect(markup).toContain('Verify Yourself');
      expect(markup).toContain('disabled');
   });

   it('uses the verified credit limit when showing the loan cap', () => {
      const markup = renderToStaticMarkup(
         createElement(LoanRequestModal, {
            ...sharedProps,
            showVerify: false,
            user: { ...baseUser, cs: 40 },
            availableCreditLimit: 40,
            startOnReferralStep: false
         })
      );

      expect(markup).toContain('Limit: $40');
   });

   it('shows remaining available credit after the current limit is used', () => {
      const markup = renderToStaticMarkup(
         createElement(LoanRequestModal, {
            ...sharedProps,
            showVerify: false,
            user: { ...baseUser, cs: 20 },
            availableCreditLimit: 0,
            startOnReferralStep: false
         })
      );

      expect(markup).toContain('Limit: $0');
   });
});

describe('Dashboard credit level carousel', () => {
   it('builds tiers for a new verified user with a $15 limit', () => {
      const tiers = buildCreditLevels({ user: baseUser, loans: [] });

      expect(tiers).toHaveLength(8);
      expect(tiers[0].unlocked).toBe(true);
      expect(tiers[1].unlockRequirement).toContain('Fully repay $15 total on time');
   });

   it('builds tiers for an experienced user with multiple repayments', () => {
      const tiers = buildCreditLevels({
         user: { ...baseUser, cs: 60 },
         loans: [
            createLoan({
               loanAmount: 20,
               updatedAt: '2025-01-15T00:00:00.000Z'
            }),
            createLoan({
               id: 'loan-2',
               loanAmount: 40,
               updatedAt: '2025-02-15T00:00:00.000Z'
            })
         ]
      });

      expect(tiers.find((tier) => tier.amount === 60)?.unlocked).toBe(true);
      expect(tiers.find((tier) => tier.amount === 80)?.unlockRequirement).toContain('Fully repay $60 total on time');
   });

   it('locks tiers for unverified users', () => {
      const tiers = buildCreditLevels({
         user: { ...baseUser, isWorldId: 'INACTIVE', cs: 0 },
         loans: []
      });

      expect(tiers.every((tier) => !tier.unlocked)).toBe(true);
      expect(tiers[0].unlockRequirement).toContain('Verify World ID');
   });

   it('shows progression paused state for late repayments', () => {
      const tiers = buildCreditLevels({
         user: { ...baseUser, cs: 40, creditProgressionPaused: true },
         loans: []
      });

      expect(tiers.every((tier) => tier.progressionPaused)).toBe(true);
      expect(tiers.find((tier) => !tier.unlocked)?.unlockRequirement).toContain('Progression Paused');
   });
});
