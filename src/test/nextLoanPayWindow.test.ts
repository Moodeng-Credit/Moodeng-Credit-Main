import { describe, expect, it } from 'vitest';

import { getPayWindow } from '@/views/dashboard-v2/components/NextLoanCard';

const DAY = 86_400_000;
const HOUR = 3_600_000;

describe('getPayWindow (one rule: pay in the 2nd half of your loan)', () => {
   const funded = Date.UTC(2026, 10, 26, 4);
   const deadline = funded + 30 * DAY;
   const due = {
      deadline: new Date(deadline).toISOString(),
      fundedAt: new Date(funded).toISOString(),
      rewardFrom: new Date(funded + 15 * DAY).toISOString()
   };

   it('opens on the halfway day of a 30-day loan', () => {
      expect(getPayWindow(due, funded)?.start).toBe(funded + 15 * DAY);
   });

   it('is too early in the first half, best in the 2nd half, late after the deadline', () => {
      expect(getPayWindow(due, funded + HOUR)?.status).toBe('early');
      expect(getPayWindow(due, funded + 10 * DAY)?.status).toBe('early');
      expect(getPayWindow(due, funded + 16 * DAY)?.status).toBe('best');
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
