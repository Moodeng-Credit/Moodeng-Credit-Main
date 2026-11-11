import { describe, expect, it } from 'vitest';

import {
   buildFacilityLoans,
   type CreditFacility,
   facilityExceptions,
   type FacilityLedgerRow,
   type FacilityLoanInput,
   facilityReturnDue,
   facilitySummary,
   interestByMonth,
   lenderLoanRows,
   privateBorrowerIds,
   reportingPeriods,
   splitReturn
} from '@/app/admin/creditLineModel';

const facility: CreditFacility = {
   id: 'f1',
   name: 'BitRepo pilot',
   lender_name: 'BitRepo',
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
   username: 'u',
   display_name: 'U',
   facebook_name: null,
   kyc_passed: true,
   kyc_document: 'Passport/PHL',
   liveness: true,
   facebook_verified: true,
   video_call_attended: false
};

const loan = (over: Partial<FacilityLoanInput>): FacilityLoanInput => ({
   id: 'l1',
   tracking_id: 'LOAN-1',
   borrower_user_id: 'a',
   funded_at: '2026-09-20T02:00:00Z', // Sep 20 Manila
   due_date: '2026-10-20T00:00:00Z',
   loan_amount: 100,
   total_repayment_amount: 113,
   repaid_amount: 0,
   repaid_at: null,
   repayment_status: 'Unpaid',
   hash: ['0xdisb'],
   reason: 'Groceries',
   rationale: 'ok',
   borrower,
   ...over
});

