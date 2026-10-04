import { describe, expect, it } from 'vitest';

import { toLocalDateString } from '@/utils/dateFormatters';

describe('toLocalDateString', () => {
   it("returns the device's calendar date, not the UTC date", () => {
      // Local 01:30 on 4 Oct: in UTC+8 that is still 3 Oct 17:30 UTC, where toISOString().slice(0, 10)
      // would say the 3rd. The local getters must give the 4th in any timezone.
      expect(toLocalDateString(new Date(2026, 9, 4, 1, 30))).toBe('2026-10-04');
   });

   it('zero-pads month and day', () => {
      expect(toLocalDateString(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
   });

   it('is the local date late in the evening too', () => {
      expect(toLocalDateString(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
   });
});
