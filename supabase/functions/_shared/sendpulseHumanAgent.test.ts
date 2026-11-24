import { assertEquals } from 'jsr:@std/assert@1';

import { buildCardPayload, buildTextPayload, isInsideHumanAgentWindow } from './sendpulse.ts';

const H = 60 * 60 * 1000;
const now = Date.parse('2026-11-24T12:00:00Z');
const seen = (hoursAgo: number) => ({ id: 'c', last_activity_at: new Date(now - hoursAgo * H).toISOString() });

Deno.test('human agent window: open up to just under 7 days', () => {
   assertEquals(isInsideHumanAgentWindow(seen(26), now), true);
   assertEquals(isInsideHumanAgentWindow(seen(166), now), true);
   assertEquals(isInsideHumanAgentWindow(seen(168), now), false);
   assertEquals(isInsideHumanAgentWindow({ id: 'c' }, now), false);
});

Deno.test('payloads carry the HUMAN_AGENT tag only when asked', () => {
   assertEquals(buildTextPayload('c', 'hi').message.type, 'RESPONSE');
   const tagged = buildTextPayload('c', 'hi', [], true).message as Record<string, unknown>;
   assertEquals([tagged.type, tagged.tag], ['MESSAGE_TAG', 'HUMAN_AGENT']);
   const card = buildCardPayload('c', { title: 't', button: { title: 'b', url: 'https://x' } }, true).message as Record<string, unknown>;
   assertEquals([card.type, card.tag], ['MESSAGE_TAG', 'HUMAN_AGENT']);
});
