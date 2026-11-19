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
   reminderState,
   shouldAutoGood,
   splitTyped,
   teamDaytime,
   toAnswerRead,
   waitingOnThem
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
