// Pure timing rules for video-call-reminders, split out so they're unit-testable.
//
// One booking walks this ladder once (users.video_call_reminder_stage, reset on every new time):
//
//   DAY          ≤ 24h before   "coming up" nudge (skipped if booked < 20h ahead — the booking
//                               confirmation just went out)
//   KEEP_SPOT    ≤ 2h before    unconfirmed only: "Still coming? Tap to keep your spot"
//   HOUR         ≤ ~1h before   unconfirmed + asked above → slot released; otherwise "starts in
//                               under an hour"
//   STARTING     ≤ 5 min before "Starting now 👋 tap to join" (skipped if Zoom already saw them)
//   WAITING      ≥ 3 min after  Zoom wired up and hasn't seen them: "We're ready for you!"
//   PROMPT       ≥ 20 min after admins: "Did Maria show up?" with the Zoom evidence
//   AUTO_NO_SHOW ≥ 60 min after Zoom wired up, never saw them, nobody tapped → no-show recorded
//
// A tick only acts on the highest rung a booking has reached, so a late first tick (deploy, cron
// hiccup) never fires a burst of stale messages.

export const RUNG = {
   NONE: 0,
   DAY: 1,
   KEEP_SPOT: 2,
   HOUR: 3,
   STARTING: 4,
   WAITING: 5,
   PROMPT: 6,
   AUTO_NO_SHOW: 7
} as const;
export type Rung = (typeof RUNG)[keyof typeof RUNG];

// minutesUntil: minutes from now to the call's start (negative once it has started).
export const targetRung = (minutesUntil: number): Rung => {
   if (minutesUntil <= -60) return RUNG.AUTO_NO_SHOW;
   if (minutesUntil <= -20) return RUNG.PROMPT;
   if (minutesUntil <= -3) return RUNG.WAITING;
   if (minutesUntil <= 5) return RUNG.STARTING;
   // 70 = the 60-min target plus a cron tick of slack, so "under an hour" is never skipped.
   if (minutesUntil <= 70) return RUNG.HOUR;
   if (minutesUntil <= 125) return RUNG.KEEP_SPOT;
   if (minutesUntil <= 24 * 60) return RUNG.DAY;
   return RUNG.NONE;
};

const leadMs = (scheduledAtIso: string | null, startsAtMs: number): number => {
   const bookedAt = scheduledAtIso ? Date.parse(scheduledAtIso) : NaN;
   return Number.isNaN(bookedAt) || Number.isNaN(startsAtMs) ? Infinity : startsAtMs - bookedAt;
};

// How far ahead a booking must be for the day-before reminder to add anything. Booked closer than
// this, the booking confirmation itself is the "coming up" message.
export const DAY_BEFORE_MIN_LEAD_HOURS = 20;

// True when the call was booked less than DAY_BEFORE_MIN_LEAD_HOURS before it starts — then the
// day-before rung is skipped (the confirmation just went out). Unknown booking time → don't skip.
export const skipsDayBeforeReminder = (scheduledAtIso: string | null, startsAtMs: number): boolean =>
   leadMs(scheduledAtIso, startsAtMs) < DAY_BEFORE_MIN_LEAD_HOURS * 60 * 60 * 1000;

// Booked less than 3h ahead: they only just saw the "Will you make it?" button in the booking
// confirmation — asking again (and releasing the slot over it) would be pushy.
export const skipsKeepSpot = (scheduledAtIso: string | null, startsAtMs: number): boolean =>
   leadMs(scheduledAtIso, startsAtMs) < 3 * 60 * 60 * 1000;

// Release an unconfirmed slot only when the "keep your spot" ask verifiably reached them.
export const shouldReleaseSlot = (u: {
   video_call_confirmed_at: string | null;
   video_call_keep_spot_asked_at: string | null;
   video_call_booking_uid: string | null;
}): boolean => !u.video_call_confirmed_at && Boolean(u.video_call_keep_spot_asked_at) && Boolean(u.video_call_booking_uid);
