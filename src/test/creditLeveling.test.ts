import { createElement, createRef, type ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { formatDate } from '@/utils/dateFormatters';

import { evaluateCreditProgression, isRepaidOnTime } from '@/lib/creditLeveling';
import type { User } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';
import LoanRequestModal from '@/views/dashboard/components/LoanRequestModal';
import { buildCreditLevels } from '@/views/profile/components/tabs/useDashboardData';

// Push reminders need a real browser; in tests the device "can't do push", so the step doesn't require it.
vi.mock('@/hooks/usePushNotifications', () => ({
   usePushNotifications: () => ({
      isSupported: false,
      permission: 'unsupported',
      isSubscribed: false,
      isBusy: false,
      enable: async () => 'unsupported',
      disable: async () => undefined
   })
}));

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

vi.mock('@/components/ToastSystem/hooks/useToast', () => ({
   useToast: () => ({
      showToast: vi.fn(),
      showToastByConfig: vi.fn(),
      removeToast: vi.fn(),
      clearAllToasts: vi.fn()
   }),
   default: () => ({
      showToast: vi.fn(),
      showToastByConfig: vi.fn(),
      removeToast: vi.fn(),
      clearAllToasts: vi.fn()
   })
}));

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
         repaidAmount: 25,
         totalRepaymentAmount: 25,
         loanAmount: 15,
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
         repaidAmount: 25,
         totalRepaymentAmount: 25,
         loanAmount: 20,
         dueDate: '2025-02-01T00:00:00.000Z',
         paidAt: '2025-01-31T00:00:00.000Z'
      });

      expect(evaluation.shouldLevelUp).toBe(true);
      expect(evaluation.nextLimit).toBe(40);
   });

   it('still levels up a full-limit loan that was repaid late', () => {
      const evaluation = evaluateCreditProgression({
         currentLimit: 20,
         isVerified: true,
         repaidAmount: 25,
         totalRepaymentAmount: 25,
         loanAmount: 20,
         dueDate: '2025-02-01T00:00:00.000Z',
         paidAt: '2025-02-03T00:00:00.000Z'
      });

      expect(evaluation.isLate).toBe(true);
      expect(evaluation.shouldLevelUp).toBe(true);
      expect(evaluation.nextLimit).toBe(40);
   });

   it('does not level up until the full-limit loan is fully repaid', () => {
      const evaluation = evaluateCreditProgression({
         currentLimit: 20,
         isVerified: true,
         repaidAmount: 10,
         totalRepaymentAmount: 25,
         loanAmount: 20,
         dueDate: '2025-02-01T00:00:00.000Z',
         paidAt: '2025-01-31T00:00:00.000Z'
      });

      expect(evaluation.shouldLevelUp).toBe(false);
   });

   it('treats a repayment made on the due date itself as on time', () => {
      const evaluation = evaluateCreditProgression({
         currentLimit: 20,
         isVerified: true,
         repaidAmount: 25,
         totalRepaymentAmount: 25,
         loanAmount: 20,
         // due at midnight UTC, repaid later the same day — must not be flagged late
         dueDate: '2025-02-01T00:00:00.000Z',
         paidAt: '2025-02-01T12:24:00.000Z'
      });

      expect(evaluation.isLate).toBe(false);
      expect(evaluation.shouldLevelUp).toBe(true);
   });

   it('does not level up a trust-building loan even when principal + interest reaches the limit', () => {
      // $20 limit, $17 requested, $20 repaid on time — still a trust-building loan.
      const evaluation = evaluateCreditProgression({
         currentLimit: 20,
         isVerified: true,
         repaidAmount: 20,
         totalRepaymentAmount: 20,
         loanAmount: 17,
         dueDate: '2025-02-01T00:00:00.000Z',
         paidAt: '2025-01-31T00:00:00.000Z'
      });

      expect(evaluation.isFullyRepaid).toBe(true);
      expect(evaluation.shouldLevelUp).toBe(false);
   });

   it('levels up a request above the current limit', () => {
      const evaluation = evaluateCreditProgression({
         currentLimit: 40,
         isVerified: true,
         repaidAmount: 50,
         totalRepaymentAmount: 50,
         loanAmount: 45,
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
      // The submit button is deliberately NOT disabled while unverified — a dead button
      // swallows the tap. It stays live so it can answer with the reason, which sits in the
      // blocker note it points at.
      expect(markup).toContain('You&#x27;re not verified yet.');
      expect(markup).toContain('aria-describedby="loan-verify-blocker"');
      expect(markup).not.toContain('disabled');
   });

   describe('borrower flow split (call/approval gate)', () => {
      const render = (user: User, loanFlow: 'open' | 'call' | 'approval') =>
         renderToStaticMarkup(
            createElement(LoanRequestModal, {
               ...sharedProps,
               showVerify: false,
               availableCreditLimit: 15,
               startOnReferralStep: false,
               loanFlow,
               user
            })
         );

      it('sends a new borrower WITHOUT a referral to "Let\u2019s connect" in the call flow', () => {
         const markup = render({ ...baseUser, loanAccessStatus: 'none' }, 'call');
         expect(markup).toContain('Let&#x27;s connect');
         expect(markup).not.toContain('Set your loan terms');
      });

      it('also gates a new REFERRED borrower — their call is Emma\u2019s setup call — even in the approval flow', () => {
         for (const flow of ['call', 'approval'] as const) {
            const markup = render({ ...baseUser, loanAccessStatus: 'none', hasReferral: true }, flow);
            expect(markup).toContain('Let&#x27;s connect');
            expect(markup).toContain('call with Emma');
            expect(markup).not.toContain('Set your loan terms');
         }
      });

      it('does not put a waiting borrower back through the referral card', () => {
         const markup = renderToStaticMarkup(
            createElement(LoanRequestModal, {
               ...sharedProps,
               showVerify: false,
               availableCreditLimit: 15,
               canUseReferralBoost: true,
               startOnReferralStep: true,
               loanFlow: 'call',
               user: { ...baseUser, loanAccessStatus: 'pending' }
            })
         );
         expect(markup).not.toContain('Have a referral code?');
         expect(markup).toContain('See you on the call');
      });

      it('shows the "see you on the call" card while an unreferred borrower waits', () => {
         const markup = render({ ...baseUser, loanAccessStatus: 'pending' }, 'call');
         expect(markup).toContain('See you on the call');
      });

      it('changes nothing in the open flow — no gate for anyone', () => {
         const markup = render({ ...baseUser, loanAccessStatus: 'none' }, 'open');
         expect(markup).toContain('Set your loan terms');
      });

      it('keeps today\u2019s open flow for referred borrowers: straight to the form, no call step', () => {
         const markup = render({ ...baseUser, loanAccessStatus: 'none', hasReferral: true }, 'open');
         expect(markup).toContain('Set your loan terms');
         expect(markup).toContain('Step 1 of 4');
      });

      it('lets an approved borrower apply without a referral', () => {
         const markup = render({ ...baseUser, loanAccessStatus: 'approved' }, 'call');
         expect(markup).toContain('Set your loan terms');
      });
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
      expect(tiers[1].unlockRequirement).toBe('Borrow & repay the full $15 to unlock');
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
      expect(tiers.find((tier) => tier.amount === 80)?.unlockRequirement).toBe('Borrow & repay the full $60 to unlock');
   });

   it('locks tiers for unverified users', () => {
      const tiers = buildCreditLevels({
         user: { ...baseUser, isWorldId: 'INACTIVE', cs: 0 },
         loans: []
      });

      expect(tiers.every((tier) => !tier.unlocked)).toBe(true);
      expect(tiers[0].unlockRequirement).toContain('Verify your identity');
   });

   it('dates each unlocked tier by the full-limit loan that unlocked it, skipping trust-building loans', () => {
      const tiers = buildCreditLevels({
         user: { ...baseUser, cs: 40 },
         loans: [
            createLoan({ id: 'full-15', loanAmount: 15, updatedAt: '2025-01-10T00:00:00.000Z' }),
            createLoan({ id: 'trust-17', loanAmount: 17, updatedAt: '2025-02-10T00:00:00.000Z' }),
            createLoan({ id: 'full-20', loanAmount: 20, updatedAt: '2025-03-10T00:00:00.000Z' })
         ]
      });

      expect(tiers.find((tier) => tier.amount === 20)?.date).toBe(formatDate('2025-01-10T00:00:00.000Z'));
      expect(tiers.find((tier) => tier.amount === 40)?.date).toBe(formatDate('2025-03-10T00:00:00.000Z'));
      expect(tiers.find((tier) => tier.amount === 60)?.unlockRequirement).toBe('Borrow & repay the full $40 to unlock');
   });
});
