// George's busy times from his own Google Calendar (free/busy only — no event details), so the
// borrower is never offered a time he's already booked outside Moodeng. Read live on every slot list
// and booking re-check. Fails open: if Google can't be reached, the Cal.com times still show.
import { readCallSecret } from './callSecrets.ts';

export type BusyBlock = { start: string; end: string };

// deno-lint-ignore no-explicit-any
export const fetchGeorgeBusy = async (svc: any, fromIso: string, toIso: string): Promise<BusyBlock[]> => {
   const [key, calendarId] = await Promise.all([readCallSecret(svc, 'GOOGLE_CALENDAR_KEY_GEORGE'), readCallSecret(svc, 'GOOGLE_CALENDAR_ID_GEORGE')]);
   if (!key || !calendarId) return [];
   try {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/freeBusy?key=${encodeURIComponent(key)}`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ timeMin: fromIso, timeMax: toIso, items: [{ id: calendarId }] })
      });
      if (!res.ok) {
         console.error('googleBusy: freeBusy failed', res.status);
         return [];
      }
      const body = await res.json();
      const cal = body?.calendars?.[calendarId];
      if (cal?.errors?.length) console.error('googleBusy: calendar errors', JSON.stringify(cal.errors));
      return (cal?.busy ?? []) as BusyBlock[];
   } catch (err) {
      console.error('googleBusy: freeBusy threw', err);
      return [];
   }
};
