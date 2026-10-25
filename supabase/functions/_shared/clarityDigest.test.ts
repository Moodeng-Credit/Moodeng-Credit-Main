import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { cleanPath, frictionLines, frictionRows, funnelLines, trafficSessions } from './clarityDigest.ts';

Deno.test('cleanPath drops query strings and ids', () => {
   assertEquals(cleanPath('https://moodeng.app/auth/verify-code?phone=639171234567'), '/auth/verify-code');
   assertEquals(cleanPath('https://moodeng.app/user/8f14e45f-ceea-4e7a-9b1c-2d3e4f5a6b7c/'), '/user/:id');
   assertEquals(cleanPath('/m/639171234567#x'), '/m/:id');
   assertEquals(cleanPath('https://moodeng.app/'), '/');
});

Deno.test('frictionRows merges the same page and sorts by sessions', () => {
   const rows = frictionRows(
      [
         {
            metricName: 'RageClickCount',
            information: [
               { sessionsCount: '4', sessionsWithMetricPercentage: 8.5, Url: 'https://moodeng.app/verify?x=1' },
               { sessionsCount: '3', URL: 'https://moodeng.app/verify' },
               { sessionsCount: '9', URL: 'https://moodeng.app/dashboard' },
               { sessionsCount: '0', URL: 'https://moodeng.app/empty' }
            ]
         },
         { metricName: 'Traffic', information: [{ totalSessionCount: '100', URL: '/' }] }
      ],
      ['URL']
   );
   assertEquals(rows, [
      { metric: 'Rage clicks', where: '/dashboard', sessions: 9, pct: null },
      { metric: 'Rage clicks', where: '/verify', sessions: 7, pct: null }
   ]);
   assertEquals(frictionLines(rows), ['• Rage clicks: /dashboard 9, /verify 7']);
});

Deno.test('frictionRows joins device and browser', () => {
   const rows = frictionRows(
      [
         {
            metricName: 'DeadClickCount',
            information: [{ sessionsCount: 5, sessionsWithMetricPercentage: 12.3, Device: 'Mobile', Browser: 'Facebook' }]
         }
      ],
      ['Device', 'Browser']
   );
   assertEquals(frictionLines(rows), ['• Dead clicks: Mobile · Facebook 5 (12%)']);
});

Deno.test('trafficSessions excludes bots', () => {
   assertEquals(
      trafficSessions([
         {
            metricName: 'Traffic',
            information: [
               { totalSessionCount: '120', totalBotSessionCount: '20' },
               { totalSessionCount: '30', totalBotSessionCount: '0' }
            ]
         }
      ]),
      130
   );
   assertEquals(trafficSessions([]), null);
});

Deno.test('funnelLines shows share of sign-ups', () => {
   assertEquals(funnelLines(10, [{ step: 'Messenger connected', count: 4 }]), ['New sign-ups: 10', '• Messenger connected: 4 (40%)']);
   assertEquals(funnelLines(0, [{ step: 'Messenger connected', count: 0 }]), ['New sign-ups: 0', '• Messenger connected: 0']);
});
