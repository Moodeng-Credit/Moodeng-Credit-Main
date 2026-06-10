import { type ReactNode, useCallback, useRef, useState } from 'react';

import { ChevronRight, Globe2, IdCard } from 'lucide-react';

import { ModalOverlay } from '@/components/worldId/modal/ModalOverlay';
import WorldIDPassportVerification from '@/components/worldId/WorldIDPassportVerification';
import WorldIDVerification from '@/components/worldId/WorldIDVerification';

interface WorldIDVerifyChoiceProps {
   /** Render-prop trigger. `open` shows the Orb/Passport choice sheet. */
   children: (props: { open: () => void }) => ReactNode;
   onSuccess?: () => void;
   showSuccessToast?: boolean;
   showSuccessFeedback?: boolean;
}

/**
 * Lets the user pick how to verify their World ID — Orb or Passport/ID — then launches
 * the matching flow. Both underlying verification components stay mounted so their launch,
 * polling, and feedback overlays keep working after the choice sheet closes. The choice
 * sheet sits below those overlays (ModalOverlay z-60 vs the flow overlays z-[2147483647]).
 */
export default function WorldIDVerifyChoice({
   children,
   onSuccess,
   showSuccessToast = true,
   showSuccessFeedback = true
}: WorldIDVerifyChoiceProps) {
   const [showChoice, setShowChoice] = useState(false);
   // The verification engines are mounted lazily on first open (so unverified pages don't
   // pre-fetch two RP contexts on load), then kept mounted so an in-flight flow is never
   // unmounted when the choice sheet closes.
   const [enginesArmed, setEnginesArmed] = useState(false);
   const orbOpenRef = useRef<(() => void) | null>(null);
   const passportOpenRef = useRef<(() => void) | null>(null);

   const openChoice = useCallback(() => {
      setEnginesArmed(true);
      setShowChoice(true);
   }, []);

   const handleSuccess = useCallback(() => {
      setShowChoice(false);
      onSuccess?.();
   }, [onSuccess]);

   const launchOrb = useCallback(() => {
      setShowChoice(false);
      orbOpenRef.current?.();
   }, []);

   const launchPassport = useCallback(() => {
      setShowChoice(false);
      passportOpenRef.current?.();
   }, []);

   return (
      <>
         {children({ open: openChoice })}

         {/* Mounted only after the first open, then kept mounted so a launched flow is never unmounted. */}
         {enginesArmed ? (
            <>
               <WorldIDVerification
                  onSuccess={handleSuccess}
                  showSuccessToast={showSuccessToast}
                  showSuccessFeedback={showSuccessFeedback}
               >
                  {({ open }) => {
                     orbOpenRef.current = open;
                     return null;
                  }}
               </WorldIDVerification>
               <WorldIDPassportVerification
                  onSuccess={handleSuccess}
                  showSuccessToast={showSuccessToast}
                  showSuccessFeedback={showSuccessFeedback}
               >
                  {({ open }) => {
                     passportOpenRef.current = open;
                     return null;
                  }}
               </WorldIDPassportVerification>
            </>
         ) : null}

         <ModalOverlay
            isOpen={showChoice}
            onClose={() => setShowChoice(false)}
            ariaLabelledBy="world-id-choice-title"
            ariaDescribedBy="world-id-choice-desc"
         >
            <div className="overflow-hidden rounded-md-xl bg-white shadow-2xl font-sans">
               <div className="flex items-center justify-between border-b border-md-neutral-300 px-4 py-3 sm:px-6 sm:py-4">
                  <h3 id="world-id-choice-title" className="text-md-h5 font-semibold tracking-tight text-md-heading">
                     Verify your World ID
                  </h3>
                  <button
                     onClick={() => setShowChoice(false)}
                     className="flex h-8 w-8 items-center justify-center rounded-full text-md-neutral-1000 transition-colors hover:bg-md-neutral-300 active:scale-95"
                     aria-label="Close"
                     type="button"
                  >
                     <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                     </svg>
                  </button>
               </div>

               <div className="flex flex-col gap-md-2 p-md-3 sm:p-md-4">
                  <p id="world-id-choice-desc" className="text-md-b2 font-medium text-md-neutral-1200">
                     Choose how you&rsquo;d like to prove you&rsquo;re a real person. You only need to do one.
                  </p>

                  <button
                     type="button"
                     onClick={launchOrb}
                     className="flex items-center gap-md-3 rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 px-md-3 py-md-3 text-left shadow-md-card transition-all duration-150 hover:border-md-primary-300 hover:bg-md-primary-100 active:scale-[0.99]"
                  >
                     <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-md-primary-300 bg-md-primary-100 text-md-primary-1200">
                        <Globe2 className="h-5 w-5" aria-hidden="true" />
                     </span>
                     <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-md-b1 font-semibold text-md-heading">World ID Orb</span>
                        <span className="text-md-b3 font-normal text-md-neutral-1200">Verify by scanning your eyes at an Orb.</span>
                     </span>
                     <ChevronRight className="h-5 w-5 shrink-0 text-md-neutral-1000" aria-hidden="true" />
                  </button>

                  <button
                     type="button"
                     onClick={launchPassport}
                     className="flex items-center gap-md-3 rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 px-md-3 py-md-3 text-left shadow-md-card transition-all duration-150 hover:border-md-primary-300 hover:bg-md-primary-100 active:scale-[0.99]"
                  >
                     <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-md-primary-300 bg-md-primary-100 text-md-primary-1200">
                        <IdCard className="h-5 w-5" aria-hidden="true" />
                     </span>
                     <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-md-b1 font-semibold text-md-heading">World ID Passport/ID</span>
                        <span className="text-md-b3 font-normal text-md-neutral-1200">Verify by scanning your passport in World App.</span>
                     </span>
                     <ChevronRight className="h-5 w-5 shrink-0 text-md-neutral-1000" aria-hidden="true" />
                  </button>
               </div>
            </div>
         </ModalOverlay>
      </>
   );
}
