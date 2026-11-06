import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
   affordOf,
   authenticityOf,
   buildMemo,
   buildSections,
   canAutoApprove,
   computeMetrics,
   type Extracted,
   kindOf,
   lenderOf,
   namesMatch,
   normalizeExtracted,
   parseStatedIncome,
   parseSteps,
   pdfJpegs,
   readPdfInfo,
   riskOf,
   runChecks,
   scoreOf,
   stepFor,
   verdictOf
} from './incomeDocs.ts';

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

Deno.test('short history: two weeks is too short, but not "no regular income" (no whole month to judge)', () => {
   const doc = base({
      period_start: '2026-10-01',
      period_end: '2026-10-15',
      transactions: [tx('2026-10-02', 3000, 4000), tx('2026-10-09', -500, 3500)],
      opening_balance: null,
      closing_balance: null
   });
   const codes = runChecks(doc, computeMetrics(doc), smallLoan).map((f) => f.code);
   assert(codes.includes('short_history'));
   assert(!codes.includes('no_regular_income'));
});

// ---- Income vs borrowed money, gig income, stricter steps -------------------------------------------

const gig = (overrides: Partial<Extracted> = {}) =>
   base({
      period_start: '2026-07-01',
      period_end: '2026-09-30',
      opening_balance: null,
      closing_balance: null,
      transactions: [
         tx('2026-07-03', 4000, null, 'Received from Payoneer'),
         tx('2026-07-19', 9000, null, 'Received from Payoneer'),
         tx('2026-08-11', 6500, null, 'Upwork payout'),
         tx('2026-09-02', 2500, null, 'Shopee seller payout'),
         tx('2026-09-24', 7000, null, 'Received from client')
      ],
      ...overrides
   });

Deno.test('gig income that changes every month is income every month, not "irregular"', () => {
   const doc = gig();
   const m = computeMetrics(doc);
   assertEquals(
      m.income_by_month?.map((x) => x.income),
      [13000, 6500, 9500]
   );
   assertEquals(m.worst_month_income, 6500);
   const codes = runChecks(doc, m, smallLoan).map((f) => f.code);
   assert(!codes.includes('no_regular_income'));
});

Deno.test('a month with no income is flagged', () => {
   const doc = gig({ transactions: [tx('2026-07-03', 9000, null, 'Payoneer'), tx('2026-09-24', 9000, null, 'Payoneer')] });
   const flags = runChecks(doc, computeMetrics(doc), smallLoan);
   assert(flags.find((f) => f.code === 'no_regular_income')?.detail.includes('1 of 3'));
});

Deno.test('loan app payouts are not income; payments to them come off income', () => {
   const doc = gig({
      transactions: [
         ...gig().transactions,
         tx('2026-07-05', 5000, null, 'GLoan disbursement'),
         tx('2026-08-05', 4000, null, 'Tala cash'),
         tx('2026-08-20', -2000, null, 'Payment to JuanHand'),
         tx('2026-09-10', -1500, null, 'Billease payment')
      ]
   });
   const m = computeMetrics(doc);
   assertEquals(m.loan_in, 9000);
   assertEquals(m.income_in, 29000);
   assertEquals(m.lenders?.sort(), ['billease', 'gloan', 'juanhand', 'tala']);
   const codes = runChecks(doc, m, smallLoan).map((f) => f.code);
   assert(codes.includes('borrowed_money_in'));
   assert(codes.includes('many_lenders'));
   assert(codes.includes('other_loan_payments'));
   assertEquals(lenderOf('Received from Natalia'), null);
   assertEquals(kindOf(tx('2026-07-05', 500, null, 'SPayLater')), 'loan_in');
});

Deno.test('affordability uses the lean month and takes off other loan payments', () => {
   const doc = gig();
   const m = computeMetrics(doc);
   // worst month 6500, average ~9667 → plan for 6500 PHP ≈ $114; $35 repay = 31%: comfortable under a 50% limit.
   assertEquals(affordOf(doc, m, smallLoan.loan, STEP60).label, 'tight');
   assertEquals(affordOf(doc, m, smallLoan.loan, null).label, 'tight');
   assertEquals(affordOf(doc, m, { amount: 15, total_repayment: 17, due_date: null }, STEP60).label, 'comfortable');
   assertEquals(affordOf(doc, m, { amount: 80, total_repayment: 90, due_date: null }, STEP60).label, 'too_much');
   assertEquals(affordOf(doc, m, null, STEP60).label, 'unknown');
});

const STEP40 = { min: 40, months: 1, fresh: false, autoApprove: true, maxShare: null, balance: false, liveCall: false };
const STEP60 = { min: 60, months: 2, fresh: false, autoApprove: false, maxShare: 0.5, balance: false, liveCall: true };

