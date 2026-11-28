import { describe, expect, it } from 'vitest';

import type { AdminCallApprovalRow } from '@/app/admin/adminSupabase';
import { buildCallLine, buildDaySchedule, callResult, groupCallApprovals, relativeStart } from '@/app/admin/callApprovalsModel';

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

   it('moves decided calls to completed, newest decision first', () => {
      const groups = groupCallApprovals(
         [
            row({ userId: 'a', callStartsAt: at(-90), outcome: 'attended', outcomeAt: at(-70) }),
            row({ userId: 'b', callStartsAt: at(-40), outcome: 'no_show', outcomeAt: at(-10) })
         ],
         NOW
      );
      expect(groups.needsDecision).toEqual([]);
      expect(groups.completed.map((r) => r.userId)).toEqual(['b', 'a']);
   });

   it('always shows a no-call approval request, and puts rejected borrowers under completed', () => {
      const groups = groupCallApprovals(
         [
            row({ userId: 'ask', request: { id: 'r1', kind: 'approval', reason: null, createdAt: at(-5) } }),
            row({ userId: 'rejected', callStartsAt: at(-5), loanAccessStatus: 'rejected' })
         ],
         NOW
      );
      expect(groups.needsDecision.map((r) => r.userId)).toEqual(['ask']);
      expect(groups.upcoming).toEqual([]);
      expect(groups.completed.map((r) => r.userId)).toEqual(['rejected']);
      expect(callResult(groups.completed[0])).toBe('rejected');
   });

   it('moves undecided calls older than 2 days to completed as not marked', () => {
      const groups = groupCallApprovals(
         [row({ userId: 'recent', callStartsAt: at(-60 * 47) }), row({ userId: 'old', callStartsAt: at(-60 * 49) })],
         NOW
      );
      expect(groups.needsDecision.map((r) => r.userId)).toEqual(['recent']);
      expect(groups.completed.map((r) => r.userId)).toEqual(['old']);
      expect(callResult(groups.completed[0])).toBe('unmarked');
   });

   it('keeps an old undecided call waiting while its call request is still pending', () => {
      const groups = groupCallApprovals(
         [row({ userId: 'stuck', callStartsAt: at(-60 * 50), request: { id: 'r2', kind: 'call', reason: null, createdAt: at(-60 * 52) } })],
         NOW
      );
      expect(groups.needsDecision.map((r) => r.userId)).toEqual(['stuck']);
      expect(groups.completed).toEqual([]);
   });

   it('labels showed-up calls approved and no-shows no-show', () => {
      expect(callResult(row({ outcome: 'attended' }))).toBe('approved');
      expect(callResult(row({ outcome: 'no_show' }))).toBe('no_show');
   });
});

describe('relativeStart', () => {
   it('reads naturally either side of the start', () => {
      expect(relativeStart(at(12), NOW)).toBe('in 12 min');
      expect(relativeStart(at(-5), NOW)).toBe('started 5 min ago');
      expect(relativeStart(at(-180), NOW)).toBe('started 3 h ago');
   });
});

describe('buildCallLine', () => {
   it('splits the line into on now, still waiting, up next and later', () => {
      const rows = [
         row({ userId: 'old', callStartsAt: at(-300) }),
         row({ userId: 'live', callStartsAt: at(-10) }),
         row({ userId: 'soon', callStartsAt: at(5) }),
         row({ userId: 'next', callStartsAt: at(40) }),
         row({ userId: 'after', callStartsAt: at(90) }),
         row({ userId: 'ask', request: { id: 'r1', kind: 'approval', reason: null, createdAt: at(-5) } })
      ];
      const line = buildCallLine(groupCallApprovals(rows, NOW), NOW);
      expect(line.onNow.map((r) => r.userId)).toEqual(['live', 'soon']);
      expect(line.waiting.map((r) => r.userId).sort()).toEqual(['ask', 'old']);
      expect(line.upNext?.userId).toBe('next');
      expect(line.later.map((r) => r.userId)).toEqual(['after']);
   });

   it('moves a call up the line when its time changes', () => {
      const rows = [row({ userId: 'a', callStartsAt: at(60) }), row({ userId: 'b', callStartsAt: at(120) })];
      expect(buildCallLine(groupCallApprovals(rows, NOW), NOW).upNext?.userId).toBe('a');
      const moved = [rows[0], { ...rows[1], callStartsAt: at(30) }];
      const line = buildCallLine(groupCallApprovals(moved, NOW), NOW);
      expect(line.upNext?.userId).toBe('b');
      expect(line.later.map((r) => r.userId)).toEqual(['a']);
   });
});

describe('buildDaySchedule', () => {
   const dayStart = NOW - 12 * 3600000;
   const dayEnd = dayStart + 24 * 3600000;

   it('lists the day in time order with where each call stands', () => {
      const rows = [
         row({ userId: 'later', callStartsAt: at(180) }),
         row({ userId: 'done', callStartsAt: at(-120), outcome: 'attended', outcomeAt: at(-100) }),
         row({ userId: 'missed', callStartsAt: at(-90), outcome: 'no_show', outcomeAt: at(-60) }),
         row({ userId: 'undecided', callStartsAt: at(-60) }),
         row({ userId: 'live', callStartsAt: at(-5) }),
         row({ userId: 'next', callStartsAt: at(45) }),
         row({ userId: 'tomorrow', callStartsAt: at(24 * 60) }),
         row({ userId: 'ask', request: { id: 'r1', kind: 'approval', reason: null, createdAt: at(-5) } })
      ];
      const schedule = buildDaySchedule(rows, NOW, dayStart, dayEnd);
      expect(schedule.map((e) => [e.row.userId, e.state])).toEqual([
         ['done', 'approved'],
         ['missed', 'no_show'],
         ['undecided', 'waiting'],
         ['live', 'now'],
         ['next', 'next'],
         ['later', 'upcoming']
      ]);
   });

   it('shows another day without marking anyone next unless they really are', () => {
      const rows = [row({ userId: 'today', callStartsAt: at(30) }), row({ userId: 'tomorrow', callStartsAt: at(24 * 60) })];
      const schedule = buildDaySchedule(rows, NOW, dayEnd, dayEnd + 24 * 3600000);
      expect(schedule.map((e) => [e.row.userId, e.state])).toEqual([['tomorrow', 'upcoming']]);
   });
});
