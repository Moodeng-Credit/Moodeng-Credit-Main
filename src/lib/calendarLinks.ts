/**
 * Add-to-calendar links: a prefilled Google Calendar URL (Android, desktop) and a downloadable .ics
 * (iPhone, Mac). Neither needs an email on the account: both open the phone's own calendar.
 */
export interface CalendarEvent {
   title: string;
   details: string;
   start: Date;
   minutes: number;
   /** Extra alerts before the start, in minutes (.ics only; Google uses the person's default alert). */
   alertsMinutesBefore?: number[];
}

const stamp = (date: Date) =>
   date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');

export const buildCalendarLinks = (event: CalendarEvent): { google: string; ics: string } => {
   const end = new Date(event.start.getTime() + event.minutes * 60_000);
   const google =
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}` +
      `&dates=${stamp(event.start)}/${stamp(end)}&details=${encodeURIComponent(event.details)}`;
   const alarms = (event.alertsMinutesBefore ?? [0]).flatMap((minutes) => [
      'BEGIN:VALARM',
      `TRIGGER:-PT${minutes}M`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${event.title}`,
      'END:VALARM'
   ]);
   const ics = `data:text/calendar;charset=utf8,${encodeURIComponent(
      [
         'BEGIN:VCALENDAR',
         'VERSION:2.0',
         'BEGIN:VEVENT',
         `DTSTART:${stamp(event.start)}`,
         `DTEND:${stamp(end)}`,
         `SUMMARY:${event.title}`,
         `DESCRIPTION:${event.details}`,
         ...alarms,
         'END:VEVENT',
         'END:VCALENDAR'
      ].join('\n')
   )}`;
   return { google, ics };
};

/** Apple devices open an .ics in Calendar; everything else gets the Google link. */
export const prefersIcsCalendar = (userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean =>
   /iPhone|iPad|iPod|Macintosh/.test(userAgent);
