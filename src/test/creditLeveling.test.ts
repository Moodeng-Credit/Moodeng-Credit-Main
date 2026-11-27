import { createElement, createRef, type ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { formatDate } from '@/utils/dateFormatters';

import { countsFromAt, evaluateCreditProgression, getFullLimitLoans, isRepaidOnTime, isTooEarlyRepay } from '@/lib/creditLeveling';
import type { User } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';
import LoanRequestModal from '@/views/dashboard/components/LoanRequestModal';
import { buildCreditLevels } from '@/views/profile/components/tabs/useDashboardData';
import { buildBorrowerTimelineEvents } from '@/views/user-profile/ProgressHistory';

// Push reminders need a real browser; in tests the device "can't do push", so the step doesn't require it.
// The pre-KYC gate reads its RPC through react-query; these tests cover borrowers it doesn't hold.
vi.mock('@/hooks/usePreKycGate', () => ({
   PRE_KYC_CONNECT_PATH: '/onboarding/connect',
   JOURNEY_V2_PATH: '/onboarding/verify',
   needsJourneyV2: () => false,
   needsPrescreen: () => false,
   PRESCREEN_PATH: '/screen',
   fetchPrescreenPath: async () => ({ on_path: false }),
   usePreKycGate: () => ({ isGated: false, isLoading: false, v2: null, prescreen: null })
}));

// Wallet last switch (react-query, no provider here): off, so the wallet-first rules below still hold.
vi.mock('@/hooks/useWalletLast', () => ({
   fetchWalletLast: async () => false,
   useWalletLast: () => ({ walletLast: false, isLoading: false })
}));

// Proof-of-income steps: none in these tests (and no QueryClientProvider to fetch them with).
vi.mock('@/hooks/useIncomeDocRequirement', () => ({
   useIncomeDocFacts: () => ({ steps: [], doc: null, lastFundedAt: null })
}));
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
   // Track B (joined after October 2026); Track A tests set an earlier createdAt.
   createdAt: '2026-11-01T00:00:00.000Z',
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
      expect(evaluation.nextLimit).toBe(25);
   });

   it('progresses $10 a level', () => {
      const evaluation = evaluateCreditProgression({
         currentLimit: 25,
         isVerified: true,
         repaidAmount: 30,
         totalRepaymentAmount: 30,
         loanAmount: 25,
         dueDate: '2025-02-01T00:00:00.000Z',
         paidAt: '2025-01-31T00:00:00.000Z'
      });

      expect(evaluation.shouldLevelUp).toBe(true);
      expect(evaluation.nextLimit).toBe(35);
   });

   it('moves an old-ladder limit to the next new level ($20 → $25)', () => {
      const evaluation = evaluateCreditProgression({
         currentLimit: 20,
         isVerified: true,
         repaidAmount: 25,
         totalRepaymentAmount: 25,
         loanAmount: 20,
         dueDate: '2026-12-01T00:00:00.000Z',
         paidAt: '2026-11-30T00:00:00.000Z',
         fundedAt: '2026-11-20T00:00:00.000Z'
      });

      expect(evaluation.nextLimit).toBe(25);
   });

   it('a full-limit loan funded before the switch keeps the old step on both tracks ($20 → $40)', () => {
      const input = {
         currentLimit: 20,
         isVerified: true,
         repaidAmount: 25,
         totalRepaymentAmount: 25,
         loanAmount: 20,
         dueDate: '2026-12-01T00:00:00.000Z',
         paidAt: '2026-11-30T00:00:00.000Z',
         fundedAt: '2026-11-10T00:00:00.000Z'
      };

      expect(evaluateCreditProgression({ ...input, joinedAt: '2026-09-01T00:00:00.000Z' })).toMatchObject({
         shouldLevelUp: true,
         nextLimit: 40
      });
      expect(evaluateCreditProgression({ ...input, joinedAt: '2026-10-05T00:00:00.000Z' })).toMatchObject({
         shouldLevelUp: true,
         nextLimit: 40
      });
      // Funded after the switch, Track B: the new ladder.
      expect(
         evaluateCreditProgression({ ...input, fundedAt: '2026-11-15T00:00:00.000Z', joinedAt: '2026-10-05T00:00:00.000Z' })
      ).toMatchObject({ shouldLevelUp: true, nextLimit: 25 });
   });

   it('stops at the top limit', () => {
      const evaluation = evaluateCreditProgression({
         currentLimit: 135,
         isVerified: true,
         repaidAmount: 150,
         totalRepaymentAmount: 150,
         loanAmount: 135,
         dueDate: '2026-12-01T00:00:00.000Z',
         paidAt: '2026-11-30T00:00:00.000Z'
      });

      expect(evaluation.shouldLevelUp).toBe(false);
      expect(evaluation.nextLimit).toBe(135);
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
      expect(evaluation.nextLimit).toBe(25);
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
         currentLimit: 35,
         isVerified: true,
         repaidAmount: 50,
         totalRepaymentAmount: 50,
         loanAmount: 40,
         dueDate: '2025-02-01T00:00:00.000Z',
         paidAt: '2025-01-31T00:00:00.000Z'
      });

      expect(evaluation.shouldLevelUp).toBe(true);
      expect(evaluation.nextLimit).toBe(45);
   });
});

