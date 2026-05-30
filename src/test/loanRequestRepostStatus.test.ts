import { describe, expect, it } from 'vitest';

import { getLoanRequestCooldownMinutes, getLoanRequestRepostStatusFromDeletedAt } from '@/lib/loanRequestRepostStatus';

describe('loan request repost cooldown', () => {
   const now = new Date('2026-05-31T12:00:00.000Z');

   it('allows another request after fewer than two deletes in 24 hours', () => {
      const status = getLoanRequestRepostStatusFromDeletedAt(['2026-05-31T11:50:00.000Z'], now);

      expect(status).toEqual({
         deleteCount24h: 1,
         cooldownUntil: null,
         canCreate: true
      });
   });

   it('blocks reposting for 30 minutes after the second recent delete', () => {
      const status = getLoanRequestRepostStatusFromDeletedAt(['2026-05-31T11:50:00.000Z', '2026-05-31T09:00:00.000Z'], now);

      expect(status.deleteCount24h).toBe(2);
      expect(status.canCreate).toBe(false);
      expect(status.cooldownUntil).toBe('2026-05-31T12:20:00.000Z');
      expect(getLoanRequestCooldownMinutes(status.cooldownUntil, now)).toBe(20);
   });

   it('allows reposting when the latest delete is outside the cooldown', () => {
      const status = getLoanRequestRepostStatusFromDeletedAt(['2026-05-31T11:20:00.000Z', '2026-05-31T09:00:00.000Z'], now);

      expect(status.deleteCount24h).toBe(2);
      expect(status.cooldownUntil).toBeNull();
      expect(status.canCreate).toBe(true);
   });

   it('ignores deletes outside the rolling 24-hour window', () => {
      const status = getLoanRequestRepostStatusFromDeletedAt(['2026-05-30T11:59:59.000Z', '2026-05-31T11:55:00.000Z'], now);

      expect(status.deleteCount24h).toBe(1);
      expect(status.canCreate).toBe(true);
   });
});
