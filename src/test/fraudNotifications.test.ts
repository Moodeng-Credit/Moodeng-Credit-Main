import { describe, expect, it } from 'vitest';

import { buildFraudAlertMessage, describeFraudSignal } from '../../supabase/functions/_shared/fraudNotifications';

describe('describeFraudSignal', () => {
   it('describes a shared wallet spanning borrower and lender accounts', () => {
      const text = describeFraudSignal({
         type: 'shared_wallet',
         severity: 'critical',
         wallet_address: '0xabc',
         account_count: 2,
         borrower_and_lender: true,
         accounts: [
            { user_id: 'u1', role: 'borrower', email: 'b@example.com', username: 'boba' },
            { user_id: 'u2', role: 'lender', email: 'l@example.com', username: 'lena' }
         ]
      });

      expect(text).toContain('Same wallet on 2 accounts');
      expect(text).toContain('INCLUDING a borrower AND a lender');
      expect(text).toContain('boba (borrower, b@example.com)');
      expect(text).toContain('lena (lender, l@example.com)');
   });

   it('describes a borrower and lender sharing an IP before any loan links them', () => {
      const text = describeFraudSignal({
         type: 'cross_role_shared_ip',
         severity: 'warning',
         borrower_user_id: 'u1',
         borrower_username: 'boba',
         lender_user_id: 'u2',
         lender_username: 'lena',
         shared_ip_count: 3
      });

      expect(text).toContain('Borrower boba');
      expect(text).toContain('lender lena');
      expect(text).toContain('3 shared IP(s)');
      expect(text).toContain('possible self-lending setup');
   });

   it('falls back to a JSON dump for unknown signal types', () => {
      const text = describeFraudSignal({ type: 'brand_new_signal', severity: 'warning', user_id: 'u1' });

      expect(text).toContain('brand_new_signal');
      expect(text).toContain('u1');
   });
});

describe('buildFraudAlertMessage', () => {
   it('leads with critical signals and counts both buckets', () => {
      const { subject, text, criticalCount, warningCount } = buildFraudAlertMessage([
         { type: 'counterparty_shared_ip', severity: 'warning', tracking_id: 'MD-1' },
         { type: 'self_deal_wallet', severity: 'critical', tracking_id: 'MD-2', wallet: '0xabc' }
      ]);

      expect(criticalCount).toBe(1);
      expect(warningCount).toBe(1);
      expect(subject).toBe('🚨 Moodeng fraud scan: 1 critical, 1 to review');
      expect(text.indexOf('Self-deal — loan MD-2')).toBeLessThan(text.indexOf('MD-1: lender & borrower logged in from the same IP'));
      expect(text).toContain('CRITICAL (1):');
      expect(text).toContain('Worth a look (1):');
      expect(text).toContain('detection signals, not proof');
   });
});