describe('isRepaidOnTime', () => {
   it("is on time until the end of the due day on the borrower's clock (Manila by default)", () => {
      expect(isRepaidOnTime('2025-02-01T00:00:00.000Z', '2025-02-01T00:00:00.000Z')).toBe(true);
      // 11:59 PM Manila on Feb 1 = 15:59Z; midnight Manila = 16:00Z.
      expect(isRepaidOnTime('2025-02-01T15:59:59.000Z', '2025-02-01T00:00:00.000Z')).toBe(true);
      expect(isRepaidOnTime('2025-02-01T16:00:00.000Z', '2025-02-01T00:00:00.000Z')).toBe(false);
      expect(isRepaidOnTime('2025-01-31T12:00:00.000Z', '2025-02-01T00:00:00.000Z')).toBe(true);
   });

   it("uses the loan's own zone when it has one", () => {
      // Los Angeles: Feb 1 ends Feb 2 08:00Z (PST).
      expect(isRepaidOnTime('2025-02-02T07:59:00.000Z', '2025-02-01T00:00:00.000Z', 'America/Los_Angeles')).toBe(true);
      expect(isRepaidOnTime('2025-02-02T08:00:00.000Z', '2025-02-01T00:00:00.000Z', 'America/Los_Angeles')).toBe(false);
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

   it("locks the form for a borrower who hasn't finished onboarding (no wallet yet)", () => {
      const markup = renderToStaticMarkup(
         createElement(LoanRequestModal, {
            ...sharedProps,
            showVerify: true,
            user: { ...baseUser, isWorldId: 'INACTIVE' }
         })
      );

      // Their next onboarding step (step 1 of 3: wallet) on the card, and the fields shown locked.
      expect(markup).toContain('Step 1 of 3');
      expect(markup).toContain('Set up your wallet<span aria-hidden="true"> →</span>');
      expect(markup).toContain('inert=""');
      expect(markup).toContain('aria-label="Finish setting up first to request a loan"');
      // The submit button is deliberately NOT disabled — a dead button swallows the tap. It stays
      // live so it can answer with the reason, which sits in the blocker note it points at.
      expect(markup).toContain('aria-describedby="loan-verify-blocker"');
      expect(markup).not.toMatch(/type="submit"[^>]*disabled=""/);
   });

   const approvedUnverifiedUser = {
      ...baseUser,
      isWorldId: 'INACTIVE',
      walletAddress: '0x1111111111111111111111111111111111111111',
      loanAccessStatus: 'approved'
   } as User;

   it('lets a borrower through onboarding fill in the form, with the ID check as the last step', () => {
      const markup = renderToStaticMarkup(
         createElement(LoanRequestModal, {
            ...sharedProps,
            showVerify: true,
            canUseReferralBoost: false,
            user: approvedUnverifiedUser
         })
      );

      expect(markup).toContain('Last step: verify your ID');
      expect(markup).toContain('Verify ID &amp; send request');
      expect(markup).not.toContain('inert=""');
   });

   it('offers the referral card before the ID check — the only place a new borrower can enter a code', () => {
      const markup = renderToStaticMarkup(
         createElement(LoanRequestModal, {
            ...sharedProps,
            showVerify: true,
            canUseReferralBoost: true,
            user: approvedUnverifiedUser
         })
      );

      expect(markup).toContain('Have a referral code?');
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
         // terms, bio1, bio2, job (no job saved yet), contacts
         expect(markup).toContain('Step 1 of 5');
      });

      it('skips the job and contact steps once the account has them (job, Messenger ID, WhatsApp)', () => {
         const markup = render(
            {
               ...baseUser,
               loanAccessStatus: 'none',
               hasReferral: true,
               incomeType: 'full-time',
               profession: 'call center agent',
               hasVerifiedContact: true,
               hasMessengerLink: true,
               whatsappVerified: true
            },
            'open'
         );
         expect(markup).toContain('Set your loan terms');
         expect(markup).not.toContain('Step 1 of');
      });

      it('asks for both lines when Messenger was only marked verified by hand (no Messenger ID)', () => {
         const markup = render(
            {
               ...baseUser,
               loanAccessStatus: 'none',
               hasReferral: true,
               incomeType: 'full-time',
               profession: 'call center agent',
               hasVerifiedContact: true,
               hasMessengerLink: false,
               whatsappVerified: false
            },
            'open'
         );
         expect(markup).toContain('Step 1 of 2');
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

      // The level they have plus the next two, never the whole ladder.
      expect(tiers.map((tier) => tier.amount)).toEqual([15, 25, 35]);
      expect(tiers[0].unlocked).toBe(true);
      expect(tiers[1].unlockRequirement).toBe('Borrow & repay the full $15 to unlock');
   });

   it('Track A (joined before October) sees the old ladder: $20 → $40 → $60', () => {
      const tiers = buildCreditLevels({
         user: { ...baseUser, cs: 20, createdAt: '2026-09-19T00:00:00.000Z' },
         loans: [createLoan({ loanAmount: 20, loanStatus: 'Lent', repaymentStatus: 'Unpaid', fundedAt: '2026-11-05T10:05:00Z' })]
      });
      expect(tiers.map((tier) => tier.amount)).toEqual([15, 20, 40, 60]);
      expect(tiers.find((tier) => tier.amount === 40)?.unlockRequirement).toBe('Borrow & repay the full $20 to unlock');
   });

   it('Track B with an open $20 loan funded before the switch highlights the promised $40', () => {
      const tiers = buildCreditLevels({
         user: { ...baseUser, cs: 20 },
         loans: [createLoan({ loanAmount: 20, loanStatus: 'Lent', repaymentStatus: 'Unpaid', fundedAt: '2026-11-05T10:05:00Z' })]
      });
      expect(tiers.map((tier) => tier.amount)).toEqual([15, 20, 25, 35, 40]);
      expect(tiers.find((tier) => tier.amount === 40)?.unlockRequirement).toBe('Borrow & repay the full $20 to unlock');
   });

   it('Track B with an open $20 loan funded after the switch highlights $25', () => {
      const tiers = buildCreditLevels({
         user: { ...baseUser, cs: 20 },
         loans: [createLoan({ loanAmount: 20, loanStatus: 'Lent', repaymentStatus: 'Unpaid', fundedAt: '2026-11-15T10:05:00Z' })]
      });
      expect(tiers.map((tier) => tier.amount)).toEqual([15, 20, 25, 35]);
      expect(tiers.find((tier) => tier.amount === 25)?.unlockRequirement).toBe('Borrow & repay the full $20 to unlock');
   });

   it('an open $20 loan funded after the switch highlights $25', () => {
      const tiers = buildCreditLevels({
         user: { ...baseUser, cs: 20 },
         loans: [createLoan({ loanAmount: 20, loanStatus: 'Lent', repaymentStatus: 'Unpaid', fundedAt: '2026-11-15T10:00:00Z' })]
      });
      expect(tiers.map((tier) => tier.amount)).toEqual([15, 20, 25, 35]);
      expect(tiers.find((tier) => tier.amount === 25)?.unlockRequirement).toBe('Borrow & repay the full $20 to unlock');
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

      // $60 is from the old ladder: it gets its own card, then the next new levels.
      expect(tiers.map((tier) => tier.amount)).toEqual([15, 25, 35, 45, 55, 60, 65, 75]);
      expect(tiers.find((tier) => tier.amount === 60)?.unlocked).toBe(true);
      expect(tiers.find((tier) => tier.amount === 65)?.unlockRequirement).toBe('Borrow & repay the full $60 to unlock');
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
            createLoan({ id: 'full-15', loanAmount: 15, creditLimitAtRepayment: 15, updatedAt: '2025-01-10T00:00:00.000Z' }),
            createLoan({ id: 'trust-17', loanAmount: 17, creditLimitAtRepayment: 20, updatedAt: '2025-02-10T00:00:00.000Z' }),
            createLoan({ id: 'full-20', loanAmount: 20, creditLimitAtRepayment: 20, updatedAt: '2025-03-10T00:00:00.000Z' })
         ]
      });

      // Repaid before the switch: $20 unlocked $40 on the old ladder.
      expect(tiers.find((tier) => tier.amount === 40)?.date).toBe(formatDate('2025-03-10T00:00:00.000Z'));
      expect(tiers.find((tier) => tier.amount === 45)?.unlockRequirement).toBe('Borrow & repay the full $40 to unlock');
   });
});

