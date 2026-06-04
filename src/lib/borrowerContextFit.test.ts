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
   it('strong — explains they will have pay before repayment', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('2026-05-18T00:00:00.000Z') }));
      expect(result.fitLevel).toBe('strong');
      expect(result.gapDays).toBe(3);
      expect(result.verdictHTML).toContain('mid-month');
      expect(result.verdictHTML).toContain('<strong>3 days</strong>');
   });

   it('strong + history + pattern — ties all three signals together', () => {
      const result = buildBorrowerContextFit(makeInput({
         dueDate: new Date('2026-05-18T00:00:00.000Z'),
         reason: 'family expenses',
         gapReasons: ['family needs'],
         repaidLoanCount: 4
      }));
      expect(result.fitLevel).toBe('strong');
      expect(result.verdictHTML).toContain('recurring family needs borrowing pattern');
      expect(result.verdictHTML).toContain('repaid 4 loans');
   });

   it('ok — repayment inside pay window', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('2026-05-12T00:00:00.000Z') }));
      expect(result.fitLevel).toBe('ok');
      expect(result.verdictHTML).toContain('mid-month pay window');
   });

   it('ok + history + pattern — shows this is their usual setup', () => {
      const result = buildBorrowerContextFit(makeInput({
         dueDate: new Date('2026-05-12T00:00:00.000Z'),
         reason: 'family expenses',
         gapReasons: ['family needs'],
         repaidLoanCount: 3
      }));
      expect(result.verdictHTML).toContain('how they typically borrow');
      expect(result.verdictHTML).toContain('repaid 3 loans');
   });

   it('weak before — notes they need to pay before getting paid', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('2026-05-08T00:00:00.000Z') }));
      expect(result.fitLevel).toBe('weak');
      expect(result.verdictHTML).toContain('<strong>2 days</strong> before their usual payday');
   });

   it('weak before + strong history — offsets timing with track record', () => {
      const result = buildBorrowerContextFit(makeInput({
         dueDate: new Date('2026-05-08T00:00:00.000Z'),
         repaidLoanCount: 4
      }));
      expect(result.verdictHTML).toContain("repaid 4 loans");
      expect(result.verdictHTML).toContain("similar situations");
   });

   it('weak before + emergency — notes urgency', () => {
      const result = buildBorrowerContextFit(makeInput({
         dueDate: new Date('2026-05-08T00:00:00.000Z'),
         reason: 'emergency car repair',
         repaidLoanCount: 0
      }));
      expect(result.verdictHTML).toContain('Emergency need');
   });

   it('unknown — part-time irregular, explains income varies week to week', () => {
      const result = buildBorrowerContextFit(makeInput({
         incomeType: 'part-time',
         paydayType: 'irregular',
         paydayStart: null,
         paydayEnd: null
      }));
      expect(result.fitLevel).toBe('unknown');
      expect(result.verdictHTML).toContain('Part-time work with no fixed pay schedule');
   });

   it('unknown — no income, no history is explicit about limited info', () => {
      const result = buildBorrowerContextFit(makeInput({ incomeType: 'none', repaidLoanCount: 0 }));
      expect(result.fitLevel).toBe('unknown');
      expect(result.verdictHTML).toContain('very limited information');
   });

   it('unknown — no income + strong history leads with track record', () => {
      const result = buildBorrowerContextFit(makeInput({ incomeType: 'none', repaidLoanCount: 4 }));
      expect(result.verdictHTML).toContain("repaid 4 loans");
      expect(result.verdictHTML).toContain("shown they can cover repayments");
   });

   it('unknown — missing date is honest about it', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('not-a-date') }));
      expect(result.fitLevel).toBe('unknown');
      expect(result.verdictHTML).toContain('No repayment date on file');
   });

   it('unknown — freelance no history, explains no track record yet', () => {
      const result = buildBorrowerContextFit(makeInput({
         incomeType: 'freelance',
         paydayType: 'irregular',
         paydayStart: null,
         paydayEnd: null,
         repaidLoanCount: 0
      }));
      expect(result.verdictHTML).toContain('no repayment history to draw on yet');
   });

   it('unknown — freelance strong history notes they manage regardless', () => {
      const result = buildBorrowerContextFit(makeInput({
         incomeType: 'freelance',
         paydayType: 'irregular',
         paydayStart: null,
         paydayEnd: null,
         repaidLoanCount: 4
      }));
      expect(result.verdictHTML).toContain('manage repayment regardless of timing');
   });

   it('full-time irregular noted as commission or performance-based', () => {
      const result = buildBorrowerContextFit(makeInput({
         incomeType: 'full-time',
         paydayType: 'irregular',
         paydayStart: null,
         paydayEnd: null
      }));
      expect(result.verdictHTML).toContain('commission or performance-based');
   });

   it('shows verified + good standing in verdict', () => {
      const result = buildBorrowerContextFit(makeInput({ goodStanding: true, isVerified: true }));
      expect(result.verdictHTML).toContain('World ID verified · Good Standing.');
   });

   it('bridge loan reason bypasses timing uncertainty', () => {
      const result = buildBorrowerContextFit(makeInput({
         reason: 'payday bridge',
         incomeType: 'part-time',
         paydayType: 'irregular',
         paydayStart: null,
         paydayEnd: null
      }));
      expect(result.verdictHTML).toContain('Explicit payday bridge');
   });

   it('active loans warning when 2+ concurrent', () => {
      const result = buildBorrowerContextFit(makeInput({
         fundedLoanCount: 4,
         repaidLoanCount: 1
      }));
      expect(result.verdictHTML).toContain('other active loans');
   });

   it('low repayment rate flagged', () => {
      const result = buildBorrowerContextFit(makeInput({
         fundedLoanCount: 10,
         repaidLoanCount: 4
      }));
      expect(result.verdictHTML).toContain('below 60%');
   });

   it('weekly pay gets strong fit within 3 days of window', () => {
      const result = buildBorrowerContextFit(makeInput({
         paydayType: 'weekly',
         paydayStart: 10,
         paydayEnd: 14,
         dueDate: new Date('2026-05-17T00:00:00.000Z') // 3 days after window closes
      }));
      expect(result.fitLevel).toBe('strong');
   });

   it('weekly pay notes frequent income', () => {
      const result = buildBorrowerContextFit(makeInput({
         paydayType: 'weekly',
         paydayStart: 10,
         paydayEnd: 14,
         dueDate: new Date('2026-05-17T00:00:00.000Z')
      }));
      expect(result.verdictHTML).toContain('every week');
   });

   it('short loan noted on weak timing', () => {
      const result = buildBorrowerContextFit(makeInput({
         requestDate: new Date('2026-05-06T00:00:00.000Z'),
         dueDate: new Date('2026-05-08T00:00:00.000Z'), // 2 days loan, before payday
         repaidLoanCount: 0
      }));
      expect(result.verdictHTML).toContain('Short loan');
   });

   it('first timer + verified surfaced in no-income case', () => {
      const result = buildBorrowerContextFit(makeInput({
         incomeType: 'none',
         repaidLoanCount: 0,
         isVerified: true
      }));
      expect(result.verdictHTML).toContain('World ID verified');
   });

   it('pattern match names the specific matched reason', () => {
      const result = buildBorrowerContextFit(makeInput({
         reason: 'family expenses',
         gapReasons: ['family needs', 'bills']
      }));
      expect(result.verdictHTML).toContain('family needs');
   });

   it('uses multiple gap reasons in chips', () => {
      const result = buildBorrowerContextFit(makeInput({ gapReasons: ['family needs', 'bills', 'transport'] }));
      const needChip = result.chips.find((c) => c.id === 'need');
      expect(needChip?.label).toBe('family needs, bills, and transport');
   });
});
