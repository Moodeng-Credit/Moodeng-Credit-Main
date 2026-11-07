import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { menuScreen, postedText, repayScreen } from './idBot.ts';
import { partialReceivedText, repayBlocker } from './idRepayments.ts';
import { buildIdMessage } from './idTrack.ts';
import { callbackFits } from './idLoanMath.ts';

const allCallbacks = (keyboard: Array<Array<Record<string, unknown>>>) =>
   keyboard.flat().filter((b) => typeof b.callback_data === 'string').map((b) => b.callback_data as string);

Deno.test('the menu has the four buttons with short callback data', () => {
   const screen = menuScreen('id', 'Budi');
   assertStringIncludes(screen.text, 'Halo Budi');
   assertEquals(allCallbacks(screen.keyboard), ['idm:status', 'idm:apply', 'idm:repay', 'idm:help']);
   assertEquals(screen.keyboard.flat().map((b) => b.text), ['📋 Pinjamanku', '💸 Ajukan pinjaman', '💰 Bayar', '❓ Bantuan']);
   assertStringIncludes(menuScreen('en').text, 'What would you like to do?');
});

Deno.test('posted message', () => {
   assertEquals(
      postedText('id', 5, 110000, '2026-11-15T00:00:00.000Z'),
      '✅ Permintaan $5 · Rp 110.000 · jatuh tempo 15 Nov diposting. Kami kirim ke Walt kamu begitu didanai.'
   );
});

Deno.test('repay screen: amount, ≈ rupiah, copyable address, the Walt steps, one-send warning', () => {
   const address = '0x1234567890abcdef1234567890abcdef12345678';
   const screen = repayScreen('id', { depositAddress: address, amountUsdt: '6.38', approxIdr: 105000, rupiahLeft: 100000 });
   assertStringIncludes(screen.text, 'Kirim: 6.38 USDT (≈ Rp 105.000)');
   assertStringIncludes(screen.text, address);
   assertStringIncludes(screen.text, 'BNB Smart Chain (BEP20)');
   assertStringIncludes(screen.text, 'hanya untuk 1x kirim');
   assertStringIncludes(screen.text, 'QRIS');
   const copy = screen.keyboard.flat().find((b) => 'copy_text' in b) as { copy_text: { text: string } };
   assertEquals(copy.copy_text.text, address);
   for (const data of allCallbacks(screen.keyboard)) assert(callbackFits(data));
});

Deno.test('partial payment message', () => {
   assertEquals(partialReceivedText('id', 50000, 3.03, 60000, 3.64), '✅ Pembayaran Rp 50.000 diterima. Sisa Rp 60.000 (≈ $3.64).');
   assertEquals(partialReceivedText('en', null, 3, null, 2.5), '✅ Payment of $3.00 received. $2.50 left to pay.');
});

Deno.test('only wallet-funded loans can be repaid straight to the lender', () => {
   const lender = '0x1234567890abcdef1234567890abcdef12345678';
   assertEquals(repayBlocker({ funding_method: 'walt_manual', lender_wallet: lender, onchain_loan_id: null }), null);
   assertEquals(repayBlocker({ funding_method: 'direct', lender_wallet: lender, onchain_loan_id: null }), null);
   assertEquals(repayBlocker({ funding_method: 'smart_contract', lender_wallet: lender, onchain_loan_id: null }), 'on_contract');
   assertEquals(repayBlocker({ funding_method: 'direct', lender_wallet: lender, onchain_loan_id: 12 }), 'on_contract');
   assertEquals(repayBlocker({ funding_method: 'walt_manual', lender_wallet: null, onchain_loan_id: null }), 'no_lender_wallet');
});

Deno.test('bot buttons on approved / funded / repaid / due messages', () => {
   assertEquals(buildIdMessage('access_approved', 'id').actions?.map((a) => a.callback_data), ['idm:apply', 'idm:menu']);
   assertEquals(buildIdMessage('loan_funded_walt', 'id', { amount: 5 }).actions?.map((a) => a.callback_data), ['idm:status', 'idm:menu']);
   assertEquals(buildIdMessage('repaid', 'id', { amount: 6 }).actions?.map((a) => a.callback_data), ['idm:apply', 'idm:menu']);
   assertEquals(buildIdMessage('due_today', 'id', { amount: 6 }).actions?.map((a) => a.callback_data), ['idm:repay']);
});