describe('getFullLimitLoans (credit- vs trust-building)', () => {
   it('uses the recorded limit: $15 at $15 is full-limit, then $17 at $20 is trust-building', () => {
      const first = createLoan({ id: 'a', loanAmount: 15, creditLimitAtRepayment: 15 });
      const second = createLoan({ id: 'b', loanAmount: 17, repaidAmount: 20, totalRepaymentAmount: 20, creditLimitAtRepayment: 20 });
      const full = getFullLimitLoans([second, first]);
      expect(full.get(first)).toBe(15);
      expect(full.has(second)).toBe(false);
   });

   it('a repaid loan with no recorded limit (unverified borrower) is never full-limit', () => {
      const unrecorded = createLoan({ id: 'a', loanAmount: 15 });
      expect(getFullLimitLoans([unrecorded]).size).toBe(0);
   });

   it('uses the limit recorded at repayment: a $20 loan on a $40 limit is trust-building', () => {
      const tierAmountButSmall = createLoan({ id: 'a', loanAmount: 20, creditLimitAtRepayment: 40 });
      const fullLimit = createLoan({ id: 'b', loanAmount: 40, creditLimitAtRepayment: 40 });
      const full = getFullLimitLoans([tierAmountButSmall, fullLimit]);
      expect(full.has(tierAmountButSmall)).toBe(false);
      expect(full.get(fullLimit)).toBe(40);
   });

   it('counts an open loan at the current limit only when asked, and never test or refunded loans', () => {
      const open = createLoan({ id: 'open', loanAmount: 20, repaidAmount: 0, totalRepaymentAmount: 24, repaymentStatus: 'Unpaid' });
      const openSmall = createLoan({ id: 'small', loanAmount: 10, repaidAmount: 0, totalRepaymentAmount: 12, repaymentStatus: 'Unpaid' });
      const testLoan = createLoan({ id: 'test', loanAmount: 15, isTest: true });
      const refunded = createLoan({ id: 'refunded', loanAmount: 15, refundedAt: '2026-09-11T00:00:00.000Z' });
      expect(getFullLimitLoans([open]).size).toBe(0);
      const full = getFullLimitLoans([open, openSmall, testLoan, refunded], 20);
      expect([...full.keys()].map((loan) => loan.id)).toEqual(['open']);
   });
});

