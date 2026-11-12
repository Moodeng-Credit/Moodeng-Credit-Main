import { describe, expect, it } from 'vitest';

import type { LenderLoan, LenderReportData } from '@/lib/creditLineReport';
import { BITREPO_ROLLOVER_ADDRESS, buildRollover } from '@/lib/creditLineRollover';

const LENDING = '0xc1022456dfd3bf36af1da553cd5631f9e76ca8d6';

const loan = (over: Partial<LenderLoan>): LenderLoan =>
   ({
      id: 'l1',
      tracking_id: 'LOAN-1',
      privateId: 'B-01',
      loan_amount: 100,
      total_repayment_amount: 110,
      repaid_amount: 0,
      fundedDate: '2026-10-01',
      dueDate: '2026-10-31',
      repaidDate: null,
      status: 'Current',
      repaymentTxs: [],
      vaultAddress: null,
      lenderWallet: LENDING,
      ...over
   }) as LenderLoan;

const data = (loans: LenderLoan[]): LenderReportData =>
   ({
      facility: { annual_rate: 0.15, start_date: '2026-09-17', lending_wallet: LENDING },
      ledger: [{ kind: 'advance', amount_usd: 500 }],
      loans
   }) as unknown as LenderReportData;

describe('buildRollover', () => {
   it('owes the advance plus interest on direct loans only, and counts what arrived from us or those loans', () => {
      const r = buildRollover(
         data([
            // Repaid after 73 days: 100 × 15% × 73/365 = $3.00 interest.
            loan({ id: 'a', status: 'Closed', repaidDate: '2026-12-13', repaid_amount: 110, repaymentTxs: ['0xAAA'] }),
            // Open, pays BitRepo directly, 30 days so far (to 2026-10-31 = today), due later.
            loan({ id: 'b', fundedDate: '2026-10-01', dueDate: '2026-11-30', lenderWallet: BITREPO_ROLLOVER_ADDRESS }),
            // Vault loan: not part of the rollover.
            loan({ id: 'c', vaultAddress: '0xvault' })
         ]),
         [
            { hash: '0xaaa', from: '0xborrower', amount: 110, at: '2026-12-13T05:00:00Z' },
            { hash: '0xbbb', from: LENDING, amount: 50, at: '2026-11-11T05:00:00Z' },
            { hash: '0xccc', from: '0xsomeoneelse', amount: 20000, at: '2026-11-06T05:00:00Z' }
         ],
         '2026-10-31'
      );
      expect(r.loans.map((l) => l.loan.id)).toEqual(['a', 'b']);
      expect(r.principal).toBe(500);
      // 3.00 (a) + 100 × 0.15 × 30/365 (b so far) = 3.00 + 1.23
      expect(r.interest).toBeCloseTo(4.23, 2);
      // b projected to its due date: 60 days = 2.47
      expect(r.interestProjected).toBeCloseTo(5.47, 2);
      expect(r.received).toBe(160);
      expect(r.receipts.map((x) => x.source)).toEqual(['moodeng', 'borrower']);
      expect(r.comingFromBorrowers).toBe(110);
      expect(r.moodengToSend).toBeCloseTo(500 + 5.47 - 160 - 110, 2);
      expect(r.overBy).toBe(0);
   });
});
