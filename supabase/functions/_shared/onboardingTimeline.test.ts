import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { formatGap, locationLine, signupLines, timelineLines } from './onboardingTimeline.ts';

Deno.test('phone sign-up: method, phone and channels', () => {
   assertEquals(signupLines({ method: 'Phone code', phone: '639170000001', channels: ['Messenger', 'WhatsApp'], steps: [] }), [
      'Signed up with: Phone code (+639170000001)',
      'Notifications on: Messenger, WhatsApp'
   ]);
   assertEquals(signupLines(null), []);
});

Deno.test('timeline shows the gap since the previous step and the total', () => {
   const lines = timelineLines({
      method: 'Google',
      phone: null,
      channels: null,
      steps: [
         { step: 'Signed up', at: '2026-10-25T05:33:34Z' },
         { step: 'Messenger connected', at: '2026-10-25T05:35:22Z' },
         { step: 'Asked to connect / booked call', at: '2026-10-25T05:44:00Z' }
      ]
   });
   assertEquals(lines, [
      'Onboarding:',
      '• Signed up — Oct 25, 12:33 PM (Bangkok time, GMT+7)',
      '• Messenger connected — +2 min',
      '• Asked to connect / booked call — +9 min',
      'Total so far: 10 min'
   ]);
});

Deno.test('formatGap', () => {
   assertEquals(formatGap(45_000), '45s');
   assertEquals(formatGap(3 * 3_600_000 + 5 * 60_000), '3h 5m');
   assertEquals(formatGap(5 * 86_400_000), '5 days');
});

Deno.test('location: IP city + country, VPN flag, phone time zone fallback', () => {
   const base = { method: 'Google', phone: null, channels: null, steps: [] };
   assertEquals(locationLine({ ...base, location: { city: 'Dhaka', country: 'BD', hosting: false } }), 'Location: Dhaka, Bangladesh');
   assertEquals(locationLine({ ...base, location: { city: null, country: 'PH', hosting: true } }), 'Location: Philippines (VPN/hosting IP — may not be real)');
   assertEquals(locationLine({ ...base, location: null, timezone: 'Asia/Ho_Chi_Minh' }), 'Location: Ho Chi Minh area (phone time zone, no IP yet)');
   assertEquals(locationLine({ ...base }), null);
   assertEquals(signupLines({ ...base, location: { city: 'Dhaka', country: 'BD', hosting: false } }), [
      'Signed up with: Google',
      'Location: Dhaka, Bangladesh',
      'Notifications on: none yet'
   ]);
});