describe('Borrower progress timeline', () => {
   const eventsFor = (loans: Loan[], cs = 20) => buildBorrowerTimelineEvents({ ...baseUser, cs }, loans);

   it('labels a tier-amount loan below the limit as trust-building, with no level-up', () => {
      const events = eventsFor(
         [createLoan({ id: 'a', loanAmount: 20, creditLimitAtRepayment: 40, fundedAt: '2026-09-01T00:00:00.000Z' })],
         40
      );
      expect(events.some((event) => event.type === 'trust_building_loan_funded')).toBe(true);
      expect(events.some((event) => event.type === 'credit_limit_unlocked')).toBe(false);
   });

   it('shows the level-up for a full-limit loan even when it was repaid late', () => {
      const late = createLoan({
         id: 'late',
         loanAmount: 15,
         creditLimitAtRepayment: 15,
         dueDate: '2026-09-01T00:00:00.000Z',
         repaidAt: '2026-09-20T00:00:00.000Z',
         updatedAt: '2026-09-20T00:00:00.000Z'
      });
      const unlocked = eventsFor([late]).find((event) => event.type === 'credit_limit_unlocked');
      expect(unlocked?.amount).toBe(20);
      expect(unlocked?.description).toBe('Unlocked Level 2: a $20 limit.');
   });
});

