import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { CalendarPlus, CheckCircle, Globe } from 'lucide-react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// The no-referral-code gate: a borrower with nobody at Moodeng to vouch for them has to SCHEDULE a
// short video call with the Moodeng team before they can post a loan request. LoanRequestModal only
// renders this step when there's no applied referral code.
//
// Free round-robin: the calcom-round-robin edge function reads both hosts' open Cal.com slots,
// merges them, and books whoever's free — so this screen shows ONE anonymous "Moodeng team" time
// list, never an individual. The booking is created and confirmed server-side (the function stamps
// users.video_call_scheduled_at), so the client can't fake it.

type Phase = 'loading' | 'picking' | 'scheduled' | 'error';

const RR_FN = 'calcom-round-robin';

export default function VideoCallStep({
   userId,
   onBack,
   onContinue,
   intro = 'No referral code — book a call.',
   continueLabel = 'Continue',
   requireUpcoming = false,
   host,
   onBooked
}: {
   userId: string;
   onBack: () => void;
   onContinue: () => void;
   intro?: ReactNode;
   continueLabel?: string;
   // Call flow (ConnectStep): only a call that's still ahead counts — after a no-show the old,
   // past booking must not show as "booked", or the borrower could never pick a new time.
   requireUpcoming?: boolean;
   // Pin the call to one host — referred borrowers book Emma for their local-exchange setup.
   host?: 'emma' | 'george';
   // Called right after a successful booking (ConnectStep sends the request to the team then, so
   // closing the app straight after booking can't leave a call with no request behind it).
   onBooked?: () => void;
}) {
   const timeZone = useMemo(() => {
      try {
         return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      } catch {
         return 'UTC';
      }
   }, []);

   // A friendly label for the detected zone, e.g. "Bangkok (GMT+7)" — same reassurance Calendly
   // gives so the borrower knows the times are in THEIR local time, not ours.
   const tzLabel = useMemo(() => {
      try {
         const offset =
            new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
               .formatToParts(new Date())
               .find((part) => part.type === 'timeZoneName')?.value ?? '';
         const city = timeZone.split('/').pop()?.replace(/_/g, ' ') ?? timeZone;
         return offset ? `${city} (${offset})` : city;
      } catch {
         return timeZone;
      }
   }, [timeZone]);

   const [phase, setPhase] = useState<Phase>('loading');
   const [slots, setSlots] = useState<string[]>([]);
   const [bookingStart, setBookingStart] = useState<string | null>(null);
   const [bookedStartsAt, setBookedStartsAt] = useState<string | null>(null);
   const [notice, setNotice] = useState('');

   const loadSlots = async () => {
      const { data, error } = await getSupabaseBrowserClient().functions.invoke(RR_FN, { body: { action: 'slots', timeZone, host } });
      if (error || !data) {
         setPhase('error');
         return;
      }
      setSlots((data as { slots?: string[] }).slots ?? []);
      setPhase('picking');
   };

   // On open: if the webhook/booking already confirmed a call on a previous visit, skip straight to
   // the booked state; otherwise load available times.
   useEffect(() => {
      let cancelled = false;
      (async () => {
         const { data } = await getSupabaseBrowserClient()
            .from('users')
            .select('video_call_scheduled_at, video_call_starts_at')
            .eq('id', userId)
            .maybeSingle();
         if (cancelled) return;
         const isPast = data?.video_call_starts_at ? Date.parse(data.video_call_starts_at) < Date.now() : true;
         if (data?.video_call_scheduled_at && !(requireUpcoming && isPast)) {
            setBookedStartsAt(data.video_call_starts_at);
            setPhase('scheduled');
            return;
         }
         await loadSlots();
      })();
      return () => {
         cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [userId]);

   const book = async (start: string) => {
      if (bookingStart) return;
      setBookingStart(start);
      setNotice('');
      const { data, error } = await getSupabaseBrowserClient().functions.invoke(RR_FN, { body: { action: 'book', start, timeZone, host } });
      setBookingStart(null);

      const result = data as { ok?: boolean; start?: string; error?: string } | null;
      if (error || !result?.ok) {
         if (result?.error === 'slot_taken') {
            setNotice('That time was just taken — pick another, please.');
            await loadSlots();
         } else {
            setNotice("Couldn't book that time. Try again, or contact support.");
         }
         return;
      }
      setBookedStartsAt(result.start ?? start);
      setPhase('scheduled');
      onBooked?.();
   };

   const dayGroups = useMemo(() => {
      const map = new Map<string, string[]>();
      for (const s of slots) {
         const key = new Date(s).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone });
         if (!map.has(key)) map.set(key, []);
         map.get(key)?.push(s);
      }
      return [...map.entries()];
   }, [slots, timeZone]);

   const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone });
   const formattedBooked = bookedStartsAt
      ? new Date(bookedStartsAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone })
      : null;

   // Add-to-calendar links for the booked slot, so the call lands in the borrower's own calendar
   // (with its native reminder) instead of only living in an email they might miss. Google gets a
   // prefilled template URL; everyone else gets a downloadable .ics. 15-min block matches the event.
   const calendarLinks = useMemo(() => {
      if (!bookedStartsAt) return null;
      const start = new Date(bookedStartsAt);
      if (Number.isNaN(start.getTime())) return null;
      const end = new Date(start.getTime() + 15 * 60000);
      const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const title = 'Moodeng video call';
      const details = 'Your short video hello with the Moodeng team — see how Moodeng works and ask anything.';
      const google =
         `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}` +
         `&dates=${stamp(start)}/${stamp(end)}&details=${encodeURIComponent(details)}`;
      const ics = `data:text/calendar;charset=utf8,${encodeURIComponent(
         ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${title}`, `DESCRIPTION:${details}`, 'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\n')
      )}`;
      return { google, ics };
   }, [bookedStartsAt]);

   const isScheduled = phase === 'scheduled';

   return (
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-5 text-md-b2 text-md-heading">
         {typeof intro === 'string' ? <p className="text-[13px] font-normal leading-[18px] text-md-neutral-1200">{intro}</p> : intro}

         {isScheduled ? (
            <div className="flex flex-col gap-3">
               <div className="flex items-start gap-1.5 rounded-md-md bg-[#eefbf2] px-md-2 py-md-1 text-md-b3 font-normal text-[#178447]">
                  <CheckCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                  <span>
                     You're booked with {host === 'emma' ? 'Emma' : 'the Moodeng team'}{formattedBooked ? ` — ${formattedBooked}` : ''}. We'll email you the details and remind
                     you on Messenger before it starts.
                  </span>
               </div>
               {calendarLinks ? (
                  <div className="flex flex-col gap-2">
                     <span className="text-[12px] font-normal text-md-neutral-1200">Add it to your calendar so you don't miss it:</span>
                     <div className="flex flex-wrap gap-2">
                        <a
                           className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-[#ded6e8] bg-white px-3 py-2 text-[13px] font-medium text-md-heading transition hover:border-md-primary-900 active:scale-[0.98]"
                           href={calendarLinks.google}
                           rel="noreferrer"
                           target="_blank"
                        >
                           <CalendarPlus aria-hidden="true" className="h-4 w-4 shrink-0 text-md-primary-900" strokeWidth={2} />
                           Google Calendar
                        </a>
                        <a
                           className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-[#ded6e8] bg-white px-3 py-2 text-[13px] font-medium text-md-heading transition hover:border-md-primary-900 active:scale-[0.98]"
                           download="moodeng-call.ics"
                           href={calendarLinks.ics}
                        >
                           <CalendarPlus aria-hidden="true" className="h-4 w-4 shrink-0 text-md-primary-900" strokeWidth={2} />
                           Apple / Outlook
                        </a>
                     </div>
                  </div>
               ) : null}
            </div>
         ) : phase === 'loading' ? (
            <p className="text-[13px] font-normal text-md-neutral-1200">Loading available times…</p>
         ) : phase === 'error' ? (
            <div className="flex flex-col gap-2">
               <p className="text-md-b3 font-normal text-md-red-500">Couldn't load available times.</p>
               <button className="w-fit text-[13px] font-medium text-md-primary-1200 underline" onClick={loadSlots} type="button">
                  Try again
               </button>
            </div>
         ) : dayGroups.length === 0 ? (
            <p className="text-[13px] font-normal text-md-neutral-1200">
               No times are open in the next two weeks. Please contact support and we'll sort out a time.
            </p>
         ) : (
            <div className="flex flex-col gap-4">
               <div className="flex items-center gap-1.5 text-[12px] font-normal leading-[16px] text-md-neutral-1200">
                  <Globe aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-md-primary-900" strokeWidth={2} />
                  <span>
                     Times shown in your time zone — <span className="font-[590] text-md-heading">{tzLabel}</span>
                  </span>
               </div>
               {notice ? <p className="text-md-b3 font-normal text-md-red-500">{notice}</p> : null}
               {dayGroups.map(([day, daySlots]) => (
                  <div className="flex flex-col gap-2" key={day}>
                     <span className="text-[13px] font-[590] text-md-heading">{day}</span>
                     <div className="grid grid-cols-3 gap-2">
                        {daySlots.map((s) => (
                           <button
                              className="min-h-[44px] rounded-[10px] border border-[#ded6e8] bg-white px-2 py-2 text-[13px] font-medium text-md-heading transition hover:border-md-primary-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={bookingStart !== null}
                              key={s}
                              onClick={() => book(s)}
                              type="button"
                           >
                              {bookingStart === s ? 'Booking…' : timeLabel(s)}
                           </button>
                        ))}
                     </div>
                  </div>
               ))}
            </div>
         )}

         <div className="mt-auto flex flex-col gap-2">
            <button
               className={`w-full rounded-md-lg px-md-4 py-md-3 text-md-b1 font-medium text-md-neutral-100 ${
                  isScheduled ? 'bg-md-primary-1200 transition duration-150 ease-out hover:bg-[#5200c8] active:scale-[0.98]' : 'bg-md-neutral-600'
               }`}
               disabled={!isScheduled}
               onClick={() => isScheduled && onContinue()}
               type="button"
            >
               {isScheduled ? continueLabel : 'Book a time to continue'}
            </button>
            <button
               className="w-full rounded-md-lg px-md-4 py-md-2 text-md-b2 font-medium text-md-neutral-1200 transition duration-150 ease-out hover:text-md-heading"
               onClick={onBack}
               type="button"
            >
               Back
            </button>
         </div>
      </div>
   );
}
