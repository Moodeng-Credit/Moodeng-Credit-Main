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
   it('returns a strong fit when repayment is 1-7 days after payday closes', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('2026-05-18T00:00:00.000Z') }));

      expect(result.fitLevel).toBe('strong');
      expect(result.gapDays).toBe(3);
      expect(result.verdictHTML).toContain('<strong>3-day gap</strong>');
      expect(result.verdictHTML).toContain('will have received income');
   });

   it('returns ok when repayment falls inside the payday window', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('2026-05-12T00:00:00.000Z') }));

      expect(result.fitLevel).toBe('ok');
      expect(result.gapDays).toBe(2);
      expect(result.verdictHTML).toContain('mid-month pay window');
   });

   it('returns weak when repayment is before the payday window opens', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('2026-05-08T00:00:00.000Z') }));

      expect(result.fitLevel).toBe('weak');
      expect(result.gapDays).toBe(-2);
      expect(result.verdictHTML).toContain('<strong>2 days</strong> before their typical pay window');
   });

   it('returns unknown for irregular income timing', () => {
      const result = buildBorrowerContextFit(
         makeInput({
            paydayType: 'irregular',
            paydayStart: null,
            paydayEnd: null,
            gapReasons: ['family needs', 'bills']
         })
      );

      expect(result.fitLevel).toBe('unknown');
      expect(result.gapDays).toBeNull();
      expect(result.verdictHTML).toContain('Variable pay timing');
      expect(result.verdictHTML).toContain('family needs and bills');
   });

   it('returns unknown when no income source is shared', () => {
      const result = buildBorrowerContextFit(makeInput({ incomeType: 'none' }));

      expect(result.fitLevel).toBe('unknown');
      expect(result.verdictHTML).toContain('No income source on file');
      expect(result.verdictHTML).toContain('family needs');
   });

   it('returns neutral unknown when dates are missing or unparseable', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('not-a-date') }));

      expect(result.fitLevel).toBe('unknown');
      expect(result.gapDays).toBeNull();
      expect(result.verdictHTML).toContain('Repayment timing is incomplete');
   });

   it('uses multiple gap reasons as a natural list in the context line chip data', () => {
      const result = buildBorrowerContextFit(makeInput({ gapReasons: ['family needs', 'bills', 'transport'] }));
      const needChip = result.chips.find((chip) => chip.id === 'need');

      expect(result.contextLine).toContain('{need}');
      expect(needChip).toEqual({ id: 'need', label: 'family needs, bills, and transport', type: 'need' });
   });

   it('flags a pattern match when reason matches gap reasons', () => {
      const result = buildBorrowerContextFit(makeInput({ reason: 'family expenses', gapReasons: ['family needs'] }));
      expect(result.verdictHTML).toContain('aligns with their usual borrowing pattern');
   });

   it('track record dominates for weak timing with strong history', () => {
      const result = buildBorrowerContextFit(makeInput({
         dueDate: new Date('2026-05-08T00:00:00.000Z'), // before payday window
         repaidLoanCount: 4
      }));
      expect(result.fitLevel).toBe('weak');
      expect(result.verdictHTML).toContain('proven track record');
   });

   it('shows verified + good standing in verdict', () => {
      const result = buildBorrowerContextFit(makeInput({ goodStanding: true, isVerified: true }));
      expect(result.verdictHTML).toContain('Verified human, Good Standing.');
   });

   it('uses repaidLoanCount over fundedLoanCount when both provided', () => {
      const result = buildBorrowerContextFit(makeInput({ repaidLoanCount: 3, fundedLoanCount: 5 }));
      expect(result.verdictHTML).toContain('3 repaid loans');
   });

   it('handles freelance + irregular with strong history correctly', () => {
      const result = buildBorrowerContextFit(makeInput({
         incomeType: 'freelance',
         paydayType: 'irregular',
         paydayStart: null,
         paydayEnd: null,
         repaidLoanCount: 3
      }));
      expect(result.fitLevel).toBe('unknown');
      expect(result.verdictHTML).toContain('established');
   });

   it('handles full-time + irregular as commission/bonus-based', () => {
      const result = buildBorrowerContextFit(makeInput({
         incomeType: 'full-time',
         paydayType: 'irregular',
         paydayStart: null,
         paydayEnd: null
      }));
      expect(result.verdictHTML).toContain('commission or bonus-based');
   });

   it('emergency reason gets urgency note on weak timing', () => {
      const result = buildBorrowerContextFit(makeInput({
         dueDate: new Date('2026-05-08T00:00:00.000Z'),
         reason: 'emergency car repair',
         repaidLoanCount: 0
      }));
      expect(result.verdictHTML).toContain('emergency');
   });
});
