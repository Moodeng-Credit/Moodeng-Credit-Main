import { describe, expect, it } from 'vitest';

import {
   buildRemindersHealthAlert,
   buildRemindersStuckAlert,
   buildRemindersStuckMessage,
   parseRemindersStuckFailure,
   shouldAlertRemindersHealth
} from '../../supabase/functions/_shared/remindersStuck';

describe('reminders-stuck', () => {
   it("doesn't send a phone that can't do reminders back to retry: Messenger takes over", () => {
      const android = buildRemindersStuckMessage('failed', 'android', 'Joy Gallano');
      expect(android.startsWith('Hi Joy!')).toBe(true);
      expect(android).toContain('wala ka nang kailangang gawin');
      expect(android).toContain('Messenger');
      expect(android).not.toContain('Chrome');
      expect(android).not.toContain('Turn on reminders');
   });

   it('tells an Android borrower inside Facebook to use Chrome, and an iPhone borrower Safari', () => {
      expect(buildRemindersStuckMessage('in_app', 'android', null)).toContain('moodeng.app sa Chrome app');
      expect(buildRemindersStuckMessage('in_app', 'ios', null)).toContain('moodeng.app sa Safari app');
   });

   it('says to leave Facebook for the in-app browser, and how to unblock when blocked', () => {
      expect(buildRemindersStuckMessage('in_app', 'android', null)).toContain('hindi sa loob ng Facebook');
      const blocked = buildRemindersStuckMessage('blocked', 'android', 'Ryan');
      expect(blocked).toContain('Permissions → Notifications → Allow');
      expect(blocked).not.toContain('Mag-sign in');
   });

   it('tells the team why, how many taps, and whether the bot reached them', () => {
      const alert = buildRemindersStuckAlert(
         { display_name: 'Mary Joy Gallano', username: 'maryjoy', email: 'joy@example.com' },
         'failed',
         'android',
         'sent',
         2,
         { stage: 'subscribe', errorName: 'AbortError', errorMessage: 'Registration failed - push service not available' }
      );
      expect(alert).toContain("🔕 Reminders didn't turn on — Mary Joy Gallano");
      expect(alert).toContain('@maryjoy · joy@example.com');
      expect(alert).toContain('tapped 2×');
      expect(alert).toContain('Bot messaged them on Messenger');
      expect(alert).toContain('(phone-side) — AbortError: Registration failed - push service not available');
      expect(
         buildRemindersStuckAlert({ display_name: 'A', username: null, email: null }, 'failed', 'android', 'sent', 2, {
            stage: 'save',
            errorName: '42501'
         })
      ).toContain('OUR SIDE');
      expect(buildRemindersStuckAlert({ display_name: null, username: 'x', email: null }, 'in_app', 'android', 'window_closed')).toContain(
         'Page inbox'
      );
   });

   it('only accepts a known failure stage from the app', () => {
      expect(parseRemindersStuckFailure({ stage: 'subscribe', errorName: 'AbortError' })).toEqual({
         stage: 'subscribe',
         errorName: 'AbortError',
         errorMessage: undefined
      });
      expect(parseRemindersStuckFailure({ stage: 'nope' })).toBeNull();
      expect(parseRemindersStuckFailure('x')).toBeNull();
   });
});

describe('reminders daily health check', () => {
   it('alerts only when several borrowers reached the step and no phone signed up', () => {
      expect(shouldAlertRemindersHealth(3, 0)).toBe(true);
      expect(shouldAlertRemindersHealth(3, 1)).toBe(false);
      expect(shouldAlertRemindersHealth(2, 0)).toBe(false);
      const alert = buildRemindersHealthAlert({ reached: 4, subscribed: 0, stuck: 2 });
      expect(alert).toContain('4 borrowers connected Facebook');
      expect(alert).toContain('2 of them');
   });
});