describe('ladder copies stay in sync', () => {
   it('the edge functions use the same ladder and level-3 limit as the website', async () => {
      const { CREDIT_TIERS, MAX_CREDIT_LIMIT, getNextCreditTier } = await import('@/config/creditTiers');
      const server = await import('../../supabase/functions/_shared/creditAndPoints.ts');
      expect([...server.CREDIT_TIERS]).toEqual([...CREDIT_TIERS]);
      expect(server.MAX_CREDIT_LIMIT).toBe(MAX_CREDIT_LIMIT);
      for (const limit of [15, 20, 25, 40, 60, 100, 120, 135]) {
         for (const joinedAt of [undefined, '2026-09-19T00:00:00Z', '2026-09-30T17:30:00Z', '2026-10-08T00:00:00Z']) {
            for (const fundedAt of [undefined, '2026-11-10T00:00:00Z', '2026-11-20T00:00:00Z']) {
               expect(server.getNextCreditTier(limit, joinedAt, fundedAt)).toBe(getNextCreditTier(limit, joinedAt, fundedAt));
            }
         }
      }
      expect(server.getCreditTrack('2026-09-30T16:59:00Z')).toBe('A');
      expect(server.getCreditTrack('2026-09-30T17:00:00Z')).toBe('B');
      const { readFileSync } = await import('node:fs');
      const rewards = readFileSync('supabase/functions/_shared/trustPointRewards.ts', 'utf8');
      expect(rewards).toContain(`const MAX_CREDIT_LIMIT = ${MAX_CREDIT_LIMIT};`);
      expect(rewards).toContain(`const LEVEL_THREE_LIMIT = ${CREDIT_TIERS[2]};`);
   });
});

describe('credit tracks: joined before October 2026 = Track A (old ladder), everyone else = Track B', () => {
   const full = {
      isVerified: true,
      repaidAmount: 24,
      totalRepaymentAmount: 24,
      loanAmount: 20,
      currentLimit: 20,
      dueDate: '2026-11-22T00:00:00Z',
      dueTimezone: 'Asia/Manila',
      fundedAt: '2026-10-23T10:43:58Z',
      paidAt: '2026-11-22T10:00:00Z'
   };
   it('Track A keeps the old steps for good: $20 → $40 → $60', () => {
      expect(evaluateCreditProgression({ ...full, joinedAt: '2026-09-19T00:00:00Z' }).nextLimit).toBe(40);
      expect(evaluateCreditProgression({ ...full, currentLimit: 40, loanAmount: 40, joinedAt: '2026-09-19T00:00:00Z' }).nextLimit).toBe(60);
   });
   it('Track B: a loan funded before the Nov 14 switch keeps the old step once ($20 → $40), then +$10 ($40 → $45)', () => {
      expect(evaluateCreditProgression({ ...full, joinedAt: '2026-10-08T00:00:00Z' }).nextLimit).toBe(40);
      const nextLoan = { ...full, currentLimit: 40, loanAmount: 40, fundedAt: '2026-11-25T00:00:00Z', paidAt: '2026-12-20T00:00:00Z' };
      expect(evaluateCreditProgression({ ...nextLoan, joinedAt: '2026-10-08T00:00:00Z' }).nextLimit).toBe(45);
      expect(evaluateCreditProgression({ ...full, fundedAt: '2026-11-15T00:00:00Z', joinedAt: '2026-10-08T00:00:00Z' }).nextLimit).toBe(25);
      expect(evaluateCreditProgression({ ...full, currentLimit: 15, loanAmount: 15, joinedAt: '2026-11-20T00:00:00Z' }).nextLimit).toBe(25);
   });
});

