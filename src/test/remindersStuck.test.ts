import { describe, expect, it } from 'vitest';

import { buildRemindersStuckAlert, buildRemindersStuckMessage } from '../../supabase/functions/_shared/remindersStuck';

describe('reminders-stuck', () => {
   it('tells an Android borrower to fix it in Chrome, and an iPhone borrower in Safari', () => {
      const android = buildRemindersStuckMessage('failed', 'android', 'Joy Gallano');
      expect(android.startsWith('Hi Joy!')).toBe(true);
      expect(android).toContain('moodeng.app sa Chrome app');
      expect(buildRemindersStuckMessage('failed', 'ios', 'Erfreca Conde')).toContain('moodeng.app sa Safari app');
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
         2
      );
      expect(alert).toContain("🔕 Reminders didn't turn on — Mary Joy Gallano");
      expect(alert).toContain('@maryjoy · joy@example.com');
      expect(alert).toContain('tapped 2×');
      expect(alert).toContain('Bot sent them the Chrome/Safari steps');
      expect(buildRemindersStuckAlert({ display_name: null, username: 'x', email: null }, 'in_app', 'android', 'window_closed')).toContain(
         'Page inbox'
      );
   });
});
