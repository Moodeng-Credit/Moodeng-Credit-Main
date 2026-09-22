import { useEffect, useMemo, useRef, useState } from 'react';

import { CheckCircle } from 'lucide-react';

import { CALCOM_EMBED_ORIGIN, VIDEO_CALL_HOSTS, type VideoCallHostId } from '@/config/contactVerification';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type CalApi = ((action: string, arg?: unknown) => void) & { loaded?: boolean; ns?: Record<string, unknown>; q?: unknown[] };

declare global {
   interface Window {
      Cal?: CalApi;
   }
}

const HOST_IDS = Object.keys(VIDEO_CALL_HOSTS) as VideoCallHostId[];

// "Round-robin" without Cal.com's paid Teams feature: spread borrowers across the hosts ourselves.
// Deterministic on the borrower's id so a given person always lands on the same host (no flip-flop
// if they come back), but evenly split across people. They can switch to the other host's times.
const assignHost = (userId: string): VideoCallHostId => {
   let hash = 0;
   for (let i = 0; i < userId.length; i += 1) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
   return HOST_IDS[hash % HOST_IDS.length];
};

// Load Cal.com's embed queue-loader (the official snippet). Cal() can be called immediately after;
// calls queue until embed.js finishes loading. We attach an onerror to the injected script so a
// blocked/offline embed surfaces a fallback link instead of a blank box.
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
// (not attend now) a short video call with the Moodeng team before they can post a loan request.
// LoanRequestModal only renders this step when there's no applied referral code.
//
// The borrower is auto-matched with one host (see assignHost) and can switch to the other. Trust
// model is unchanged: we never let the client assert its own booking — we pass the borrower id and
// the matched host as embed metadata, and the signed calcom-webhook confirms the real
// BOOKING_CREATED and sets users.video_call_scheduled_at. This component only *reads* that column.
export default function VideoCallStep({ userId, onBack, onContinue }: { userId: string; onBack: () => void; onContinue: () => void }) {
   const assignedHost = useMemo(() => assignHost(userId), [userId]);
   const [override, setOverride] = useState<VideoCallHostId | null>(null);
   const activeHost = override ?? assignedHost;
   const otherHost = HOST_IDS.find((id) => id !== activeHost) ?? activeHost;

   const [isScheduled, setIsScheduled] = useState(false);
   const [bookedHost, setBookedHost] = useState<string | null>(null);
   const [bookedStartsAt, setBookedStartsAt] = useState<string | null>(null);
   const [isConfirming, setIsConfirming] = useState(false);
   const [widgetError, setWidgetError] = useState('');
   const widgetContainerRef = useRef<HTMLDivElement | null>(null);
   const pollRef = useRef<number | null>(null);

   const applyScheduled = (host: string | null, startsAt: string | null) => {
      setIsScheduled(true);
      setIsConfirming(false);
      setBookedHost(host);
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

   // Mount the matched host's Cal.com embed, and poll for the webhook's confirmation. Re-runs when
   // the borrower switches hosts, so the embed and the metadata we send both follow activeHost.
   useEffect(() => {
      if (isScheduled) return;
      let cancelled = false;
      setWidgetError('');

      const cal = ensureCal(CALCOM_EMBED_ORIGIN, () => {
         if (!cancelled) setWidgetError("Couldn't load the scheduler — check your connection, or open it in a new tab below.");
      });
      if (cal && widgetContainerRef.current) {
         widgetContainerRef.current.innerHTML = '';
         cal('inline', {
            elementOrSelector: widgetContainerRef.current,
            calLink: VIDEO_CALL_HOSTS[activeHost].calLink,
            // Carried through to the webhook so it credits the right borrower + host.
            config: { layout: 'month_view', metadata: { moodeng_user_id: userId, moodeng_host: activeHost } }
         });
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
   }, [activeHost, isScheduled, userId]);

   const handleContinue = () => {
      if (!isScheduled) return;
      onContinue();
   };

   const hostName = bookedHost && bookedHost in VIDEO_CALL_HOSTS ? VIDEO_CALL_HOSTS[bookedHost as VideoCallHostId].name : null;
   const formattedStart = bookedStartsAt
      ? new Date(bookedStartsAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : null;
   const fallbackUrl = `${CALCOM_EMBED_ORIGIN}/${VIDEO_CALL_HOSTS[activeHost].calLink}`;

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
                  You're booked with {hostName ?? 'the Moodeng team'}
                  {formattedStart ? ` — ${formattedStart}` : ''}. You're all set.
               </span>
            </div>
         ) : (
            <>
               <div className="flex items-center gap-3 rounded-[16px] border border-[#ded6e8] bg-white px-3 py-2.5">
                  <img alt={VIDEO_CALL_HOSTS[activeHost].name} className="size-10 rounded-full object-cover" src={VIDEO_CALL_HOSTS[activeHost].photo} />
                  <div className="flex min-w-0 flex-col">
                     <span className="text-[13px] font-[590] leading-4 text-md-heading">You'll meet with {VIDEO_CALL_HOSTS[activeHost].name}</span>
                     <button
                        className="w-fit text-[12px] font-normal text-md-primary-1200 underline"
                        onClick={() => setOverride(otherHost)}
                        type="button"
                     >
                        See {VIDEO_CALL_HOSTS[otherHost].name}'s times instead
                     </button>
                  </div>
               </div>

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
                  <div className="h-[600px] min-h-[600px] w-full overflow-hidden rounded-[16px] border border-[#ded6e8]" ref={widgetContainerRef} />
               )}

               <a className="text-[12px] font-normal text-md-primary-1200 underline" href={fallbackUrl} rel="noopener noreferrer" target="_blank">
                  Scheduler not loading? Open it in a new tab
               </a>
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