describe('the 48-hour rule: a loan repaid within 2 days of funding never levels up', () => {
   const base = {
      currentLimit: 15,
      isVerified: true,
      repaidAmount: 16.5,
      totalRepaymentAmount: 16.5,
      loanAmount: 15,
      dueDate: '2026-12-16T00:00:00Z',
      dueTimezone: 'Asia/Manila',
      fundedAt: '2026-11-16T08:00:00Z'
   };
   it('repaid 30 hours after funding: no level-up', () => {
      expect(evaluateCreditProgression({ ...base, paidAt: '2026-11-17T14:00:00Z' }).shouldLevelUp).toBe(false);
   });
   it('repaid 49 hours after funding: levels up as before', () => {
      expect(evaluateCreditProgression({ ...base, paidAt: '2026-11-18T09:00:00Z' }).shouldLevelUp).toBe(true);
   });
});

describe('the second-half rule (loans funded from 2026-11-27 Bangkok): only payments in the 2nd half grow the limit', () => {
   // Funded Dec 1 09:00 Manila, due Dec 31: the loan ends Jan 1 00:00 Manila, halfway Dec 16 ~04:30, so the
   // 2nd half starts Dec 16 00:00 Manila (= Dec 15 16:00Z).
   const base = {
      currentLimit: 15,
      isVerified: true,
      repaidAmount: 16.5,
      totalRepaymentAmount: 16.5,
      loanAmount: 15,
      dueDate: '2026-12-31T00:00:00Z',
      dueTimezone: 'Asia/Manila',
      fundedAt: '2026-12-01T01:00:00Z'
   };
   it('starts counting at 00:00 Manila on the halfway day', () => {
      expect(countsFromAt(base.fundedAt, base.dueDate, base.dueTimezone)?.toISOString()).toBe('2026-12-15T16:00:00.000Z');
   });
   it('paid on day 5 (after 48 hours, first half): no level-up', () => {
      expect(isTooEarlyRepay(base.fundedAt, '2026-12-06T01:00:00Z', base.dueDate, base.dueTimezone)).toBe(true);
      expect(evaluateCreditProgression({ ...base, paidAt: '2026-12-06T01:00:00Z' }).shouldLevelUp).toBe(false);
   });
   it('paid one minute before the 2nd half: no level-up; at its start: levels up', () => {
      expect(evaluateCreditProgression({ ...base, paidAt: '2026-12-15T15:59:00Z' }).shouldLevelUp).toBe(false);
      expect(evaluateCreditProgression({ ...base, paidAt: '2026-12-15T16:00:00Z' }).shouldLevelUp).toBe(true);
   });
   it('paid on day 20 or on the due day: levels up', () => {
      expect(evaluateCreditProgression({ ...base, paidAt: '2026-12-21T01:00:00Z' }).shouldLevelUp).toBe(true);
      expect(evaluateCreditProgression({ ...base, paidAt: '2026-12-31T10:00:00Z' }).shouldLevelUp).toBe(true);
   });
   it('a loan funded before the switch keeps the 48-hour rule', () => {
      const old = { ...base, fundedAt: '2026-11-26T01:00:00Z', dueDate: '2026-12-26T00:00:00Z' };
      expect(countsFromAt(old.fundedAt, old.dueDate, old.dueTimezone)?.toISOString()).toBe('2026-11-28T01:00:00.000Z');
      expect(evaluateCreditProgression({ ...old, paidAt: '2026-11-29T01:00:00Z' }).shouldLevelUp).toBe(true);
   });
   it('a short loan never asks for less than 48 hours', () => {
      // Funded Dec 1, due Dec 3: halfway is Dec 2, but 48 hours after funding comes later.
      expect(countsFromAt(base.fundedAt, '2026-12-03T00:00:00Z', 'Asia/Manila')?.toISOString()).toBe('2026-12-03T01:00:00.000Z');
   });
});

