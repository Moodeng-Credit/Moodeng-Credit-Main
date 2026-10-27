// Cal.com availability for the borrower video call: the team's open hours, each host's "Video
// interview" event type, and its free slots. Shared by calcom-round-robin (the borrower's booking
// page) and telegram-webhook (the team's 🔄 Change time picker), so both offer the same times.

export const CAL_BASE = 'https://api.cal.com/v2';
export const EVENT_SLUG = '15min'; // both hosts' "Video interview" events use this slug

export const hostApiKey = (host: string | null | undefined) => (host ? Deno.env.get(`CALCOM_API_KEY_${host.toUpperCase()}`) ?? '' : '');

// Open hours come from each host's Cal.com schedule alone — Emma's is copied from her Calendly every
// night (calcom-round-robin sync_calendly_hours), so there's no second, hard-coded list here.
export const CALL_MINUTES = 15;
export const CALL_TIME_ZONE = 'Asia/Bangkok';

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
      for (const slot of list) if (slot?.start) out.push(slot.start);
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
   // 2026-02-25 first: it takes allowBookingOutOfBounds (the older 2024-08-13 refuses times outside
   // the host's open hours as "not available"). The older one is the fallback.
   for (const version of ['2026-02-25', '2024-08-13']) {
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
         console.error(`calcomSlots: reschedule (${version}) refused`, res.status, lastMessage.slice(0, 300));
         if (msg.includes('no longer available') || msg.includes('already') || msg.includes('busy')) {
            return { error: 'taken', message: lastMessage };
         }
      } catch (err) {
         lastMessage = err instanceof Error ? err.message : String(err);
         console.error('calcomSlots: reschedule threw', lastMessage);
      }
   }
   return { error: 'other', message: lastMessage };
};
