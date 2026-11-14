import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
   buildIncomeDocCallback,
   INCOME_DOCS_ADMIN_URL,
   INCOME_REJECT_REASONS,
   incomeDocConfirmRows,
   incomeDocKeyboard,
   incomeDocReasonRows,
   incomeDocStamp,
   parseIncomeDocCallback,
   parseReasonPrompt,
   reachLine,
   reasonPromptText
} from './incomeDocCards.ts';

const DOC = '3f0c1a52-9b7e-4c1d-8a55-0123456789ab';

Deno.test('income doc callbacks round-trip and fit Telegram’s 64 bytes', () => {
   for (const step of ['approve', 'decline', 'yes_approve', 'yes_decline', 'back', 'type_reason', 'reason_0', 'reason_4'] as const) {
      const data = buildIncomeDocCallback(step, DOC);
      assertEquals(new TextEncoder().encode(data).length <= 64, true);
      assertEquals(parseIncomeDocCallback(data), { step, docId: DOC });
   }
});

Deno.test('other cards’ buttons are not ours', () => {
   for (const data of [null, '', 'busy', `kv:a:${DOC}`, `pi:x:${DOC}`, `pi:r9:${DOC}`, 'pi:a:not-a-uuid', `pi:a:${DOC}0`]) {
      assertEquals(parseIncomeDocCallback(data), null);
   }
});

Deno.test('keyboard: link to this document first, then Approve / Reject', () => {
   const [check, decide] = incomeDocKeyboard(DOC);
   assertEquals(check, [{ text: '👀 Open this document', url: `${INCOME_DOCS_ADMIN_URL}?doc=${DOC}` }]);
   assertEquals(incomeDocKeyboard(DOC, false).length, 1);
   assertEquals(
      decide.map((b) => b.text),
      ['✅ Approve', '❌ Reject']
   );
   assertEquals(
      incomeDocConfirmRows(DOC, 'decline').map((row) => row[0].text),
      ['❌ Yes, reject it', '◀ Back']
   );
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
   assertEquals(
      incomeDocDiscordRows(DOC, 'decide')[0].components.map((b) => b.label),
      ['👀 Check', '✅ Approve', '❌ Reject']
   );
   assertEquals(
      incomeDocDiscordRows(DOC, 'decline')[0].components.map((b) => b.label),
      ['❌ Yes, reject it', '◀ Back']
   );
   assertEquals(
      incomeDocDiscordRows(DOC, 'done')[0].components.map((b) => b.label),
      ['👀 Check']
   );
});

Deno.test('Discord click: confirm step swaps buttons, foreign ids are ignored', async () => {
   const { handleIncomeDocDiscordClick } = await import('./incomeDocCards.ts');
   const svc = { rpc: () => Promise.reject(new Error('no save on a first click')) };
   const first = (await handleIncomeDocDiscordClick(svc, { data: { custom_id: `incdoc:a:${DOC}` } })) as {
      type: number;
      data: { components: Array<{ components: Array<{ label: string }> }> };
   };
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
   })) as {
      type: number;
      data: { embeds: Array<{ title: string; description: string; footer: { text: string } }>; components: unknown[] };
   };
   assertEquals(calls, [{ p_id: DOC, p_decision: 'declined', p_by: 'Emma (Discord)' }]);
   assertEquals(out.type, 7);
   assertEquals(out.data.embeds[0].title.startsWith('❌ REJECTED'), true);
   assertEquals(out.data.embeds[0].description.includes('score 40/100'), true);
   assertEquals(out.data.embeds[0].footer.text, 'Decided by Emma (Discord)');
});

Deno.test('Reject asks what for: every reason, type-your-own, Back', () => {
   const rows = incomeDocReasonRows(DOC);
   const texts = rows.flat().map((b) => b.text);
   assertEquals(
      texts.slice(0, INCOME_REJECT_REASONS.length),
      INCOME_REJECT_REASONS.map((r) => r.label)
   );
   assertEquals(texts.slice(-2), ['✍️ Type the reason', '◀ Back']);
   for (const row of rows)
      for (const b of row) assertEquals(parseIncomeDocCallback((b as { callback_data: string }).callback_data)?.docId, DOC);
   for (const r of INCOME_REJECT_REASONS) assertEquals(r.text.length <= 300, true);
});

