import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildCardPayload, isInsideMessagingWindow, messengerDisplayName, sendMessengerMessage } from './sendpulse.ts';

const NOW = Date.parse('2026-09-24T12:00:00Z');

Deno.test('Messenger window: open within 23h of the last interaction, closed after', () => {
   assertEquals(isInsideMessagingWindow({ id: 'c', status: 1, last_activity_at: '2026-09-24T02:00:00Z' }, NOW), true);
   assertEquals(isInsideMessagingWindow({ id: 'c', status: 1, last_activity_at: '2026-09-23T12:30:00Z' }, NOW), false);
});

Deno.test('Messenger window: closed for unsubscribed/disabled contacts or no activity', () => {
   assertEquals(isInsideMessagingWindow({ id: 'c', status: 2, last_activity_at: '2026-09-24T11:00:00Z' }, NOW), false);
   assertEquals(isInsideMessagingWindow({ id: 'c', unsubscribed_at: '2026-09-24T10:00:00Z', last_activity_at: '2026-09-24T11:00:00Z' }, NOW), false);
   assertEquals(isInsideMessagingWindow({ id: 'c' }, NOW), false);
   assertEquals(isInsideMessagingWindow(null, NOW), false);
});

Deno.test('card payload is a RESPONSE generic template with one link button, clipped to Messenger limits', () => {
   const payload = buildCardPayload('contact-1', {
      title: 'x'.repeat(100),
      subtitle: 'Tap below',
      button: { title: "✅ I'll be there — really long", url: 'https://example.com/c?t=abc' }
   });
   assertEquals(payload.contact_id, 'contact-1');
   assertEquals(payload.message.type, 'RESPONSE');
   const element = payload.message.data.attachment.payload.elements[0];
   assertEquals(element.title.length, 80);
   assertEquals(element.buttons[0].type, 'web_url');
   assertEquals(element.buttons[0].title.length <= 20, true);
});

Deno.test('Facebook name comes from channel_data', () => {
   assertEquals(messengerDisplayName({ id: 'c', channel_data: { name: 'Maria Santos' } }), 'Maria Santos');
   assertEquals(messengerDisplayName({ id: 'c', channel_data: { first_name: 'Maria', last_name: 'Santos' } }), 'Maria Santos');
   assertEquals(messengerDisplayName(null), null);
});

Deno.test('sending is a quiet no-op without credentials or a contact', async () => {
   Deno.env.delete('SENDPULSE_API_KEY');
   Deno.env.delete('SENDPULSE_API_ID');
   Deno.env.delete('SENDPULSE_API_SECRET');
   assertEquals(await sendMessengerMessage(null, { text: 'hi' }), { ok: false, reason: 'no_contact' });
   assertEquals(await sendMessengerMessage('contact-1', { text: 'hi' }), { ok: false, reason: 'not_configured' });
});
