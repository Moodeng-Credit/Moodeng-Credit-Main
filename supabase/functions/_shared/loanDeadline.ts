// When is a loan actually due? `loans.due_date` is a calendar date stored as midnight UTC, with no
// time and no timezone. Read as an instant it means "the start of the due day in London", which is
// morning in Manila and Bangkok, so a borrower was told "overdue" the moment their due day began.
//
// The rule used everywhere now: a loan is due on that calendar day in the BORROWER'S timezone and
// becomes overdue only once that day has ended (their local midnight, start of the next day).
//
// The zone is fixed on the loan when it is posted (loans.due_timezone, set by a database trigger from
// the borrower's device time zone, else a booked call's zone, else their usual login country, else
// Manila) and never moves, so the app, the reminders and the team posts all agree. Loans from before
// that column existed fall back to the same resolution here.

export const DEFAULT_TIMEZONE = 'Asia/Manila';

// Country → the zone most of its borrowers live in. Multi-zone countries use the populous one.
const COUNTRY_TIMEZONES: Record<string, string> = {
   PH: 'Asia/Manila',
   TH: 'Asia/Bangkok',
   ID: 'Asia/Jakarta',
   MY: 'Asia/Kuala_Lumpur',
   SG: 'Asia/Singapore',
   VN: 'Asia/Ho_Chi_Minh',
   KH: 'Asia/Phnom_Penh',
   LA: 'Asia/Vientiane',
   MM: 'Asia/Yangon',
   IN: 'Asia/Kolkata',
   BD: 'Asia/Dhaka',
   PK: 'Asia/Karachi',
   NP: 'Asia/Kathmandu',
   LK: 'Asia/Colombo',
   HK: 'Asia/Hong_Kong',
   MO: 'Asia/Macau',
   TW: 'Asia/Taipei',
   CN: 'Asia/Shanghai',
   JP: 'Asia/Tokyo',
   KR: 'Asia/Seoul',
   AU: 'Australia/Sydney',
   NZ: 'Pacific/Auckland',
   AE: 'Asia/Dubai',
   SA: 'Asia/Riyadh',
   QA: 'Asia/Qatar',
   KW: 'Asia/Kuwait',
   GB: 'Europe/London',
   IE: 'Europe/Dublin',
   DE: 'Europe/Berlin',
   FR: 'Europe/Paris',
   ES: 'Europe/Madrid',
   IT: 'Europe/Rome',
   NL: 'Europe/Amsterdam',
   US: 'America/New_York',
   CA: 'America/Toronto',
   NG: 'Africa/Lagos',
   KE: 'Africa/Nairobi',
   ZA: 'Africa/Johannesburg'
};

export const isValidTimezone = (zone: string | null | undefined): zone is string => {
   if (!zone) return false;
   try {
      new Intl.DateTimeFormat('en-US', { timeZone: zone });
      return true;
   } catch {
      return false;
   }
};

// UTC/GMT/Etc on a phone or laptop almost always means "never set", not where someone is. Same rule
// as app_private.is_usable_timezone in the database.
export const isUsableTimezone = (zone: string | null | undefined): zone is string =>
   isValidTimezone(zone) &&
   !/^(utc|gmt|etc\/|zulu|universal|uct|posix|right\/|factory|localtime|systemv\/)/i.test(zone) &&
   /^[A-Za-z]+\/[A-Za-z0-9_+\-/]+$/.test(zone);

/** The zone a loan's due day is measured in: the one saved on the loan, else the borrower's. */
export const loanTimezone = (loan: { due_timezone?: string | null }, borrowerZone: string): string =>
   isUsableTimezone(loan.due_timezone) ? loan.due_timezone : borrowerZone;

/** How far a claimed zone may sit from the login country's before we use the country's instead. */
export const MAX_ZONE_DRIFT_HOURS = 3;

/**
 * Best known zone for a borrower. Never throws; always returns a valid IANA zone. The saved (device)
 * zone wins unless it's more than 3 hours from the country they usually log in from, so a borrower
 * can't stretch their deadline by picking a far-west zone. Same rule as app_private.resolve_user_timezone.
 */
export const resolveTimezone = (
   savedZone: string | null | undefined,
   countryIso: string | null | undefined,
   now: Date = new Date(),
   // A new borrower has no usual country yet: their latest login's country, for the 3-hour check only.
   latestCountryIso?: string | null
): string => {
   const fromCountry = COUNTRY_TIMEZONES[(countryIso ?? '').toUpperCase()];
   const checkZone = fromCountry ?? COUNTRY_TIMEZONES[(latestCountryIso ?? '').toUpperCase()];
   if (isUsableTimezone(savedZone)) {
      if (!checkZone) return savedZone;
      const drift = Math.abs(zoneOffsetMs(now, savedZone) - zoneOffsetMs(now, checkZone));
      if (drift <= MAX_ZONE_DRIFT_HOURS * 60 * 60 * 1000) return savedZone;
   }
   return checkZone ?? DEFAULT_TIMEZONE;
};

