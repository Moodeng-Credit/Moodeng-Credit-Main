import { useEffect, useRef, useState } from 'react';

import { CheckCircle } from 'lucide-react';

import { VIDEO_CALL_HOSTS, type VideoCallHostId } from '@/config/contactVerification';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

declare global {
   interface Window {
      Calendly?: {
         initInlineWidget: (opts: { url: string; parentElement: HTMLElement; prefill?: Record<string, unknown> }) => void;
      };
   }
}

const CALENDLY_SCRIPT_SRC = 'https://assets.calendly.com/assets/external/widget.js';
const CALENDLY_STYLESHEET_HREF = 'https://assets.calendly.com/assets/external/widget.css';

let calendlyScriptPromise: Promise<void> | null = null;
const loadCalendlyScript = (): Promise<void> => {
   if (window.Calendly) return Promise.resolve();
   if (calendlyScriptPromise) return calendlyScriptPromise;

   if (!document.querySelector(`link[href="${CALENDLY_STYLESHEET_HREF}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CALENDLY_STYLESHEET_HREF;
      document.head.appendChild(link);
   }

   calendlyScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CALENDLY_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Calendly widget script'));
      document.body.appendChild(script);
   });
   return calendlyScriptPromise;
};

// The no-referral-code gate: a borrower with no one at Moodeng to vouch for them has to
// SCHEDULE (not complete) a short video call with George or Emma before they can post a loan
// request. LoanRequestModal only renders this step when the borrower has no applied referral
// code — a referral already vouches for them.
//
// Calendly's Webhooks API needs a paid Standard-tier org (Moodeng is on the free plan), so there
// is no server-side confirmation available. Instead we embed Calendly inline and listen for its
// own `calendly.event_scheduled` postMessage the moment a real booking completes in this same
// page, then record it via the mark_video_call_scheduled RPC. That RPC is honest about being a
// client-asserted fact, not an independently verified one — see the migration's comment for why
// that's an acceptable trade-off here.
export default function VideoCallStep({ userId, onBack, onContinue }: { userId: string; onBack: () => void; onContinue: () => void }) {
   const [selectedHost, setSelectedHost] = useState<VideoCallHostId | null>(null);
   const [isScheduled, setIsScheduled] = useState(false);
   const [widgetError, setWidgetError] = useState('');
   const widgetContainerRef = useRef<HTMLDivElement | null>(null);

   useEffect(() => {
      let cancelled = false;
      (async () => {
         const { data } = await getSupabaseBrowserClient()
            .from('users')
            .select('video_call_scheduled_at')
            .eq('id', userId)
            .maybeSingle();
         if (!cancelled && data?.video_call_scheduled_at) setIsScheduled(true);
      })();
      return () => {
         cancelled = true;
      };
   }, [userId]);

   useEffect(() => {
      if (!selectedHost || isScheduled) return;

      let cancelled = false;
      setWidgetError('');
      loadCalendlyScript()
         .then(() => {
            if (cancelled || !widgetContainerRef.current || !window.Calendly) return;
            widgetContainerRef.current.innerHTML = '';
            window.Calendly.initInlineWidget({
               url: VIDEO_CALL_HOSTS[selectedHost].calendlyUrl,
               parentElement: widgetContainerRef.current
            });
         })
         .catch((err) => {
            console.error('Calendly widget failed to load', err);
            if (!cancelled) setWidgetError("Couldn't load the scheduler — check your connection and try again.");
         });

      return () => {
         cancelled = true;
      };
   }, [selectedHost, isScheduled]);

   useEffect(() => {
      const handleMessage = async (event: MessageEvent) => {
         if (event.origin.indexOf('calendly.com') === -1) return;
         if ((event.data as { event?: string })?.event !== 'calendly.event_scheduled') return;
         if (!selectedHost) return;

         const { error } = await getSupabaseBrowserClient().rpc('mark_video_call_scheduled', { p_host: selectedHost });
         if (error) {
            console.error('mark_video_call_scheduled failed', error);
            return;
         }
         setIsScheduled(true);
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
   }, [selectedHost]);

   return (
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-5 text-md-b2 text-md-heading">
         <p className="text-[13px] font-normal leading-[18px] text-md-neutral-1200">
            Since you don't have a referral code, book a quick video call with the Moodeng team before your request goes out.
         </p>

         {isScheduled ? (
            <div className="flex items-center gap-1.5 rounded-md-md bg-[#eefbf2] px-md-2 py-md-1 text-md-b3 font-normal text-[#178447]">
               <CheckCircle aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
               <span>You're booked{selectedHost ? ` with ${VIDEO_CALL_HOSTS[selectedHost].name}` : ''} — you're all set.</span>
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
                  widgetError ? (
                     <p className="text-md-b3 font-normal text-md-red-500">{widgetError}</p>
                  ) : (
                     <div className="h-[600px] min-h-[600px] w-full overflow-hidden rounded-[16px] border border-[#ded6e8]" ref={widgetContainerRef} />
                  )
               ) : null}
            </>
         )}

         <div className="mt-auto flex flex-col gap-2">
            <button
               className={`w-full rounded-md-lg px-md-4 py-md-3 text-md-b1 font-medium text-md-neutral-100 ${
                  isScheduled ? 'bg-md-primary-1200 transition duration-150 ease-out hover:bg-[#5200c8] active:scale-[0.98]' : 'bg-md-neutral-600'
               }`}
               disabled={!isScheduled}
               onClick={onContinue}
               type="button"
            >
               Continue
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