describe('income ladders (2026-11-27): the income ceiling picks the steps', () => {
   const newB = '2026-11-20T00:00:00Z'; // Track B
   const after = '2026-11-29T00:00:00Z'; // funded after INCOME_LADDER_FROM
   it('low income ($35): shows at least +$2 (the Limit Spin minimum), top $35', async () => {
      const { getIncomeNextLimit } = await import('@/config/creditTiers');
      // The Limit Spin's guaranteed minimum (+$2), never past $35.
      expect([15, 17, 25, 33, 34, 35].map((l) => getIncomeNextLimit(l, 35, newB, after))).toEqual([17, 19, 27, 35, 35, 35]);
   });
   it('default ($60): the normal +$10 steps, top $60', async () => {
      const { getIncomeNextLimit } = await import('@/config/creditTiers');
      expect([15, 25, 35, 45, 55, 60].map((l) => getIncomeNextLimit(l, 60, newB, after))).toEqual([25, 35, 45, 55, 60, 60]);
   });
   it('approved proof of ₱23k+ ($140): still the normal +$10 steps, just no $60 top', async () => {
      const { getIncomeNextLimit } = await import('@/config/creditTiers');
      expect([15, 25, 55, 65, 125].map((l) => getIncomeNextLimit(l, 140, newB, after))).toEqual([25, 35, 65, 75, 135]);
   });
   it('a loan funded before the switch keeps its +$10 step, capped at the ceiling', async () => {
      const { getIncomeNextLimit } = await import('@/config/creditTiers');
      expect(getIncomeNextLimit(15, 35, newB, '2026-11-26T00:00:00Z')).toBe(25);
      expect(getIncomeNextLimit(25, 35, newB, '2026-11-26T00:00:00Z')).toBe(35);
      expect(getIncomeNextLimit(35, 35, newB, '2026-11-26T00:00:00Z')).toBe(35);
   });
   it('never lowers a limit above the ceiling; no ceiling = the old ladder', async () => {
      const { getIncomeNextLimit } = await import('@/config/creditTiers');
      expect(getIncomeNextLimit(100, 60, newB, after)).toBe(100);
      expect(getIncomeNextLimit(15, null, newB, after)).toBe(25);
   });
   it('early members (Track A) keep their ladder, capped at the ceiling', async () => {
      const { getIncomeNextLimit } = await import('@/config/creditTiers');
      expect(getIncomeNextLimit(20, 60, '2026-09-01T00:00:00Z', after)).toBe(40);
      expect(getIncomeNextLimit(40, 60, '2026-09-01T00:00:00Z', after)).toBe(60);
      expect(getIncomeNextLimit(20, 35, '2026-09-01T00:00:00Z', after)).toBe(35);
   });
   it('server and app agree', async () => {
      const client = await import('@/config/creditTiers');
      const server = await import('../../supabase/functions/_shared/creditAndPoints.ts');
      for (const ceiling of [35, 60, 140, null]) {
         for (const limit of [15, 20, 25, 30, 35, 40, 45, 55, 60, 75, 100]) {
            for (const funded of [after, '2026-11-26T00:00:00Z', null]) {
               expect(server.getIncomeNextLimit(limit, ceiling, newB, funded)).toBe(
                  client.getIncomeNextLimit(limit, ceiling, newB, funded)
               );
            }
         }
      }
   });
});

