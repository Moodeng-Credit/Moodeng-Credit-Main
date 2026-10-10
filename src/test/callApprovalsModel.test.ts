import { describe, expect, it } from 'vitest';

import type { AdminCallApprovalRow } from '@/app/admin/adminSupabase';
import { groupCallApprovals, relativeStart } from '@/app/admin/callApprovalsModel';

const NOW = Date.parse('2026-10-10T12:00:00Z');
const at = (minFromNow: number) => new Date(NOW + minFromNow * 60000).toISOString();

const row = (over: Partial<AdminCallApprovalRow>): AdminCallApprovalRow => ({
   userId: over.userId ?? 'u',
   name: 'Maria',
   username: null,
   loanAccessStatus: 'none',
   callStartsAt: null,
   host: 'emma',
   joinUrl: null,
   attendance: null,
   outcome: null,
   outcomeAt: null,
   request: null,
   ...over
});

describe('groupCallApprovals', () => {
   it('puts calls that have started (or start within 10 min) under needs a decision, oldest first', () => {
      const groups = groupCallApprovals(
         [row({ userId: 'soon', callStartsAt: at(5) }), row({ userId: 'past', callStartsAt: at(-30) }), row({ userId: 'later', callStartsAt: at(60) })],
         NOW
      );
      expect(groups.needsDecision.map((r) => r.userId)).toEqual(['past', 'soon']);
      expect(groups.upcoming.map((r) => r.userId)).toEqual(['later']);
   });

   it('moves decided calls to decided, newest decision first', () => {
      const groups = groupCallApprovals(
         [
            row({ userId: 'a', callStartsAt: at(-90), outcome: 'attended', outcomeAt: at(-70) }),
            row({ userId: 'b', callStartsAt: at(-40), outcome: 'no_show', outcomeAt: at(-10) })
         ],
         NOW
      );
      expect(groups.needsDecision).toEqual([]);
      expect(groups.decided.map((r) => r.userId)).toEqual(['b', 'a']);
   });

   it('always shows a no-call approval request, and hides rejected borrowers', () => {
      const groups = groupCallApprovals(
         [
            row({ userId: 'ask', request: { id: 'r1', kind: 'approval', reason: null, createdAt: at(-5) } }),
            row({ userId: 'rejected', callStartsAt: at(-5), loanAccessStatus: 'rejected' })
         ],
         NOW
      );
      expect(groups.needsDecision.map((r) => r.userId)).toEqual(['ask']);
      expect(groups.upcoming).toEqual([]);
      expect(groups.decided).toEqual([]);
   });
});

describe('relativeStart', () => {
   it('reads naturally either side of the start', () => {
      expect(relativeStart(at(12), NOW)).toBe('in 12 min');
      expect(relativeStart(at(-5), NOW)).toBe('started 5 min ago');
      expect(relativeStart(at(-180), NOW)).toBe('started 3 h ago');
   });
});