Deno.test('typed-reason prompt carries the document and card back', () => {
   assertEquals(parseReasonPrompt(reasonPromptText(DOC, 4321)), { docId: DOC, cardMessageId: 4321 });
   assertEquals(parseReasonPrompt('✍️ Why reject? something else'), null);
   assertEquals(parseReasonPrompt(null), null);
});

Deno.test('reject stamp shows the reason, or that there was none', () => {
   assertEquals(incomeDocStamp({ state: 'decided' }, 'declined', '@sam', 'Too blurry.').detail, 'Reason sent: “Too blurry.”');
   assertEquals(incomeDocStamp({ state: 'decided' }, 'declined', '@sam').detail, 'No reason given.');
});

Deno.test('reach line warns when only push (or nothing) went out', () => {
   assertEquals(reachLine([], 'declined').startsWith('⚠️ Couldn’t reach them'), true);
   assertEquals(reachLine(['push'], 'declined').startsWith('⚠️ The reject only went out as a push'), true);
   assertEquals(reachLine(['push', 'email'], 'approved'), '📬 They got the approval by push, email.');
});

Deno.test('Telegram: a reason button saves the reject with that reason and the card ref', async () => {
   const { handleIncomeDocCallback } = await import('./incomeDocCards.ts');
   const calls: Array<[string, unknown]> = [];
   const svc = {
      rpc: (fn: string, args: unknown) => (calls.push([fn, args]), Promise.resolve({ data: { state: 'decided' }, error: null }))
   };
   const realFetch = globalThis.fetch;
   globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify({ ok: true, result: {} })));
   try {
      const handled = await handleIncomeDocCallback(
         svc,
         { id: 'q', data: `pi:r2:${DOC}`, from: { username: 'emma' }, message: { chat: { id: -100 }, message_id: 77, text: 'card' } },
         ['-100']
      );
      assertEquals(handled, true);
   } finally {
      globalThis.fetch = realFetch;
   }
   assertEquals(calls, [
      [
         'decide_income_document_from_card',
         {
            p_id: DOC,
            p_decision: 'declined',
            p_by: '@emma',
            p_reason: INCOME_REJECT_REASONS[2].text,
            p_card: { chat: '-100', message: 77 }
         }
      ]
   ]);
});

Deno.test('Telegram: a reply to the prompt saves the typed reason', async () => {
   const { handleIncomeDocReasonReply } = await import('./incomeDocCards.ts');
   const calls: unknown[] = [];
   const svc = { rpc: (_fn: string, args: unknown) => (calls.push(args), Promise.resolve({ data: { state: 'decided' }, error: null })) };
   const realFetch = globalThis.fetch;
   globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify({ ok: true, result: {} })));
   try {
      const msg = (text: string, chat = -100) => ({
         message_id: 90,
         chat: { id: chat },
         from: { username: 'george' },
         text,
         reply_to_message: { message_id: 88, text: reasonPromptText(DOC, 77), from: { is_bot: true } }
      });
      assertEquals(await handleIncomeDocReasonReply(svc, msg('  Please send your payslip.  '), ['-100']), true);
      assertEquals(await handleIncomeDocReasonReply(svc, msg('sneaky', -5), ['-100']), true);
      assertEquals(
         await handleIncomeDocReasonReply(svc, { ...msg('x'), reply_to_message: { message_id: 1, text: 'hi', from: { is_bot: true } } }, [
            '-100'
         ]),
         false
      );
   } finally {
      globalThis.fetch = realFetch;
   }
   assertEquals(calls, [
      { p_id: DOC, p_decision: 'declined', p_by: '@george', p_reason: 'Please send your payslip.', p_card: { chat: '-100', message: 77 } }
   ]);
});
