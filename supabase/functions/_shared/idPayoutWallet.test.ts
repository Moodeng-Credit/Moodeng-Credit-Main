import { assertEquals, assertThrows } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { autoPayBlocker, bangkokDay, bangkokDayStart, encodeTransfer, parseCreds, unitsToUsd, usdcBscUnits } from './idPayoutWallet.ts';

Deno.test('usdcBscUnits: exact 18-decimal units, no floats', () => {
   assertEquals(usdcBscUnits(5), 5n * 10n ** 18n);
   assertEquals(usdcBscUnits('10'), 10n * 10n ** 18n);
   assertEquals(usdcBscUnits('10.50'), 105n * 10n ** 17n);
   assertEquals(usdcBscUnits('0.1'), 10n ** 17n);
   assertThrows(() => usdcBscUnits('-1'));
   assertThrows(() => usdcBscUnits('1e3'));
   assertThrows(() => usdcBscUnits('abc'));
   assertEquals(unitsToUsd(usdcBscUnits('12.345678')), 12.345678);
});

Deno.test('encodeTransfer: transfer(address,uint256) calldata', () => {
   const data = encodeTransfer('0x00000000000000000000000000000000000000Ab', 5n * 10n ** 18n);
   assertEquals(data.slice(0, 10), '0xa9059cbb');
   assertEquals(data.length, 10 + 128);
   assertEquals(data.slice(10, 74), '00000000000000000000000000000000000000000000000000000000000000ab');
   assertEquals(BigInt(`0x${data.slice(74)}`), 5n * 10n ** 18n);
   assertThrows(() => encodeTransfer('0x123', 1n));
   assertThrows(() => encodeTransfer('0x00000000000000000000000000000000000000Ab', 0n));
});

Deno.test('bangkokDayStart: UTC+7 midnight', () => {
   // 2026-11-07 16:59Z = 23:59 Bangkok → day started 2026-11-06 17:00Z
   assertEquals(bangkokDayStart(Date.parse('2026-11-07T16:59:00Z')).toISOString(), '2026-11-06T17:00:00.000Z');
   // 17:00Z = 00:00 Bangkok next day
   assertEquals(bangkokDayStart(Date.parse('2026-11-07T17:00:00Z')).toISOString(), '2026-11-07T17:00:00.000Z');
   assertEquals(bangkokDay(Date.parse('2026-11-07T17:00:00Z')), '2026-11-08');
   assertEquals(bangkokDay(Date.parse('2026-11-07T16:59:00Z')), '2026-11-07');
});

Deno.test('autoPayBlocker: window, max, cap, balance', () => {
   const now = Date.parse('2026-11-07T10:00:00Z');
   const base = {
      amountUsd: 10,
      createdAt: '2026-11-07T09:50:00Z',
      now,
      paidTodayUsd: 0,
      balanceUsd: 50,
      limits: { maxUsd: 10, dailyCapUsd: 100 },
      hasWalt: true,
      requireAge: true
   };
   assertEquals(autoPayBlocker(base), null);
   assertEquals(autoPayBlocker({ ...base, hasWalt: false }), 'no_walt_address');
   assertEquals(autoPayBlocker({ ...base, createdAt: '2026-11-07T09:59:00Z' }), 'too_new');
   assertEquals(autoPayBlocker({ ...base, createdAt: '2026-11-07T09:59:00Z', requireAge: false }), null);
   assertEquals(autoPayBlocker({ ...base, createdAt: '2026-10-30T09:00:00Z' }), 'too_old');
   assertEquals(autoPayBlocker({ ...base, amountUsd: 10.01 }), 'over_max');
   assertEquals(autoPayBlocker({ ...base, paidTodayUsd: 90 }), null); // exactly at the cap is fine
   assertEquals(autoPayBlocker({ ...base, paidTodayUsd: 95 }), 'daily_cap_reached');
   assertEquals(autoPayBlocker({ ...base, balanceUsd: 9.99 }), 'low_balance');
   assertEquals(autoPayBlocker({ ...base, balanceUsd: 10 }), null);
   assertEquals(autoPayBlocker({ ...base, balanceUsd: null }), 'balance_unknown');
   assertEquals(autoPayBlocker({ ...base, amountUsd: 0 }), 'bad_amount');
});

Deno.test('parseCreds: the OPENFORT_PAYOUT vault JSON', () => {
   assertEquals(parseCreds(null), null);
   assertEquals(parseCreds('not json'), null);
   assertEquals(parseCreds('{"secretKey":"sk_live_x","walletSecret":"w"}'), null);
   assertEquals(parseCreds('{"secretKey":"pk_x","walletSecret":"w","feeSponsorshipId":"pol_1"}'), null);
   assertEquals(parseCreds('{"secretKey":"sk_live_x","walletSecret":"w","feeSponsorshipId":"pol_1"}'), {
      secretKey: 'sk_live_x',
      walletSecret: 'w',
      feeSponsorshipId: 'pol_1'
   });
});
