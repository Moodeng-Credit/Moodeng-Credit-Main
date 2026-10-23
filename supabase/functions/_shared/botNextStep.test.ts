import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { type BotStage, type BotUserRow, botStage, nextStepReply } from './botNextStep.ts';

const borrower = (over: Partial<BotUserRow> = {}): BotUserRow => ({
   user_role: 'borrower',
   wallet_address: '0x0000000000000000000000000000000000000001',
   messenger_verified_at: '2026-10-01T00:00:00Z',
   income_type: 'employed',
   ...over
});

Deno.test('stage follows the app journey', () => {
   assertEquals(botStage(null, false, 3), 'unlinked');
   assertEquals(botStage(borrower({ is_didit: 'ACTIVE' }), true, 3), 'verified');
   assertEquals(botStage(borrower({ user_role: 'lender' }), false, 3), 'lender');
   assertEquals(botStage(borrower({ wallet_address: null }), true, 3), 'wallet');
   assertEquals(botStage(borrower({ messenger_verified_at: null }), true, 3), 'messenger');
   assertEquals(botStage(borrower({ income_type: null }), true, 3), 'about');
   assertEquals(botStage(borrower(), true, 3), 'book_call');
   assertEquals(botStage(borrower({ loan_access_status: 'pending' }), true, 3), 'call_booked');
   assertEquals(botStage(borrower(), false, 3), 'apply');
   assertEquals(botStage(borrower({ didit_submitted_at: '2026-10-20T00:00:00Z' }), false, 3), 'id_processing');
   assertEquals(botStage(borrower({ didit_id_status: 'In Review' }), false, 3), 'id_review');
   assertEquals(botStage(borrower({ didit_id_status: 'Abandoned' }), false, 3), 'id_unfinished');
   assertEquals(botStage(borrower({ didit_id_status: 'Declined' }), false, 2), 'id_declined');
   assertEquals(botStage(borrower({ didit_id_status: 'Declined' }), false, 0), 'id_no_tries');
   assertEquals(botStage(borrower({ didit_id_status: 'Duplicate' }), false, 3), 'id_duplicate');
});

const STAGES: BotStage[] = [
   'unlinked', 'lender', 'wallet', 'messenger', 'about', 'book_call', 'call_booked', 'apply',
   'id_processing', 'id_review', 'id_unfinished', 'id_declined', 'id_no_tries', 'id_duplicate', 'verified'
];

Deno.test('every reply fits Messenger limits, in both languages, with language links', () => {
   for (const stage of STAGES) {
      for (const locale of ['en', 'fil'] as const) {
         const r = nextStepReply(stage, locale, 'Maria', 2);
         assert(r.text.length <= 640, `${stage}/${locale} text is ${r.text.length} chars`);
         assert(r.text.startsWith('Hi Maria!'), `${stage}/${locale} greets by name`);
         assert(r.buttons.length <= 3);
         for (const b of r.buttons) {
            assert(b.title.length <= 20, `${stage}/${locale} button "${b.title}" is too long`);
            assert(b.url.includes(`lang=${locale}`), `${stage}/${locale} ${b.url} lacks lang`);
         }
      }
   }
});

Deno.test('no greeting without a name', () => {
   assert(nextStepReply('apply', 'en').text.startsWith('🎉'));
});
