import { describe, expect, it } from 'vitest';

import { buildHeartbeat, HeartbeatInput } from '../../supabase/functions/_shared/securityHeartbeat';

const NOW = new Date('2026-07-22T09:00:00.000Z');

const healthy = (): HeartbeatInput => ({
   scanLastOkAt: new Date(NOW.getTime() - 5 * 60 * 60 * 1000).toISOString(), // 5h ago
   ipLogins24h: 42,
   riskScores26h: 40,
   missingCriticalEnv: [],
   missingDegradedEnv: [],
   fraudChatIdConfigured: true,
   telegramTokenWorks: true,
   openFindingsOver7d: 0,
   now: NOW
});

describe('buildHeartbeat — healthy', () => {
   it('reports all systems OK', () => {
      const { ok, message } = buildHeartbeat(healthy());
      expect(ok).toBe(true);
      expect(message).toContain('ℹ️ Security heartbeat — all systems OK.');
      expect(message).toContain('✅ Fraud scan:');
      expect(message).toContain('✅ IP logging:');
      expect(message).toContain('✅ Risk scoring:');
      expect(message).toContain('✅ Telegram delivery:');
      expect(message).not.toContain('🔴');
   });
});

describe('buildHeartbeat — failures', () => {
   it('flags a stale fraud scan (the 11-day-outage scenario)', () => {
      const { ok, message } = buildHeartbeat({
         ...healthy(),
         scanLastOkAt: new Date(NOW.getTime() - 40 * 60 * 60 * 1000).toISOString() // 40h ago
      });
      expect(ok).toBe(false);
      expect(message).toContain('🔴 SECURITY HEARTBEAT FAILURE');
      expect(message).toContain('🔴 Fraud scan:');
      expect(message).toContain('security_job_runs');
   });

   it('flags a scan that never ran', () => {
      const { ok, message } = buildHeartbeat({ ...healthy(), scanLastOkAt: null });
      expect(ok).toBe(false);
      expect(message).toContain('no successful fraud-signal-scan run');
   });

   it('flags a dead IP pipeline and warns detection is blind', () => {
      const { ok, message } = buildHeartbeat({ ...healthy(), ipLogins24h: 0 });
      expect(ok).toBe(false);
      expect(message).toContain('🔴 IP logging:');
      expect(message).toContain('blind');
   });

   it('flags a stalled CRS engine', () => {
      const { ok, message } = buildHeartbeat({ ...healthy(), riskScores26h: 0 });
      expect(ok).toBe(false);
      expect(message).toContain('🔴 Risk scoring:');
   });

   it('flags missing critical secrets by name', () => {
      const { ok, message } = buildHeartbeat({ ...healthy(), missingCriticalEnv: ['IP_HASH_SALT'] });
      expect(ok).toBe(false);
      expect(message).toContain('🔴 Critical config:');
      expect(message).toContain('IP_HASH_SALT');
   });

   it('flags an unconfigured or broken Telegram channel', () => {
      const noChat = buildHeartbeat({ ...healthy(), fraudChatIdConfigured: false });
      expect(noChat.ok).toBe(false);
      expect(noChat.message).toContain('no fraud_alert_chat_id configured');

      const badToken = buildHeartbeat({ ...healthy(), telegramTokenWorks: false });
      expect(badToken.ok).toBe(false);
      expect(badToken.message).toContain('getMe failed');
   });

   it('lists still-OK checks alongside failures', () => {
      const { message } = buildHeartbeat({ ...healthy(), ipLogins24h: 0 });
      expect(message).toContain('Still OK:');
      expect(message).toContain('✅ Fraud scan:');
   });
});

describe('buildHeartbeat — non-fatal notes', () => {
   it('treats degraded geo config as a note, not a failure', () => {
      const { ok, message } = buildHeartbeat({ ...healthy(), missingDegradedEnv: ['MAXMIND_LICENSE_KEY'] });
      expect(ok).toBe(true);
      expect(message).toContain('Notes:');
      expect(message).toContain('🟡 Geo enrichment:');
   });

   it('treats a review backlog as a note, not a failure', () => {
      const { ok, message } = buildHeartbeat({ ...healthy(), openFindingsOver7d: 5 });
      expect(ok).toBe(true);
      expect(message).toContain('🟡 Review backlog:');
      expect(message).toContain('5 open fraud finding(s)');
   });
});

describe('buildHeartbeat — 26h boundary', () => {
   it('accepts a scan just under 26h old and rejects just over', () => {
      const under = buildHeartbeat({ ...healthy(), scanLastOkAt: new Date(NOW.getTime() - (26 * 3600 - 60) * 1000).toISOString() });
      expect(under.ok).toBe(true);
      const over = buildHeartbeat({ ...healthy(), scanLastOkAt: new Date(NOW.getTime() - (26 * 3600 + 60) * 1000).toISOString() });
      expect(over.ok).toBe(false);
   });
});
