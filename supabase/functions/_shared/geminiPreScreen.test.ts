import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { clipWarnings, SETTING_CUT_MAX, settingCut, settingIssues, toClipCheck, toIncomeRead } from './geminiPreScreen.ts';

Deno.test('toIncomeRead: unreadable keeps the reason, drops the type', () => {
   const r = toIncomeRead({ readable: false, problem: 'Blurry photo', doc_type: 'payslip' });
   assertEquals(r?.readable, false);
   assertEquals(r?.problem, 'Blurry photo');
   assertEquals(r?.doc_type, null);
});

Deno.test('toIncomeRead: numbers from strings, unknown type → other, warnings capped', () => {
   const r = toIncomeRead({
      readable: true,
      doc_type: 'crypto_wallet',
      monthly_income_usd: '210.5',
      months_covered: 1,
      transactions: 7.4,
      warnings: ['a', '', 3, 'b']
   });
   assertEquals(r?.doc_type, 'other');
   assertEquals(r?.monthly_income_usd, 210.5);
   assertEquals(r?.transactions, 7);
   assertEquals(r?.warnings, ['a', 'b']);
   assertEquals(toIncomeRead(null), null);
});

Deno.test('clipWarnings: only what is clearly off', () => {
   assertEquals(clipWarnings(null), []);
   assertEquals(clipWarnings(toClipCheck({ person_visible: true, one_person: true, live_person: true, reading: false, note: 'ok' })), []);
   assertEquals(clipWarnings(toClipCheck({ person_visible: false, reading: true, one_person: null })), [
      'no face on camera',
      'reading from a script'
   ]);
});

Deno.test('toClipCheck: setting fields only take known values', () => {
   const c = toClipCheck({ light: 'Dark', place: 'car', posture: 'lying', sound: 'poor', moving: 'yes', serious: false });
   assertEquals([c?.light, c?.place, c?.posture, c?.sound, c?.moving, c?.serious], ['dark', null, 'lying', 'poor', null, false]);
});

Deno.test('settingIssues: a normal clip at home costs nothing', () => {
   assertEquals(settingIssues(null), []);
   assertEquals(settingIssues(toClipCheck({ light: 'dim', place: 'indoors', posture: 'sitting', sound: 'ok', serious: true })), []);
});

Deno.test('settingCut: each issue once across clips, riding beats parked, capped, job video skipped', () => {
   const seen = {
      intro: toClipCheck({ light: 'dark', posture: 'lying' }),
      q2: toClipCheck({ light: 'dark', place: 'vehicle', moving: false }),
      q3: toClipCheck({ place: 'vehicle', moving: true }),
      job_video: toClipCheck({ place: 'outdoors', sound: 'poor' })
   };
   const cut = settingCut(seen, new Set(['job_video']));
   assertEquals(cut.reasons, ['too dark to see them', 'lying down', 'recorded while riding']);
   assertEquals(cut.points, 4 + 5 + 5 - 2); // 14 capped at 12
   assertEquals(cut.points, SETTING_CUT_MAX);
   assertEquals(settingCut({ a: toClipCheck({ place: 'outdoors' }) }), { points: 2, reasons: ['outside'] });
   assertEquals(settingCut({}), { points: 0, reasons: [] });
});
