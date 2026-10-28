import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { splitDiscordContent, telegramToDiscordContent } from './discord.ts';

Deno.test('mirror: link buttons become links, copy buttons their text, callback buttons are dropped', () => {
   const content = telegramToDiscordContent('🧾 Daily rewards check', [
      [{ text: '📥 Open the Moodeng Page inbox', url: 'https://business.facebook.com/x' }],
      [
         { text: '💬 Ana Cruz', url: 'https://login.sendpulse.com/c1' },
         { text: '📋 Copy message', copy_text: { text: 'Hi Ana!' } },
         { text: '👤', url: 'https://moodeng.app/admin?q=ana' }
      ],
      [{ text: '✅ Send code', callback_data: 'vo:s:1' }]
   ]);
   assertEquals(
      content,
      '🧾 Daily rewards check\n\n[📥 Open the Moodeng Page inbox](<https://business.facebook.com/x>)\n[💬 Ana Cruz](<https://login.sendpulse.com/c1>) · 📋 “Hi Ana!” · [👤](<https://moodeng.app/admin?q=ana>)'
   );
   assertEquals(telegramToDiscordContent('plain'), 'plain');
});

Deno.test('mirror: long posts split at line breaks under 2000 characters', () => {
   const lines = Array.from({ length: 60 }, (_, i) => `• person ${i} ${'x'.repeat(50)}`);
   const chunks = splitDiscordContent(lines.join('\n'));
   assert(chunks.length > 1);
   assert(chunks.every((chunk) => chunk.length <= 2000));
   assertEquals(chunks.join('\n'), lines.join('\n'));
   assert(splitDiscordContent('y'.repeat(2500))[0].length <= 2000);
});
