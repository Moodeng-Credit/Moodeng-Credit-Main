import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildSections, computeMetrics, type Extracted, nameRecheck, riskOf, runChecks, scoreOf, verdictOf } from './incomeDocs.ts';

// Made-up people; no real borrower data.
const doc = (holder: string | null): Extracted => ({
   readable: true,
   unreadable_reason: null,
   doc_type: 'payslip',
   holder_name: holder,
   institution: 'Sample Staffing Inc.',
   currency: 'PHP',
   period_start: '2026-10-16',
   period_end: '2026-10-31',
   opening_balance: null,
   closing_balance: null,
   payslip: { employer: 'Sample Staffing Inc.', gross_pay: 8500, total_deductions: 500, net_pay: 8000 },
   fields: [],
   transactions: [],
   visual_anomalies: []
});
const ctx = (kycName: string | null) => ({ pdfs: [], duplicateOf: [], kycName, statedMonthlyIncome: null, loan: null, now: Date.parse('2026-11-05') });

Deno.test('before Didit: name shows as not checked (not ✅), and changes nothing else', () => {
   const d = doc('Juan Dela Cruz');
   const flags = runChecks(d, computeMetrics(d), ctx(null));
   assert(flags.some((f) => f.code === 'name_not_checked'));
   assertEquals(buildSections(flags, { ok: true }).find((c) => c.key === 'identity')?.status, 'skip');
   const plain = runChecks(d, computeMetrics(d), ctx('Juan Dela Cruz'));
   assertEquals(riskOf(flags), riskOf(plain));
   assertEquals(scoreOf(d, computeMetrics(d), flags), scoreOf(d, computeMetrics(d), plain));
   assertEquals(verdictOf(flags, 'payslip'), verdictOf(plain, 'payslip'));
});

Deno.test('with a Didit name: compared at once as before (pass or red)', () => {
   const d = doc('Juan Dela Cruz');
   const ok = runChecks(d, computeMetrics(d), ctx('JUAN P. DELA CRUZ'));
   assertEquals(buildSections(ok, { ok: true }).find((c) => c.key === 'identity')?.status, 'pass');
   const bad = runChecks(d, computeMetrics(d), ctx('Maria Santos'));
   assertEquals(buildSections(bad, { ok: true }).find((c) => c.key === 'identity')?.status, 'fail');
});

Deno.test('after Didit: a not-checked send is compared; match passes, mismatch is a team-only red flag', () => {
   const d = doc('Juan Dela Cruz');
   const flags = runChecks(d, computeMetrics(d), ctx(null));
   const stored = { flags, checks: buildSections(flags, { ok: true }), extracted: d };
   const match = nameRecheck(stored, 'Juan P. Dela Cruz')!;
   assert(match.matched);
   assertEquals(match.checks.find((c) => c.key === 'identity')?.status, 'pass');
   assert(!match.flags.some((f) => f.code === 'name_not_checked'));
   const miss = nameRecheck(stored, 'Maria Santos')!;
   assert(!miss.matched);
   assertEquals(miss.checks.find((c) => c.key === 'identity')?.status, 'fail');
   // Found this late it only flags the team: risk/score/verdict ignore it.
   assertEquals(riskOf(miss.flags), riskOf(flags));
   assertEquals(verdictOf(miss.flags, 'payslip'), verdictOf(flags, 'payslip'));
});

Deno.test('nothing to recheck: already checked, or no name on the document', () => {
   const d = doc('Juan Dela Cruz');
   const checked = runChecks(d, computeMetrics(d), ctx('Juan Dela Cruz'));
   assertEquals(nameRecheck({ flags: checked, checks: buildSections(checked, { ok: true }), extracted: d }, 'Maria Santos'), null);
   const noName = doc(null);
   const f2 = runChecks(noName, computeMetrics(noName), ctx(null));
   assert(!f2.some((f) => f.code === 'name_not_checked'));
   assertEquals(nameRecheck({ flags: f2, checks: [], extracted: noName }, 'Maria Santos'), null);
});
