import { describe, expect, it } from 'vitest';

import {
   formatEmailSubject,
   formatTelegramMessage,
   severityEmoji,
   shouldEmail,
   type SecurityAlert,
   type SecuritySeverity
} from '../../supabase/functions/_shared/securityAlerts';

const alert = (over: Partial<SecurityAlert> = {}): SecurityAlert => ({
   source: 'fraud-scan',
   severity: 'critical',
   title: '2 new signal(s) — 1 critical, 1 to review',
   body: 'CRITICAL (1):\n1. Self-deal — loan ABC',
   ...over
});

describe('severityEmoji — the §2.6 taxonomy', () => {
   it('maps every severity to its emoji', () => {
      expect(severityEmoji('critical')).toBe('🔴');
      expect(severityEmoji('high')).toBe('🟠');
      expect(severityEmoji('warning')).toBe('🟡');
      expect(severityEmoji('info')).toBe('ℹ️');
   });
});

describe('formatTelegramMessage', () => {
   it('prefixes emoji + [source] title, then a blank line, then the body', () => {
      expect(formatTelegramMessage(alert())).toBe(
         '🔴 [fraud-scan] 2 new signal(s) — 1 critical, 1 to review\n\nCRITICAL (1):\n1. Self-deal — loan ABC'
      );
   });

   it('uses the source label verbatim for each engine', () => {
      expect(formatTelegramMessage(alert({ source: 'risk-score', severity: 'high', title: 'sybil cluster — bob' }))).toContain(
         '🟠 [risk-score] sybil cluster — bob'
      );
      expect(formatTelegramMessage(alert({ source: 'heartbeat', severity: 'info', title: 'all systems OK' }))).toContain(
         'ℹ️ [heartbeat] all systems OK'
      );
   });
});

describe('formatEmailSubject', () => {
   it('renders «emoji» Moodeng [source]: title', () => {
      expect(formatEmailSubject(alert({ source: 'risk-score', severity: 'high', title: 'sybil cluster — bob' }))).toBe(
         '🟠 Moodeng [risk-score]: sybil cluster — bob'
      );
   });
});

describe('shouldEmail — the channel matrix', () => {
   const cases: Array<[SecuritySeverity, boolean, boolean, string]> = [
      // severity, telegramOk, expected, why
      ['critical', true, true, 'critical always emails (redundant channel)'],
      ['high', true, true, 'high always emails'],
      ['warning', true, true, 'warning always emails'],
      ['info', true, false, 'info with Telegram delivered: no email (avoids heartbeat spam)'],
      ['info', false, true, 'info but Telegram FAILED: email is the fail-loud backstop'],
      ['warning', false, true, 'warning + Telegram failed: still emails'],
      ['critical', false, true, 'critical + Telegram failed: still emails']
   ];

   for (const [severity, telegramOk, expected, why] of cases) {
      it(`${severity} / telegramOk=${telegramOk} → email=${expected} (${why})`, () => {
         expect(shouldEmail(severity, telegramOk)).toBe(expected);
      });
   }
});
