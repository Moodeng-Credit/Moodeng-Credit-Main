/**
 * When is a loan due? `loans.due_date` is a calendar date stored as midnight UTC. Read as an instant
 * that is 8 AM in Manila on the due day, which is when the app used to say "Past due".
 *
 * The rule: a loan is due until the END of its due day in the borrower's time zone, the one saved on
 * the loan when it was posted (`loans.due_timezone`, fixed by the database and never moved). It is
 * overdue from 00:00 the next day in that zone. Mirrors supabase/functions/_shared/loanDeadline.ts,
 * so the app, the reminders and the team posts all agree.
 *
 * Borrowers and lenders only ever see the date. The admin panel also shows the clock time, on the
 * borrower's clock and on the viewer's own (read from their device each time, nothing hard-coded).
 */

export const DEFAULT_LOAN_TIMEZONE = 'Asia/Manila';

const isValidTimezone = (zone: string | null | undefined): zone is string => {
   if (!zone) return false;
   try {
      new Intl.DateTimeFormat('en-US', { timeZone: zone });
      return true;
   } catch {
      return false;
   }
};

/** A real zone that isn't UTC/GMT/Etc, which on a device almost always means "never set". */
export const isUsableTimezone = (zone: string | null | undefined): zone is string =>
   isValidTimezone(zone) &&
   !/^(utc|gmt|etc\/|zulu|universal|uct|posix|right\/|factory|localtime|systemv\/)/i.test(zone) &&
   /^[A-Za-z]+\/[A-Za-z0-9_+\-/]+$/.test(zone);

/** The time zone this device is set to, or null when it's unknown or UTC-like. */
export const getDeviceTimezone = (): string | null => {
   try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return isUsableTimezone(zone) ? zone : null;
   } catch {
      return null;
   }
};

/** The zone a loan's due day is measured in: the one saved on the loan, else the fallback. */
export const getLoanTimezone = (loan: { dueTimezone?: string | null }, fallback?: string | null): string => {
   if (isUsableTimezone(loan.dueTimezone)) return loan.dueTimezone;
   if (isUsableTimezone(fallback)) return fallback;
   return getDeviceTimezone() ?? DEFAULT_LOAN_TIMEZONE;
};

// Offset (ms) of `zone` from UTC at `at`, positive east of Greenwich.
const zoneOffsetMs = (at: Date, zone: string): number => {
   const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
   }).formatToParts(at);
   const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
   const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
   return asUtc - Math.floor(at.getTime() / 1000) * 1000;
};

// The instant that is 00:00 on calendar date y-m-d in `zone` (month 1-12; day may overflow).
const zonedMidnight = (year: number, month: number, day: number, zone: string): Date => {
   const naive = Date.UTC(year, month - 1, day);
   let instant = naive - zoneOffsetMs(new Date(naive), zone);
   instant = naive - zoneOffsetMs(new Date(instant), zone);
   return new Date(instant);
};

/** The moment a loan becomes overdue: 00:00 on the day after its due date, in `zone`. */
export const getDueDayEnd = (dueDate: string | Date, zone: string): Date => {
   const due = new Date(dueDate);
   return zonedMidnight(due.getUTCFullYear(), due.getUTCMonth() + 1, due.getUTCDate() + 1, zone);
};

/** True once the due day has fully ended in `zone`. */
export const isPastDueDay = (dueDate: string | Date, zone: string, now: Date | number = Date.now()): boolean =>
   new Date(now).getTime() >= getDueDayEnd(dueDate, zone).getTime();

// Calendar date (y, m, d) of `at` in `zone`.
const zonedDate = (at: Date, zone: string) => {
   const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(at);
   const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
   return Date.UTC(get('year'), get('month') - 1, get('day'));
};

/**
 * Whole calendar days from today (in `zone`) to the due date: 0 = due today, 1 = tomorrow,
 * negative = days since the due date (overdue).
 */
export const getDaysUntilDueDay = (dueDate: string | Date, zone: string, now: Date | number = Date.now()): number => {
   const due = new Date(dueDate);
   const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
   return Math.round((dueDay - zonedDate(new Date(now), zone)) / (24 * 60 * 60 * 1000));
};

const cityOf = (zone: string) => zone.split('/').pop()?.replace(/_/g, ' ') ?? zone;

const clockIn = (instant: Date, zone: string, withDay: boolean) =>
   instant.toLocaleString('en-US', {
      timeZone: zone,
      ...(withDay ? { month: 'short', day: 'numeric' } : {}),
      hour: 'numeric',
      minute: '2-digit'
   });

/**
 * Admin panel: the deadline on the borrower's clock and on the viewer's.
 * { borrower: "Sep 30, 11:59 PM Manila", viewer: "10:59 PM your time" }; `viewer` is null when both
 * clocks read the same, and names the date when the viewer is on a different day.
 */
export const formatDeadlineForViewer = (
   dueDate: string | Date,
   borrowerZone: string,
   viewerZone: string | null = getDeviceTimezone()
): { borrower: string; viewer: string | null } => {
   const lastMinute = new Date(getDueDayEnd(dueDate, borrowerZone).getTime() - 60_000);
   const borrower = `${clockIn(lastMinute, borrowerZone, true)} ${cityOf(borrowerZone)}`;
   if (!viewerZone || clockIn(lastMinute, viewerZone, true) === clockIn(lastMinute, borrowerZone, true)) {
      return { borrower, viewer: null };
   }
   const sameDay =
      lastMinute.toLocaleDateString('en-US', { timeZone: viewerZone }) === lastMinute.toLocaleDateString('en-US', { timeZone: borrowerZone });
   return { borrower, viewer: `${clockIn(lastMinute, viewerZone, !sameDay)} your time` };
};
