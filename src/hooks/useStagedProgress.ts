import { useEffect, useRef, useState } from 'react';

/**
 * Where each real stage of a payment sits on the 0–100 bar. On entering a stage the percent eases
 * quickly up to `mark`, then creeps ever more slowly toward `cap` while we wait, so it never sits
 * still but can't pass the next real milestone. Only `done` reaches 100.
 */
const STAGES = {
   signing: { mark: 8, cap: 24 },
   sent: { mark: 50, cap: 78 },
   recording: { mark: 84, cap: 95 },
   done: { mark: 100, cap: 100 }
} as const;

export type PaymentStage = keyof typeof STAGES;

/**
 * Turns the current payment stage into a smoothly rising percent (0–100) for a progress ring.
 * Never moves backwards; resets to 0 when `stage` is null (nothing in flight).
 */
export function useStagedProgress(stage: PaymentStage | null): number {
   const [percent, setPercent] = useState(0);
   const valueRef = useRef(0);

   useEffect(() => {
      if (!stage) {
         valueRef.current = 0;
         setPercent(0);
         return undefined;
      }
      const { mark, cap } = STAGES[stage];
      // A timer rather than requestAnimationFrame: rAF stops while the tab is in the background
      // (lender switched to their wallet app), and the ring should have moved on when they return.
      let last = performance.now();
      const timer = window.setInterval(() => {
         const now = performance.now();
         const dt = Math.min(now - last, 1000) / 1000;
         last = now;
         const v = valueRef.current;
         // Fast catch-up to the stage's mark, then a slow asymptotic creep toward its cap.
         const next = v < mark ? v + (mark + 1 - v) * Math.min(1, dt * 4) : v + (cap - v) * dt * 0.12;
         valueRef.current = Math.min(Math.max(v, next), cap);
         setPercent(valueRef.current);
         if (valueRef.current >= cap) window.clearInterval(timer);
      }, 50);
      return () => window.clearInterval(timer);
   }, [stage]);

   return Math.floor(percent);
}

/** Resolves after `ms` — lets the ring show 100% for a beat before the success screen. */
export const holdAtFull = (ms = 700) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
