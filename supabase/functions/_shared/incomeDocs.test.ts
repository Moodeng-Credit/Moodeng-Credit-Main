import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildMemo, buildSections, verdictOf, computeMetrics, type Extracted, namesMatch, normalizeExtracted, parseStatedIncome, readPdfInfo, riskOf, runChecks, scoreOf } from './incomeDocs.ts';

const tx = (date: string, amount: number, balance: number | null, description = 'x') => ({ date, description, amount, balance, page: 1, source_text: `${date} ${amount}` });

const NOW = Date.parse('2026-10-20');

const base = (overrides: Partial<Extracted> = {}): Extracted => ({
   readable: true,
   unreadable_reason: null,
   doc_type: 'gcash_history',
   holder_name: 'Maria Santos Cruz',
   institution: 'GCash',
   currency: 'PHP',
   period_start: '2026-08-01',
   period_end: '2026-10-15',
   opening_balance: 1000,
   closing_balance: 13500,
   payslip: null,
   fields: [],
   transactions: [
      tx('2026-08-15', 12000, 13000, 'Salary ACME'),
      tx('2026-08-20', -2000, 11000),
      tx('2026-09-15', 12500, 23500, 'Salary ACME'),
      tx('2026-09-25', -10000, 13500)
   ],
   visual_anomalies: [],
   ...overrides
});

// $80 loan, repay $90 on the 16th; ~PHP 12,000 ≈ $210/month in → 43% of income.
const ctx = { pdfs: [], duplicateOf: [], kycName: 'MARIA S. CRUZ', statedMonthlyIncome: 15000, loan: { amount: 80, total_repayment: 90, due_date: '2026-11-16' }, now: NOW };
const smallLoan = { ...ctx, loan: { amount: 30, total_repayment: 35, due_date: '2026-11-16' } };

Deno.test('regular deposits, payday and monthly money in', () => {
   const m = computeMetrics(base());
   assertEquals(m.transaction_count, 4);
   assertEquals(m.total_in, 24500);
   assertEquals(m.regular_deposits.length, 1);
   assertEquals(m.regular_deposits[0].refs, ['T1', 'T3']);
   assertEquals(m.regular_deposits[0].payday, 15);
});

Deno.test('clean document with an affordable loan scores high', () => {
   const doc = base();
   const m = computeMetrics(doc);
   const flags = runChecks(doc, m, smallLoan);
   assertEquals(riskOf(flags), 'green');
   assert(scoreOf(doc, m, flags) >= 90);
   assert(buildMemo(doc, m, flags).includes('[T1, T3]'));
});

Deno.test('repayment too big for income is flagged', () => {
   const doc = base();
   const flags = runChecks(doc, computeMetrics(doc), ctx);
   const f = flags.find((x) => x.code === 'repayment_vs_income');
   assertEquals(f?.severity, 'orange');
   const big = runChecks(doc, computeMetrics(doc), { ...ctx, loan: { amount: 120, total_repayment: 140, due_date: null } });
   assertEquals(big.find((x) => x.code === 'repayment_vs_income')?.severity, 'red');
});

Deno.test('due date far from payday suggests a better one', () => {
   const doc = base();
   const flags = runChecks(doc, computeMetrics(doc), { ...smallLoan, loan: { amount: 30, total_repayment: 35, due_date: '2026-11-05' } });
   const f = flags.find((x) => x.code === 'due_far_from_payday');
   assert(f?.detail.includes('16th'));
});

Deno.test('short history and no regular income', () => {
   const doc = base({ period_start: '2026-10-01', period_end: '2026-10-15', transactions: [tx('2026-10-02', 3000, 4000), tx('2026-10-09', -500, 3500)], opening_balance: null, closing_balance: null });
   const codes = runChecks(doc, computeMetrics(doc), smallLoan).map((f) => f.code);
   assert(codes.includes('short_history'));
   assert(codes.includes('no_regular_income'));
});