Deno.test('$40+: a payslip alone is sent back for account history, and never approves itself', () => {
   const slip = base({
      doc_type: 'payslip',
      transactions: [],
      opening_balance: null,
      closing_balance: null,
      payslip: { employer: 'ACME', gross_pay: 20000, total_deductions: 2000, net_pay: 18000 }
   });
   const flags = runChecks(slip, computeMetrics(slip), { ...smallLoan, step: STEP40 });
   assert(flags.some((f) => f.code === 'needs_history'));
   assertEquals(verdictOf(flags, 'payslip'), { verdict: 'resend', reason: 'need_history' });
   assert(!canAutoApprove('looks_good', STEP40, slip, 'real', 'comfortable'));
   assert(canAutoApprove('looks_good', STEP40, gig(), 'real', 'comfortable'));
   assert(!canAutoApprove('looks_good', STEP40, gig(), 'check', 'comfortable'));
   // No step known (opened /documents on its own): a payslip is still fine for the team to look at.
   assert(!runChecks(slip, computeMetrics(slip), smallLoan).some((f) => f.code === 'needs_history'));
});

Deno.test('math that fakes get wrong: dates out of order, future dates, negative wallet balance', () => {
   const doc = base({
      opening_balance: null,
      closing_balance: null,
      transactions: [
         tx('2026-09-01', 100, 200),
         tx('2026-08-01', 100, 300),
         tx('2026-09-05', 100, 400),
         tx('2026-08-03', 100, -50),
         tx('2026-12-01', 100, 50)
      ]
   });
   const codes = runChecks(doc, computeMetrics(doc), smallLoan).map((f) => f.code);
   assert(codes.includes('dates_out_of_order'));
   assert(codes.includes('future_date'));
   assert(codes.includes('balance_negative'));
});

Deno.test('a PDF saved again after export is flagged; signed or linearized ones are not', () => {
   const enc = (s: string) => new TextEncoder().encode(s);
   assertEquals(readPdfInfo(enc('%PDF-1.4\n...%%EOF\n...%%EOF\n')).saves, 2);
   assertEquals(readPdfInfo(enc('%PDF-1.4\n<< /Linearized 1 >>\n%%EOF\n...%%EOF\n')).saves, 1);
   const flags = runChecks(base(), computeMetrics(base()), {
      ...smallLoan,
      pdfs: [{ ...readPdfInfo(enc('%%EOF %%EOF %%EOF')), producer: 'BPI eStatement' }]
   });
   assertEquals(flags.find((f) => f.code === 'pdf_saved_again')?.severity, 'orange');
   const signed = runChecks(base(), computeMetrics(base()), { ...smallLoan, pdfs: [readPdfInfo(enc('/ByteRange [0 1 2 3] %%EOF %%EOF'))] });
   assert(!signed.some((f) => f.code === 'pdf_saved_again'));
});