describe('creditLineModel', () => {
   it('rupiah-pegged loans: cost from the request-time total, principal capped at what was repaid', () => {
      // $10 lent, priced at $12 at request; the rupiah fell and the borrower closed it paying $9.40.
      const [pegged] = buildFacilityLoans(
         [
            loan({
               loan_amount: 10,
               usd_total_at_request: 12,
               total_repayment_amount: 9.4,
               repaid_amount: 9.4,
               repayment_status: 'Paid',
               repaid_at: '2026-09-27T02:00:00Z',
               hash: ['bsc:0xdisb', '0xrepay']
            })
         ],
         [],
         '2026-10-01'
      );
      expect(pegged.impliedCost).toBeCloseTo(0.2);
      expect(pegged.restructured).toBe(false);
      expect(pegged.principalRepaid).toBe(9.4);
      expect(pegged.interestRepaid).toBe(0);
      expect(pegged.outstanding).toBe(0);
      expect(pegged.status).toBe('Closed');

      // Same loan priced the same, but the rupiah rose: paid $12.60 → principal 10, interest 2.60.
      const [up] = buildFacilityLoans(
         [
            loan({
               loan_amount: 10,
               usd_total_at_request: 12,
               total_repayment_amount: 12.6,
               repaid_amount: 12.6,
               repayment_status: 'Paid',
               repaid_at: '2026-09-27T02:00:00Z'
            })
         ],
         [],
         '2026-10-01'
      );
      expect(up.impliedCost).toBeCloseTo(0.2);
      expect(up.principalRepaid).toBe(10);
      expect(up.interestRepaid).toBe(2.6);
   });

   it('numbers borrowers in order of their first loan', () => {
      const ids = privateBorrowerIds([
         { borrower_user_id: 'b', funded_at: '2026-09-25T00:00:00Z' },
         { borrower_user_id: 'a', funded_at: '2026-09-20T00:00:00Z' },
         { borrower_user_id: 'b', funded_at: '2026-09-21T00:00:00Z' }
      ]);
      expect(ids.get('a')).toBe('B-01');
      expect(ids.get('b')).toBe('B-02');
   });

   it('builds 17th-to-16th reporting periods due the day after', () => {
      expect(reportingPeriods(facility, '2026-10-20')).toEqual([
         { start: '2026-09-17', end: '2026-10-16', due: '2026-10-17' },
         { start: '2026-10-17', end: '2026-11-16', due: '2026-11-17' }
      ]);
   });

   it('accrues actual/365 interest on deployed principal, split by calendar month', () => {
      const loans = buildFacilityLoans(
         [loan({ repaid_amount: 113, repaid_at: '2026-10-10T03:00:00Z', repayment_status: 'Paid', hash: ['0xdisb', '0xrepay'] })],
         [],
         '2026-10-12'
      );
      const months = interestByMonth(loans, 0.15, '2026-10-12');
      expect(months.map((m) => m.month)).toEqual(['2026-09', '2026-10']);
      expect(months[0].interest).toBeCloseTo((100 * 11 * 0.15) / 365, 6); // Sep 20 → Oct 1
      expect(months[1].interest).toBeCloseTo((100 * 9 * 0.15) / 365, 6); // Oct 1 → Oct 10
      expect(loans[0]).toMatchObject({
         status: 'Closed',
         outstanding: 0,
         principalRepaid: 100,
         interestRepaid: 13,
         repaymentTxs: ['0xrepay']
      });
   });

   it('marks late loans and counts days past due', () => {
      const [l] = buildFacilityLoans([loan({})], [], '2026-10-25');
      expect(l).toMatchObject({ status: 'Late', daysPastDue: 5, outstanding: 100, termDays: 30 });
   });

   it('takes a missing disbursement tx from the ledger', () => {
      const ledger: FacilityLedgerRow[] = [
         {
            id: 1,
            occurred_at: '',
            kind: 'disbursement',
            description: '',
            from_label: null,
            to_label: null,
            amount_usd: -100,
            tx_hash: '0xfix',
            loan_id: 'l1'
         }
      ];
      const [l] = buildFacilityLoans([loan({ hash: [] })], ledger, '2026-10-12');
      expect(l.disbursementTxs).toEqual(['0xfix']);
   });

   it('summarises balances against the advance', () => {
      const ledger: FacilityLedgerRow[] = [
         {
            id: 1,
            occurred_at: '',
            kind: 'advance',
            description: '',
            from_label: null,
            to_label: null,
            amount_usd: 500,
            tx_hash: '0xa',
            loan_id: null
         }
      ];
      const loans = buildFacilityLoans(
         [loan({}), loan({ id: 'l2', borrower_user_id: 'b', loan_amount: 20, total_repayment_amount: 22 })],
         ledger,
         '2026-10-12'
      );
      const s = facilitySummary(facility, loans, ledger, '2026-10-12');
      expect(s).toMatchObject({ advanced: 500, deployed: 120, unallocated: 380, openLoans: 2 });
      expect(s.utilization).toBeCloseTo(0.24);
   });

   it('flags non-Philippine IDs, missing KYC documents, restructures and missing txs', () => {
      const loans = buildFacilityLoans(
         [
            loan({ borrower: { ...borrower, kyc_document: 'Identity Card/IDN' } }),
            loan({
               id: 'l2',
               borrower_user_id: 'b',
               total_repayment_amount: 100,
               reason: 'Bridge loan',
               hash: [],
               borrower: { ...borrower, kyc_document: null }
            })
         ],
         [],
         '2026-10-12'
      );
      const kinds = facilityExceptions(facility, loans, 0).map((e) => `${e.privateId}:${e.kind}`);
      expect(kinds).toEqual(expect.arrayContaining(['B-01:country', 'B-02:kyc', 'B-02:restructure', 'B-02:missing_tx']));
   });

   it('exports private IDs and never usernames', () => {
      const loans = buildFacilityLoans(
         [loan({ borrower: { ...borrower, username: 'secret-user', display_name: 'Secret Name' } })],
         [],
         '2026-10-12'
      );
      const csv = JSON.stringify(lenderLoanRows(loans, '2026-10-12'));
      expect(csv).toContain('B-01');
      expect(csv).not.toContain('secret-user');
      expect(csv).not.toContain('Secret Name');
   });

   it('what goes back to BitRepo: the advance not still out, plus 15%/yr on repaid advance loans; vault loans left out', () => {
      const ledger: FacilityLedgerRow[] = [
         { id: 'a', occurred_at: '2026-09-17', kind: 'advance', description: '', from_label: '', to_label: '', amount_usd: 500, tx_hash: null, loan_id: null }
      ];
      const loans = buildFacilityLoans(
         [
            // $100 out for 73 days (Sep 20 → Dec 2), repaid: $3 interest at 15%/yr.
            loan({ id: 'paid', repaid_amount: 113, repaid_at: '2026-12-02T02:00:00Z', repayment_status: 'Paid', hash: ['0xdisb', '0xrep'] }),
            loan({ id: 'open', tracking_id: 'LOAN-2', loan_amount: 50, total_repayment_amount: 56 }),
            loan({ id: 'vault', tracking_id: 'LOAN-3', loan_amount: 25, vault_address: '0xvault' })
         ],
         ledger,
         '2026-12-05'
      );
      const due = facilityReturnDue(facility, loans, ledger);
      expect(due.stillOut).toBe(50);
      expect(due.principalDue).toBe(450);
      expect(due.interestDue).toBe(3);
      expect(due.total).toBe(453);
      expect(due.openLoans).toBe(1);

      // Recording a $100 return: interest first, then principal.
      const split = splitReturn(100, due.interestDue);
      expect(split).toEqual({ interest: 3, principal: 97 });
      const after = facilityReturnDue(facility, loans, [
         ...ledger,
         { ...ledger[0], id: 'i', kind: 'interest_payment', amount_usd: -3 },
         { ...ledger[0], id: 'p', kind: 'principal_return', amount_usd: -97 }
      ]);
      expect(after.total).toBe(353);
      expect(after.interestDue).toBe(0);
   });
});
