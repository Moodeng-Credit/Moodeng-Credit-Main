import { useCallback, useEffect, useMemo, useState } from 'react';

type GuidedTourStep = {
   target: string;
   title: string;
   body: string;
   cardPlacement?: 'top' | 'bottom';
   durationMs?: number;
};

interface GuidedTourPreviewProps {
   autoAdvanceMs?: number;
   startImmediately?: boolean;
   onFinish?: (reason: 'complete' | 'skip') => void;
   onStepChange?: (stepIndex: number) => void;
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

export default function GuidedTourPreview({
   autoAdvanceMs = 6000,
   startImmediately = false,
   onFinish,
   onStepChange,
   stepOffset = 0,
   steps,
   totalSteps
}: GuidedTourPreviewProps) {
   const [isVisible, setIsVisible] = useState(true);
   const [hasStarted, setHasStarted] = useState(startImmediately);
   const [stepIndex, setStepIndex] = useState(0);
   const [bounds, setBounds] = useState<SpotlightBounds | null>(null);
   const currentStep = steps[stepIndex];
   const isLastStep = stepIndex === steps.length - 1;
   const globalStepIndex = stepOffset + stepIndex;
   const isFinalGlobalStep = globalStepIndex === (totalSteps ?? steps.length) - 1;
   const stepCardPosition = currentStep?.cardPlacement === 'top' ? 'top-[88px]' : 'bottom-[104px]';

   const updateBounds = useCallback(() => {
      if (!hasStarted || !currentStep) return;

      const target = document.querySelector<HTMLElement>(currentStep.target);
      if (!target) {
         setBounds(null);
         return;
      }

      target.scrollIntoView({ block: 'center', behavior: 'smooth' });

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
      if (isLastStep) {
         finish('complete');
         return;
      }

      setStepIndex((index) => index + 1);
   }, [finish, isLastStep]);

   const back = useCallback(() => {
      if (stepIndex > 0) {
         setStepIndex((index) => index - 1);
         return;
      }

      window.history.back();
   }, [stepIndex]);

   useEffect(() => {
      if (!hasStarted || isLastStep) return undefined;

      const timer = window.setTimeout(next, currentStep.durationMs ?? autoAdvanceMs);
      return () => window.clearTimeout(timer);
   }, [autoAdvanceMs, currentStep.durationMs, hasStarted, isLastStep, next, stepIndex]);

   const stepLabel = useMemo(() => `Step ${globalStepIndex + 1} of ${totalSteps ?? steps.length}`, [globalStepIndex, steps.length, totalSteps]);

   if (!isVisible || steps.length === 0) return null;

   return (
      <div className="fixed inset-0 z-[120] pointer-events-none">
         <div className="absolute inset-0 bg-[#080512]/45" />

         {hasStarted && bounds ? (
            <div
               aria-hidden="true"
               className="absolute rounded-[20px] border-[3px] border-md-primary-900 bg-transparent shadow-[0_0_0_9999px_rgba(8,5,18,0.45),0_12px_34px_rgba(20,18,24,0.22)] transition-all duration-150"
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
                  See how Moodeng works in under a minute. You can skip this and use everything normally.
               </p>
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
                     onClick={() => setHasStarted(true)}
                     className="rounded-full bg-md-primary-1200 px-md-3 py-md-1 text-md-b2 font-semibold text-md-neutral-100 transition hover:bg-[#5200c8] active:scale-[0.98]"
                  >
                     Take the tour
                  </button>
               </div>
            </article>
         ) : (
            <article
               className={`pointer-events-auto fixed ${stepCardPosition} left-1/2 w-[calc(100vw-64px)] max-w-[340px] -translate-x-1/2 rounded-[22px] bg-[#3b087b] p-md-3 text-md-neutral-100 shadow-md-card`}
            >
               <div className="text-[11px] font-semibold uppercase leading-4 tracking-[0.08em] text-white/70">{stepLabel}</div>
               <h2 className="mt-1 text-md-h5 font-semibold text-white">{currentStep.title}</h2>
               <p className="mt-md-1 text-md-b2 font-normal text-white/90">{currentStep.body}</p>
               <div className="mt-md-3 flex items-center justify-between gap-md-2">
                  <div className="flex items-center gap-md-2">
                     <button type="button" onClick={() => finish('skip')} className="rounded-full py-md-1 text-md-b2 font-medium text-white/75 transition active:scale-[0.98]">
                        Skip
                     </button>
                     {globalStepIndex > 0 ? (
                        <button type="button" onClick={back} className="rounded-full py-md-1 text-md-b2 font-medium text-white transition active:scale-[0.98]">
                           Back
                        </button>
                     ) : null}
                  </div>
                  <button
                     type="button"
                     onClick={next}
                     className="min-w-[112px] rounded-full border-2 border-[#d99800] bg-white px-md-3 py-md-1 text-md-b2 font-semibold shadow-sm transition active:scale-[0.98]"
                     style={{ color: '#3b087b' }}
                  >
                     {isFinalGlobalStep ? 'Finished' : 'Next'}
                  </button>
               </div>
            </article>
         )}
      </div>
   );
}
