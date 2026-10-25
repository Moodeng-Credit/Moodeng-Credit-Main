import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { cleanPath, frictionLines, frictionRows, funnelLines, trafficSessions } from './clarityDigest.ts';

Deno.test('cleanPath drops query strings and ids', () => {
   assertEquals(cleanPath('https://moodeng.app/auth/verify-code?phone=639171234567'), '/auth/verify-code');
   assertEquals(cleanPath('https://moodeng.app/user/8f14e45f-ceea-4e7a-9b1c-2d3e4f5a6b7c/'), '/user/:id');
   assertEquals(cleanPath('/m/639171234567#x'), '/m/:id');
   assertEquals(cleanPath('https://moodeng.app/'), '/');
});

Deno.test('frictionRows counts visits WITH the problem, merges the same page, skips clean pages', () => {
   // Shapes from Clarity's real export (2026-10-26): sessionsCount = all visits to the page.
   const rows = frictionRows(
      [
         {
            metricName: 'DeadClickCount',
            information: [
               { Url: 'https://moodeng.app/sign-in', subTotal: 0, sessionsCount: 13, sessionsWithMetricPercentage: 0 },
               { Url: 'https://moodeng.app/creditline', subTotal: 70, sessionsCount: 9, sessionsWithMetricPercentage: 44.44 },
               { Url: 'https://moodeng.app/request-board', subTotal: 3, sessionsCount: 9, sessionsWithMetricPercentage: 11.11 },
               { Url: 'https://moodeng.app/request-board?tour=1', subTotal: 0, sessionsCount: 2, sessionsWithMetricPercentage: 0 },
               { Url: 'https://moodeng.app/onboarding/connect', subTotal: 3, sessionsCount: 4, sessionsWithMetricPercentage: 50 }
            ]
         },
         { metricName: 'Traffic', information: [{ totalSessionCount: '100', Url: '/' }] }
      ],
      ['URL']
   );
   assertEquals(rows, [
      { metric: 'Dead clicks', where: '/creditline', sessions: 4, total: 9, pct: (4 / 9) * 100 },
      { metric: 'Dead clicks', where: '/onboarding/connect', sessions: 2, total: 4, pct: 50 },
      { metric: 'Dead clicks', where: '/request-board', sessions: 1, total: 11, pct: (1 / 11) * 100 }
   ]);
   assertEquals(frictionLines(rows), [
      '• Dead clicks: /creditline 4 of 9 visits (44%), /onboarding/connect 2 of 4 visits (50%), /request-board 1 of 11 visits (9%)'
   ]);
});

Deno.test('frictionRows joins device and browser', () => {
   const rows = frictionRows(
      [
         {
            metricName: 'DeadClickCount',
            information: [{ sessionsCount: 20, sessionsWithMetricPercentage: 25, Device: 'Mobile', Browser: 'Facebook' }]
         }
      ],
      ['Device', 'Browser']
   );
   assertEquals(frictionLines(rows), ['• Dead clicks: Mobile · Facebook 5 of 20 visits (25%)']);
});

Deno.test('frictionRows without a share counts the place only when the problem was recorded', () => {
   const rows = frictionRows(
      [
         {
            metricName: 'RageClickCount',
            information: [
               { sessionsCount: 6, subTotal: 2, Url: '/verify' },
               { sessionsCount: 30, subTotal: 0, Url: '/dashboard' }
            ]
         }
      ],
      ['URL']
   );
   assertEquals(rows, [{ metric: 'Rage clicks', where: '/verify', sessions: 6, total: 6, pct: 100 }]);
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
