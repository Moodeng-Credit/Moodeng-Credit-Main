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

Deno.test('keyboard: link to this document first, then Approve / Reject', () => {
   const [check, decide] = incomeDocKeyboard(DOC);
   assertEquals(check, [{ text: '👀 Open this document', url: `${INCOME_DOCS_ADMIN_URL}?doc=${DOC}` }]);
   assertEquals(incomeDocKeyboard(DOC, false).length, 1);
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

Deno.test('Discord buttons: ids round-trip, fit 100 characters, other buttons are not ours', async () => {
   const { buildIncomeDocDiscordId, parseIncomeDocDiscordId, incomeDocDiscordRows } = await import('./incomeDocCards.ts');
   for (const step of ['approve', 'decline', 'yes_approve', 'yes_decline', 'back'] as const) {
      const id = buildIncomeDocDiscordId(step, DOC);
      assertEquals(id.length <= 100, true);
      assertEquals(parseIncomeDocDiscordId(id), { step, docId: DOC });
   }
   for (const id of [undefined, '', `reply:${DOC}`, `pi:a:${DOC}`, `incdoc:z:${DOC}`]) assertEquals(parseIncomeDocDiscordId(id), null);
   assertEquals(incomeDocDiscordRows(DOC, 'decide')[0].components.map((b) => b.label), ['👀 Check', '✅ Approve', '❌ Reject']);
   assertEquals(incomeDocDiscordRows(DOC, 'decline')[0].components.map((b) => b.label), ['❌ Yes, reject it', '◀ Back']);
   assertEquals(incomeDocDiscordRows(DOC, 'done')[0].components.map((b) => b.label), ['👀 Check']);
});

Deno.test('Discord click: confirm step swaps buttons, foreign ids are ignored', async () => {
   const { handleIncomeDocDiscordClick } = await import('./incomeDocCards.ts');
   const svc = { rpc: () => Promise.reject(new Error('no save on a first click')) };
   const first = (await handleIncomeDocDiscordClick(svc, { data: { custom_id: `incdoc:a:${DOC}` } })) as { type: number; data: { components: Array<{ components: Array<{ label: string }> }> } };
   assertEquals(first.type, 7);
   assertEquals(first.data.components[0].components[0].label, '✅ Yes, approve it');
   assertEquals(await handleIncomeDocDiscordClick(svc, { data: { custom_id: `reply:${DOC}` } }), null);
});

Deno.test('Discord click: Yes saves with the clicker’s name and stamps the card', async () => {
   const { handleIncomeDocDiscordClick } = await import('./incomeDocCards.ts');
   const calls: unknown[] = [];
   const svc = { rpc: (_fn: string, args: unknown) => (calls.push(args), Promise.resolve({ data: { state: 'decided' }, error: null })) };
   const out = (await handleIncomeDocDiscordClick(svc, {
      data: { custom_id: `incdoc:yd:${DOC}` },
      member: { nick: 'Emma' },
      message: { embeds: [{ title: '⚠️ Needs your decision — Ana', description: 'score 40/100' }] }
   })) as { type: number; data: { embeds: Array<{ title: string; description: string; footer: { text: string } }>; components: unknown[] } };
   assertEquals(calls, [{ p_id: DOC, p_decision: 'declined', p_by: 'Emma (Discord)' }]);
   assertEquals(out.type, 7);
   assertEquals(out.data.embeds[0].title.startsWith('❌ REJECTED'), true);
   assertEquals(out.data.embeds[0].description.includes('score 40/100'), true);
   assertEquals(out.data.embeds[0].footer.text, 'Decided by Emma (Discord)');
});
