import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildMessengerContent, MOO_BORROWER_POSTER_URL } from './borrowerNotificationDelivery.ts';

const loan = {
   tracking_id: 'LOAN-1',
   loan_amount: 15,
   total_repayment_amount: 16.5,
   due_date: '2026-11-12T00:00:00Z',
   funded_at: '2026-10-13T07:23:12Z',
   borrower_user_id: 'b',
   lender_user_id: 'l'
};

Deno.test('first funded loan → Moo-borrower welcome with the poster', () => {
   const content = buildMessengerContent('funded', loan, undefined, { firstLoan: true });
   assert(content?.text.includes('Moo-borrower'));
   assertEquals(content?.card?.imageUrl, MOO_BORROWER_POSTER_URL);
});

Deno.test('later funded loans keep the plain funded message', () => {
   const content = buildMessengerContent('funded', loan, undefined);
   assert(content?.text.startsWith('🎉 Great news'));
   assertEquals(content?.card?.imageUrl, undefined);
});