Deno.test('two labels: is it real, from the fake-sign checks', () => {
   const clean = buildSections([], { ok: true });
   assertEquals(authenticityOf(clean), 'real');
   assertEquals(authenticityOf(buildSections([{ code: 'visual_anomaly', severity: 'orange', detail: 'x' }], { ok: true })), 'check');
   assertEquals(authenticityOf(buildSections([{ code: 'name_mismatch', severity: 'red', detail: 'x' }], { ok: true })), 'fake_signs');
   // Affordability warnings don't make a document look fake.
   assertEquals(authenticityOf(buildSections([{ code: 'repayment_vs_income', severity: 'red', detail: 'x' }], { ok: true })), 'real');
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

Deno.test('not a financial document goes back to the borrower even with AI tags', () => {
   assertEquals(verdictOf([{ code: 'ai_label', severity: 'red', detail: 'x' }], 'other'), { verdict: 'resend', reason: 'not_financial' });
   // An AI-tagged GCash history is still the team's call.
   assertEquals(verdictOf([{ code: 'ai_label', severity: 'red', detail: 'x' }], 'gcash_history').verdict, 'needs_review');
});

Deno.test('unread documents show content checks as not checked', () => {
   const by = Object.fromEntries(buildSections([{ code: 'ai_label', severity: 'red', detail: 'x' }], { ok: false }).map((c) => [c.key, c.status]));
   assertEquals(by.readable, 'fail');
   assertEquals(by.not_ai, 'fail');
   assertEquals(by.afford, 'skip');
   assertEquals(by.identity, 'skip');
});

const STEPS = parseSteps([
   { min: 40, months: 0, fresh: false, autoApprove: true, maxShare: null, balance: false, liveCall: false },
   { min: 60, months: 2, fresh: false, autoApprove: false, maxShare: 0.5, balance: false, liveCall: false },
   { min: 100, months: 2, fresh: true, autoApprove: false, maxShare: 0.3, balance: true, liveCall: false },
   { min: 140, months: 2, fresh: true, autoApprove: false, maxShare: 0.3, balance: true, liveCall: true }
]);

Deno.test('steps: $40 takes one screenshot, $60 needs 2 months', () => {
   const week = base({ period_start: '2026-10-08', period_end: '2026-10-15', transactions: [tx('2026-10-09', 3000, 4000), tx('2026-10-10', -500, 3500)], opening_balance: null, closing_balance: null });
   const at40 = runChecks(week, computeMetrics(week), { ...smallLoan, step: stepFor(40, STEPS) });
   assert(!at40.some((f) => f.code === 'short_history'));
   const at60 = runChecks(week, computeMetrics(week), { ...smallLoan, step: stepFor(60, STEPS) });
   assert(at60.some((f) => f.code === 'short_history'));
   assertEquals(verdictOf(at60, week.doc_type), { verdict: 'resend', reason: 'short_history' });
});

Deno.test('steps: repayment share and balance get stricter at $100', () => {
   const doc = base();
   // $90 repay on ~$210/month = 43%: fine at the $60 step (50%), flagged at $100 (30%).
   const loan = { amount: 80, total_repayment: 90, due_date: null };
   const at60 = runChecks(doc, computeMetrics(doc), { ...ctx, loan, step: stepFor(60, STEPS) });
   assert(!at60.some((f) => f.code === 'repayment_vs_income'));
   const at100 = runChecks(doc, computeMetrics(doc), { ...ctx, loan, step: stepFor(100, STEPS) });
   assertEquals(at100.find((f) => f.code === 'repayment_vs_income')?.severity, 'orange');
   // Average balance (~PHP 15k ≈ $265) vs a $300 repayment: a note below $100, a flag from $100.
   const big = { amount: 140, total_repayment: 300, due_date: null };
   assertEquals(runChecks(doc, computeMetrics(doc), { ...ctx, loan: big, step: stepFor(60, STEPS) }).find((f) => f.code === 'balance_below_repayment')?.severity, 'info');
   assertEquals(runChecks(doc, computeMetrics(doc), { ...ctx, loan: big, step: stepFor(140, STEPS) }).find((f) => f.code === 'balance_below_repayment')?.severity, 'orange');
   assert(runChecks(doc, computeMetrics(doc), { ...ctx, loan: big, step: stepFor(140, STEPS) }).some((f) => f.code === 'live_call'));
});

Deno.test('scanned PDF: page photos come out as JPEGs, logos are skipped', () => {
   const enc = new TextEncoder();
   const page = new Uint8Array(60_000);
   page.set([0xff, 0xd8, 0xff, 0xe0]);
   const logo = new Uint8Array(2_000);
   logo.set([0xff, 0xd8]);
   const chunks = [
      enc.encode('%PDF-1.4\r11 0 obj\r<</Filter/DCTDecode/Height 4002/Length 60000/Subtype/Image/Type/XObject/Width 2740>>stream\r\n'),
      page,
      enc.encode('\r\nendstream\rendobj\r12 0 obj\r<</Subtype/Image/Filter /DCTDecode/Length 2000>>stream\n'),
      logo,
      enc.encode('\nendstream\rendobj\r%%EOF')
   ];
   const pdf = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
   let at = 0;
   for (const c of chunks) {
      pdf.set(c, at);
      at += c.length;
   }
   const jpegs = pdfJpegs(pdf);
   assertEquals(jpegs.length, 1);
   assertEquals(jpegs[0].length, 60_000);
   assertEquals(pdfJpegs(enc.encode('%PDF-1.4 no images')).length, 0);
});

Deno.test('a re-saved phone scan is a note, a re-saved bank export is a warning', () => {
   const doc = base();
   const scan = { encrypted: false, producer: 'iOS Version 27.0.1 (Build 24A446)', creator: null, created: 'D:20261027080711Z', modified: "D:20261027153843+07'00'" };
   const exported = { ...scan, producer: 'iText 5.5' };
   assertEquals(runChecks(doc, computeMetrics(doc), { ...smallLoan, pdfs: [scan] }).find((f) => f.code === 'edited_after_creation')?.severity, 'info');
   assertEquals(runChecks(doc, computeMetrics(doc), { ...smallLoan, pdfs: [exported] }).find((f) => f.code === 'edited_after_creation')?.severity, 'orange');
});
