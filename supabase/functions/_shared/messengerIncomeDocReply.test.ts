import { assert, assertEquals, assertFalse, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { answersText, pairAnswers, parseBorrowerQuestions } from './incomeDocs.ts';
import { docsReply, isAwaitedAnswer, isDocsKeyword, langOf, openQuestions, questionLine } from './messengerIncomeDocReply.ts';

const Q1 = { id: 'q1', team: 'What was the 2.1M IDR deposit?', en: 'What was the Rp 2,100,000 on Nov 14 for?', local: 'Untuk apa Rp 2.100.000 tanggal 14 Nov?', kind: 'text' as const };
const Q2 = { id: 'q2', team: 'Ask for a longer statement', en: 'Can you add 2 more months of history?', local: 'Bisa tambah riwayat 2 bulan lagi?', kind: 'file' as const };
const doc = (over: Record<string, unknown> = {}) => ({
   id: 'd1',
   status: 'done',
   decision: null,
   verdict: 'needs_review',
   questions: [Q1, Q2],
   answers: [],
   messenger_asked_at: null,
   messenger_asked_id: null,
   ...over
});

Deno.test('DOCS keyword: only the word itself', () => {
   for (const t of ['DOCS', 'docs', ' Doc ', 'DOCS.', 'docs!']) assert(isDocsKeyword(t), t);
   for (const t of ['docs please', 'my docs', 'documents', '']) assertFalse(isDocsKeyword(t), t);
});

Deno.test('language: menu English wins, then Indonesia, then fil', () => {
   assertEquals(langOf('en', 'ID'), 'en');
   assertEquals(langOf(null, 'ID'), 'id');
   assertEquals(langOf('fil', null), 'fil');
   assertEquals(langOf(null, null), 'en');
});

Deno.test('open questions skip answered ones', () => {
   assertEquals(openQuestions(doc({ answers: [{ id: 'q1' }] })).map((q) => q.id), ['q2']);
});

Deno.test('question line: local text + files hint for a file question', () => {
   assertEquals(questionLine(Q1, 'en'), Q1.en);
   assertEquals(questionLine(Q1, 'id'), Q1.local);
   assertStringIncludes(questionLine(Q2, 'en'), 'moodeng.app/documents');
});

Deno.test('DOCS reply: asks the first open question once checked', () => {
   const r = docsReply(doc(), 'en');
   assertEquals(r.asks, 'q1');
   assertStringIncludes(r.text, Q1.en);
   assertEquals(docsReply(doc({ status: 'processing' }), 'en').asks, null);
   assertEquals(docsReply(doc({ decision: 'approved' }), 'en').asks, null);
   assertEquals(docsReply(doc({ answers: [{ id: 'q1' }, { id: 'q2' }] }), 'en').asks, null);
   assertStringIncludes(docsReply(null, 'en').text, 'moodeng.app/documents');
});

Deno.test('an answer counts only right after our question, within 2 hours, while undecided', () => {
   const now = Date.parse('2026-11-17T10:00:00Z');
   const asked = doc({ messenger_asked_at: '2026-11-17T09:00:00Z', messenger_asked_id: 'q1' });
   assert(isAwaitedAnswer(asked, now));
   assertFalse(isAwaitedAnswer(doc(), now));
   assertFalse(isAwaitedAnswer({ ...asked, messenger_asked_at: '2026-11-17T07:30:00Z' }, now));
   assertFalse(isAwaitedAnswer({ ...asked, decision: 'approved' }, now));
   assertFalse(isAwaitedAnswer({ ...asked, answers: [{ id: 'q1' }] }, now));
});

Deno.test('borrower questions: cleaned, capped at 2, ids q1/q2', () => {
   const out = parseBorrowerQuestions({
      questions: [
         { team: 'a', en: 'One?', local: 'Isa?', kind: 'text' },
         { team: 'b', en: '', local: 'x' },
         { team: 'c', en: 'Two?', kind: 'file' },
         { team: 'd', en: 'Three?' }
      ]
   });
   assertEquals(out.map((q) => [q.id, q.en, q.kind]), [
      ['q1', 'One?', 'text'],
      ['q2', 'Two?', 'file']
   ]);
   assertEquals(parseBorrowerQuestions(null), []);
});

Deno.test('team post lists each question with the answer', () => {
   const pairs = pairAnswers([Q1, Q2], [{ id: 'q1', a: 'Salary from my boss', at: '2026-11-17', via: 'messenger' }]);
   const text = answersText('Louiz', pairs, null);
   assertStringIncludes(text, 'Salary from my boss · on Messenger');
   assertStringIncludes(text, '(no answer)');
});
