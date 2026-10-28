// "📅 Add to my calendar" for the borrower video call: the phone's own calendar then reminds them
// 1 hour and 15 minutes before, with the ✅ confirm link and the Zoom link in the event — so the
// reminder reaches them even when Messenger's 24h window has closed. Served by video-call-confirm
// (?ics=<confirm token>): an .ics file for iPhone and desktop, a Google Calendar link for Android
// (the Google Calendar app can't open .ics files).

export const CALL_MINUTES_ON_CALENDAR = 15;

/** A ✅ tap from the calendar only counts this close to the call; earlier taps just say "come back". */
export const CALENDAR_CONFIRM_OPENS_MIN = 120;

export type CallCalendarEvent = {
   uid: string;
   startsAt: string;
   joinUrl: string | null;
   confirmUrl: string;
};

const TITLE = 'Moodeng video call — tap ✅ to confirm';

const description = (e: CallCalendarEvent) =>
   [
      "1 hour before: tap the link below to confirm you're coming, or the call is cancelled automatically.",
      `✅ I'll be there: ${e.confirmUrl}`,
      e.joinUrl ? `🎥 Join on Zoom: ${e.joinUrl}` : 'The Zoom link is in your email.',
      'Have your original ID or passport ready.'
   ].join('\n\n');

// iCalendar UTC stamp: 20261030T120000Z.
const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// RFC 5545 text escaping, then lines folded at 75 octets (continuation lines start with a space).
const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line: string) => {
   const bytes = new TextEncoder().encode(line);
   if (bytes.length <= 75) return line;
   const parts: string[] = [];
   let current = '';
   let size = 0;
   for (const ch of line) {
      const n = new TextEncoder().encode(ch).length;
      if (size + n > (parts.length ? 74 : 75)) {
         parts.push(current);
         current = '';
         size = 0;
      }
      current += ch;
      size += n;
   }
   parts.push(current);
   return parts.join('\r\n ');
};

const alarm = (minutes: number) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(TITLE)}`, `TRIGGER:-PT${minutes}M`, 'END:VALARM'];

export const buildCallIcs = (e: CallCalendarEvent, now = Date.now()): string => {
   const start = Date.parse(e.startsAt);
   return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Moodeng Credit//Video call//EN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${e.uid}@moodeng.app`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(start + CALL_MINUTES_ON_CALENDAR * 60_000)}`,
      `SUMMARY:${escapeText(TITLE)}`,
      `DESCRIPTION:${escapeText(description(e))}`,
      `URL:${e.confirmUrl}`,
      ...(e.joinUrl ? [`LOCATION:${escapeText(e.joinUrl)}`] : []),
      ...alarm(60),
      ...alarm(15),
      'END:VEVENT',
      'END:VCALENDAR'
   ]
      .map(fold)
      .join('\r\n')
      .concat('\r\n');
};

/** Google Calendar's "add event" page (Android). It uses the person's default reminders. */
export const googleCalendarUrl = (e: CallCalendarEvent): string => {
   const start = Date.parse(e.startsAt);
   const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: TITLE,
      dates: `${stamp(start)}/${stamp(start + CALL_MINUTES_ON_CALENDAR * 60_000)}`,
      details: description(e),
      ...(e.joinUrl ? { location: e.joinUrl } : {})
   });
   return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const isAndroid = (userAgent: string | null | undefined) => /android/i.test(userAgent ?? '');
