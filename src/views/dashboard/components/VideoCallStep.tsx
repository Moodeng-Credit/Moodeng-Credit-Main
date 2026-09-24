import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { CalendarPlus, CheckCircle, Globe } from 'lucide-react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { GhostButton, PrimaryButton } from '@/views/dashboard/components/connectKit';

// The no-referral-code gate: a borrower with nobody at Moodeng to vouch for them has to SCHEDULE a
// short video call with the Moodeng team before they can post a loan request. LoanRequestModal only
// renders this step when there's no applied referral code.
//
// Free round-robin: the calcom-round-robin edge function reads both hosts' open Cal.com slots,
// merges them, and books whoever's free — so this screen shows ONE anonymous "Moodeng team" time
// list, never an individual. The booking is created and confirmed server-side (the function stamps
// users.video_call_scheduled_at), so the client can't fake it.

type Phase = 'loading' | 'picking' | 'scheduled' | 'error' | 'cooldown';

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
   // Two missed calls → no new booking until this time (calcom-round-robin enforces it).
   const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);

   const loadSlots = async () => {
      const { data, error } = await getSupabaseBrowserClient().functions.invoke(RR_FN, { body: { action: 'slots', timeZone, host } });
      if (error || !data) {
         setPhase('error');
         return;
      }
      if ((data as { error?: string }).error === 'cooldown') {
         setCooldownUntil((data as { until?: string }).until ?? null);
         setPhase('cooldown');
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

      const result = data as { ok?: boolean; start?: string; error?: string; until?: string } | null;
      if (error || !result?.ok) {
         if (result?.error === 'cooldown') {
            setCooldownUntil(result.until ?? null);
            setPhase('cooldown');
         } else if (result?.error === 'slot_taken') {
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
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-5 text-md-b2 text-md-heading">
         {typeof intro === 'string' ? <p className="text-[14px] font-normal leading-[20px] text-[#7b6b8c]">{intro}</p> : intro}

         {isScheduled ? (
            <div className="flex flex-col gap-3">
               <div className="flex items-center gap-3 rounded-[18px] border-2 border-[#4aa256] bg-[#eefbf2] px-4 py-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#4aa256] text-white">
                     <CheckCircle aria-hidden="true" className="size-6" strokeWidth={2.4} />
                  </span>
                  <span className="flex min-w-0 flex-col text-left">
                     <span className="text-[18px] font-bold leading-[22px] text-[#2f7a3a]">You&apos;re booked with {host === 'emma' ? 'Emma' : 'the Moodeng team'}!</span>
                     {formattedBooked ? <span className="text-[15px] leading-[20px] text-[#3c8248]">{formattedBooked}</span> : null}
                     <span className="text-[13px] leading-[18px] text-[#3c8248]/80">Zoom link by email · reminder on Messenger</span>
                  </span>
               </div>
               {calendarLinks ? (
                  <div className="grid grid-cols-2 gap-2">
                     <a
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border-2 border-[#e2dcee] bg-white px-3 text-[14px] font-semibold text-[#594d65] transition hover:border-[#7661f9] active:scale-[0.98]"
                        href={calendarLinks.google}
                        rel="noreferrer"
                        target="_blank"
                     >
                        <CalendarPlus aria-hidden="true" className="size-4 shrink-0 text-[#6b55f7]" strokeWidth={2} />
                        Google Calendar
                     </a>
                     <a
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border-2 border-[#e2dcee] bg-white px-3 text-[14px] font-semibold text-[#594d65] transition hover:border-[#7661f9] active:scale-[0.98]"
                        download="moodeng-call.ics"
                        href={calendarLinks.ics}
                     >
                        <CalendarPlus aria-hidden="true" className="size-4 shrink-0 text-[#6b55f7]" strokeWidth={2} />
                        Apple / Outlook
                     </a>
                  </div>
               ) : null}
            </div>
         ) : phase === 'loading' ? (
            <p className="text-center text-[14px] font-normal text-[#877897]">Finding open times…</p>
         ) : phase === 'cooldown' ? (
            <p className="rounded-[18px] bg-[#f8f1ff] px-4 py-4 text-center text-[15px] leading-[20px] text-[#594d65]">
               You&apos;ve missed two calls, so booking is paused for a week.
               {cooldownUntil ? (
                  <>
                     {' '}
                     You can pick a new time from{' '}
                     <b>{new Date(cooldownUntil).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</b>.
                  </>
               ) : null}
            </p>
         ) : phase === 'error' ? (
            <div className="flex flex-col items-center gap-2">
               <p className="text-md-b3 font-normal text-md-red-500">Couldn&apos;t load available times.</p>
               <button className="min-h-[44px] px-4 text-[14px] font-semibold text-[#6b55f7] underline" onClick={loadSlots} type="button">
                  Try again
               </button>
            </div>
         ) : dayGroups.length === 0 ? (
            <p className="text-center text-[14px] font-normal text-[#877897]">
               No times are open in the next two weeks. Message us on Messenger and we&apos;ll find one.
            </p>
         ) : (
            <div className="flex flex-col gap-4">
               <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-[#f3ecff] px-3 py-1 text-[12px] font-semibold text-[#6b55f7]">
                  <Globe aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
                  <span>Your time zone · {tzLabel}</span>
               </div>
               {notice ? <p className="text-center text-md-b3 font-normal text-md-red-500">{notice}</p> : null}
               {dayGroups.map(([day, daySlots]) => (
                  <div className="flex flex-col gap-2" key={day}>
                     <span className="text-[14px] font-bold text-[#594d65]">{day}</span>
                     <div className="grid grid-cols-3 gap-2">
                        {daySlots.map((s) => (
                           <button
                              className="min-h-[44px] rounded-full border-2 border-[#e2dcee] bg-white px-2 text-[14px] font-semibold text-[#594d65] transition hover:border-[#7661f9] hover:bg-[#f8f1ff] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
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

         <div className="mt-auto flex flex-col gap-1 pt-1">
            <PrimaryButton disabled={!isScheduled} onClick={() => isScheduled && onContinue()}>
               {isScheduled ? continueLabel : 'Pick a time above'}
            </PrimaryButton>
            <GhostButton onClick={onBack}>Back</GhostButton>
         </div>
      </div>
   );
}
