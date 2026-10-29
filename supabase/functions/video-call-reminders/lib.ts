// Pure timing rules for video-call-reminders, split out so they're unit-testable.
//
// One booking walks this ladder once (users.video_call_reminder_stage, reset on every new time):
//
//   DAY          ≤ 24h before   "coming up" nudge (skipped if booked < 20h ahead — the booking
//                               confirmation just went out)
//   CONFIRM      ≤ 1h before    unconfirmed: "Tap ✅ I'll be there in the next 30 min or the call is
//                               cancelled" (the booking confirmation + page told them to expect it);
//                               already confirmed / booked under 75 min ahead: "starts in under an hour"
//   RELEASE      ≤ 30 min before still unconfirmed after that ask → call cancelled, slot freed
//   STARTING     ≤ 5 min before "Starting now 👋 tap to join" (skipped if Zoom already saw them);
//                               admins get the Showed up / No-show card now, to decide right after
//   WAITING      ≥ 3 min after  Zoom wired up and hasn't seen them: "We're ready for you!"
//   PROMPT       ≥ 20 min after still undecided: admins re-asked "Did Maria show up?" + Zoom evidence
//   AUTO_NO_SHOW ≥ 60 min after Zoom wired up, never saw them, nobody tapped → no-show recorded
//
// A tick only acts on the highest rung a booking has reached, so a late first tick (deploy, cron
// hiccup) never fires a burst of stale messages.

export const RUNG = {
   NONE: 0,
   DAY: 1,
   CONFIRM: 2,
   RELEASE: 3,
   STARTING: 4,
   WAITING: 5,
   PROMPT: 6,
   AUTO_NO_SHOW: 7
} as const;
export type Rung = (typeof RUNG)[keyof typeof RUNG];

// The confirm window: the ✅ button goes out 1h before; no tap by 30 min before → cancelled.
// The borrower page (ConnectStep) mirrors these numbers.
export const CONFIRM_OPENS_MIN = 60;
export const CONFIRM_CLOSES_MIN = 30;

// minutesUntil: minutes from now to the call's start (negative once it has started).
export const targetRung = (minutesUntil: number): Rung => {
   if (minutesUntil <= -60) return RUNG.AUTO_NO_SHOW;
   if (minutesUntil <= -20) return RUNG.PROMPT;
   if (minutesUntil <= -3) return RUNG.WAITING;
   if (minutesUntil <= 5) return RUNG.STARTING;
   if (minutesUntil <= CONFIRM_CLOSES_MIN) return RUNG.RELEASE;
   // 65 = the 60-min target plus a cron tick of slack, so the ask is never skipped.
   if (minutesUntil <= CONFIRM_OPENS_MIN + 5) return RUNG.CONFIRM;
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

// Booked under 75 min ahead: they booked inside (or right before) the confirm window, so the
// booking itself is the confirmation — no ask, and nothing to cancel.
export const skipsConfirmAsk = (scheduledAtIso: string | null, startsAtMs: number): boolean =>
   leadMs(scheduledAtIso, startsAtMs) < 75 * 60 * 1000;

// Release an unconfirmed slot only when the confirm ask was made (video_call_keep_spot_asked_at).
export const shouldReleaseSlot = (u: {
   video_call_confirmed_at: string | null;
   video_call_keep_spot_asked_at: string | null;
   video_call_booking_uid: string | null;
}): boolean => !u.video_call_confirmed_at && Boolean(u.video_call_keep_spot_asked_at) && Boolean(u.video_call_booking_uid);

// WhatsApp fallback for the 1h ✅ ask, for borrowers Messenger can't reach (outside its 24h window).
// WhatsApp only allows approved templates there, so this is `moodeng_call_confirm` (Utility):
//   body   "Hi {{1}}, your Moodeng video call is in 1 hour ({{2}}). Tap the button below within 30
//           minutes to confirm you're coming, or the call is cancelled automatically."
//   button URL ".../functions/v1/video-call-confirm?t={{1}}" (the confirm token)
// Switch: telegram_bot_settings `call_confirm_whatsapp_enabled`, off until Meta approves the template.
export const CALL_CONFIRM_TEMPLATE = 'moodeng_call_confirm';
export const CALL_CONFIRM_WHATSAPP_SETTING_KEY = 'call_confirm_whatsapp_enabled';

export const buildCallConfirmTemplate = (name: string | null | undefined, at: string, confirmToken: string) => ({
   name: CALL_CONFIRM_TEMPLATE,
   language: { code: 'en' },
   components: [
      { type: 'body' as const, parameters: [{ type: 'text' as const, text: name?.trim() || 'there' }, { type: 'text' as const, text: at }] },
      { type: 'button' as const, sub_type: 'url' as const, index: '0', parameters: [{ type: 'text' as const, text: confirmToken }] }
   ]
});
