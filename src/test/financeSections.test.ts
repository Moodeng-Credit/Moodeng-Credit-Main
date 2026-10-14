import { act, createElement, type ReactNode } from 'react';

import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Renders the Credit line and Marketing admin pages against fixed data, so a broken page shows up in CI
// (the real pages need an admin session).

const facility = {
   id: 'f1',
   name: 'BitRepo pilot',
   lender_name: 'Token Terrier LLC (BitRepo)',
   commitment_usd: 500,
   annual_rate: 0.15,
   start_date: '2026-09-17',
   period_anchor_day: 17,
   max_loan_usd: 100,
   max_term_days: null,
   originator_wallet: null,
   lending_wallet: null,
   notes: null
};
const borrower = {
   username: 'manuel',
   display_name: 'Manuel',
   facebook_name: 'Manny T',
   kyc_passed: true,
   kyc_document: 'Passport/PHL',
   liveness: true,
   facebook_verified: true,
   video_call_attended: false
};

vi.mock('@/app/admin/adminFinance', () => ({
   DEFAULT_GOALS: { lent_usd: 500, marketing_budget_usd: 50, cac_target_usd: 5 },
   loadCreditLine: vi.fn(async () => ({
      facilities: [facility],
      facility,
      loans: [
         {
            id: 'l1',
            tracking_id: 'LOAN-1',
            borrower_user_id: 'u1',
            funded_at: '2026-09-19T09:19:00Z',
            due_date: '2026-10-19T09:19:00Z',
            loan_amount: 15,
            total_repayment_amount: 17,
            repaid_amount: 0,
            repaid_at: null,
            repayment_status: 'Unpaid',
            hash: ['0x827fafcb6620cffcef6f71c009af922476e9636cd8c14506bef8193a929eac20'],
            reason: 'Power bill',
            rationale: 'Level 1, 1st loan. Didit passed.',
            borrower
         }
      ],
      ledger: [
         {
            id: 1,
            occurred_at: '2026-09-17T06:40:11Z',
            kind: 'advance',
            description: 'BitRepo advance',
            from_label: 'BitRepo',
            to_label: 'Moodeng',
            amount_usd: 500,
            tx_hash: '0xabc',
            loan_id: null
         }
      ],
      candidates: [],
      history: new Map([['l1', { prior: 0, repaid: 0, late: 0, creditLimit: 15 }]])
   })),
   loadMarketing: vi.fn(async () => ({
      loans: [
         {
            id: 'a',
            borrower_user_id: 'u1',
            loan_status: 'Lent',
            created_at: '2026-10-01T00:00:00Z',
            funded_at: '2026-10-02T02:00:00Z',
            due_date: '2026-11-01T00:00:00Z',
            repaid_at: null,
            repayment_status: 'Unpaid',
            loan_amount: 20,
            total_repayment_amount: 22
         },
         {
            id: 'b',
            borrower_user_id: 'u2',
            loan_status: 'Lent',
            created_at: '2026-09-01T00:00:00Z',
            funded_at: '2026-09-01T02:00:00Z',
            due_date: '2026-10-01T00:00:00Z',
            repaid_at: '2026-09-30T02:00:00Z',
            repayment_status: 'Paid',
            loan_amount: 15,
            total_repayment_amount: 17
         }
      ],
      users: [
         {
            id: 'u1',
            username: 'manuel',
            display_name: 'Manuel',
            facebook_name: null,
            created_at: '2026-09-30T00:00:00Z',
            verified: true,
            messenger_verified_at: null,
            redeemed_referral_code_id: null,
            credit_limit: 15
         },
         {
            id: 'u2',
            username: 'princess',
            display_name: 'Princess Cabantugan',
            facebook_name: null,
            created_at: '2026-08-30T00:00:00Z',
            verified: true,
            messenger_verified_at: null,
            redeemed_referral_code_id: null,
            credit_limit: 20,
            account_status: 'active',
            loan_access_status: 'approved'
         }
      ],
      spend: [{ id: 1, spent_on: '2026-10-03', channel: 'poster', amount_usd: 20, referral_code_id: null, note: 'Cebu IT Park' }],
      codes: [{ id: 'c1', code: 'POSTER-01', channel: 'poster', label: 'Cebu' }],
      goals: { lent_usd: 500, marketing_budget_usd: 50, cac_target_usd: 5 },
      excluded: new Set<string>()
   })),
   addFacilityLoan: vi.fn(),
   addLedgerEntry: vi.fn(),
   deleteLedgerEntry: vi.fn(),
   removeFacilityLoan: vi.fn(),
   setFacilityLoanRationale: vi.fn(),
   addSpend: vi.fn(),
   deleteSpend: vi.fn(),
   saveGoal: vi.fn(),
   setCodeChannel: vi.fn(),
   setGoalExcluded: vi.fn()
}));

class ResizeObserverStub {
   observe() {}
   unobserve() {}
   disconnect() {}
}

describe('finance admin pages', () => {
   let container: HTMLDivElement;
   beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-12T04:00:00Z'));
      (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
      (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
      container = document.createElement('div');
      document.body.appendChild(container);
   });
   afterEach(() => {
      vi.useRealTimers();
      container.remove();
   });

   const render = async (node: ReactNode) => {
      const root = createRoot(container);
      await act(async () => {
         root.render(node);
      });
      await act(async () => {
         await Promise.resolve();
      });
      return root;
   };

   it('shows credit line balances, loans with tx links, and the ledger', async () => {
      const { default: CreditLineSection } = await import('@/app/admin/CreditLineSection');
      const root = await render(createElement(CreditLineSection));
      const text = container.textContent ?? '';
      expect(text).toContain('Advance received');
      expect(text).toContain('$500.00');
      expect(text).toContain('Lent out now');
      expect(text).toContain('$15.00');
      expect(text).toContain('B-01');
      expect(text).toContain('2026-10-17'); // first report due
      expect(container.querySelector('a[href*="basescan.org/tx/0x827fafcb"]')).not.toBeNull();
      expect(text).toContain('BitRepo advance');
      act(() => root.unmount());
   });

   it('shows the goal by name, spend vs budget and who to contact', async () => {
      const { default: MarketingSection } = await import('@/app/admin/MarketingSection');
      const root = await render(createElement(MarketingSection));
      const text = container.textContent ?? '';
      expect(text).toContain('Goal: $500 lent');
      expect(text).toContain('Already lent');
      expect(text).toContain('Manuel'); // lent this month
      expect(text).toContain('Princess Cabantugan'); // repaid, can borrow again now
      expect(text).toContain('Still need from new people');
      expect(text).toContain('This week');
      expect(text).toContain('Spent this month');
      expect(text).toContain('$20.00');
      expect(text).toContain('Does the spend pay off?');
      expect(text).toContain('Who to contact today');
      expect(text).toContain('POSTER-01');
      act(() => root.unmount());
   });
});