describe('low income: pay anytime, the spin unlocks on day 3 (2026-11-28)', () => {
   const base = {
      currentLimit: 15,
      isVerified: true,
      repaidAmount: 16.5,
      totalRepaymentAmount: 16.5,
      loanAmount: 15,
      dueDate: '2026-12-31T00:00:00Z',
      dueTimezone: 'Asia/Manila',
      fundedAt: '2026-12-01T01:00:00Z',
      joinedAt: '2026-11-20T00:00:00Z'
   };
   it('day 1: counts for low income, still too early for the 2nd-half rule', () => {
      expect(evaluateCreditProgression({ ...base, lowIncome: true, paidAt: '2026-12-01T06:00:00Z' }).shouldLevelUp).toBe(true);
      expect(evaluateCreditProgression({ ...base, paidAt: '2026-12-01T06:00:00Z' }).shouldLevelUp).toBe(false);
   });
   it('a loan funded before the low-income switch keeps the 2nd-half rule', () => {
      expect(
         evaluateCreditProgression({ ...base, fundedAt: '2026-11-27T12:00:00Z', lowIncome: true, paidAt: '2026-11-28T12:00:00Z' }).shouldLevelUp
      ).toBe(false);
   });
   it('the spin unlocks 3 days after funding, the same on server and app', async () => {
      const server = await import('../../supabase/functions/_shared/creditAndPoints.ts');
      const app = await import('@/config/creditTiers');
      expect(app.limitSpinUnlockAt(base.fundedAt)?.toISOString()).toBe('2026-12-04T01:00:00.000Z');
      expect(server.limitSpinUnlockAt(base.fundedAt)?.toISOString()).toBe('2026-12-04T01:00:00.000Z');
      expect(app.limitSpinUnlockAt(null)).toBeNull();
      expect(server.LIMIT_SPIN_UNLOCK_DAYS).toBe(app.LIMIT_SPIN_UNLOCK_DAYS);
   });
   it('server and app agree on when it counts', async () => {
      const server = await import('../../supabase/functions/_shared/creditAndPoints.ts');
      for (const low of [true, false]) {
         for (const funded of ['2026-11-26T01:00:00Z', '2026-11-27T12:00:00Z', '2026-12-01T01:00:00Z']) {
            expect(server.countsFromAt(funded, base.dueDate, 'Asia/Manila', { lowIncome: low })?.toISOString()).toBe(
               countsFromAt(funded, base.dueDate, 'Asia/Manila', { lowIncome: low })?.toISOString()
            );
         }
      }
   });
});

describe('Limit Spin: usually +$3, never less than +$2, up to +$5', () => {
   it('draws by the odds', async () => {
      const { drawLimitSpin } = await import('@/config/creditTiers');
      expect(drawLimitSpin(() => 0)).toBe(2);
      expect(drawLimitSpin(() => 0.24)).toBe(2);
      expect(drawLimitSpin(() => 0.25)).toBe(3);
      expect(drawLimitSpin(() => 0.84)).toBe(3);
      expect(drawLimitSpin(() => 0.86)).toBe(4);
      expect(drawLimitSpin(() => 0.99)).toBe(5);
   });
   it('only low income, Track B, loans funded from 11-28 earn it', async () => {
      const { earnsLimitSpin } = await import('@/config/creditTiers');
      expect(earnsLimitSpin(35, '2026-11-20T00:00:00Z', '2026-11-29T00:00:00Z')).toBe(true);
      expect(earnsLimitSpin(60, '2026-11-20T00:00:00Z', '2026-11-29T00:00:00Z')).toBe(false);
      expect(earnsLimitSpin(35, '2026-09-01T00:00:00Z', '2026-11-29T00:00:00Z')).toBe(false);
      expect(earnsLimitSpin(35, '2026-11-20T00:00:00Z', '2026-11-26T00:00:00Z')).toBe(false);
   });
   it('server and app agree', async () => {
      const client = await import('@/config/creditTiers');
      const server = await import('../../supabase/functions/_shared/creditAndPoints.ts');
      for (const r of [0, 0.3, 0.61, 0.9, 0.97]) expect(server.drawLimitSpin(() => r)).toBe(client.drawLimitSpin(() => r));
      expect(server.earnsLimitSpin(35, '2026-11-20T00:00:00Z', '2026-11-29T00:00:00Z')).toBe(true);
   });
});
