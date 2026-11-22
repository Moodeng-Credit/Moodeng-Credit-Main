import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
   autoAskThreshold,
   bangkokHour,
   borrowerDaytime,
   cleanQuestions,
   draftText,
   isWaitingForReply,
   messengerText,
   needsNudge,
   parseAskCallback,
   parseAskPrompt,
   plainRedFlags,
   reminderState,
   shouldAutoGood,
   splitTyped,
   teamDaytime,
   toAnswerRead,
   toRedFlags,
   waitingOnThem,
   autoDeclineDue,
   costsWhy,
   gradeWarnings,
} from './preScreeningAsk.ts';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

Deno.test('parseAskCallback reads pq taps only', () => {
   assertEquals(parseAskCallback(`pq:ask:${ID}`), { step: 'ask', id: ID });
   assertEquals(parseAskCallback(`pq:send:${ID}`), { step: 'send', id: ID });
   assertEquals(parseAskCallback(`ps:good:${ID}`), null);
   assertEquals(parseAskCallback('pq:ask:nope'), null);
});

Deno.test('parseAskPrompt finds the ref in the prompt', () => {
   assertEquals(parseAskPrompt(`✍️ type…\n(ref ${ID} · card 4512)`), { id: ID, cardMsg: 4512 });
   assertEquals(parseAskPrompt('✍️ Why reject?'), null);
});

Deno.test('splitTyped: one per line, numbering gone, max 3', () => {
   assertEquals(splitTyped('1. How much do you take home?\n2) Who are the loans with?\n\n- What is it for\n4. extra'), [
      'How much do you take home?',
      'Who are the loans with?',
      'What is it for'
   ]);
   assertEquals(splitTyped('   \n'), []);
});

Deno.test('cleanQuestions keeps good ones', () => {
   assertEquals(cleanQuestions({ questions: [{ en: ' Hi? ', local: 'Kumusta?', team: 'x' }, { local: 'no en' }, null] }), [
      { team: 'x', en: 'Hi?', local: 'Kumusta?' }
   ]);
   assertEquals(cleanQuestions('junk'), []);
});

Deno.test('texts', () => {
   const qs = [{ team: 't', en: 'How much is left after deductions?', local: 'Magkano ang natitira?' }];
   assertEquals(draftText('Kim Jay', qs, false).includes('   Magkano ang natitira?'), true);
   assertEquals(messengerText('Kim Jay Calleja', qs, 'fil').startsWith('Hi Kim!'), true);
   assertEquals(messengerText('Kim Jay', qs, 'fil').endsWith('1. Magkano ang natitira?'), true);
   assertEquals(messengerText('Kim Jay', qs, 'en').endsWith('1. How much is left after deductions?'), true);
});

Deno.test('isWaitingForReply: 24h, undecided, with a card', () => {
   const now = Date.parse('2026-11-19T12:00:00Z');
   const card = { chat: -1, msg: 2 };
   assertEquals(isWaitingForReply({ followup_sent_at: '2026-11-19T00:00:00Z', team_decision: null, followup_card: card }, now), true);
   assertEquals(isWaitingForReply({ followup_sent_at: '2026-11-18T11:00:00Z', team_decision: null, followup_card: card }, now), false);
   assertEquals(isWaitingForReply({ followup_sent_at: '2026-11-19T00:00:00Z', team_decision: 'good', followup_card: card }, now), false);
   assertEquals(isWaitingForReply(null, now), false);
});

Deno.test('autoAskThreshold: 50 by default, a number, or off', () => {
   assertEquals(autoAskThreshold(null), 50);
   assertEquals(autoAskThreshold(''), 50);
   assertEquals(autoAskThreshold('60'), 60);
   assertEquals(autoAskThreshold('off'), null);
   assertEquals(autoAskThreshold('0'), null);
});

Deno.test('auto good fit: all answered and at the bar', () => {
   assertEquals(toAnswerRead({ read: ' ok ', answered_all: true, score: 61.4 }), { read: 'ok', answered_all: true, score: 61 });
   assertEquals(toAnswerRead({ read: 'x', score: null }), { read: 'x', answered_all: false, score: null });
   assertEquals(toAnswerRead({}), null);
   assertEquals(shouldAutoGood({ read: 'x', answered_all: true, score: 50 }, 50), true);
   assertEquals(shouldAutoGood({ read: 'x', answered_all: true, score: 49 }, 50), false);
   assertEquals(shouldAutoGood({ read: 'x', answered_all: false, score: 90 }, 50), false);
   assertEquals(shouldAutoGood(null, 50), false);
});

