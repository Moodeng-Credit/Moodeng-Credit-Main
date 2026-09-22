import { useEffect, useRef, useState } from 'react';

import { CheckCircle } from 'lucide-react';

import { CALCOM_EMBED_ORIGIN, VIDEO_CALL_HOSTS, type VideoCallHostId } from '@/config/contactVerification';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type CalApi = ((action: string, arg?: unknown) => void) & { loaded?: boolean; ns?: Record<string, unknown>; q?: unknown[] };

declare global {
   interface Window {
      Cal?: CalApi;
   }
}

// Load Cal.com's embed queue-loader (the official snippet). Cal() can be called immediately after;
// calls queue until embed.js finishes loading. Returns the Cal function, or null if we're not in a
// browser. We attach an onerror to the injected script so a blocked/offline embed surfaces a
// fallback link instead of a blank box.
const ensureCal = (origin: string, onScriptError: () => void): CalApi | null => {
   if (typeof window === 'undefined') return null;
   if (!window.Cal) {
      const src = `${origin}/embed/embed.js`;
      (function (C: Window, A: string, L: string) {
         const d = C.document;
         const cal: CalApi = function (...args: unknown[]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (cal as any).q = (cal as any).q || [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (cal as any).q.push(args);
         } as unknown as CalApi;
         C.Cal = cal;
         if (!cal.loaded) {
            cal.loaded = true;
            const script = d.createElement('script');
            script.src = A;
            script.async = true;
            script.onerror = onScriptError;
            d.head.appendChild(script);
         }
         cal(L, { origin });
      })(window, src, 'init');
   }
   return window.Cal ?? null;
};

// The no-referral-code gate: a borrower with nobody at Moodeng to vouch for them has to SCHEDULE
// (not attend now) a short video call with George or Emma before they can post a loan request.
// LoanRequestModal only renders this step when there's no applied referral code.
//
// Trust model: we NEVER let the client assert its own booking. The borrower books inside an inline
// Cal.com embed; we pass their user id + chosen host as embed metadata, and the signed
// calcom-webhook confirms the real BOOKING_CREATED server-side and sets users.video_call_scheduled_at.
// This component only *reads* that column (polling), so a borrower who closes the embed without
// booking simply never gets past the gate. A cancellation reopens it (the webhook clears the column).
export default function VideoCallStep({ userId, onBack, onContinue }: { userId: string; onBack: () => void; onContinue: () => void }) {
   const [selectedHost, setSelectedHost] = useState<VideoCallHostId | null>(null);
   const [isScheduled, setIsScheduled] = useState(false);
   const [bookedHost, setBookedHost] = useState<VideoCallHostId | null>(null);
   const [bookedStartsAt, setBookedStartsAt] = useState<string | null>(null);
   const [isConfirming, setIsConfirming] = useState(false);
   const [widgetError, setWidgetError] = useState('');
   const widgetContainerRef = useRef<HTMLDivElement | null>(null);
   const pollRef = useRef<number | null>(null);

   const applyScheduled = (host: string | null, startsAt: string | null) => {
      setIsScheduled(true);
      setIsConfirming(false);
      if (host === 'george' || host === 'emma') setBookedHost(host);
      setBookedStartsAt(startsAt);
   };

   // Pick up a booking confirmed on a previous visit (webhook already stamped the columns).
   useEffect(() => {
      let cancelled = false;
      (async () => {
         const { data } = await getSupabaseBrowserClient()
            .from('users')
            .select('video_call_scheduled_at, video_call_host, video_call_starts_at')
            .eq('id', userId)
            .maybeSingle();
         if (!cancelled && data?.video_call_scheduled_at) applyScheduled(data.video_call_host, data.video_call_starts_at);
      })();
      return () => {
         cancelled = true;
      };
   }, [userId]);

   const stopPolling = () => {
      if (pollRef.current) {
         window.clearInterval(pollRef.current);
         pollRef.current = null;
      }
   };
   useEffect(() => stopPolling, []);

   // Mount the Cal.com embed once a host is picked, and poll for the webhook's confirmation.
   useEffect(() => {
      if (!selectedHost || isScheduled) return;
      let cancelled = false;
      setWidgetError('');

      const cal = ensureCal(CALCOM_EMBED_ORIGIN, () => {
         if (!cancelled) setWidgetError("Couldn't load the scheduler — check your connection, or open it in a new tab below.");
      });
      if (cal && widgetContainerRef.current) {
         widgetContainerRef.current.innerHTML = '';
         cal('inline', {
            elementOrSelector: widgetContainerRef.current,
            calLink: VIDEO_CALL_HOSTS[selectedHost].calLink,
            // Carried through to the webhook's payload so it can credit the right borrower + host.
            config: { layout: 'month_view', metadata: { moodeng_user_id: userId, moodeng_host: selectedHost } }
         });
         // Not a confirmation of anything — just lets us show a "confirming…" state while the
         // webhook lands, instead of a silent gap. The DB poll remains the source of truth.
         cal('on', { action: 'bookingSuccessful', callback: () => !cancelled && setIsConfirming(true) });
      }

      stopPolling();
      pollRef.current = window.setInterval(async () => {
         const { data } = await getSupabaseBrowserClient()
            .from('users')
            .select('video_call_scheduled_at, video_call_host, video_call_starts_at')
            .eq('id', userId)
            .maybeSingle();
         if (data?.video_call_scheduled_at) {
            applyScheduled(data.video_call_host, data.video_call_starts_at);
            stopPolling();
         }
      }, 3000);

      return () => {
         cancelled = true;
         stopPolling();
      };
   }, [selectedHost, isScheduled, userId]);

   const handleContinue = () => {
      if (!isScheduled) return;
      onContinue();
   };

   const formattedStart = bookedStartsAt
      ? new Date(bookedStartsAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : null;
   const fallbackUrl = selectedHost ? `${CALCOM_EMBED_ORIGIN}/${VIDEO_CALL_HOSTS[selectedHost].calLink}` : null;

   return (
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-5 text-md-b2 text-md-heading">
         <p className="text-[13px] font-normal leading-[18px] text-md-neutral-1200">
            You don't have a referral code, so book a short 15-minute video call with the Moodeng team before your request goes out. You're
            picking a time now — not calling right away.
         </p>

         {isScheduled ? (
            <div className="flex items-center gap-1.5 rounded-md-md bg-[#eefbf2] px-md-2 py-md-1 text-md-b3 font-normal text-[#178447]">
               <CheckCircle aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
               <span>
                  You're booked{bookedHost ? ` with ${VIDEO_CALL_HOSTS[bookedHost].name}` : ''}
                  {formattedStart ? ` — ${formattedStart}` : ''}. You're all set.
               </span>
            </div>
         ) : (
            <>
               <div className="grid grid-cols-2 gap-3">
                  {Object.values(VIDEO_CALL_HOSTS).map((host) => (
                     <button
                        key={host.id}
                        aria-pressed={selectedHost === host.id}
                        className={`flex flex-col items-center gap-2 rounded-[16px] border px-3 py-4 transition active:scale-[0.99] ${
                           selectedHost === host.id
                              ? 'border-md-primary-900 bg-[#f3e8ff] shadow-[0_6px_16px_rgba(96,16,210,0.08)]'
                              : 'border-[#ded6e8] bg-white hover:border-[#cbbce0]'
                        }`}
                        onClick={() => setSelectedHost(host.id)}
                        type="button"
                     >
                        <img alt={host.name} className="size-16 rounded-full object-cover" src={host.photo} />
                        <span className="text-[14px] font-[590] leading-5 text-md-heading">{host.name}</span>
                     </button>
                  ))}
               </div>

               {selectedHost ? (
                  <>
                     <div className="flex items-start gap-2 rounded-[12px] bg-[#f7f5fa] px-3 py-2.5">
                        <span className="text-[12px] leading-[17px] text-md-neutral-1400">
                           {isConfirming
                              ? 'Confirming your booking… this unlocks Continue in a moment.'
                              : 'Finish booking in the scheduler. Continue unlocks on its own once we confirm it — nothing to save. Cal.com emails you the details.'}
                        </span>
                     </div>

                     {widgetError ? (
                        <p className="text-md-b3 font-normal text-md-red-500">{widgetError}</p>
                     ) : (
                        <div
                           className="h-[600px] min-h-[600px] w-full overflow-hidden rounded-[16px] border border-[#ded6e8]"
                           ref={widgetContainerRef}
                        />
                     )}

                     {fallbackUrl ? (
                        <a
                           className="text-[12px] font-normal text-md-primary-1200 underline"
                           href={fallbackUrl}
                           rel="noopener noreferrer"
                           target="_blank"
                        >
                           Scheduler not loading? Open it in a new tab
                        </a>
                     ) : null}
                  </>
               ) : null}
            </>
         )}

         <div className="mt-auto flex flex-col gap-2">
            <button
               className={`w-full rounded-md-lg px-md-4 py-md-3 text-md-b1 font-medium text-md-neutral-100 ${
                  isScheduled ? 'bg-md-primary-1200 transition duration-150 ease-out hover:bg-[#5200c8] active:scale-[0.98]' : 'bg-md-neutral-600'
               }`}
               disabled={!isScheduled}
               onClick={handleContinue}
               type="button"
            >
               {isScheduled ? 'Continue' : 'Continue — unlocks once your call is confirmed'}
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
