import { describe, expect, it } from 'vitest';

import { groupOutcomes, type IncomeDocOutcome, wilsonUpper } from '@/lib/incomeDocOutcomes';

const row = (affordability: string | null, outcome: IncomeDocOutcome['outcome']): IncomeDocOutcome => ({
   doc_id: Math.random().toString(36),
   sent_at: '2026-11-06T00:00:00Z',
   authenticity: 'real',
   affordability,
   score: null,
   verdict: 'looks_good',
   decision: 'approved',
   loan_amount: 60,
   due_date: '2026-12-06T00:00:00Z',
   outcome,
   days_late: 0
});

describe('income doc outcomes', () => {
   it('gives a range even with no bad outcomes', () => {
      expect(wilsonUpper(0, 26)).toBeCloseTo(0.129, 2);
      expect(wilsonUpper(0, 0)).toBeNull();
      expect(wilsonUpper(5, 10)!).toBeGreaterThan(0.5);
   });

   it('groups by label and leaves out documents with no loan', () => {
      const rows = [
         row('comfortable', 'on_time'),
         row('comfortable', 'late'),
         row('tight', 'not_due'),
         row(null, 'no_loan'),
         row('too_much', 'unpaid')
      ];
      const groups = groupOutcomes(rows, 'affordability', ['comfortable', 'tight', 'too_much', 'unknown']);
      expect(groups.map((g) => g.key)).toEqual(['comfortable', 'tight', 'too_much', 'unknown']);
      expect(groups[0]).toMatchObject({ due: 2, onTime: 1, late: 1 });
      expect(groups[1]).toMatchObject({ due: 0, notDue: 1, upperBadRate: null });
      expect(groups[2]).toMatchObject({ due: 1, unpaid: 1 });
   });
});
