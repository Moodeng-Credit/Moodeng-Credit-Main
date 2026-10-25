import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
   cleanPath,
   composeDigest,
   frictionLines,
   frictionRows,
   funnelLines,
   notableDeviceRows,
   type Person,
   stuckLines,
   trafficSessions
} from './clarityDigest.ts';

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

const NOW = Date.parse('2026-10-25T20:44:16Z');
const at = (iso: string) => `2026-10-25T${iso}Z`;
const PEOPLE: Person[] = [
   {
      username: 'luis',
      method: 'Phone code',
      browser: 'Google app',
      os: 'ios',
      locale: null,
      steps: [
         { step: 'Signed up', at: at('05:33:34') },
         { step: 'Wallet connected', at: at('05:34:26') },
         { step: 'Tapped Connect Messenger', at: at('05:34:29') },
         { step: 'Messenger connected', at: at('05:35:22') },
         { step: 'Asked to connect / booked call', at: at('05:44:00') }
      ]
   },
   {
      username: 'sandi',
      method: 'Email + password',
      browser: 'Chrome',
      os: 'android',
      locale: null,
      steps: [
         { step: 'Signed up', at: at('14:10:37') },
         { step: 'Wallet connected', at: at('14:11:21') },
         { step: 'Tapped Connect Messenger', at: at('15:55:27') },
         { step: 'Opened Messenger chat', at: at('16:09:21') }
      ]
   },
   // Signed up 30 minutes ago: not "stuck" yet.
   { username: 'new', method: 'Google', browser: 'Facebook app', os: 'android', locale: null, steps: [{ step: 'Signed up', at: at('20:14:16') }] }
];

Deno.test('funnelLines: share, how long the step took after their previous one, and what changed', () => {
   const lines = funnelLines(PEOPLE, { step_pct: { 'Messenger connected': 10 }, friction_pct: {}, created_at: at('00:00:00') });
   assertEquals(lines[0], 'New borrowers: 3');
   assertEquals(lines[1], '• Tapped Connect Messenger: 2 of 3 (67%) · took ~52 min');
   assertEquals(lines[3], '• Messenger connected: 1 of 3 (33%) · took ~53s ↑ from 10%');
   assertEquals(lines[lines.length - 1], '• Nobody yet: Turned on push, Call booked, Approved to borrow, ID check submitted, First loan funded');
});

Deno.test('stuckLines: newest first, with username and what they still need to do', () => {
   assertEquals(stuckLines(PEOPLE, NOW), [
      'Stopped partway: 1 of 3 (newest first, worth a message)',
      '• B @sandi (Email + password · Chrome/android) · 4h 35m ago · hasn\'t: finish Messenger (sent no code), ask to borrow'
   ]);
});

Deno.test('composeDigest: DeepSeek never sees usernames', () => {
   const d = composeDigest({ now: NOW, days: 3, people: PEOPLE, clarity: null, prev: null });
   assertEquals(d.lines.some((l) => l.includes('@sandi')), true);
   assertEquals(['@', 'sandi', 'luis'].some((u) => d.aiInput.includes(u)), false);
   assertEquals(d.aiInput.includes('B (Email + password · Chrome/android): Signed up → Wallet connected +44s'), true);
});

Deno.test('team pages are left out of friction and traffic', () => {
   const byPage = [
      { metricName: 'DeadClickCount', information: [{ Url: 'https://moodeng.app/admin/test-lab', sessionsCount: 5, sessionsWithMetricPercentage: 100 }] },
      { metricName: 'Traffic', information: [{ Url: 'https://moodeng.app/admin', totalSessionCount: 9 }, { Url: '/repay', totalSessionCount: 4 }] }
   ];
   assertEquals(frictionRows(byPage, ['URL']), []);
   assertEquals(trafficSessions(byPage), 4);
});

Deno.test('notableDeviceRows keeps in-app browsers and clear outliers, drops tiny samples', () => {
   const rows = frictionRows(
      [
         {
            metricName: 'DeadClickCount',
            information: [
               { Device: 'PC', Browser: 'Chrome', sessionsCount: 40, sessionsWithMetricPercentage: 10 },
               { Device: 'Mobile', Browser: 'ChromeMobile', sessionsCount: 10, sessionsWithMetricPercentage: 50 },
               { Device: 'Mobile', Browser: 'FacebookApp', sessionsCount: 4, sessionsWithMetricPercentage: 25 },
               { Device: 'Mobile', Browser: 'InstagramApp', sessionsCount: 1, sessionsWithMetricPercentage: 100 }
            ]
         }
      ],
      ['Device', 'Browser']
   );
   assertEquals(
      notableDeviceRows(rows).map((r) => r.where),
      ['Mobile · ChromeMobile', 'Mobile · FacebookApp']
   );
});
