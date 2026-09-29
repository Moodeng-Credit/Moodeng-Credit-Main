// Pure helpers for the admin Calendar tab — converting Cal.com's v2 schedule shape to and from the
// per-day editor, and placing bookings on a week grid in the schedule's own time zone.
//
// Cal.com stores weekly hours as { days: ['Monday', …], startTime: 'HH:MM', endTime: 'HH:MM' } entries
// and one-off dates as overrides { date: 'YYYY-MM-DD', startTime, endTime }. An override of
// 00:00–00:00 means "unavailable all day".

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface TimeRange {
   start: string; // HH:MM
   end: string; // HH:MM
}

export interface CalAvailability {
   days: string[];
   startTime: string;
   endTime: string;
}

export interface CalOverride {
   date: string;
   startTime: string;
   endTime: string;
}

export interface CalSchedule {
   id: number;
   name: string;
   timeZone: string;
   isDefault: boolean;
   availability: CalAvailability[];
   overrides: CalOverride[];
}

export type WeekHours = Record<Weekday, TimeRange[]>;
// A dated override: 'off' for the whole day, or the hours that replace that weekday's usual ones.
export type DateOverrides = Record<string, 'off' | TimeRange[]>;

const byStart = (a: TimeRange, b: TimeRange) => a.start.localeCompare(b.start);

export function emptyWeek(): WeekHours {
   return { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };
}

export function toWeekHours(availability: CalAvailability[]): WeekHours {
   const week = emptyWeek();
   for (const entry of availability ?? []) {
      for (const day of entry.days ?? []) {
         if ((WEEKDAYS as readonly string[]).includes(day)) week[day as Weekday].push({ start: entry.startTime, end: entry.endTime });
      }
   }
   for (const day of WEEKDAYS) week[day].sort(byStart);
   return week;
}

// Groups days that share an identical range back into one entry, the way Cal.com's own UI saves them.
export function fromWeekHours(week: WeekHours): CalAvailability[] {
   const grouped = new Map<string, CalAvailability>();
   for (const day of WEEKDAYS) {
      for (const range of week[day]) {
         const key = `${range.start}-${range.end}`;
         const entry = grouped.get(key) ?? { days: [], startTime: range.start, endTime: range.end };
         entry.days.push(day);
         grouped.set(key, entry);
      }
   }
   return [...grouped.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function toDateOverrides(overrides: CalOverride[]): DateOverrides {
   const out: DateOverrides = {};
   for (const o of overrides ?? []) {
      if (o.startTime === '00:00' && o.endTime === '00:00') {
         out[o.date] = 'off';
         continue;
      }
      const current = out[o.date];
      if (current === 'off') continue;
      out[o.date] = [...(current ?? []), { start: o.startTime, end: o.endTime }].sort(byStart);
   }
   return out;
}

export function fromDateOverrides(overrides: DateOverrides): CalOverride[] {
   return Object.keys(overrides)
      .sort()
      .flatMap((date) => {
         const value = overrides[date];
         if (value === 'off') return [{ date, startTime: '00:00', endTime: '00:00' }];
         return value.map((r) => ({ date, startTime: r.start, endTime: r.end }));
      });
}

// Overlapping or back-to-front ranges on the same day, as a human-readable problem (or null if fine).
export function rangeProblem(ranges: TimeRange[]): string | null {
   const sorted = [...ranges].sort(byStart);
   for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].start >= sorted[i].end) return `${sorted[i].start}–${sorted[i].end} ends before it starts`;
      if (i > 0 && sorted[i].start < sorted[i - 1].end)
         return `${sorted[i - 1].start}–${sorted[i - 1].end} overlaps ${sorted[i].start}–${sorted[i].end}`;
   }
   return null;
}

export function weekProblem(week: WeekHours, overrides: DateOverrides): string | null {
   for (const day of WEEKDAYS) {
      const problem = rangeProblem(week[day]);
      if (problem) return `${day}: ${problem}`;
   }
   for (const [date, value] of Object.entries(overrides)) {
      if (value === 'off') continue;
      if (value.length === 0) return `${date}: add hours or mark the day off`;
      const problem = rangeProblem(value);
      if (problem) return `${date}: ${problem}`;
   }
   return null;
}

// ---- Dates & time zones ----------------------------------------------------------------------

export function weekdayOf(ymd: string): Weekday {
   // getUTCDay: 0 = Sunday. Noon UTC keeps the calendar date stable.
   const index = new Date(`${ymd}T12:00:00Z`).getUTCDay();
   return WEEKDAYS[(index + 6) % 7];
}

export function addDays(ymd: string, days: number): string {
   const d = new Date(`${ymd}T12:00:00Z`);
   d.setUTCDate(d.getUTCDate() + days);
   return d.toISOString().slice(0, 10);
}

export function mondayOf(ymd: string): string {
   return addDays(ymd, -WEEKDAYS.indexOf(weekdayOf(ymd)));
}

export function weekDates(monday: string): string[] {
   return WEEKDAYS.map((_, i) => addDays(monday, i));
}

// The calendar date and minute-of-day of an instant, as seen in `timeZone`.
export function zonedParts(iso: string | Date, timeZone: string): { ymd: string; minutes: number } {
   const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
   }).formatToParts(typeof iso === 'string' ? new Date(iso) : iso);
   const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
   return { ymd: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export function toMinutes(hhmm: string): number {
   const [h, m] = hhmm.split(':').map(Number);
   return h * 60 + m;
}

// The open hours on a given date: its override if one exists, otherwise that weekday's usual hours.
export function hoursOn(
   ymd: string,
   week: WeekHours,
   overrides: DateOverrides
): { ranges: TimeRange[]; overridden: boolean; off: boolean } {
   const override = overrides[ymd];
   if (override === 'off') return { ranges: [], overridden: true, off: true };
   if (override) return { ranges: override, overridden: true, off: false };
   return { ranges: week[weekdayOf(ymd)], overridden: false, off: false };
}

// 15-minute steps for the time pickers, plus 23:59 so a range can run to the end of the day.
export const TIME_OPTIONS: string[] = [
   ...Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`),
   '23:59'
];

export function formatTime(hhmm: string): string {
   const [h, m] = hhmm.split(':').map(Number);
   const suffix = h < 12 ? 'am' : 'pm';
   const hour = h % 12 === 0 ? 12 : h % 12;
   return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, '0')}${suffix}`;
}
