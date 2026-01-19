import { type ReactNode, createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';

import { evaluateCreditProgression } from '@/lib/creditLeveling';
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

const baseUser: User = {
   id: 'user-1',
   username: 'moodeng',
   email: 'user@moodeng.xyz',
   isWorldId: 'ACTIVE',
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

describe('Credit leveling logic', () => {
   it('increments limit after on-time full repayment at the current limit', () => {
      const evaluation = evaluateCreditProgression({
         currentLimit: 20,
         isVerified: true,
         isPaused: false,
         loanAmount: 20,
         repaidAmount: 25,
         totalRepaymentAmount: 25,
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
         loanAmount: 20,
         repaidAmount: 25,
         totalRepaymentAmount: 25,
         dueDate: '2025-02-01T00:00:00.000Z',
         paidAt: '2025-02-03T00:00:00.000Z'
      });

      expect(evaluation.shouldPause).toBe(true);
      expect(evaluation.shouldLevelUp).toBe(false);
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
      isSubmitting: false
   };

   it('shows verification-required state for unverified users', () => {
      const markup = renderToStaticMarkup(
         createElement(LoanRequestModal, {
            ...sharedProps,
            showVerify: true,
            user: { ...baseUser, isWorldId: 'INACTIVE' }
         })
      );

      expect(markup).toContain('Verification Required for Borrowers');
      expect(markup).toContain('disabled');
   });

   it('uses the verified credit limit when showing the loan cap', () => {
      const markup = renderToStaticMarkup(
         createElement(LoanRequestModal, {
            ...sharedProps,
            showVerify: false,
            user: { ...baseUser, cs: 40 }
         })
      );

      expect(markup).toContain('Limit: $40');
   });
});

describe('Dashboard credit level carousel', () => {
   it('builds tiers for a new verified user with a $20 limit', () => {
      const tiers = buildCreditLevels({ user: baseUser, loans: [] });

      expect(tiers).toHaveLength(7);
      expect(tiers[0].unlocked).toBe(true);
      expect(tiers[1].unlockRequirement).toContain('Fully repay $20 on time');
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
      expect(tiers.find((tier) => tier.amount === 80)?.unlockRequirement).toContain('Fully repay $60 on time');
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
