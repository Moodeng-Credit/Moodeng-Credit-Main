import { describe, expect, it } from 'vitest';

import { gateMessage, type IncomeDocFacts, incomeDocGate, parseSteps, stepFor } from '@/lib/incomeDocSteps';

const steps = parseSteps([
   { min: 40, months: 0, fresh: false, autoApprove: true, maxShare: null, balance: false, liveCall: false },
   { min: 60, months: 2, fresh: false, autoApprove: false, maxShare: 0.5, balance: false, liveCall: false },
   { min: 100, months: 2, fresh: true, autoApprove: false, maxShare: 0.3, balance: true, liveCall: false },
   { min: 140, months: 2, fresh: true, autoApprove: false, maxShare: 0.3, balance: true, liveCall: true }
]);

const NOW = Date.parse('2026-11-10T00:00:00Z');
const day = 86_400_000;
const facts = (doc: IncomeDocFacts['doc'], lastFundedAt: number | null = null): IncomeDocFacts => ({ steps, doc, lastFundedAt });

describe('proof-of-income steps', () => {
   it('picks the step by amount', () => {
      expect(stepFor(20, steps)).toBeNull();
      expect(stepFor(40, steps)?.min).toBe(40);
      expect(stepFor(80, steps)?.min).toBe(60);
      expect(stepFor(120, steps)?.min).toBe(100);
      expect(stepFor(140, steps)?.liveCall).toBe(true);
   });

   it('small loans need nothing', () => {
      expect(incomeDocGate(20, facts(null), NOW).ok).toBe(true);
   });

   it('asks for a document when there is none', () => {
      const gate = incomeDocGate(40, facts(null), NOW);
      expect(gate.ok).toBe(false);
      if (!gate.ok) expect(gate.missing).toBe('doc');
   });

   it('one screenshot covers $40 but not $60', () => {
      const oneWeek = { createdAt: NOW - day, months: 0.3, read: true, approved: true };
      expect(incomeDocGate(40, facts(oneWeek), NOW).ok).toBe(true);
      const gate = incomeDocGate(60, facts(oneWeek), NOW);
      expect(gate.ok).toBe(false);
      if (!gate.ok) {
         expect(gate.missing).toBe('months');
         expect(gateMessage(gate)).toContain('about 1 week.');
      }
   });

   it('a document still being read lets the request through', () => {
      expect(incomeDocGate(60, facts({ createdAt: NOW - day, months: null, read: false, approved: false }), NOW).ok).toBe(true);
   });

   it('$100+ needs a fresh document after the last funded loan', () => {
      const twoMonths = { createdAt: NOW - 3 * day, months: 2.5, read: true, approved: true };
      expect(incomeDocGate(100, facts(twoMonths, NOW - 30 * day), NOW).ok).toBe(true);
      const usedBefore = incomeDocGate(100, facts(twoMonths, NOW - day), NOW);
      expect(usedBefore.ok).toBe(false);
      if (!usedBefore.ok) expect(usedBefore.missing).toBe('fresh');
      const stale = incomeDocGate(100, facts({ ...twoMonths, createdAt: NOW - 20 * day }), NOW);
      expect(stale.ok).toBe(false);
   });

   it('drops malformed steps', () => {
      expect(parseSteps([{ min: 'x' }, null, { min: 50 }])).toHaveLength(1);
      expect(parseSteps('nope')).toEqual([]);
   });
});
