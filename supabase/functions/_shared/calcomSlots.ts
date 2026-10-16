// Cal.com availability for the borrower video call: the team's open hours, each host's "Video
// interview" event type, and its free slots. Shared by calcom-round-robin (the borrower's booking
// page) and telegram-webhook (the team's 🔄 Change time picker), so both offer the same times.

export const CAL_BASE = 'https://api.cal.com/v2';
export const EVENT_SLUG = '15min'; // both hosts' "Video interview" events use this slug

export const hostApiKey = (host: string | null | undefined) => (host ? Deno.env.get(`CALCOM_API_KEY_${host.toUpperCase()}`) ?? '' : '');

// When the team takes calls, whatever Cal.com says (George, 2026-10-13, both hosts). Local wall-clock time
// in CALL_TIME_ZONE, by weekday (0 = Sunday). A slot is offered only if the whole call fits inside a
// window, so a 15-minute call can start at 11:45 but not 12:00, and the last one of the night is 22:45.
export const CALL_MINUTES = 15;
export const CALL_TIME_ZONE = 'Asia/Bangkok';
type Window = { from: string; to: string };
const WEEKDAY_HOURS: Window[] = [
   { from: '10:00', to: '12:00' },
   { from: '16:00', to: '23:00' }
];
const OPEN_HOURS: Record<number, Window[]> = {
   0: [{ from: '13:00', to: '23:00' }],
   1: WEEKDAY_HOURS,
   2: WEEKDAY_HOURS,
   3: WEEKDAY_HOURS,
   4: WEEKDAY_HOURS,
   5: WEEKDAY_HOURS,
   6: [
      { from: '09:00', to: '12:00' },
      { from: '13:00', to: '18:00' },
      { from: '21:00', to: '23:00' }
   ]
};

const toMinutes = (hhmm: string) => {
   const [h, m] = hhmm.split(':').map(Number);
   return h * 60 + m;
};
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const localTime = (iso: string) => {
   const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: CALL_TIME_ZONE,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
   }).formatToParts(new Date(iso));
   const value = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
   return { weekday: WEEKDAYS.indexOf(value('weekday')), minutes: Number(value('hour')) * 60 + Number(value('minute')) };
};
export const isOpenSlot = (iso: string) => {
   const { weekday, minutes } = localTime(iso);
   const end = minutes + CALL_MINUTES;
   return (OPEN_HOURS[weekday] ?? []).some((w) => minutes >= toMinutes(w.from) && end <= toMinutes(w.to));
};

// Resolve a host's "Video interview" event type id (slug EVENT_SLUG) from their account.
export const resolveEventTypeId = async (apiKey: string): Promise<number | null> => {
   const res = await fetch(`${CAL_BASE}/event-types`, { headers: { Authorization: `Bearer ${apiKey}` } });
   if (!res.ok) return null;
   const body = await res.json();
   for (const group of body?.data?.eventTypeGroups ?? []) {
      for (const et of group?.eventTypes ?? []) {
         if (et?.slug === EVENT_SLUG) return et.id as number;
      }
   }
   return null;
};

// Flattened list of available start strings for a host between two YMD dates.
export const fetchSlots = async (apiKey: string, eventTypeId: number, start: string, end: string, timeZone: string): Promise<string[]> => {
   const url = `${CAL_BASE}/slots?eventTypeId=${eventTypeId}&start=${start}&end=${end}&timeZone=${encodeURIComponent(timeZone)}`;
   const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}`, 'cal-api-version': '2024-09-04' } });
   if (!res.ok) return [];
   const body = await res.json();
   const days = body?.data ?? {};
   const out: string[] = [];
   for (const list of Object.values(days) as Array<Array<{ start?: string }>>) {
      for (const slot of list) if (slot?.start && isOpenSlot(slot.start)) out.push(slot.start);
   }
   return out;
};


// The Cal.com account email behind a host's API key.
export const fetchAccountEmail = async (apiKey: string): Promise<string | null> => {
   try {
      const res = await fetch(`${CAL_BASE}/me`, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!res.ok) return null;
      const body = await res.json();
      return typeof body?.data?.email === 'string' && body.data.email ? body.data.email : null;
   } catch {
      return null;
   }
};

// Move a booking to a new start with the host's own key. Cal.com makes a new booking (new uid) and
// fires BOOKING_RESCHEDULED, which calcom-webhook turns into the new call. `rescheduledBy` is the
// host's own email so Cal.com confirms it straight away. 'taken' = that time is no longer free.
export const rescheduleCalBooking = async (
   host: string | null | undefined,
   uid: string,
   start: string,
   reason: string
): Promise<{ uid: string } | { error: 'taken' | 'no_key' | 'other'; message?: string }> => {
   const apiKey = hostApiKey(host);
   if (!apiKey) return { error: 'no_key' };
   const rescheduledBy = await fetchAccountEmail(apiKey);
   let lastMessage = '';
   // 2024-08-13 is the version the rest of our Cal.com calls use; the newer one is a fallback.
   for (const version of ['2024-08-13', '2026-02-25']) {
      try {
         const res = await fetch(`${CAL_BASE}/bookings/${encodeURIComponent(uid)}/reschedule`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'cal-api-version': version, 'Content-Type': 'application/json' },
            // allowBookingOutOfBounds: the team may pick outside the host's Cal.com open hours (it is
            // honored for the host's own key; Cal.com still refuses a time the host is busy).
            body: JSON.stringify({ start, reschedulingReason: reason, allowBookingOutOfBounds: true, ...(rescheduledBy ? { rescheduledBy } : {}) })
         });
         const body = await res.json().catch(() => ({}));
         if (res.ok && typeof body?.data?.uid === 'string') return { uid: body.data.uid };
         lastMessage = String(body?.error?.message ?? body?.message ?? res.status);
         const msg = lastMessage.toLowerCase();
         if (msg.includes('no longer available') || msg.includes('already') || msg.includes('busy') || msg.includes('not available')) {
            return { error: 'taken', message: lastMessage };
         }
         console.error(`calcomSlots: reschedule (${version}) failed`, res.status, lastMessage.slice(0, 300));
      } catch (err) {
         lastMessage = err instanceof Error ? err.message : String(err);
         console.error('calcomSlots: reschedule threw', lastMessage);
      }
   }
   return { error: 'other', message: lastMessage };
};
