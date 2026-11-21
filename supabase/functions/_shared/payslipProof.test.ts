import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { pairAnswers, parseSourceRead, payslipProofQuestions, photoAnswerPath, sourceDateFlag, sourceLine } from './incomeDocs.ts';
import { awaitIdFor, docsReply, questionLine } from './messengerIncomeDocReply.ts';

// Made-up borrower; no real data.
const UID = '11111111-2222-3333-4444-555555555555';

Deno.test('payslip proof questions: edit question first, then the chat screenshot, in their language', () => {
   const ph = payslipProofQuestions('Philippines');
   assertEquals(ph.map((q) => [q.id, q.kind]), [['p1', 'text'], ['p2', 'photo']]);
   assertStringIncludes(ph[0].en, 'edit or enhance');
   assertStringIncludes(ph[1].en, 'screenshot of the chat or email');
   assertStringIncludes(ph[1].local ?? '', 'payslip');
   assertStringIncludes(payslipProofQuestions('Indonesia')[1].local ?? '', 'slip gaji');
});

Deno.test('photo answer path: only from their own folder', () => {
   assertEquals(photoAnswerPath(`photo:${UID}/answers/a.jpg`, UID), `${UID}/answers/a.jpg`);
   assertEquals(photoAnswerPath('photo:someone-else/a.jpg', UID), null);
   assertEquals(photoAnswerPath(`photo:${UID}/../x/a.jpg`, UID), null);
   assertEquals(photoAnswerPath('yes I did', UID), null);
   assertEquals(photoAnswerPath(null, UID), null);
});

Deno.test('chat date vs pay period: sent on the first day of a 15-day period is red', () => {
   const f = sourceDateFlag('2026-10-15', '2026-10-30');
   assertEquals(f?.code, 'payslip_sent_before_period_end');
   assertEquals(f?.severity, 'red');
   assertStringIncludes(f!.detail, '15 days BEFORE');
});

Deno.test('chat date vs pay period: a day or two before payday is normal, after is fine', () => {
   assertEquals(sourceDateFlag('2026-10-28', '2026-10-30')?.severity, 'info');
   assertEquals(sourceDateFlag('2026-10-30', '2026-10-30'), null);
   assertEquals(sourceDateFlag('2026-11-02', '2026-10-30'), null);
   assertEquals(sourceDateFlag(null, '2026-10-30'), null);
   assertEquals(sourceDateFlag('2026-10-15', null), null);
});

Deno.test('source read: cleans what the model sent', () => {
   assertEquals(parseSourceRead({ sent_date: '2026-10-15', shows_payslip: true, notes: ' Looks like recruitment. ' }), {
      sent_date: '2026-10-15',
      shows_payslip: true,
      notes: 'Looks like recruitment.'
   });
   assertEquals(parseSourceRead({ sent_date: 'Oct 15', shows_payslip: 'yes' }), { sent_date: null, shows_payslip: false, notes: '' });
   assertEquals(parseSourceRead(null), { sent_date: null, shows_payslip: false, notes: '' });
});

Deno.test('team line: red date first, unreadable says so', () => {
   const flag = sourceDateFlag('2026-10-15', '2026-10-30');
   const line = sourceLine({ sent_date: '2026-10-15', shows_payslip: true, notes: '' }, flag);
   assertStringIncludes(line, '🔴');
   assertStringIncludes(sourceLine({ sent_date: '2026-11-01', shows_payslip: true, notes: '' }, null), '✅');
   assertStringIncludes(sourceLine({ sent_date: null, shows_payslip: false, notes: '' }, null), 'No payslip visible');
   assertStringIncludes(sourceLine(null, null), 'couldn’t read');
});

Deno.test('photo answers show as a screenshot, not a storage path', () => {
   const [p1, p2] = payslipProofQuestions('Philippines');
   const pairs = pairAnswers([p1, p2], [
      { id: 'p1', a: 'No', at: '', via: 'page' },
      { id: 'p2', a: `photo:${UID}/answers/a.jpg`, at: '', via: 'page' }
   ]);
   assertEquals(pairs.map((p) => p.answer), ['No', '📸 sent a screenshot']);
});

Deno.test('Messenger: a photo question points to /documents and the bot does not wait for a reply', () => {
   const [p1, p2] = payslipProofQuestions('Philippines');
   assertStringIncludes(questionLine(p2, 'en'), 'moodeng.app/documents');
   assertStringIncludes(questionLine(p2, 'fil'), 'dito sa chat');
   assertStringIncludes(questionLine(p2, 'en'), 'here in this chat');
   assertEquals(awaitIdFor(p1), 'p1');
   assertEquals(awaitIdFor(p2), null);
   const doc = { id: 'd', status: 'done', decision: null, verdict: 'looks_good', questions: [p1, p2], answers: [{ id: 'p1' }], messenger_asked_at: null, messenger_asked_id: null };
   const r = docsReply(doc, 'en');
   assertEquals(r.asks, null);
   assert(r.text.includes('screenshot'));
});

Deno.test('approved by itself: the payslip questions stay open on Messenger; a team decision closes them', async () => {
   const { questionsOpen } = await import('./messengerIncomeDocReply.ts');
   const [p1, p2] = payslipProofQuestions('Philippines');
   const base = { id: 'd', status: 'done', verdict: 'looks_good', questions: [p1, p2], answers: [], messenger_asked_at: null, messenger_asked_id: null };
   const auto = docsReply({ ...base, decision: 'approved', decided_by: 'auto ($40 step)' }, 'en');
   assert(auto.text.startsWith('Your proof of income is approved ✅ One quick question'));
   assertEquals(auto.asks, 'p1');
   const team = docsReply({ ...base, decision: 'approved', decided_by: 'george' }, 'en');
   assertEquals(team, { text: 'Your proof of income is approved ✅', asks: null });
   assert(questionsOpen({ decision: null, decided_by: null }));
   assert(questionsOpen({ decision: 'approved', decided_by: 'auto (AI lend x3, score 80)' }));
   assert(!questionsOpen({ decision: 'declined', decided_by: 'auto' }));
});
