import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { bangkokDay, bangkokWeek, buildTeamLoansDue, type TeamDueLoan } from './teamLoansDue.ts';

const loan = (dueDate: string, extra: Partial<TeamDueLoan> = {}): TeamDueLoan => ({
   dueDate,
   owedUsd: 21.5,
   name: 'Ana',
   username: 'ana.c',
   facebookName: 'Ana Cruz',
   messengerContactId: 'c1',
   onHold: false,
   ...extra
});

Deno.test('week runs Monday to Sunday in Bangkok', () => {
   // Sunday 23:30 Bangkok is still the week that started Monday 26 Oct.
   assertEquals(bangkokWeek(new Date('2026-11-01T16:30:00Z')).key, '2026-10-26');
   // Monday 00:30 Bangkok (Sunday 17:30 UTC) is the next week.
   assertEquals(bangkokWeek(new Date('2026-11-01T17:30:00Z')).key, '2026-11-02');
   assertEquals(bangkokWeek(new Date('2026-10-28T09:00:00Z')).start.toISOString(), '2026-10-25T17:00:00.000Z');
});

Deno.test('day is the Bangkok calendar day', () => {
   assertEquals(bangkokDay(new Date('2026-11-26T16:59:00Z')).key, '2026-11-26');
   assertEquals(bangkokDay(new Date('2026-11-26T17:00:00Z')).key, '2026-11-27');
   assertEquals(bangkokDay(new Date('2026-11-27T02:00:00Z')).start.toISOString(), '2026-11-26T17:00:00.000Z');
});

Deno.test('next 7 days and overdue sections, with 💬 buttons once per person', () => {
   // Wed 28 Oct, 16:00 Bangkok. Due dates are stored at 00:00 UTC (07:00 Bangkok).
   const now = new Date('2026-10-28T09:00:00Z');
   const { text, keyboard } = buildTeamLoansDue(
      [
         loan('2026-10-28T00:00:00Z', { name: 'Cy', username: null, messengerContactId: null, facebookName: null, owedUsd: 5 }),
         loan('2026-10-30T00:00:00Z'),
         loan('2026-11-03T00:00:00Z', { name: 'Dee', username: null, facebookName: null, messengerContactId: 'c2', owedUsd: 57.5, part: 'part 1/2', loanLeftUsd: 115 }),
         loan('2026-11-04T00:00:00Z', { name: 'Later' }),
         loan('2026-10-20T00:00:00Z', { name: 'Ben', username: null, facebookName: null, messengerContactId: null, owedUsd: 10, onHold: true }),
         loan('2026-10-15T00:00:00Z')
      ],
      now
   );
   assertStringIncludes(text, '💰 Loans due (Wed 28 Oct – Tue 3 Nov, Bangkok)');
   assertStringIncludes(text, '📅 Due next 7 days — 3 loans, $84.00');
   assertStringIncludes(text, '• Wed 28 Oct (TODAY) · Cy · $5.00 left · no FB');
   assertStringIncludes(text, '• Fri 30 Oct · Ana (@ana.c) · $21.50 left · FB: Ana Cruz');
   assertStringIncludes(text, '• Tue 3 Nov · Dee · $57.50 left (part 1/2, $115.00 on the whole loan) · Messenger ✓');
   assertEquals(text.includes('Later'), false);
   assertStringIncludes(text, '⏰ Still overdue — 2 loans, $31.50');
   assertStringIncludes(text, '• Thu 15 Oct (13d late) · Ana (@ana.c)');
   assertStringIncludes(text, 'Ben · $10.00 left · no FB · on hold');
   assertEquals(keyboard, [
      [
         { text: '💬 Ana Cruz', url: 'https://login.sendpulse.com/chatbots/chats?contact_id=c1&channel=messenger' },
         { text: '💬 Dee', url: 'https://login.sendpulse.com/chatbots/chats?contact_id=c2&channel=messenger' }
      ]
   ]);
});

Deno.test('tomorrow is labelled', () => {
   const { text } = buildTeamLoansDue([loan('2026-10-29T00:00:00Z')], new Date('2026-10-28T09:00:00Z'));
   assertStringIncludes(text, '• Thu 29 Oct (tomorrow) · Ana');
});

Deno.test('nothing due says so', () => {
   assertStringIncludes(buildTeamLoansDue([], new Date('2026-10-28T09:00:00Z')).text, 'Due next 7 days: none 🎉');
});
