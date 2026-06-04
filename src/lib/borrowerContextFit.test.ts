import { describe, expect, it } from 'vitest';

import { type BorrowerContextInput, buildBorrowerContextFit } from '@/lib/borrowerContextFit';

const makeInput = (overrides: Partial<BorrowerContextInput> = {}): BorrowerContextInput => ({
   borrowerName: 'maya-demo',
   requestDate: new Date('2026-05-08T00:00:00.000Z'),
   dueDate: new Date('2026-05-16T00:00:00.000Z'),
   amount: 15,
   reason: 'groceries',
   incomeType: 'full-time',
   paydayType: 'mid-month',
   paydayStart: 10,
   paydayEnd: 15,
   gapReasons: ['family needs'],
   ...overrides
});

describe('borrower context fit', () => {
   it('returns strong fit — will have income before repayment', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('2026-05-18T00:00:00.000Z') }));
      expect(result.fitLevel).toBe('strong');
      expect(result.gapDays).toBe(3);
      expect(result.verdictHTML).toContain('<strong>3 days</strong>');
      expect(result.verdictHTML).toContain("they'll have income before they need to pay back");
   });

   it('returns ok — repayment lands inside pay window', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('2026-05-12T00:00:00.000Z') }));
      expect(result.fitLevel).toBe('ok');
      expect(result.gapDays).toBe(2);
      expect(result.verdictHTML).toContain('mid-month pay window');
   });

   it('returns weak — repayment before payday', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('2026-05-08T00:00:00.000Z') }));
      expect(result.fitLevel).toBe('weak');
      expect(result.gapDays).toBe(-2);
      expect(result.verdictHTML).toContain('<strong>2 days</strong> before their usual payday');
   });

   it('returns unknown for part-time irregular income', () => {
      const result = buildBorrowerContextFit(makeInput({
         incomeType: 'part-time',
         paydayType: 'irregular',
         paydayStart: null,
         paydayEnd: null,
         gapReasons: ['family needs', 'bills']
      }));
      expect(result.fitLevel).toBe('unknown');
      expect(result.gapDays).toBeNull();
      expect(result.verdictHTML).toContain('Part-time work with no fixed pay schedule');
   });

   it('returns unknown when no income on file', () => {
      const result = buildBorrowerContextFit(makeInput({ incomeType: 'none' }));
      expect(result.fitLevel).toBe('unknown');
      expect(result.verdictHTML).toContain('No income on file');
   });

   it('returns unknown when dates are missing', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('not-a-date') }));
      expect(result.fitLevel).toBe('unknown');
      expect(result.gapDays).toBeNull();
      expect(result.verdictHTML).toContain("Repayment date is missing");
   });

   it('uses multiple gap reasons as a natural list in chips', () => {
      const result = buildBorrowerContextFit(makeInput({ gapReasons: ['family needs', 'bills', 'transport'] }));
      const needChip = result.chips.find((chip) => chip.id === 'need');
      expect(result.contextLine).toContain('{need}');
      expect(needChip).toEqual({ id: 'need', label: 'family needs, bills, and transport', type: 'need' });
   });

   it('notes pattern match when reason matches gap reasons', () => {
      const result = buildBorrowerContextFit(makeInput({ reason: 'family expenses', gapReasons: ['family needs'] }));
      expect(result.verdictHTML).toContain('Consistent with their usual borrowing pattern');
   });

   it('weak timing with strong history notes prior repayments', () => {
      const result = buildBorrowerContextFit(makeInput({
         dueDate: new Date('2026-05-08T00:00:00.000Z'),
         repaidLoanCount: 4
      }));
      expect(result.fitLevel).toBe('weak');
      expect(result.verdictHTML).toContain("they've repaid in similar timing before");
   });

   it('shows verified + good standing in verdict', () => {
      const result = buildBorrowerContextFit(makeInput({ goodStanding: true, isVerified: true }));
      expect(result.verdictHTML).toContain('World ID verified · Good Standing.');
   });

   it('uses repaidLoanCount in track record phrase', () => {
      const result = buildBorrowerContextFit(makeInput({ repaidLoanCount: 3 }));
      expect(result.verdictHTML).toContain('Repaid 3 loans');
   });

   it('freelance with strong history notes prior repayments', () => {
      const result = buildBorrowerContextFit(makeInput({
         incomeType: 'freelance',
         paydayType: 'irregular',
         paydayStart: null,
         paydayEnd: null,
         repaidLoanCount: 3
      }));
      expect(result.fitLevel).toBe('unknown');
      expect(result.verdictHTML).toContain("they've repaid 3 loans before");
   });

   it('full-time irregular noted as commission or bonus-based', () => {
      const result = buildBorrowerContextFit(makeInput({
         incomeType: 'full-time',
         paydayType: 'irregular',
         paydayStart: null,
         paydayEnd: null
      }));
      expect(result.verdictHTML).toContain('commission or bonus-based');
   });

   it('emergency reason noted on weak timing', () => {
      const result = buildBorrowerContextFit(makeInput({
         dueDate: new Date('2026-05-08T00:00:00.000Z'),
         reason: 'emergency car repair',
         repaidLoanCount: 0
      }));
      expect(result.verdictHTML).toContain('Emergency need');
   });
});
