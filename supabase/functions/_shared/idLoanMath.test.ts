import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
   callbackFits,
   idCallback,
   idDueDateIso,
   idRepayIdrBounds,
   idRepayIdrChoices,
   idTermChoices,
   idUsdForIdr,
   idUsdLeft,
   ID_PURPOSES,
   isIdMenuText,
   parseIdBotCallback
} from './idLoanMath.ts';

Deno.test('callbacks round-trip and fit in 64 bytes', () => {
   const cases = [
      idCallback.sent(123456789012),
      idCallback.menu('status'),
      idCallback.menu('apply'),
      idCallback.menu('repay'),
      idCallback.menu('help'),
      idCallback.menu('menu'),
      idCallback.amount(10),
      idCallback.term(10, 14),
      idCallback.rupiah(10, 14, 225000),
      idCallback.purpose(10, 14, 225000, 5),
      idCallback.confirm(9999.99, 999, 999999999, 5)
   ];
   for (const data of cases) {
      assert(callbackFits(data), data);
      assert(parseIdBotCallback(data), data);
   }
   assertEquals(parseIdBotCallback('idc:5:7:110000:2'), { kind: 'confirm', amount: 5, days: 7, rp: 110000, purpose: 2 });
   assertEquals(parseIdBotCallback('idr:7.5:14:150000'), { kind: 'rupiah', amount: 7.5, days: 14, rp: 150000 });
   assertEquals(parseIdBotCallback('idm:status'), { kind: 'menu', action: 'status' });
   assertEquals(idCallback.amount(7.5), 'ida:7.5');
});

Deno.test('foreign or broken callback data is not ours', () => {
   for (const bad of ['tl:abc:12', 'la:approve:x', 'idm:delete', 'idc:5:7:110000:9', 'idc:5:7:110000', 'idc:-5:7:110000:1', 'ida:5;drop', 'idr:5:7:12', '', 'idp:5:7:110000:6']) {
      assertEquals(parseIdBotCallback(bad), null, bad);
   }
   assertEquals(ID_PURPOSES.length, 6);
});

Deno.test('menu words', () => {
   for (const t of ['/menu', '/start', 'Menu', ' pinjaman ', '/menu@moodengnewbranchbot', '/start@moodengnewbranchbot']) assert(isIdMenuText(t), t);
   for (const t of ['/start support', 'menu please', 'halo', '', null]) assert(!isIdMenuText(t), String(t));
});

Deno.test('USD left: rupiah left ÷ today’s rate, rounded up to cents', () => {
   assertEquals(idUsdLeft({ repay_idr: 110000, repaid_idr: 0, total_repayment_amount: 6.08, repaid_amount: 0 }, 16500), { usd: 6.67, idr: 110000 });
   assertEquals(idUsdLeft({ repay_idr: 110000, repaid_idr: 60000, total_repayment_amount: 6.1, repaid_amount: 3.3 }, null), { usd: 2.8, idr: 50000 });
   assertEquals(idUsdLeft({ repay_idr: null, total_repayment_amount: 12, repaid_amount: 2 }, 16500), { usd: 10, idr: null });
});

Deno.test('terms and due dates (midnight UTC of the Jakarta date + days)', () => {
   assertEquals(idTermChoices(14), [7, 14]);
   assertEquals(idTermChoices(5), [5]);
   assertEquals(idTermChoices(0), []);
   // 2026-11-08 20:00 UTC is already 9 Nov in Jakarta.
   assertEquals(idDueDateIso(new Date('2026-11-08T20:00:00Z'), 7), '2026-11-16T00:00:00.000Z');
   assertEquals(idDueDateIso(new Date('2026-11-08T10:00:00Z'), 14), '2026-11-22T00:00:00.000Z');
});

Deno.test('rupiah chips are inside the server bounds and on Rp 5.000', () => {
   for (const rate of [15000, 16321.5, 16500, 18100]) {
      for (const amount of [5, 10]) {
         const bounds = idRepayIdrBounds(amount, rate)!;
         const chips = idRepayIdrChoices(amount, rate);
         assert(chips.length > 0 && chips.length <= 3, `${amount}@${rate}`);
         for (const rp of chips) {
            assertEquals(rp % 5000, 0);
            assert(rp >= bounds.min && rp <= bounds.max);
            const usd = idUsdForIdr(rp, rate);
            assert(usd >= amount + 1 && usd <= amount * 1.5, `${rp}@${rate}`);
         }
      }
   }
});
