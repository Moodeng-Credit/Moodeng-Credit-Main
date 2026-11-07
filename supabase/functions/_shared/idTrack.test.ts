import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildIdMessage, formatIdTime, idApprovalBlock, idFlag, idLocaleOf, idStepUrl, sendIdTelegramTo, stepsLeft } from './idTrack.ts';

Deno.test('step done names the next step and links to it', () => {
   const msg = buildIdMessage('step_done', 'id', { doneStep: 'whatsapp', next: 'facebook' });
   assertStringIncludes(msg.text, '✅ WhatsApp selesai — langkah berikutnya: Facebook');
   assertEquals(msg.button?.url, 'https://moodeng.app/id/onboarding?step=facebook');
});

Deno.test('English when preferred_locale is en, Bahasa otherwise', () => {
   assertEquals(idLocaleOf('en'), 'en');
   assertEquals(idLocaleOf('id'), 'id');
   assertEquals(idLocaleOf(null), 'id');
   assertStringIncludes(buildIdMessage('due_today', 'en', { amount: 10 }).text, 'Your $10 payment is due today');
});

Deno.test('funded points to the Walt cash-out', () => {
   const msg = buildIdMessage('loan_funded', 'id', { amount: 5 });
   assertStringIncludes(msg.text, 'Pinjaman $5 kamu sudah dikirim ke dompet Moodeng');
   assertEquals(msg.button?.url, 'https://moodeng.app/withdraw?to=walt');
});

Deno.test('call times are shown in WIB', () => {
   // 07:00 UTC = 14:00 in Jakarta.
   assertStringIncludes(formatIdTime('2026-11-08T07:00:00Z', 'id'), '14:00 WIB');
   assertStringIncludes(buildIdMessage('call_booked', 'id', { callAt: '2026-11-08T07:00:00Z', joinUrl: 'https://zoom.us/j/1' }).text, '14:00 WIB');
});

Deno.test('next-step urls and counters', () => {
   assertEquals(idStepUrl('apply'), 'https://moodeng.app/request-board');
   assertEquals(idStepUrl('waiting'), 'https://moodeng.app/id/onboarding');
   assertEquals(
      stepsLeft({ market: 'ID', steps: { telegram: true, whatsapp: true, facebook: false, about: false, income: false, kyc: false, walt: false, call: false } }),
      6
   );
   assertEquals(idFlag('ID'), '🇮🇩 ');
   assertEquals(idFlag(null), '');
});

Deno.test('only market ID users are messaged', async () => {
   assertEquals(await sendIdTelegramTo({ id: 'x', chat_id: 1, market: null }, 'repaid'), false);
   assertEquals(await sendIdTelegramTo({ id: 'x', chat_id: null, market: 'ID' }, 'repaid'), false);
});

const svcWith = (row: Record<string, unknown> | null) => ({
   from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }) })
});

Deno.test('approval is blocked for an Indonesian until KYC is approved', async () => {
   assert(await idApprovalBlock(svcWith({ market: 'ID', is_didit: null }), 'u1'));
   assertEquals(await idApprovalBlock(svcWith({ market: 'ID', is_didit: 'ACTIVE' }), 'u1'), null);
   assertEquals(await idApprovalBlock(svcWith({ market: null, is_didit: null }), 'u1'), null);
});

Deno.test('rupiah-pegged loans lead with the rupiah owed', () => {
   assertStringIncludes(buildIdMessage('due_today', 'id', { amount: 6.08, amountIdr: 110000 }).text, 'Pembayaran Rp 110.000 (≈ $6.08) jatuh tempo hari ini');
   assertStringIncludes(buildIdMessage('overdue', 'en', { amount: 4, amountIdr: 72000, lateBy: '2 days' }).text, 'Your Rp 72.000 (≈ $4) payment is overdue');
   assertStringIncludes(buildIdMessage('repaid', 'id', { amount: 6.1, amountIdr: 110000 }).text, 'Pembayaran Rp 110.000 (≈ $6.10) diterima');
   assertStringIncludes(buildIdMessage('due_tomorrow', 'id', { amount: 10, amountIdr: null }).text, 'Pembayaran $10 jatuh tempo besok');
});
