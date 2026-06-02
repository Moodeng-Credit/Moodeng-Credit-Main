import { describe, expect, it } from 'vitest';

import { type BorrowerContextFit, type BorrowerContextState, buildBorrowerContextFit } from '@/lib/borrowerContextFit';

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
} satisfies BorrowerContextState;

const renderText = (fit: BorrowerContextFit) =>
   fit.segments
      .map((segment) => {
         if (typeof segment === 'string') return segment;
         return fit.chips.find((chip) => chip.id === segment.chipId)?.text ?? '';
      })
      .join('');

const renderExplanationText = (fit: BorrowerContextFit) =>
   fit.explanationSegments
      .map((segment) => {
         if (typeof segment === 'string') return segment;
         return fit.chips.find((chip) => chip.id === segment.chipId)?.text ?? '';
      })
      .join('');

const deltaChip = (fit: BorrowerContextFit) => fit.chips.find((chip) => chip.id === 'delta')?.text;

describe('buildBorrowerContextFit', () => {
   it('uses supportive timing when due date falls after the payday window', () => {
      const fit = buildBorrowerContextFit({ ...baseInput, context: baseContext });

      expect(fit.fitLevel).toBe('supportive');
      expect(deltaChip(fit)).toBe('1 day after payday');
      expect(renderText(fit)).toContain(
         'maya-demo - full-time, paid 10th-15th monthly - is requesting $15 for emergency groceries, due May 16, with recurring family needs.'
      );
      expect(renderExplanationText(fit)).toContain('As a full-time employee paid 10th-15th monthly');
      expect(renderExplanationText(fit)).toContain('8-day gap');
      expect(renderExplanationText(fit)).toContain('due date follows the bio timing shared');
   });

   it('uses consistent timing when due date falls inside the payday window', () => {
      const fit = buildBorrowerContextFit({
         ...baseInput,
         context: baseContext,
         dueDate: '2026-05-12T00:00:00.000Z'
      });

      expect(fit.fitLevel).toBe('consistent');
      expect(deltaChip(fit)).toBe('inside payday window');
      expect(renderExplanationText(fit)).toContain('matching the bio timing shared');
   });

   it('frames due dates before the payday window as an early gap instead of a borrower warning', () => {
      const fit = buildBorrowerContextFit({
         ...baseInput,
         context: baseContext,
         dueDate: '2026-05-08T00:00:00.000Z'
      });

      expect(fit.fitLevel).toBe('early_gap');
      expect(deltaChip(fit)).toBe('2 days before payday');
      expect(renderExplanationText(fit)).toContain('may bridge an earlier gap');
      expect(renderExplanationText(fit)).not.toContain('does not clearly line up');
   });

   it('handles requests opened after the payday window ended', () => {
      const fit = buildBorrowerContextFit({
         ...baseInput,
         context: baseContext,
         dueDate: '2026-06-09T00:00:00.000Z',
         requestDate: '2026-05-18T00:00:00.000Z'
      });

      expect(fit.fitLevel).toBe('after_payday_gap');
      expect(deltaChip(fit)).toBe('1 day before payday');
      expect(fit.chips.find((chip) => chip.id === 'opened-delta')?.text).toBe('3 days after payday');
      expect(renderExplanationText(fit)).toContain('Bio timing gives a less direct signal');
   });

   it('uses the next calendar month payday window when repayment crosses months', () => {
      const fit = buildBorrowerContextFit({
         borrowerName: 'maya-demo',
         context: { ...baseContext, paydayWindow: '1_5' },
         dueDate: '2026-06-06T00:00:00.000Z',
         loanAmount: 15,
         loanReason: 'Emergency groceries',
         requestDate: '2026-05-28T00:00:00.000Z'
      });

      expect(fit.fitLevel).toBe('supportive');
      expect(deltaChip(fit)).toBe('1 day after payday');
      expect(renderText(fit)).toContain('paid 1st-5th monthly');
      expect(renderExplanationText(fit)).toContain('9-day gap');
   });

   it('reduces timing confidence for far future due dates', () => {
      const fit = buildBorrowerContextFit({
         ...baseInput,
         context: baseContext,
         dueDate: '2026-06-20T00:00:00.000Z'
      });

      expect(fit.fitLevel).toBe('distant');
      expect(deltaChip(fit)).toBe('43 days after request');
      expect(renderExplanationText(fit)).toContain('payday timing is less useful as a short-term signal');
   });

   it('uses neutral language for payday varies', () => {
      const fit = buildBorrowerContextFit({
         ...baseInput,
         context: { ...baseContext, paydayWindow: 'it_varies' }
      });

      expect(fit.fitLevel).toBe('variable');
      expect(renderExplanationText(fit)).toContain('Pay timing varies');
      expect(renderExplanationText(fit)).toContain('clearest bio signals');
   });

   it('falls back when saved bio context is missing', () => {
      const fit = buildBorrowerContextFit({ ...baseInput, context: null });

      expect(fit.fitLevel).toBe('unclear');
      expect(fit.showTimingClaim).toBe(false);
      expect(fit.chips.some((chip) => chip.id === 'delta')).toBe(false);
      expect(renderExplanationText(fit)).toContain('Bio context is incomplete');
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
      expect(renderExplanationText(fit)).toContain('timing details are not available');
   });

   it('uses the first gap inline and renders additional gaps as secondary chips', () => {
      const fit = buildBorrowerContextFit({
         ...baseInput,
         context: { ...baseContext, cashGaps: ['family_needs', 'bills_before_payday', 'transport'] }
      });

      expect(fit.chips.find((chip) => chip.id === 'gap-primary')?.text).toBe('family needs');
      expect(fit.secondaryChips.map((chip) => chip.text)).toEqual(['bills before payday', 'transport costs']);
   });

   it('uses caution copy when no income source is included in the bio', () => {
      const fit = buildBorrowerContextFit({
         ...baseInput,
         context: { ...baseContext, incomeSetup: 'no_income' }
      });

      expect(fit.fitLevel).toBe('no_income');
      expect(fit.tone).toBe('caution');
      expect(renderExplanationText(fit)).toContain('No income source is included in the bio');
   });

   it('never makes a repayment certainty claim or adds gendered pronouns', () => {
      const fit = buildBorrowerContextFit({ ...baseInput, context: baseContext });
      const text = `${renderText(fit)} ${renderExplanationText(fit)}`.toLowerCase();

      expect(text).not.toContain('likely to repay');
      expect(text).not.toContain('will pay back');
      expect(text).not.toContain('they');
      expect(text).not.toContain('their');
   });
});
