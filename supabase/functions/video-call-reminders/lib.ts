// Pure timing rules for video-call-reminders, split out so they're unit-testable.

// How far ahead a booking must be for the day-before reminder to add anything. Booked closer than
// this, the booking confirmation itself is the "coming up" message.
export const DAY_BEFORE_MIN_LEAD_HOURS = 20;

// True when the call was booked less than DAY_BEFORE_MIN_LEAD_HOURS before it starts — then the
// day-before rung is skipped (the confirmation just went out). Unknown booking time → don't skip.
export const skipsDayBeforeReminder = (scheduledAtIso: string | null, startsAtMs: number): boolean => {
   const bookedAt = scheduledAtIso ? Date.parse(scheduledAtIso) : NaN;
   if (Number.isNaN(bookedAt) || Number.isNaN(startsAtMs)) return false;
   return startsAtMs - bookedAt < DAY_BEFORE_MIN_LEAD_HOURS * 60 * 60 * 1000;
};
