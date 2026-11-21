import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { combineOpinions, parseRepayChance, repayChanceLine } from './incomeDocs.ts';
import { buildGrade, combineReads } from './preScreening.ts';

Deno.test('repay chance: clamped to 1–99, reasons trimmed to 2', () => {
   assertEquals(parseRepayChance({ repay_chance: 78.4, reasons: ['steady salary', 'repaid early before', 'extra'] }), {
      repayChance: 78,
      reasons: ['steady salary', 'repaid early before']
   });
   assertEquals(parseRepayChance({ repay_chance: 100 }).repayChance, 99);
   assertEquals(parseRepayChance({ repay_chance: '0' }).repayChance, 1);
   assertEquals(parseRepayChance({ repay_chance: 'high' }).repayChance, null);
   assertEquals(parseRepayChance(null), { repayChance: null, reasons: [] });
});

Deno.test('income doc: three reads averaged, reasons from the read closest to the average', () => {
   const o = (verdict: 'lend' | 'maybe', repayChance: number, reasons: string[]) => ({ verdict, note: 'n', ask: [], repayChance, reasons });
   const d = combineOpinions([o('lend', 90, ['salary covers it']), o('lend', 80, ['on time before']), o('maybe', 70, ['thin history'])])!;
   assertEquals(d.repayChance, 80);
   assertEquals(d.reasons, ['on time before']);
   assertEquals(repayChanceLine(d), '🎯 Chance of repaying on time: 80% — on time before');
   assertEquals(combineOpinions([{ verdict: 'lend', note: 'n', ask: [] }])!.repayChance, null);
   assertEquals(repayChanceLine({ repayChance: null, reasons: [] }), null);
});

Deno.test('pre-screening: reads averaged and carried into the grade', () => {
   const merged = combineReads([
      { summary: 's', answers: [], repay_chance: 70, reasons: ['vague job'] },
      { summary: 's', answers: [], repay_chance: 80 }
   ])!;
   assertEquals(merged.repay_chance, 75);
   assertEquals(merged.reasons, ['vague job']);
   const grade = buildGrade([], {}, merged);
   assertEquals(grade.repay_chance, 75);
   assertEquals(grade.repay_reasons, ['vague job']);
   assert(buildGrade([], {}, { summary: 's', answers: [] }).repay_chance === null);
});
