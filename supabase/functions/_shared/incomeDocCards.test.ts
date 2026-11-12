import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
   buildIncomeDocCallback,
   incomeDocConfirmRows,
   incomeDocKeyboard,
   incomeDocStamp,
   INCOME_DOCS_ADMIN_URL,
   parseIncomeDocCallback
} from './incomeDocCards.ts';

const DOC = '3f0c1a52-9b7e-4c1d-8a55-0123456789ab';

Deno.test('income doc callbacks round-trip and fit Telegram’s 64 bytes', () => {
   for (const step of ['approve', 'decline', 'yes_approve', 'yes_decline', 'back'] as const) {
      const data = buildIncomeDocCallback(step, DOC);
      assertEquals(new TextEncoder().encode(data).length <= 64, true);
      assertEquals(parseIncomeDocCallback(data), { step, docId: DOC });
   }
});

Deno.test('other cards’ buttons are not ours', () => {
   for (const data of [null, '', 'busy', `kv:a:${DOC}`, `pi:x:${DOC}`, 'pi:a:not-a-uuid', `pi:a:${DOC}0`]) {
      assertEquals(parseIncomeDocCallback(data), null);
   }
});

Deno.test('keyboard: Check link first, then Approve / Reject', () => {
   const [check, decide] = incomeDocKeyboard(DOC);
   assertEquals(check, [{ text: '👀 Check', url: INCOME_DOCS_ADMIN_URL }]);
   assertEquals(decide.map((b) => b.text), ['✅ Approve', '❌ Reject']);
   assertEquals(incomeDocConfirmRows(DOC, 'decline').map((row) => row[0].text), ['❌ Yes, reject it', '◀ Back']);
   assertEquals(incomeDocConfirmRows(DOC, 'approve')[0][0], { text: '✅ Yes, approve it', callback_data: `pi:ya:${DOC}` });
});

Deno.test('stamp says what happened and who did it', () => {
   assertEquals(incomeDocStamp({ state: 'decided' }, 'approved', '@sam').header.startsWith('✅ APPROVED'), true);
   assertEquals(incomeDocStamp({ state: 'decided' }, 'declined', '@sam').header.startsWith('❌ REJECTED'), true);
   const already = incomeDocStamp({ state: 'already', decision: 'declined', by: 'Emma' }, 'approved', '@sam');
   assertEquals(already.header, 'ℹ️ Already decided — rejected by Emma');
   assertEquals(already.verb, 'Tapped by');
   assertEquals(incomeDocStamp({ state: 'not_found' }, 'approved', '@sam').verb, 'Tapped by');
});
