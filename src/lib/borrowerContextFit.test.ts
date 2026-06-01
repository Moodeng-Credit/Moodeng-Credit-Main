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
      expect(result.verdictHTML).toContain('will have received income before repayment is due');
   });

   it('returns ok when repayment falls inside the payday window', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('2026-05-12T00:00:00.000Z') }));

      expect(result.fitLevel).toBe('ok');
      expect(result.gapDays).toBe(2);
      expect(result.verdictHTML).toContain('inside their usual mid-month window');
      expect(result.verdictHTML).toContain('<strong>2-day gap</strong>');
   });

   it('returns weak when repayment is before the payday window opens', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('2026-05-08T00:00:00.000Z') }));

      expect(result.fitLevel).toBe('weak');
      expect(result.gapDays).toBe(-2);
      expect(result.verdictHTML).toContain('<strong>2 days</strong> before their usual payday window opens');
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
      expect(result.verdictHTML).toContain("With irregular income, timing alone isn't a strong signal here");
      expect(result.verdictHTML).toContain('stated family needs pattern');
   });

   it('returns unknown when no income source is shared', () => {
      const result = buildBorrowerContextFit(makeInput({ incomeType: 'none' }));

      expect(result.fitLevel).toBe('unknown');
      expect(result.gapDays).toBe(1);
      expect(result.verdictHTML).toBe(
         'No income source shared. This request is based on stated needs alone — review repayment history before funding.'
      );
   });

   it('returns neutral unknown when dates are missing or unparseable', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('not-a-date') }));

      expect(result.fitLevel).toBe('unknown');
      expect(result.gapDays).toBeNull();
      expect(result.verdictHTML).toBe('Borrower timing is missing or unclear. Review repayment history before funding.');
   });

   it('uses multiple gap reasons as a natural list in the context line chip data', () => {
      const result = buildBorrowerContextFit(makeInput({ gapReasons: ['family needs', 'bills', 'transport'] }));
      const needChip = result.chips.find((chip) => chip.id === 'need');

      expect(result.contextLine).toContain('{need}');
      expect(needChip).toEqual({ id: 'need', label: 'family needs, bills, and transport', type: 'need' });
   });
});
