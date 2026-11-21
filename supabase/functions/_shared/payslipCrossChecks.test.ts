import { assert, assertEquals, assertNotEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildSections, computeMetrics, type Extracted, FLAG_ONLY, hasHistoryForPayday, idKeys, payslipProofQuestions, riskOf, salaryCheck, salaryFlags, scoreOf, verdictOf } from './incomeDocs.ts';

// Made-up documents; no real borrower data.
const payslip = (net = 8000, end = '2026-10-31'): Extracted => ({
   readable: true,
   unreadable_reason: null,
   doc_type: 'payslip',
   holder_name: 'Juan Dela Cruz',
   institution: 'Sample Staffing Inc.',
   currency: 'PHP',
   period_start: '2026-10-16',
   period_end: end,
   opening_balance: null,
   closing_balance: null,
   payslip: { employer: 'Sample Staffing Inc.', gross_pay: net + 500, total_deductions: 500, net_pay: net },
   fields: [],
   transactions: [],
   visual_anomalies: []
});
const tx = (date: string, amount: number) => ({ date, description: 'x', amount, balance: null, page: 1, source_text: '' });
const gcash = (rows: Array<[string, number]>, start = '2026-10-01', end = '2026-11-15'): Extracted => ({
   ...payslip(),
   doc_type: 'gcash_history',
   institution: 'GCash',
   period_start: start,
   period_end: end,
   payslip: null,
   transactions: rows.map(([d, a]) => tx(d, a))
});

Deno.test('salary landed: net pay arrives a couple of days after the period ends', () => {
   const f = salaryCheck(payslip(), gcash([['2026-11-02', 8000]]));
   assertEquals(f?.code, 'salary_landed');
   assertEquals(f?.severity, 'info');
});

Deno.test('salary landed: within 2% counts (fees), a different amount does not', () => {
   assertEquals(salaryCheck(payslip(), gcash([['2026-11-01', 7900]]))?.code, 'salary_landed');
   assertEquals(salaryCheck(payslip(), gcash([['2026-11-01', 5000]]))?.code, 'salary_not_landed');
});

Deno.test('salary not landed: only flagged when the history covers payday', () => {
   assertEquals(salaryCheck(payslip(), gcash([['2026-10-05', 300]]))?.severity, 'orange');
   // History ends before payday: can't tell, no flag.
   assertEquals(salaryCheck(payslip(), gcash([['2026-10-05', 300]], '2026-09-01', '2026-10-20')), null);
});

Deno.test('salary check works either way round and one landing is enough', () => {
   const hist = gcash([['2026-11-02', 8000]]);
   assertEquals(salaryFlags(payslip(), [hist]).map((f) => f.code), ['salary_landed']);
   assertEquals(salaryFlags(hist, [payslip()]).map((f) => f.code), ['salary_landed']);
   assertEquals(salaryFlags(payslip(), [gcash([['2026-10-05', 1]]), hist]).map((f) => f.code), ['salary_landed']);
   assertEquals(salaryFlags(payslip(), []), []);
});

Deno.test('new flags are team-only: shown on the checks, but risk, score and verdict ignore them', () => {
   const doc = payslip();
   const metrics = computeMetrics(doc);
   const flags = [
      ...salaryFlags(doc, [gcash([['2026-10-05', 300]])]),
      { code: 'same_id_other_account', severity: 'red' as const, detail: 'x' },
      { code: 'payslip_sent_before_period_end', severity: 'red' as const, detail: 'x' }
   ];
   assert(flags.every((f) => FLAG_ONLY.has(f.code)));
   assertEquals(verdictOf(flags, 'payslip'), { verdict: 'looks_good', reason: null });
   assertEquals(riskOf(flags), 'green');
   assertEquals(scoreOf(doc, metrics, flags), scoreOf(doc, metrics, []));
   const sections = buildSections(flags, { ok: true });
   assertEquals(sections.find((c) => c.key === 'income')?.status, 'warn');
   assertEquals(sections.find((c) => c.key === 'unique')?.status, 'fail');
   assertEquals(sections.find((c) => c.key === 'authentic')?.status, 'fail');
});

Deno.test('payslip asks for a history only when none covers payday', () => {
   assert(!hasHistoryForPayday(payslip(), []));
   assert(hasHistoryForPayday(payslip(), [gcash([['2026-11-02', 8000]])]));
   assertEquals(payslipProofQuestions('Philippines', { askHistory: true }).map((q) => [q.id, q.kind]), [
      ['p1', 'text'],
      ['p2', 'photo'],
      ['p3', 'file']
   ]);
   assertEquals(payslipProofQuestions('Philippines').length, 2);
});

Deno.test('ID numbers: same number however it is printed = same hash; junk is skipped', async () => {
   const a = await idKeys([{ type: 'SSS', value: '01-2345678-9' }]);
   const b = await idKeys([{ type: 'sss', value: '0123456789' }]);
   assertEquals(a, b);
   assertEquals(a.length, 1);
   assertNotEquals(await idKeys([{ type: 'tin', value: '0123456789' }]), a);
   assertEquals(await idKeys([{ type: 'sss', value: '1234' }, { type: 'passport', value: '123456789' }, { type: 'tin', value: '000000000' }]), []);
   assertEquals((await idKeys([{ type: 'Pag-IBIG', value: '1234-5678-9012' }, { type: 'hdmf', value: '123456789012' }])).length, 1);
});

Deno.test('the same ID on another account is a red flag under Not used by another account', async () => {
   const { runChecks } = await import('./incomeDocs.ts');
   const doc = payslip();
   const flags = runChecks(doc, computeMetrics(doc), { pdfs: [], duplicateOf: [], idMatches: 2, kycName: 'Juan Dela Cruz', statedMonthlyIncome: null, loan: null });
   assertEquals(flags.find((f) => f.code === 'same_id_other_account')?.severity, 'red');
   assertEquals(buildSections(flags, { ok: true }).find((c) => c.key === 'unique')?.status, 'fail');
});
