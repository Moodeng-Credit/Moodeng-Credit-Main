import { describe, expect, it } from 'vitest';

import {
   formatEmailSubject,
   formatTelegramMessage,
   type SecurityAlert,
   type SecuritySeverity,
   severityEmoji,
   shouldEmail,
   shouldTelegram
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

   it('trims to Telegram’s 4096-char limit and points to the email', () => {
      const message = formatTelegramMessage(alert({ body: 'x'.repeat(10_000) }));
      expect(message.length).toBeLessThanOrEqual(4096);
      expect(message.startsWith('🔴 [fraud-scan]')).toBe(true);
      expect(message).toContain('full details in the alert email');
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
      // severity, chatDelivered (Discord or Telegram), expected, why
      ['critical', true, true, 'critical always emails (redundant channel)'],
      ['high', true, true, 'high always emails'],
      ['warning', true, true, 'warning always emails'],
      ['info', true, false, 'info delivered to chat: no email (avoids heartbeat spam)'],
      ['info', false, true, 'info but no chat channel got it: email is the fail-loud backstop'],
      ['warning', false, true, 'warning + chat failed: still emails'],
      ['critical', false, true, 'critical + chat failed: still emails']
   ];

   for (const [severity, chatDelivered, expected, why] of cases) {
      it(`${severity} / chatDelivered=${chatDelivered} → email=${expected} (${why})`, () => {
         expect(shouldEmail(severity, chatDelivered)).toBe(expected);
      });
   }
});

describe('shouldTelegram — only urgent alerts reach the team group', () => {
   it('sends high and critical to Telegram', () => {
      expect(shouldTelegram('critical')).toBe(true);
      expect(shouldTelegram('high')).toBe(true);
   });
   it('keeps warnings and the all-OK heartbeat (info) out of Telegram', () => {
      expect(shouldTelegram('warning')).toBe(false);
      expect(shouldTelegram('info')).toBe(false);
   });
});
