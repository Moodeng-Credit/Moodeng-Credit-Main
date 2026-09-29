// Input checks for admin-calendar's schedule writes, split out so they're unit-testable without the
// edge runtime. Shapes follow Cal.com's v2 schedules API: weekly `availability` entries of
// { days, startTime, endTime } and dated `overrides` of { date, startTime, endTime } (HH:MM, 24h).
// An override of 00:00–00:00 is how Cal.com records "unavailable all day".

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isRange = (start: unknown, end: unknown) =>
   typeof start === 'string' && typeof end === 'string' && HHMM.test(start) && HHMM.test(end) && start < end;

export const isValidAvailability = (value: unknown): boolean =>
   Array.isArray(value) &&
   value.length <= 100 &&
   value.every(
      (entry) =>
         isRecord(entry) &&
         Array.isArray(entry.days) &&
         entry.days.length > 0 &&
         entry.days.every((day) => (WEEKDAYS as readonly unknown[]).includes(day)) &&
         isRange(entry.startTime, entry.endTime)
   );

export const isValidOverrides = (value: unknown): boolean =>
   Array.isArray(value) &&
   value.length <= 366 &&
   value.every(
      (entry) =>
         isRecord(entry) &&
         typeof entry.date === 'string' &&
         YMD.test(entry.date) &&
         !Number.isNaN(Date.parse(entry.date)) &&
         // 00:00–00:00 = off all day; otherwise a normal start < end range.
         ((entry.startTime === '00:00' && entry.endTime === '00:00') || isRange(entry.startTime, entry.endTime))
   );
