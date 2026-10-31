import { describe, expect, it } from 'vitest';

import { EMPTY_INTEREST_REFUNDS, parseMyInterestRefunds } from '@/lib/friendReferrals';

describe('parseMyInterestRefunds', () => {
   it('returns empty for missing data', () => {
      expect(parseMyInterestRefunds(null)).toEqual(EMPTY_INTEREST_REFUNDS);
      expect(parseMyInterestRefunds({})).toEqual(EMPTY_INTEREST_REFUNDS);
   });

   it('reads friends at each stage of the refund', () => {
      const parsed = parseMyInterestRefunds({
         friends: [
            { joinedAt: '2026-10-30T00:00:00Z', repaid: false, refundUsd: null, refundStatus: null, sentAt: null, txHash: null },
            { joinedAt: '2026-10-29T00:00:00Z', repaid: true, refundUsd: '5.00', refundStatus: 'pending', sentAt: null, txHash: null },
            { joinedAt: '2026-10-28T00:00:00Z', repaid: true, refundUsd: 3, refundStatus: 'sent', sentAt: '2026-10-31T00:00:00Z', txHash: '0xabc' }
         ],
         totalRefundedUsd: '3.00'
      });

      expect(parsed.totalRefundedUsd).toBe(3);
      expect(parsed.friends.map((f) => [f.repaid, f.refundUsd, f.refundStatus])).toEqual([
         [false, null, null],
         [true, 5, 'pending'],
         [true, 3, 'sent']
      ]);
      expect(parsed.friends[2].txHash).toBe('0xabc');
   });

   it('ignores unknown refund statuses', () => {
      const parsed = parseMyInterestRefunds({ friends: [{ joinedAt: 'x', repaid: true, refundUsd: 2, refundStatus: 'weird' }] });
      expect(parsed.friends[0].refundStatus).toBeNull();
   });
});