Deno.test('sweep: nudge after 6h, before 20h, once, only with no reply', () => {
   const sent = Date.parse('2026-11-19T00:00:00Z');
   const base = {
      id: 'x',
      name: 'A',
      user_id: 'u',
      score: 40,
      status: 'graded',
      graded_at: null,
      team_card: null,
      followup_card: null,
      followup_sent_at: '2026-11-19T00:00:00Z',
      followup_answers: [],
      followup_nudged_at: null
   };
   assertEquals(needsNudge(base, sent + 5 * 3.6e6), false);
   assertEquals(needsNudge(base, sent + 7 * 3.6e6), true);
   assertEquals(needsNudge(base, sent + 21 * 3.6e6), false);
   assertEquals(needsNudge({ ...base, followup_nudged_at: 'y' }, sent + 7 * 3.6e6), false);
   assertEquals(needsNudge({ ...base, followup_answers: [{ text: 'hi' }] }, sent + 7 * 3.6e6), false);
   assertEquals(waitingOnThem(base, sent + 23 * 3.6e6), true);
   assertEquals(waitingOnThem(base, sent + 25 * 3.6e6), false);
   assertEquals(reminderState(base, sent), 'asked on Messenger, no reply in 24 hours');
   assertEquals(reminderState({ ...base, followup_sent_at: null }, sent), '40/100, nobody has decided');
});

Deno.test('sweep: daytime in Bangkok', () => {
   assertEquals(bangkokHour(Date.parse('2026-11-19T01:00:00Z')), 8);
   assertEquals(teamDaytime(Date.parse('2026-11-18T23:00:00Z')), false);
   assertEquals(teamDaytime(Date.parse('2026-11-19T01:00:00Z')), true);
   assertEquals(borrowerDaytime(Date.parse('2026-11-19T14:30:00Z')), false);
   assertEquals(borrowerDaytime(Date.parse('2026-11-19T05:00:00Z')), true);
});

Deno.test('red flags: plain ones and the AI list', () => {
   assertEquals(plainRedFlags(null), []);
   assertEquals(
      plainRedFlags({
         answers: [{ q: 'q1', transcript: null, note: '', seen: { person_visible: false } }],
         income: { read: { warnings: ['pay.png is labelled as AI-made (Content Credentials)'] } }
      }),
      ['nobody on camera in an answer', 'document tagged as AI-made']
   );
   assertEquals(plainRedFlags({ income: { read: { warnings: ['blurry photo'] } } }), []);
   assertEquals(toRedFlags({ red_flags: [{ code: 'sick_family', why: 'mother in hospital' }, { code: 'vague' }] }), [
      'loan for a sick family member (mother in hospital)'
   ]);
   assertEquals(toRedFlags({ red_flags: [] }), []);
   assertEquals(toRedFlags('junk'), []);
});

Deno.test('auto-decline: high medical costs, AI-graded, answers add up, 2h after grading, no team decision', () => {
   const now = Date.parse('2026-11-21T12:00:00Z');
   const high = { has_problem: true, who: 'mother', condition: 'dialysis', loan_for: 'ongoing' as const, chronic: true, size: 'large' as const, severity: 'high' as const, future_php_month: 10000, income_share: 0.67, note: '' };
   const row = { status: 'graded', user_id: 'u1', graded_at: '2026-11-21T09:30:00Z', medical: high };
   assertEquals(autoDeclineDue(row, now), true);
   assertEquals(autoDeclineDue({ ...row, graded_at: '2026-11-21T10:30:00Z' }, now), false); // only 1.5h
   assertEquals(autoDeclineDue({ ...row, medical: { ...high, severity: 'medium' as const } }, now), false);
   assertEquals(autoDeclineDue({ ...row, medical: { ...high, ungraded: true } }, now), false); // AI never read it
   assertEquals(autoDeclineDue({ ...row, medical: { ...high, consistent: false } }, now), false); // random taps
   assertEquals(autoDeclineDue({ ...row, user_id: null }, now), false);
   assertEquals(autoDeclineDue({ ...row, status: 'failed' }, now), false);
   assertEquals(costsWhy(high), 'mother, dialysis, ≈ ₱10,000/mo still to pay, 67% of income');
});

Deno.test('warnings: auto ✅ after replies only when they cleared every ⚠️', () => {
   const read = { read: 'ok', answered_all: true, score: 70, cleared: false };
   assertEquals(shouldAutoGood(read, 50), true);
   assertEquals(shouldAutoGood(read, 50, ['job photo is a selfie']), false);
   assertEquals(shouldAutoGood({ ...read, cleared: true }, 50, ['job photo is a selfie']), true);
   assertEquals(toAnswerRead({ read: 'x', answered_all: true, score: 60, cleared: true })?.cleared, true);
   assertEquals(toAnswerRead({ read: 'x', answered_all: true, score: 60 })?.cleared, undefined);
});

Deno.test('gradeWarnings: strings only, trimmed, deduped', () => {
   assertEquals(gradeWarnings({ flags: [' a ', 'a', '', 3, 'b'] }), ['a', 'b']);
   assertEquals(gradeWarnings(null), []);
});
