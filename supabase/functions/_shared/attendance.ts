// Zoom attendance for borrower video calls — shared by zoom-webhook (records arrivals),
// video-call-reminders (nudges + auto no-show) and videoCallOutcome (the "did they show up?" card).
//
// Nobody joins the call to watch: Zoom itself tells zoom-webhook when a participant enters the
// waiting room / the meeting / leaves, and we match the meeting id to the booking. Hosts no longer
// sit in empty rooms — they get "🟢 Maria is in the waiting room" and join then.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// Zoom join links look like https://us06web.zoom.us/j/81234567890?pwd=… (or /w/…, or ?confno=…).
// Anything else (Cal Video, Meet) → null: no Zoom tracking for that booking.
export const meetingIdFromJoinUrl = (url?: string | null): string | null => {
   if (!url || !/zoom\.(us|com)/i.test(url)) return null;
   const match = url.match(/\/(?:j|w|s)\/(\d{9,12})/) ?? url.match(/[?&]confno=(\d{9,12})/);
   return match ? match[1] : null;
};

// Zoom counts as "wired up" for a host once their Zoom app has delivered a signed event recently.
// Until then nothing is inferred from silence — a missing webhook must never turn every borrower
// into a no-show.
const SEEN_KEY = (host: string) => `zoom_seen:${host}`;
export const ZOOM_ACTIVE_DAYS = 14;

export const markZoomSeen = async (svc: SupabaseClient, host: string) => {
   const { error } = await svc
      .from('telegram_bot_settings')
      .upsert({ key: SEEN_KEY(host), value: new Date().toISOString() }, { onConflict: 'key' });
   if (error) console.error('attendance: markZoomSeen failed', error.message);
};

export const isZoomActive = (lastSeenIso: string | null | undefined, now: number): boolean => {
   const seen = lastSeenIso ? Date.parse(lastSeenIso) : NaN;
   return !Number.isNaN(seen) && now - seen < ZOOM_ACTIVE_DAYS * 86400000;
};

export const zoomActiveForHost = async (svc: SupabaseClient, host: string | null | undefined): Promise<boolean> => {
   if (!host) return false;
   const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', SEEN_KEY(host)).maybeSingle();
   return isZoomActive((data as { value?: string } | null)?.value, Date.now());
};

export type AttendanceFields = {
   video_call_starts_at: string | null;
   video_call_meeting_id?: string | null;
   video_call_arrived_at?: string | null;
   video_call_joined_at?: string | null;
   video_call_left_at?: string | null;
};

export const ATTENDANCE_COLUMNS = 'video_call_host, video_call_meeting_id, video_call_arrived_at, video_call_joined_at, video_call_left_at';

const bkkClock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour: 'numeric', minute: '2-digit' });

// One line of evidence for the admins' "did they show up?" card, or null when there's none to give
// (not a Zoom booking, or Zoom not wired up — then silence means nothing).
export const describeAttendance = (u: AttendanceFields, zoomActive: boolean): string | null => {
   if (u.video_call_joined_at) {
      const joined = Date.parse(u.video_call_joined_at);
      const start = u.video_call_starts_at ? Date.parse(u.video_call_starts_at) : NaN;
      const lateMin = Number.isNaN(start) ? 0 : Math.round((joined - start) / 60000);
      const late = lateMin >= 2 ? ` (${lateMin} min late)` : '';
      const left = u.video_call_left_at ? Date.parse(u.video_call_left_at) : NaN;
      const stayed =
         !Number.isNaN(left) && left > joined ? `stayed ${Math.max(1, Math.round((left - joined) / 60000))} min` : 'still in the call';
      return `✅ Zoom: joined ${bkkClock(u.video_call_joined_at)}${late}, ${stayed}.`;
   }
   if (u.video_call_arrived_at) {
      return `🟡 Zoom: reached the waiting room at ${bkkClock(u.video_call_arrived_at)} but never got into the call.`;
   }
   if (zoomActive && u.video_call_meeting_id) return '❌ Zoom: never joined.';
   return null;
};

// Fresh booking / moved time → forget the last call's attendance.
export const ATTENDANCE_RESET = {
   video_call_arrived_at: null,
   video_call_joined_at: null,
   video_call_left_at: null,
   video_call_keep_spot_asked_at: null
};