Deno.test('edited balance is caught', () => {
   const doc = base({ closing_balance: 53500 });
   const flags = runChecks(doc, computeMetrics(doc), smallLoan);
   assert(flags.some((f) => f.code === 'balance_math'));
   assertEquals(riskOf(flags), 'red');
   assert(scoreOf(doc, computeMetrics(doc), flags) < 60);
});

Deno.test('payslip math, name and duplicate file', () => {
   const doc = base({ transactions: [], opening_balance: null, closing_balance: null, payslip: { employer: 'ACME', gross_pay: 20000, total_deductions: 2000, net_pay: 19000 }, holder_name: 'Juan Dela Paz' });
   const codes = runChecks(doc, computeMetrics(doc), { ...ctx, duplicateOf: [{ user_id: 'u2' }] }).map((f) => f.code);
   assert(codes.includes('payslip_math'));
   assert(codes.includes('name_mismatch'));
   assert(codes.includes('same_file_other_account'));
});

Deno.test('names and stated income parsing', () => {
   assert(namesMatch('Maria Santos Cruz', 'MARIA S. CRUZ'));
   assert(!namesMatch('Juan Dela Paz', 'Maria Cruz'));
   assertEquals(parseStatedIncome('₱15,000'), 15000);
   assertEquals(parseStatedIncome('8k a month'), 8000);
   assertEquals(parseStatedIncome('depends'), null);
});

Deno.test('pdf info reads editor and encryption', () => {
   const info = readPdfInfo(new TextEncoder().encode('/Producer (Canva) /CreationDate (D:20260901) /ModDate (D:20261001) /Encrypt 5 0 R'));
   assertEquals(info.producer, 'Canva');
   assert(info.encrypted);
});

Deno.test('loose JSON from the model is normalized', () => {
   const doc = normalizeExtracted({
      doc_type: 'GCash',
      currency: 'PHP',
      opening_balance: '1,000.50',
      transactions: [{ date: '2026-08-15', amount: '12,000', balance: null, page: '1' }, { date: '2026-08-16', amount: 'n/a' }],
      visual_anomalies: null
   });
   assertEquals(doc.doc_type, 'other');
   assertEquals(doc.opening_balance, 1000.5);
   assertEquals(doc.transactions.length, 1);
   assertEquals(doc.transactions[0].amount, 12000);
   assertEquals(doc.visual_anomalies, []);
   assert(doc.readable);
});

Deno.test('verdict: clean looks good, fixable resends, fake signs always go to the team', () => {
   const doc = base();
   const clean = runChecks(doc, computeMetrics(doc), smallLoan);
   assertEquals(verdictOf(clean, doc.doc_type).verdict, 'looks_good');

   const old = base({ period_end: '2026-06-01' });
   assertEquals(verdictOf(runChecks(old, computeMetrics(old), smallLoan), old.doc_type), { verdict: 'resend', reason: 'old_document' });
   assertEquals(verdictOf([], 'other'), { verdict: 'resend', reason: 'not_financial' });

   // Old AND edited: the fake sign wins, and the borrower is never told why.
   const oldEdited = base({ period_end: '2026-06-01', closing_balance: 99999 });
   assertEquals(verdictOf(runChecks(oldEdited, computeMetrics(oldEdited), smallLoan), oldEdited.doc_type).verdict, 'needs_review');

   // Can't afford it: not fixable by resending, so the team decides.
   assertEquals(verdictOf(runChecks(doc, computeMetrics(doc), ctx), doc.doc_type).verdict, 'needs_review');
});

Deno.test('named checks pass, warn and fail', () => {
   const sections = buildSections(
      [
         { code: 'name_mismatch', severity: 'red', detail: 'x' },
         { code: 'short_history', severity: 'orange', detail: 'y' }
      ],
      { ok: true }
   );
   const by = Object.fromEntries(sections.map((c) => [c.key, c.status]));
   assertEquals(by.readable, 'pass');
   assertEquals(by.identity, 'fail');
   assertEquals(by.recent, 'warn');
   assertEquals(by.not_ai, 'pass');
});
