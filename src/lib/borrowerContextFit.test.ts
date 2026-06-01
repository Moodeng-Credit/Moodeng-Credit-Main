import { describe, expect, it } from 'vitest';

import { buildBorrowerContextFit, type BorrowerContextFit } from '@/lib/borrowerContextFit';

const baseInput = {
   borrowerName: 'maya-demo',
   dueDate: '2026-05-16T00:00:00.000Z',
   loanAmount: 15,
   loanReason: 'Emergency groceries',
   requestDate: '2026-05-08T00:00:00.000Z'
};

const baseContext = {
   incomeSetup: 'full_time',
   paydayWindow: '10_15',
   cashGaps: ['family_needs']
};

const renderText = (fit: BorrowerContextFit) =>
   fit.segments
      .map((segment) => {
         if (typeof segment === 'string') return segment;
         return fit.chips.find((chip) => chip.id === segment.chipId)?.text ?? '';
      })
      .join('');

const deltaChip = (fit: BorrowerContextFit) => fit.chips.find((chip) => chip.id === 'delta')?.text;

describe('buildBorrowerContextFit', () => {
   it('uses supportive timing when request opens before payday and due date follows the window', () => {
      const fit = buildBorrowerContextFit({ ...baseInput, context: baseContext });

      expect(fit.fitLevel).toBe('supportive');
      expect(deltaChip(fit)).toBe('1 day after payday');
      expect(renderText(fit)).toContain('maya-demo opened this request for $15 · emergency groceries on May 8');
      expect(renderText(fit)).toContain('planning to repay by May 16');
      expect(renderText(fit)).toContain('due date follows the income timing they shared');
   });

   it('uses consistent timing when repayment falls inside the payday window', () => {
      const fit = buildBorrowerContextFit({
         ...baseInput,
         context: baseContext,
         dueDate: '2026-05-12T00:00:00.000Z'
      });

      expect(fit.fitLevel).toBe('consistent');
      expect(deltaChip(fit)).toBe('inside payday window');
      expect(renderText(fit)).toContain('consistent with their profile');
   });

   it('frames before-payday repayment as an early gap instead of a borrower warning', () => {
      const fit = buildBorrowerContextFit({
         ...baseInput,
         context: baseContext,
         dueDate: '2026-05-08T00:00:00.000Z'
      });

      expect(fit.fitLevel).toBe('early_gap');
      expect(deltaChip(fit)).toBe('2 days before payday');
      expect(renderText(fit)).toContain('may bridge an earlier gap');
      expect(renderText(fit)).not.toContain('does not clearly line up');
   });

   it('handles requests opened after the payday window ended', () => {
      const fit = buildBorrowerContextFit({
         ...baseInput,
         context: baseContext,
         requestDate: '2026-05-18T00:00:00.000Z'
      });

      expect(fit.fitLevel).toBe('after_payday_gap');
      expect(deltaChip(fit)).toBe('3 days after payday');
      expect(renderText(fit)).toContain('may reflect a gap after income was received');
   });

   it('reduces timing confidence for far future due dates', () => {
      const fit = buildBorrowerContextFit({
         ...baseInput,
         context: baseContext,
         dueDate: '2026-06-20T00:00:00.000Z'
      });

      expect(fit.fitLevel).toBe('distant');
      expect(deltaChip(fit)).toBe('43 days after request');
      expect(renderText(fit)).toContain('payday timing is less of a signal here');
   });

   it('uses neutral language for irregular payday timing', () => {
      const fit = buildBorrowerContextFit({
         ...baseInput,
         context: { ...baseContext, paydayWindow: 'it_varies' }
      });

      expect(fit.fitLevel).toBe('variable');
      expect(renderText(fit)).toContain('Their payday timing varies');
   });

   it('falls back when borrower context is missing', () => {
      const fit = buildBorrowerContextFit({ ...baseInput, context: null });

      expect(fit.fitLevel).toBe('unclear');
      expect(fit.showTimingClaim).toBe(false);
      expect(fit.chips.some((chip) => chip.id === 'delta')).toBe(false);
      expect(renderText(fit)).toContain('Use the request reason and repayment history to judge fit');
   });

   it('falls back when dates cannot be parsed', () => {
      const fit = buildBorrowerContextFit({
         ...baseInput,
         context: baseContext,
         dueDate: 'not-a-date'
      });

      expect(fit.fitLevel).toBe('unclear');
      expect(fit.showTimingClaim).toBe(false);
      expect(fit.chips.some((chip) => chip.id === 'delta')).toBe(false);
      expect(renderText(fit)).toContain('timing details are not available');
   });

   it('uses the first gap inline and renders additional gaps as secondary chips', () => {
      const fit = buildBorrowerContextFit({
         ...baseInput,
         context: { ...baseContext, cashGaps: ['family_needs', 'bills_before_payday', 'transport'] }
      });

      expect(fit.chips.find((chip) => chip.id === 'gap-primary')?.text).toBe('family needs');
      expect(fit.secondaryChips.map((chip) => chip.text)).toEqual(['bills before payday', 'transport costs']);
   });

   it('uses caution copy when no income source is shared', () => {
      const fit = buildBorrowerContextFit({
         ...baseInput,
         context: { ...baseContext, incomeSetup: 'no_income' }
      });

      expect(fit.fitLevel).toBe('no_income');
      expect(fit.tone).toBe('caution');
      expect(renderText(fit)).toContain('has not shared an income source');
   });

   it('never makes a repayment certainty claim', () => {
      const fit = buildBorrowerContextFit({ ...baseInput, context: baseContext });
      const text = renderText(fit).toLowerCase();

      expect(text).not.toContain('likely to repay');
      expect(text).not.toContain('will pay back');
   });
});
