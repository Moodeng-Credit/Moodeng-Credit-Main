import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type GuidedTourStep = {
   target: string;
   title: string;
   body: string;
   cardPlacement?: 'top' | 'bottom';
   durationMs?: number;
};

export type TourRoleOption = {
   id: string;
   title: string;
   body: string;
};

interface GuidedTourPreviewProps {
   initialStepIndex?: number;
   startImmediately?: boolean;
   onFinish?: (reason: 'complete' | 'skip') => void;
   onRoleSelect?: (roleId: string) => void;
   onStepBack?: (stepIndex: number) => boolean | void;
   onStepNext?: (stepIndex: number) => boolean | void;
   onStepChange?: (stepIndex: number) => void;
   roleOptions?: TourRoleOption[];
   stepOffset?: number;
   steps: GuidedTourStep[];
   totalSteps?: number;
}

type SpotlightBounds = {
   height: number;
   left: number;
   top: number;
   width: number;
};

const SPOTLIGHT_INSET = 6;
const CARD_GAP = 16;
const CARD_TOP_MARGIN = 72;
const CARD_BOTTOM_MARGIN = 112;
const FALLBACK_CARD_HEIGHT = 280;

export default function GuidedTourPreview({
   initialStepIndex = 0,
   startImmediately = false,
   onFinish,
   onRoleSelect,
   onStepBack,
   onStepNext,
   onStepChange,
   roleOptions,
   stepOffset = 0,
   steps,
   totalSteps
}: GuidedTourPreviewProps) {
   const [isVisible, setIsVisible] = useState(true);
   const [hasStarted, setHasStarted] = useState(startImmediately);
   const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
   const [stepIndex, setStepIndex] = useState(() => Math.min(Math.max(initialStepIndex, 0), Math.max(steps.length - 1, 0)));
   const [bounds, setBounds] = useState<SpotlightBounds | null>(null);
   const cardRef = useRef<HTMLElement>(null);
   const currentStep = steps[stepIndex];
   const isLastStep = stepIndex === steps.length - 1;
   const globalStepIndex = stepOffset + stepIndex;
   const isFinalGlobalStep = globalStepIndex === (totalSteps ?? steps.length) - 1;
   const canGoBack = stepIndex > 0 || Boolean(onStepBack && globalStepIndex > 0);
   const cardTop = useMemo(() => {
      if (!bounds || typeof window === 'undefined') return undefined;

      const cardHeight = cardRef.current?.offsetHeight || FALLBACK_CARD_HEIGHT;
      const viewportHeight = window.innerHeight;
      const belowTarget = bounds.top + bounds.height + CARD_GAP;
      const aboveTarget = bounds.top - cardHeight - CARD_GAP;

      if (currentStep?.cardPlacement === 'top' && aboveTarget >= CARD_TOP_MARGIN) {
         return aboveTarget;
      }

      if (belowTarget + cardHeight <= viewportHeight - CARD_BOTTOM_MARGIN) {
         return belowTarget;
      }

      if (aboveTarget >= CARD_TOP_MARGIN) {
         return aboveTarget;
      }

      return Math.max(CARD_TOP_MARGIN, viewportHeight - CARD_BOTTOM_MARGIN - cardHeight);
   }, [bounds, currentStep?.cardPlacement]);

   const updateBounds = useCallback(() => {
      if (!hasStarted || !currentStep) return;

      const target = document.querySelector<HTMLElement>(currentStep.target);
      if (!target) {
         setBounds(null);
         return;
      }

      // Scroll target to the top of the viewport so the tour card always has
      // room to sit below it — prevents overlap on small screens like iPhone SE.
      target.scrollIntoView({
         block: 'start',
         behavior: 'auto'
      });

      window.requestAnimationFrame(() => {
         const rect = target.getBoundingClientRect();
         setBounds({
            height: rect.height + SPOTLIGHT_INSET * 2,
            left: rect.left - SPOTLIGHT_INSET,
            top: rect.top - SPOTLIGHT_INSET,
            width: rect.width + SPOTLIGHT_INSET * 2
         });
      });
   }, [currentStep, hasStarted]);

   useEffect(() => {
      updateBounds();
   }, [updateBounds]);

   useEffect(() => {
      if (!hasStarted) return undefined;

      onStepChange?.(stepIndex);
      const timer = window.setTimeout(updateBounds, 120);
      return () => window.clearTimeout(timer);
   }, [hasStarted, onStepChange, stepIndex, updateBounds]);

   useEffect(() => {
      window.addEventListener('resize', updateBounds);
      window.addEventListener('scroll', updateBounds, true);

      return () => {
         window.removeEventListener('resize', updateBounds);
         window.removeEventListener('scroll', updateBounds, true);
      };
   }, [updateBounds]);

   const finish = useCallback((reason: 'complete' | 'skip') => {
      setIsVisible(false);
      onFinish?.(reason);
   }, [onFinish]);

   const next = useCallback(() => {
      if (onStepNext?.(stepIndex)) {
         setIsVisible(false);
         return;
      }

      if (isLastStep) {
         finish('complete');
         return;
      }

      setStepIndex((index) => index + 1);
   }, [finish, isLastStep, onStepNext, stepIndex]);

   const back = useCallback(() => {
      if (stepIndex === 0 && onStepBack?.(stepIndex)) {
         setIsVisible(false);
         return;
      }

      setStepIndex((index) => Math.max(0, index - 1));
   }, [onStepBack, stepIndex]);

   const stepLabel = useMemo(() => `Step ${globalStepIndex + 1} of ${totalSteps ?? steps.length}`, [globalStepIndex, steps.length, totalSteps]);

   if (!isVisible || steps.length === 0) return null;

   return (
      <div className={`fixed inset-0 z-[120] ${hasStarted ? 'pointer-events-none' : ''}`}>
         <div className="absolute inset-0 bg-[#080512]/45" />

         {hasStarted && bounds ? (
            <div
               aria-hidden="true"
               className="absolute rounded-[20px] border-[3px] border-md-primary-900 bg-transparent shadow-[0_0_0_9999px_rgba(8,5,18,0.45),0_12px_34px_rgba(20,18,24,0.22)]"
               style={{
                  height: bounds.height,
                  left: bounds.left,
                  top: bounds.top,
                  width: bounds.width
               }}
            />
         ) : null}

         {!hasStarted ? (
            <article className="pointer-events-auto fixed left-1/2 top-1/2 w-[calc(100vw-64px)] max-w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-md-neutral-400 bg-md-neutral-100 p-md-4 shadow-md-card">
               <h2 className="text-md-h4 font-semibold text-md-heading">Want a quick tour?</h2>
               <p className="mt-md-1 text-md-b2 font-normal text-md-neutral-1200">
                  {roleOptions
                     ? 'Pick a side and we\'ll walk you through it — no account needed.'
                     : 'See how Moodeng works in under a minute. You can skip this and use everything normally.'}
               </p>
               {roleOptions ? (
                  <div className="mt-md-3 flex flex-col gap-2">
                     {roleOptions.map((option) => (
                        <button
                           key={option.id}
                           type="button"
                           onClick={() => setSelectedRoleId(option.id)}
                           className={[
                              'flex flex-col gap-1 items-start px-3 py-3 rounded-[12px] border w-full text-left transition-colors',
                              selectedRoleId === option.id
                                 ? 'bg-md-primary-900/10 border-md-primary-900'
                                 : 'bg-md-neutral-200 border-md-neutral-500'
                           ].join(' ')}
                        >
                           <span className="text-md-b2 font-semibold text-md-heading">{option.title}</span>
                           <span className="text-[12px] text-md-neutral-1100 leading-[18px]">{option.body}</span>
                        </button>
                     ))}
                  </div>
               ) : null}
               <div className="mt-md-3 flex flex-col-reverse gap-md-1 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between min-[380px]:gap-md-2">
                  <button
                     type="button"
                     onClick={() => finish('skip')}
                     className="rounded-full px-md-2 py-md-1 text-md-b2 font-medium text-md-neutral-1200 transition active:scale-[0.98]"
                  >
                     Skip for now
                  </button>
                  <button
                     type="button"
                     disabled={roleOptions ? !selectedRoleId : false}
                     onClick={() => {
                        if (roleOptions && selectedRoleId && onRoleSelect) {
                           onRoleSelect(selectedRoleId);
                        } else {
                           setHasStarted(true);
                        }
                     }}
                     className="rounded-full bg-md-primary-1200 px-md-3 py-md-1 text-md-b2 font-semibold text-md-neutral-100 transition hover:bg-[#5200c8] active:scale-[0.98] disabled:opacity-50"
                  >
                     {roleOptions ? 'Start the tour' : 'Take the tour'}
                  </button>
               </div>
            </article>
         ) : (
            <article
               ref={cardRef}
               className="pointer-events-auto fixed left-1/2 w-[calc(100vw-64px)] max-w-[340px] -translate-x-1/2 rounded-[22px] bg-[#3b087b] p-md-3 text-md-neutral-100 shadow-md-card"
               style={cardTop === undefined ? { bottom: CARD_BOTTOM_MARGIN } : { top: cardTop }}
            >
               <div className="text-[11px] font-semibold uppercase leading-4 tracking-[0.08em] text-white/70">{stepLabel}</div>
               <h2 className="mt-1 text-md-h5 font-semibold text-white">{currentStep.title}</h2>
               <p className="mt-md-1 text-md-b2 font-normal text-white/90">{currentStep.body}</p>
               <div className="mt-md-3 flex items-center justify-between gap-md-2">
                  <div className="flex items-center gap-md-2">
                     <button type="button" onClick={() => finish('skip')} className="rounded-full py-md-1 text-md-b2 font-medium text-white/75 transition active:scale-[0.98]">
                        Skip
                     </button>
                     {canGoBack ? (
                        <button type="button" onClick={back} className="rounded-full py-md-1 text-md-b2 font-medium text-white transition active:scale-[0.98]">
                           Back
                        </button>
                     ) : null}
                  </div>
                  <button
                     type="button"
                     onClick={next}
                     className="min-w-[112px] rounded-full bg-[#d99800] px-md-3 py-md-1 text-md-b2 font-semibold text-white shadow-sm transition hover:bg-[#c48800] active:scale-[0.98]"
                  >
                     {isFinalGlobalStep ? 'Finished' : 'Next'}
                  </button>
               </div>
            </article>
         )}
      </div>
   );
}
