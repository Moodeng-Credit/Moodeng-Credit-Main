import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type GuidedTourStep = {
   target: string;
   /** Optional: query a sub-element for tap-dot placement. Dot placed at right-end of element (button-style). */
   dotTarget?: string;
   /** Override dot placement within the spotlight. 'bottom-right' avoids text in large panels. */
   dotPlacement?: 'center' | 'bottom-right';
   title: string;
   body: string;
   /**
    * Controls where the tour card appears relative to the spotlight:
    * - 'top'    – card sits above the highlighted element (element scrolled to bottom of viewport)
    * - 'bottom' – card is pinned near the bottom of the viewport so large elements
    *              remain fully visible above it (ideal for wide/tall containers on small screens)
    * - omitted  – card goes below by default; falls back to above if there is no room
    */
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
const FALLBACK_CARD_HEIGHT = 160;

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
   const [tapNonce, setTapNonce] = useState(0);
   // Separate position state for the dot so it can CSS-transition between steps.
   const [dotPos, setDotPos] = useState<{ x: number; y: number } | null>(null);
   const [isMoving, setIsMoving] = useState(false);
   const [hasClickedThisStep, setHasClickedThisStep] = useState(false);
   const [burst, setBurst] = useState<{ x: number; y: number; nonce: number } | null>(null);
   const cardRef = useRef<HTMLElement>(null);
   // Refs so effects can read current values without re-subscribing.
   const stepIndexRef = useRef(stepIndex);
   const lastDotStepRef = useRef(-1);
   const dotPosRef = useRef<{ x: number; y: number } | null>(null);
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

      // 'bottom' – pin the card near the bottom of the viewport.  The highlighted
      // element is scrolled to the top so it sits fully above the card.
      if (currentStep?.cardPlacement === 'bottom') {
         return Math.max(CARD_TOP_MARGIN, viewportHeight - CARD_BOTTOM_MARGIN - cardHeight);
      }

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

      // Scroll target into view.
      // • 'top'    → scroll element to bottom of viewport so the card fits above it
      // • 'bottom' → scroll element to top so it's fully visible above the bottom card
      // • default  → scroll element to top so the card sits below it
      target.scrollIntoView({
         block: currentStep?.cardPlacement === 'top' ? 'end' : 'start',
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

   // Keep ref in sync so bounds effect can read stepIndex without re-subscribing.
   useEffect(() => { stepIndexRef.current = stepIndex; }, [stepIndex]);

   // When bounds change (new step or scroll/resize), position the dot.
   // Supports dotTarget (sub-element right-end) and dotPlacement:'bottom-right'.
   // On a genuine step change, slide the dot to the new position then replay the tap animation.
   // On scroll/resize, just jump the dot without animation so it stays locked to the target.
   useEffect(() => {
      if (!bounds || !hasStarted) return undefined;

      // Compute dot target position
      let cx: number;
      let cy: number;
      const dotTargetEl = currentStep?.dotTarget ? document.querySelector<HTMLElement>(currentStep.dotTarget) : null;
      if (dotTargetEl) {
         const r = dotTargetEl.getBoundingClientRect();
         cx = r.left + r.width - r.height * 0.55;
         cy = r.top + r.height / 2;
      } else if (currentStep?.dotPlacement === 'bottom-right') {
         cx = bounds.left + bounds.width - SPOTLIGHT_INSET - 28;
         cy = bounds.top + bounds.height - SPOTLIGHT_INSET - 28;
      } else {
         cx = bounds.left + bounds.width / 2;
         cy = bounds.top + bounds.height / 2;
      }

      const curStep = stepIndexRef.current;
      const isNewStep = curStep !== lastDotStepRef.current;
      lastDotStepRef.current = curStep;
      const newPos = { x: cx, y: cy };
      setHasClickedThisStep(false);

      if (!isNewStep || dotPosRef.current === null) {
         // First appearance or scroll/resize: snap into place.
         const wasNull = dotPosRef.current === null;
         dotPosRef.current = newPos;
         setDotPos(newPos);
         if (wasNull) {
            const t = window.setTimeout(() => setTapNonce(n => n + 1), 100);
            return () => window.clearTimeout(t);
         }
         return undefined;
      }

      // New step: CSS-transition the dot to the new position, then fire the tap animation.
      // setIsMoving(true) must commit in its own frame BEFORE dotPos updates, otherwise
      // React batches them together and the browser never sees the "from" position.
      setIsMoving(true);
      const tPos = window.setTimeout(() => {
         dotPosRef.current = newPos;
         setDotPos(newPos);
      }, 20);
      const t = window.setTimeout(() => {
         setIsMoving(false);
         setTapNonce(n => n + 1);
      }, 440);
      return () => { window.clearTimeout(tPos); window.clearTimeout(t); };
   }, [bounds, currentStep?.dotPlacement, currentStep?.dotTarget, hasStarted]);

   // Show a click burst when the user taps within the spotlight bounds, then hide the dot.
   useEffect(() => {
      if (!bounds || !hasStarted) return undefined;
      const { left, top, width, height } = bounds;
      const onDocClick = (e: MouseEvent) => {
         if (e.clientX >= left && e.clientX <= left + width && e.clientY >= top && e.clientY <= top + height) {
            setBurst({ x: e.clientX, y: e.clientY, nonce: Date.now() });
            setHasClickedThisStep(true);
         }
      };
      document.addEventListener('click', onDocClick, true);
      return () => document.removeEventListener('click', onDocClick, true);
   }, [bounds, hasStarted]);

   // Auto-clear the burst element once the animation finishes.
   useEffect(() => {
      if (!burst) return undefined;
      const t = window.setTimeout(() => setBurst(null), 650);
      return () => window.clearTimeout(t);
   }, [burst]);

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
               style={{ height: bounds.height, left: bounds.left, top: bounds.top, width: bounds.width }}
            />
         ) : null}

         {/* Tap cue — slides between steps, hides after the user clicks the spotlit element */}
         {hasStarted && dotPos ? (
            <>
               <div
                  aria-hidden="true"
                  className="pointer-events-none absolute"
                  style={{
                     left: dotPos.x,
                     top: dotPos.y,
                     transition: isMoving ? 'left 0.38s cubic-bezier(0.4,0,0.2,1), top 0.38s cubic-bezier(0.4,0,0.2,1)' : undefined
                  }}
               >
                  {isMoving ? (
                     /* Small trailing dot shown while sliding to the next target */
                     <span style={{
                        position: 'absolute', left: 0, top: 0, width: 10, height: 10,
                        margin: '-5px 0 0 -5px', borderRadius: '9999px',
                        background: 'rgba(98,16,210,0.85)',
                        boxShadow: '0 0 0 2px rgba(255,255,255,0.4)'
                     }} />
                  ) : !hasClickedThisStep ? (
                     <>
                        <span key={`r1-${tapNonce}`} className={`tour-tap-ring-${tapNonce}`} />
                        <span key={`r2-${tapNonce}`} className={`tour-tap-ring-${tapNonce}`} style={{ animationDelay: '0.4s' }} />
                        <span key={`d-${tapNonce}`} className={`tour-tap-dot-${tapNonce}`} />
                     </>
                  ) : null}
               </div>
               <style>{`
                  .tour-tap-ring-${tapNonce} {
                     position: absolute; left: 0; top: 0; width: 36px; height: 36px;
                     margin: -18px 0 0 -18px; border-radius: 9999px;
                     background: rgba(98, 16, 210, 0.40); opacity: 0;
                     animation: tourTapRing-${tapNonce} 0.85s ease-out 2 forwards;
                  }
                  .tour-tap-dot-${tapNonce} {
                     position: absolute; left: 0; top: 0; width: 16px; height: 16px;
                     margin: -8px 0 0 -8px; border-radius: 9999px;
                     background: rgba(98, 16, 210, 0.95);
                     box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35); opacity: 0;
                     animation: tourTapDot-${tapNonce} 1.8s ease-out forwards;
                  }
                  @keyframes tourTapRing-${tapNonce} {
                     0% { transform: scale(0.35); opacity: 0.55; }
                     70% { opacity: 0.12; }
                     100% { transform: scale(1.7); opacity: 0; }
                  }
                  @keyframes tourTapDot-${tapNonce} {
                     0% { transform: scale(1); opacity: 0; }
                     10% { opacity: 0.95; }
                     26% { transform: scale(0.78); }
                     42% { transform: scale(1); }
                     80% { opacity: 0.95; }
                     100% { transform: scale(1); opacity: 0; }
                  }
                  @media (prefers-reduced-motion: reduce) {
                     .tour-tap-ring-${tapNonce}, .tour-tap-dot-${tapNonce} { animation: none; opacity: 0; }
                  }
               `}</style>
            </>
         ) : null}

         {/* Click burst — fires at the exact tap point when the user clicks the spotlit element */}
         {burst ? (
            <div
               key={burst.nonce}
               aria-hidden="true"
               className="pointer-events-none absolute"
               style={{ left: burst.x, top: burst.y }}
            >
               <span className={`tour-click-burst-${burst.nonce}`} />
               <span className={`tour-click-burst-${burst.nonce}`} style={{ animationDelay: '0.07s' }} />
               <style>{`
                  .tour-click-burst-${burst.nonce} {
                     position: absolute; left: 0; top: 0; width: 44px; height: 44px;
                     margin: -22px 0 0 -22px; border-radius: 9999px;
                     background: rgba(98, 16, 210, 0.55); opacity: 0;
                     animation: tourClickBurst-${burst.nonce} 0.5s ease-out forwards;
                  }
                  @keyframes tourClickBurst-${burst.nonce} {
                     0%   { transform: scale(0.15); opacity: 0.9; }
                     100% { transform: scale(2.4);  opacity: 0; }
                  }
                  @media (prefers-reduced-motion: reduce) {
                     .tour-click-burst-${burst.nonce} { animation: none; opacity: 0; }
                  }
               `}</style>
            </div>
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