// Offset (ms) of `zone` from UTC at the instant `at`: positive east of Greenwich.
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

/** The instant that is 00:00 on calendar date y-m-d in `zone` (month is 1-12, day may overflow). */
export const zonedMidnightUtc = (year: number, month: number, day: number, zone: string): Date => {
   const naive = Date.UTC(year, month - 1, day);
   // The offset can differ between the naive guess and the real instant around a DST change; two
   // passes settle it.
   let instant = naive - zoneOffsetMs(new Date(naive), zone);
   instant = naive - zoneOffsetMs(new Date(instant), zone);
   return new Date(instant);
};

/**
 * The due day as an instant range in the borrower's zone: `start` is 00:00 on the due date,
 * `end` is 00:00 on the next day. The loan is overdue from `end` onward. The due date is read
 * as its calendar date in UTC, which is how it was written (midnight UTC).
 */
export const dueDayBounds = (dueDate: string | Date, zone: string): { start: Date; end: Date } => {
   const due = new Date(dueDate);
   const year = due.getUTCFullYear();
   const month = due.getUTCMonth() + 1;
   const day = due.getUTCDate();
   return {
      start: zonedMidnightUtc(year, month, day, zone),
      end: zonedMidnightUtc(year, month, day + 1, zone)
   };
};

/** Hour of day (0-23) at `at` in `zone`, for "don't message people in the middle of the night". */
export const localHour = (at: Date, zone: string): number => {
   const hour = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', hour: 'numeric' }).format(at);
   return Number(hour);
};

// Reminders wait until this local hour so a "due today" push never lands at 2 AM.
export const QUIET_HOURS_END = 7;

/** "11:59 PM Fri, Oct 2 (Manila)": the exact moment a loan becomes overdue, for people to read. */
export const formatDeadline = (dueDate: string | Date, zone: string): string => {
   const { end } = dueDayBounds(dueDate, zone);
   const lastMinute = new Date(end.getTime() - 60_000);
   const when = lastMinute.toLocaleString('en-US', {
      timeZone: zone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
   });
   const city = zone.split('/').pop()?.replace(/_/g, ' ') ?? zone;
   return `${when} (${city})`;
};

const cityOf = (zone: string) => zone.split('/').pop()?.replace(/_/g, ' ') ?? zone;

const clockIn = (instant: Date, zone: string, withDay: boolean) =>
   instant.toLocaleString('en-US', {
      timeZone: zone,
      ...(withDay ? { weekday: 'short', month: 'short', day: 'numeric' } : {}),
      hour: 'numeric',
      minute: '2-digit'
   });

/**
 * For the team (Telegram / Discord): the deadline on the borrower's clock, then on the team's.
 * "Wed, Sep 30, 11:59 PM their time (Manila) · 10:59 PM Bangkok time". Says it once when both
 * clocks read the same, and names the day on the team side when it falls on a different date.
 */
export const formatDeadlineForTeam = (dueDate: string | Date, borrowerZone: string, teamZone: string): string => {
   const lastMinute = new Date(dueDayBounds(dueDate, borrowerZone).end.getTime() - 60_000);
   const theirs = `${clockIn(lastMinute, borrowerZone, true)} their time (${cityOf(borrowerZone)})`;
   if (!isValidTimezone(teamZone) || clockIn(lastMinute, teamZone, true) === clockIn(lastMinute, borrowerZone, true)) {
      return theirs;
   }
   const sameDay =
      lastMinute.toLocaleDateString('en-US', { timeZone: teamZone }) === lastMinute.toLocaleDateString('en-US', { timeZone: borrowerZone });
   return `${theirs} · ${clockIn(lastMinute, teamZone, !sameDay)} ${cityOf(teamZone)} time`;
};

/**
 * The moment a loan is past due: the LATER of the end of its due day in `zone` and due_date + 24h.
 * Same as app_private.loan_past_due_at and the app's getLoanPastDueAt (Manila: 8 AM the next day).
 */
export const pastDueAt = (dueDate: string | Date, zone: string): Date =>
   new Date(Math.max(dueDayBounds(dueDate, zone).end.getTime(), new Date(dueDate).getTime() + 24 * 60 * 60 * 1000));

/** For the team: when the loan becomes overdue, on the borrower's clock and the team's. */
export const formatPastDueForTeam = (dueDate: string | Date, borrowerZone: string, teamZone: string): string => {
   const at = pastDueAt(dueDate, borrowerZone);
   const theirs = `${clockIn(at, borrowerZone, true)} their time (${cityOf(borrowerZone)})`;
   if (!isValidTimezone(teamZone) || clockIn(at, teamZone, true) === clockIn(at, borrowerZone, true)) {
      return theirs;
   }
   const sameDay = at.toLocaleDateString('en-US', { timeZone: teamZone }) === at.toLocaleDateString('en-US', { timeZone: borrowerZone });
   return `${theirs} · ${clockIn(at, teamZone, !sameDay)} ${cityOf(teamZone)} time`;
};

