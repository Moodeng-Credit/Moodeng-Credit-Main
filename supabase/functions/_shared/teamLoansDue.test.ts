import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { bangkokWeek, buildTeamLoansDue, type TeamDueLoan } from './teamLoansDue.ts';

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

Deno.test('this week and overdue sections, with 💬 buttons once per person', () => {
   const now = new Date('2026-10-28T09:00:00Z');
   const { text, keyboard } = buildTeamLoansDue(
      [
         loan('2026-10-30T01:00:00Z'),
         loan('2026-10-20T01:00:00Z', { name: 'Ben', username: null, facebookName: null, messengerContactId: null, owedUsd: 10, onHold: true }),
         loan('2026-10-15T01:00:00Z')
      ],
      now
   );
   assertStringIncludes(text, 'Mon 26 Oct – Sun 1 Nov');
   assertStringIncludes(text, '📅 Due this week — 1 loan, $21.50\n• Fri 30 Oct · Ana (@ana.c) · $21.50 left · FB: Ana Cruz');
   assertStringIncludes(text, '⏰ Still overdue — 2 loans, $31.50');
   assertStringIncludes(text, '• Thu 15 Oct (13d late) · Ana (@ana.c)');
   assertStringIncludes(text, 'Ben · $10.00 left · no FB · on hold');
   assertEquals(keyboard, [[{ text: '💬 Ana Cruz', url: 'https://login.sendpulse.com/chatbots/chats?contact_id=c1&channel=messenger' }]]);
});

Deno.test('nothing due says so', () => {
   assertStringIncludes(buildTeamLoansDue([], new Date('2026-10-28T09:00:00Z')).text, 'Due this week: none 🎉');
});
