import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { menuScreen, postedText, repayScreen } from './idBot.ts';
import { partialReceivedText } from './idRepayments.ts';
import { buildIdMessage } from './idTrack.ts';
import { callbackFits } from './idLoanMath.ts';

const allCallbacks = (keyboard: Array<Array<Record<string, unknown>>>) =>
   keyboard.flat().filter((b) => typeof b.callback_data === 'string').map((b) => b.callback_data as string);

Deno.test('the menu has the four buttons + the guides, with short callback data', () => {
   const screen = menuScreen('id', 'Budi');
   assertStringIncludes(screen.text, 'Halo Budi');
   assertEquals(allCallbacks(screen.keyboard), ['idm:status', 'idm:apply', 'idm:repay', 'idm:help', 'idg:list:0']);
   assertEquals(screen.keyboard.flat().map((b) => b.text), ['📋 Pinjamanku', '💸 Ajukan pinjaman', '💰 Bayar', '❓ Bantuan', '📖 Panduan langkah demi langkah']);
   assertStringIncludes(menuScreen('en').text, 'What would you like to do?');
});

Deno.test('posted message', () => {
   assertEquals(
      postedText('id', 5, 110000, '2026-11-15T00:00:00.000Z'),
      '✅ Permintaan $5 · Rp 110.000 · jatuh tempo 15 Nov diposting.\n\nYang terjadi sekarang:\n1. Kami kirim $5 ke Walt kamu (biasanya dalam beberapa jam, 08–22 WIB).\n2. Kami kabari kamu di chat ini.\n3. Lalu kami tunjukkan cara mencairkannya ke rupiah, langkah demi langkah.'
   );
});

Deno.test('repay screen never shows a withdrawal: no Walt username → paused, no address', () => {
   const address = '0x1234567890abcdef1234567890abcdef12345678';
   const screen = repayScreen('id', { method: 'bep20', address, amountUsdt: '6.08', approxIdr: 110000, rupiahLeft: 110000 });
   assert(!screen.text.includes(address));
   assert(!screen.text.includes('BEP20'));
   assertStringIncludes(screen.text, 'dijeda');
});

Deno.test('repay screen (Walt Transfer, free): exact amount, @username, copy buttons, Sudah kirim, no Withdraw', () => {
   const screen = repayScreen('id', { method: 'walt_transfer', waltUsername: 'jimmymoodengcredit', requestId: 42, address: 'walt:@jimmymoodengcredit', amountUsdt: '6.08', approxIdr: 110000, rupiahLeft: 110000 });
   assertStringIncludes(screen.text, 'Kirim TEPAT: 6.08 USDT (≈ Rp 110.000)');
   assertStringIncludes(screen.text, 'Ke: @jimmymoodengcredit');
   assertStringIncludes(screen.text, 'Transfer (gratis), BUKAN Withdraw');
   assert(!screen.text.includes('BEP20'), 'no on-chain steps in the free way');
   const copies = screen.keyboard.flat().filter((b) => 'copy_text' in b) as Array<{ copy_text: { text: string } }>;
   assertEquals(copies.map((c) => c.copy_text.text), ['@jimmymoodengcredit', '6.08']);
   assert(allCallbacks(screen.keyboard).includes('ids:42'));
   // The two guides people need right here.
   assert(allCallbacks(screen.keyboard).includes('idg:buy:1'));
   assert(allCallbacks(screen.keyboard).includes('idg:send:1'));
   for (const data of allCallbacks(screen.keyboard)) assert(callbackFits(data));
});

Deno.test('partial payment message', () => {
   assertEquals(partialReceivedText('id', 50000, 3.03, 60000, 3.64), '✅ Pembayaran Rp 50.000 diterima. Sisa Rp 60.000 (≈ $3.64).');
   assertEquals(partialReceivedText('en', null, 3, null, 2.5), '✅ Payment of $3.00 received. $2.50 left to pay.');
});

Deno.test('bot buttons on approved / funded / repaid / due messages', () => {
   assertEquals(buildIdMessage('access_approved', 'id').actions?.map((a) => a.callback_data), ['idm:apply', 'idm:menu']);
   assertEquals(buildIdMessage('loan_funded_walt', 'id', { amount: 5 }).actions?.map((a) => a.callback_data), ['idm:status', 'idm:menu']);
   assertEquals(buildIdMessage('repaid', 'id', { amount: 6 }).actions?.map((a) => a.callback_data), ['idm:apply', 'idm:menu']);
   assertEquals(buildIdMessage('due_today', 'id', { amount: 6 }).actions?.map((a) => a.callback_data), ['idm:repay']);
});
