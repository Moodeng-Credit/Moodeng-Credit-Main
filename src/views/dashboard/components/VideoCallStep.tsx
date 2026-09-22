import { useEffect, useMemo, useState } from 'react';

import { CheckCircle } from 'lucide-react';

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

export default function VideoCallStep({ userId, onBack, onContinue }: { userId: string; onBack: () => void; onContinue: () => void }) {
   const timeZone = useMemo(() => {
      try {
         return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      } catch {
         return 'UTC';
      }
   }, []);

   const [phase, setPhase] = useState<Phase>('loading');
   const [slots, setSlots] = useState<string[]>([]);
   const [bookingStart, setBookingStart] = useState<string | null>(null);
   const [bookedStartsAt, setBookedStartsAt] = useState<string | null>(null);
   const [notice, setNotice] = useState('');

   const loadSlots = async () => {
      const { data, error } = await getSupabaseBrowserClient().functions.invoke(RR_FN, { body: { action: 'slots', timeZone } });
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
         if (data?.video_call_scheduled_at) {
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
      const { data, error } = await getSupabaseBrowserClient().functions.invoke(RR_FN, { body: { action: 'book', start, timeZone } });
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

   const isScheduled = phase === 'scheduled';

   return (
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-5 text-md-b2 text-md-heading">
         <p className="text-[13px] font-normal leading-[18px] text-md-neutral-1200">
            You don't have a referral code, so book a short 15-minute video call with the Moodeng team before your request goes out. You're
            picking a time now — not calling right away.
         </p>

         {isScheduled ? (
            <div className="flex items-center gap-1.5 rounded-md-md bg-[#eefbf2] px-md-2 py-md-1 text-md-b3 font-normal text-[#178447]">
               <CheckCircle aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
               <span>You're booked with the Moodeng team{formattedBooked ? ` — ${formattedBooked}` : ''}. We'll email you the details.</span>
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
               {notice ? <p className="text-md-b3 font-normal text-md-red-500">{notice}</p> : null}
               {dayGroups.map(([day, daySlots]) => (
                  <div className="flex flex-col gap-2" key={day}>
                     <span className="text-[13px] font-[590] text-md-heading">{day}</span>
                     <div className="grid grid-cols-3 gap-2">
                        {daySlots.map((s) => (
                           <button
                              className="rounded-[10px] border border-[#ded6e8] bg-white px-2 py-2 text-[13px] font-medium text-md-heading transition hover:border-md-primary-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
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
               {isScheduled ? 'Continue' : 'Continue — unlocks once your call is booked'}
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
