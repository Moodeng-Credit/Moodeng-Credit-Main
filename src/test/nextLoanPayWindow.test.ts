import { describe, expect, it } from 'vitest';

import { getPayWindow } from '@/views/dashboard-v2/components/NextLoanCard';

const DAY = 86_400_000;
const HOUR = 3_600_000;

describe('getPayWindow (one rule: pay in your last week)', () => {
   const funded = Date.UTC(2026, 10, 26, 4);
   const deadline = funded + 30 * DAY;
   const due = {
      deadline: new Date(deadline).toISOString(),
      fundedAt: new Date(funded).toISOString(),
      rewardFrom: new Date(funded + 15 * DAY).toISOString()
   };

   it('opens 7 days before the deadline on a 30-day loan', () => {
      expect(getPayWindow(due, funded)?.start).toBe(deadline - 7 * DAY);
   });

   it('is too early right after funding, best in the last week, late after the deadline', () => {
      expect(getPayWindow(due, funded + HOUR)?.status).toBe('early');
      expect(getPayWindow(due, deadline - 2 * DAY)?.status).toBe('best');
      expect(getPayWindow(due, deadline + HOUR)?.status).toBe('late');
   });

   it('never opens before 48 hours or the halfway day on a short loan', () => {
      const shortDeadline = funded + 5 * DAY;
      const short = { ...due, deadline: new Date(shortDeadline).toISOString(), rewardFrom: new Date(funded + 2.5 * DAY).toISOString() };
      expect(getPayWindow(short, funded)?.start).toBe(funded + 2.5 * DAY);
   });

   it('returns null for a bad deadline', () => {
      expect(getPayWindow({ ...due, deadline: 'nope' })).toBeNull();
   });
});
