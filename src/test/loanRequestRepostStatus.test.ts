import { describe, expect, it } from 'vitest';

import { getLoanRequestCooldownMinutes, getLoanRequestRepostStatusFromDeletedAt } from '@/lib/loanRequestRepostStatus';

describe('loan request repost cooldown', () => {
   const now = new Date('2026-05-31T12:00:00.000Z');

   const four = ['2026-05-31T11:50:00.000Z', '2026-05-31T11:40:00.000Z', '2026-05-31T10:00:00.000Z', '2026-05-31T09:00:00.000Z'];

   it('lets a borrower fix and repost up to four times in 24 hours with no wait', () => {
      const status = getLoanRequestRepostStatusFromDeletedAt(four, now);

      expect(status).toEqual({
         deleteCount24h: 4,
         cooldownUntil: null,
         canCreate: true
      });
   });

   it('blocks reposting for 30 minutes after the fifth recent delete', () => {
      const status = getLoanRequestRepostStatusFromDeletedAt([...four, '2026-05-31T08:00:00.000Z'], now);

      expect(status.deleteCount24h).toBe(5);
      expect(status.canCreate).toBe(false);
      expect(status.cooldownUntil).toBe('2026-05-31T12:20:00.000Z');
      expect(getLoanRequestCooldownMinutes(status.cooldownUntil, now)).toBe(20);
   });

   it('allows reposting when the latest delete is outside the cooldown', () => {
      const status = getLoanRequestRepostStatusFromDeletedAt(
         ['2026-05-31T11:20:00.000Z', '2026-05-31T11:00:00.000Z', '2026-05-31T10:00:00.000Z', '2026-05-31T09:30:00.000Z', '2026-05-31T09:00:00.000Z'],
         now
      );

      expect(status.deleteCount24h).toBe(5);
      expect(status.cooldownUntil).toBeNull();
      expect(status.canCreate).toBe(true);
   });

   it('ignores deletes outside the rolling 24-hour window', () => {
      const status = getLoanRequestRepostStatusFromDeletedAt(['2026-05-30T11:59:59.000Z', '2026-05-31T11:55:00.000Z'], now);

      expect(status.deleteCount24h).toBe(1);
      expect(status.canCreate).toBe(true);
   });
});
