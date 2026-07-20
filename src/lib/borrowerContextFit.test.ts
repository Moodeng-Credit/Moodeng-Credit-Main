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
   it('strong — income arrives before repayment', () => {
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

   it('weak before — notes timing relative to payday', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('2026-05-08T00:00:00.000Z') }));
      expect(result.fitLevel).toBe('weak');
      expect(result.verdictHTML).toContain('<strong>2 days</strong> before their usual payday');
   });

   it('weak before + strong history — references prior similar situations', () => {
      const result = buildBorrowerContextFit(makeInput({
         dueDate: new Date('2026-05-08T00:00:00.000Z'),
         repaidLoanCount: 4
      }));
      expect(result.verdictHTML).toContain('repaid 4 loans');
      expect(result.verdictHTML).toContain('similar timing situations');
   });

   it('weak before + emergency — notes urgency', () => {
      const result = buildBorrowerContextFit(makeInput({
         dueDate: new Date('2026-05-08T00:00:00.000Z'),
         reason: 'emergency car repair',
         repaidLoanCount: 0
      }));
      expect(result.verdictHTML).toContain('Emergency need');
   });

   it('unknown — part-time irregular, describes flexible hours', () => {
      const result = buildBorrowerContextFit(makeInput({
         incomeType: 'part-time',
         paydayType: 'irregular',
         paydayStart: null,
         paydayEnd: null
      }));
      expect(result.fitLevel).toBe('unknown');
      expect(result.verdictHTML).toContain('Part-time work with flexible hours');
   });

   it('unknown — no income first loan leads with New to Moodeng', () => {
      const result = buildBorrowerContextFit(makeInput({ incomeType: 'none', repaidLoanCount: 0 }));
      expect(result.fitLevel).toBe('unknown');
      expect(result.verdictHTML).toContain('New to Moodeng');
   });

   it('unknown — no income + strong history leads with track record', () => {
      const result = buildBorrowerContextFit(makeInput({ incomeType: 'none', repaidLoanCount: 4 }));
      expect(result.verdictHTML).toContain("repaid 4 loans");
   });

   it('unknown — missing date returns something useful', () => {
      const result = buildBorrowerContextFit(makeInput({ dueDate: new Date('not-a-date') }));
      expect(result.fitLevel).toBe('unknown');
      expect(result.verdictHTML).toContain('New to Moodeng');
   });

   it('unknown — freelance no history, new borrower', () => {
      const result = buildBorrowerContextFit(makeInput({
         incomeType: 'freelance',
         paydayType: 'irregular',
         paydayStart: null,
         paydayEnd: null,
         repaidLoanCount: 0
      }));
      expect(result.verdictHTML).toContain('Freelance work');
      expect(result.verdictHTML).toContain('First loan on Moodeng');
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

   it('full-time irregular describes variable pay', () => {
      const result = buildBorrowerContextFit(makeInput({
         incomeType: 'full-time',
         paydayType: 'irregular',
         paydayStart: null,
         paydayEnd: null
      }));
      expect(result.verdictHTML).toContain('Full-time employee');
   });

   it('shows verified + good standing in verdict', () => {
      const result = buildBorrowerContextFit(makeInput({ goodStanding: true, isVerified: true }));
      expect(result.verdictHTML).toContain('Identity verified · Good Standing.');
   });

   it('bridge loan leads with bridging context', () => {
      const result = buildBorrowerContextFit(makeInput({
         reason: 'payday bridge',
         incomeType: 'part-time',
         paydayType: 'irregular',
         paydayStart: null,
         paydayEnd: null
      }));
      expect(result.verdictHTML).toContain('bridge the gap');
   });

   it('weekly pay gets strong fit within 3 days of window', () => {
      const result = buildBorrowerContextFit(makeInput({
         paydayType: 'weekly',
         paydayStart: 10,
         paydayEnd: 14,
         dueDate: new Date('2026-05-17T00:00:00.000Z')
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
         dueDate: new Date('2026-05-08T00:00:00.000Z'),
         repaidLoanCount: 0
      }));
      expect(result.verdictHTML).toContain('2-day loan');
   });

   it('first timer + verified surfaced for no-income case', () => {
      const result = buildBorrowerContextFit(makeInput({
         incomeType: 'none',
         repaidLoanCount: 0,
         isVerified: true
      }));
      expect(result.verdictHTML).toContain('Identity verified');
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
