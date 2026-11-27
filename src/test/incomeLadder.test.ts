import { describe, expect, it } from 'vitest';

import { docMonthlyPhp, incomeLadderLine } from '../../supabase/functions/_shared/incomeLadder.ts';

describe('proof of income → monthly amount for the credit ladder', () => {
   it('scales a half-month payslip to a month', () => {
      expect(docMonthlyPhp({ currency: 'PHP', doc_type: 'payslip', net_pay: 9000, months_covered: 0.5 })).toBe(18000);
   });
   it('a payslip with no usable period counts as one month', () => {
      expect(docMonthlyPhp({ currency: 'PHP', doc_type: 'payslip', net_pay: 25125, months_covered: 1 })).toBe(25125);
      expect(docMonthlyPhp({ currency: 'PHP', doc_type: 'payslip', net_pay: 25125, months_covered: 0 })).toBe(25125);
   });
   it('a bank statement uses money coming in, not a stray net-pay figure', () => {
      expect(docMonthlyPhp({ currency: 'PHP', doc_type: 'bank_statement', net_pay: 3014, monthly_in: 8229 })).toBe(8229);
   });
   it('no net pay: the regular deposit, else money in per month', () => {
      expect(docMonthlyPhp({ currency: 'PHP', regular_deposits: [{ amount: 18848 }], monthly_in: 43149 })).toBe(18848);
      expect(docMonthlyPhp({ currency: 'PHP', regular_deposits: [], monthly_in: 8229.02 })).toBe(8229);
   });
   it('not pesos or nothing readable: no amount', () => {
      expect(docMonthlyPhp({ currency: 'IDR', doc_type: 'payslip', net_pay: 2_500_000 })).toBeNull();
      expect(docMonthlyPhp({ currency: 'PHP' })).toBeNull();
   });
});

describe('team card line: said vs shows → ladder', () => {
   it('more than they said', () => {
      expect(incomeLadderLine('under_200', 18400)).toBe(
         '🪜 Said: under ₱12k · Shows: about ₱18,400/month → if approved: normal steps, top $60 · ⚠️ more than they said'
      );
   });
   it('less than they said', () => {
      expect(incomeLadderLine('700_plus', 3000)).toBe(
         '🪜 Said: ₱41k+ · Shows: about ₱3,000/month → if approved: small steps, top $35 · ⚠️ less than they said'
      );
   });
   it('matches', () => {
      expect(incomeLadderLine('400_700', 30000)).toBe(
         '🪜 Said: ₱23k–41k · Shows: about ₱30,000/month → if approved: normal steps, no $60 top'
      );
   });
   it('nothing readable', () => {
      expect(incomeLadderLine(null, null)).toBe('🪜 Said: nothing · Shows: no monthly amount → their ladder stays on what they said');
   });
});
