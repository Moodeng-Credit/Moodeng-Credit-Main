import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildMessengerContent, buildWhatsAppReminderTemplate, MOO_BORROWER_POSTER_URL } from './borrowerNotificationDelivery.ts';
import { normalizeWhatsAppPhone } from './sendpulse.ts';

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

const bodyTexts = (template: ReturnType<typeof buildWhatsAppReminderTemplate>) =>
   template?.components?.[0]?.parameters.map((parameter) => parameter.text);

Deno.test('WhatsApp: due tomorrow / today / overdue map to their approved templates', () => {
   const aggregate = { count: 1, totalAmount: 16.5, dueLabel: '1 day' };
   const recipient = { username: 'maria' };
   assertEquals(buildWhatsAppReminderTemplate('final_reminder', recipient, aggregate)?.name, 'moodeng_due_tomorrow');
   assertEquals(bodyTexts(buildWhatsAppReminderTemplate('final_reminder', recipient, aggregate)), ['maria', '16.5', 'tomorrow']);
   assertEquals(bodyTexts(buildWhatsAppReminderTemplate('due_today', recipient, aggregate)), ['maria', '16.5', 'today']);
   assertEquals(buildWhatsAppReminderTemplate('overdue', recipient, { ...aggregate, dueLabel: '2 days' })?.name, 'moodeng_overdue');
   assertEquals(bodyTexts(buildWhatsAppReminderTemplate('overdue', recipient, { ...aggregate, dueLabel: '2 days' })), ['maria', '16.5', '2 days']);
});

Deno.test('WhatsApp: no template for "due in 3 days" or without an amount', () => {
   assertEquals(buildWhatsAppReminderTemplate('urgent_reminder', { username: 'maria' }, { count: 1, totalAmount: 5 }), null);
   assertEquals(buildWhatsAppReminderTemplate('funded', { username: 'maria' }, { count: 1, totalAmount: 5 }), null);
   assertEquals(buildWhatsAppReminderTemplate('due_today', { username: 'maria' }, undefined), null);
});

Deno.test('WhatsApp: overdue with no measurable deadline and no username still reads', () => {
   assertEquals(bodyTexts(buildWhatsAppReminderTemplate('overdue', { username: null }, { count: 2, totalAmount: 30, dueLabel: 'overdue' })), [
      'there',
      '30',
      'a little'
   ]);
});

Deno.test('WhatsApp: phone numbers normalised to digits', () => {
   assertEquals(normalizeWhatsAppPhone('+66 95 165 9077'), '66951659077');
   assertEquals(normalizeWhatsAppPhone(639171234567), '639171234567');
   assertEquals(normalizeWhatsAppPhone(''), null);
   assertEquals(normalizeWhatsAppPhone('123'), null);
});

Deno.test('funded WhatsApp template: name and amount', async () => {
   const { buildFundedWhatsAppTemplate } = await import('./borrowerNotificationDelivery.ts');
   const t = buildFundedWhatsAppTemplate({ username: 'maria' } as never, { loan_amount: 20 } as never);
   assertEquals(t.name, 'moodeng_loan_funded');
   assertEquals(t.components?.[0].parameters.map((p) => p.text), ['maria', '20']);
});
