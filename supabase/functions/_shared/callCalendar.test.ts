import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildCallIcs, googleCalendarUrl, isAndroid } from './callCalendar.ts';

const event = {
   uid: 'abc123',
   startsAt: '2026-10-30T11:00:00.000Z',
   joinUrl: 'https://us06web.zoom.us/j/123?pwd=x',
   confirmUrl: 'https://example.supabase.co/functions/v1/video-call-confirm?t=tok&src=cal'
};

Deno.test('ics: the call at the right UTC time, with 1h and 15m alarms and both links', () => {
   const ics = buildCallIcs(event, Date.parse('2026-10-29T00:00:00Z'));
   assertStringIncludes(ics, 'DTSTART:20261030T110000Z');
   assertStringIncludes(ics, 'DTEND:20261030T111500Z');
   assertStringIncludes(ics, 'TRIGGER:-PT60M');
   assertStringIncludes(ics, 'TRIGGER:-PT15M');
   assertStringIncludes(ics, 'UID:abc123@moodeng.app');
   const unfolded = ics.replace(/\r\n /g, '');
   assertStringIncludes(unfolded, 'video-call-confirm?t=tok&src=cal');
   assertStringIncludes(unfolded, 'zoom.us/j/123?pwd=x');
   // Every physical line fits in 75 octets, and lines end in CRLF.
   for (const line of ics.split('\r\n')) assert(new TextEncoder().encode(line).length <= 75, line);
   assert(ics.endsWith('END:VCALENDAR\r\n'));
});

Deno.test('ics: commas and semicolons are escaped; no Zoom link → no LOCATION', () => {
   const ics = buildCallIcs({ ...event, joinUrl: null });
   assert(!ics.includes('LOCATION:'));
   assertStringIncludes(ics.replace(/\r\n /g, ''), 'The Zoom link is in your email.');
   assertStringIncludes(ics.replace(/\r\n /g, ''), "1 hour before: tap the link below to confirm you're coming\\, or");
});

Deno.test('google calendar link and android detection', () => {
   const url = new URL(googleCalendarUrl(event));
   assertEquals(url.searchParams.get('action'), 'TEMPLATE');
   assertEquals(url.searchParams.get('dates'), '20261030T110000Z/20261030T111500Z');
   assertStringIncludes(url.searchParams.get('details') ?? '', 'src=cal');
   assertEquals(isAndroid('Mozilla/5.0 (Linux; Android 14; SM-A145F)'), true);
   assertEquals(isAndroid('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), false);
});
