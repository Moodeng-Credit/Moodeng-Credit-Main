import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildCallConfirmTemplate, RUNG, shouldReleaseSlot, skipsDayBeforeReminder, skipsConfirmAsk, targetRung } from './lib.ts';

const H = 60 * 60 * 1000;
const start = Date.parse('2026-09-25T08:00:00Z');

Deno.test('a call booked for later today skips the day-before nudge (the confirmation covers it)', () => {
   assertEquals(skipsDayBeforeReminder(new Date(start - 5 * H).toISOString(), start), true);
});

Deno.test('a call booked two days ahead still gets the day-before nudge', () => {
   assertEquals(skipsDayBeforeReminder(new Date(start - 48 * H).toISOString(), start), false);
});

Deno.test('an unknown booking time never suppresses a reminder', () => {
   assertEquals(skipsDayBeforeReminder(null, start), false);
   assertEquals(skipsDayBeforeReminder('garbage', start), false);
});

Deno.test('the ladder: each window maps to its rung', () => {
   assertEquals(targetRung(30 * 60), RUNG.NONE);
   assertEquals(targetRung(20 * 60), RUNG.DAY);
   assertEquals(targetRung(120), RUNG.DAY);
   assertEquals(targetRung(65), RUNG.CONFIRM);
   assertEquals(targetRung(45), RUNG.CONFIRM);
   assertEquals(targetRung(30), RUNG.RELEASE);
   assertEquals(targetRung(10), RUNG.RELEASE);
   assertEquals(targetRung(4), RUNG.STARTING);
   assertEquals(targetRung(-2), RUNG.STARTING);
   assertEquals(targetRung(-5), RUNG.WAITING);
   assertEquals(targetRung(-25), RUNG.PROMPT);
   assertEquals(targetRung(-61), RUNG.AUTO_NO_SHOW);
});

Deno.test('no confirm ask when they booked inside the last 75 minutes before the call', () => {
   assertEquals(skipsConfirmAsk(new Date(start - 0.5 * H).toISOString(), start), true);
   assertEquals(skipsConfirmAsk(new Date(start - 2 * H).toISOString(), start), false);
});

Deno.test('a slot is released only if unconfirmed AND the ask verifiably reached them', () => {
   const base = { video_call_confirmed_at: null, video_call_keep_spot_asked_at: '2026-09-25T06:00:00Z', video_call_booking_uid: 'uid1' };
   assertEquals(shouldReleaseSlot(base), true);
   assertEquals(shouldReleaseSlot({ ...base, video_call_confirmed_at: '2026-09-25T06:10:00Z' }), false);
   assertEquals(shouldReleaseSlot({ ...base, video_call_keep_spot_asked_at: null }), false);
   assertEquals(shouldReleaseSlot({ ...base, video_call_booking_uid: null }), false);
});

Deno.test('WhatsApp confirm template: name, time and the confirm token as the button suffix', () => {
   const t = buildCallConfirmTemplate('Maria', 'Thu, Oct 30, 7:00 PM (Manila time)', 'abc123');
   assertEquals(t.name, 'moodeng_call_confirm');
   assertEquals(t.components[0].parameters.map((p) => p.text), ['Maria', 'Thu, Oct 30, 7:00 PM (Manila time)']);
   assertEquals(t.components[1], { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'abc123' }] });
   assertEquals(buildCallConfirmTemplate('  ', 'x', 't').components[0].parameters[0].text, 'there');
});
