import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildSignalReport, type SignalRow, signalStats } from './signalReport.ts';

const row = (outcome: string, signals: Record<string, string>, fast = false): SignalRow => ({ outcome, days_late: 0, fast_repay: fast, signals });

Deno.test('groups finished loans per signal; running loans are counted but not judged', () => {
   const rows = [
      ...Array.from({ length: 6 }, () => row('on_time', { video_call: 'call attended' })),
      ...Array.from({ length: 4 }, () => row('on_time', { video_call: 'no call' })),
      ...Array.from({ length: 2 }, () => row('unpaid', { video_call: 'no call' })),
      row('not_due', { video_call: 'no call' })
   ];
   const { overall, done, groups } = signalStats(rows);
   assertEquals(done, 12);
   assertEquals(overall, 83);
   const call = groups.find((g) => g.key === 'video_call')!;
   assertEquals(call.stats.map((s) => [s.label, s.finished, s.onTimePct, s.unpaid]), [
      ['call attended', 6, 100, 0],
      ['no call', 6, 67, 2]
   ]);
   // 100 vs 83 = +17 → ▲; 67 vs 83 = −16 → ▼ (both have 5+ finished).
   assertEquals(call.stats.map((s) => s.mark), ['▲', '▼']);
});

Deno.test('small groups get no mark; just-after and late count as missed', () => {
   const rows = [...Array.from({ length: 8 }, () => row('on_time', { amount: 'under $20' })), row('just_after', { amount: '$100+' }), row('late', { amount: '$100+' })];
   const amount = signalStats(rows).groups.find((g) => g.key === 'amount')!;
   const big = amount.stats.find((s) => s.label === '$100+')!;
   assertEquals(big.missed, 2);
   assertEquals(big.mark, '');
});

Deno.test('report text: warns while misses are few, lists groups, stays under Telegram size', () => {
   const rows = [row('on_time', { prescreen: 'pre-screen 70+' }, true), row('just_after', { prescreen: 'no pre-screen' }), row('not_due', { prescreen: 'no pre-screen' })];
   const text = buildSignalReport(rows);
   assertStringIncludes(text, '2 loans finished: 1 on time · 1 paid just after the due time · 0 late · 0 unpaid. 1 still running.');
   assertStringIncludes(text, 'Repaid within 48 h of funding: 1');
   assertStringIncludes(text, 'hints, not proof');
   assertStringIncludes(text, '• no pre-screen: 1 · 0% on time (1 missed)');
   assertStringIncludes(text, '• pre-screen 70+: 1 · 100% on time (1 fast)');
});

Deno.test('a signal with one group only is listed as not comparable yet', () => {
   const text = buildSignalReport([row('on_time', { market: 'PH', referred: 'referred' }), row('late', { market: 'PH', referred: 'not referred' })]);
   assertStringIncludes(text, 'Not comparable yet (every finished loan in one group): Country (PH).');
   assertStringIncludes(text, 'Referral');
   assert(text.length <= 3900);
});

Deno.test('no rows: still a valid message', () => {
   assertStringIncludes(buildSignalReport([]), '0 loans finished');
});
