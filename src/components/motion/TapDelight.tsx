import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

// Small motion rewards for taps (styles: .tap-* in globals.css). They never add text to the
// screen: a flip swaps what's already there and flips back, particles float up and vanish.

/** Flip to the "back" face for `ms`, then flip back. Tapping again while flipped flips back early. */
export function useTapFlip(ms = 3000) {
   const [flipped, setFlipped] = useState(false);
   const timerRef = useRef<number | null>(null);

   useEffect(() => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
   }, []);

   const flip = useCallback(() => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setFlipped((current) => {
         if (current) return false;
         timerRef.current = window.setTimeout(() => setFlipped(false), ms);
         return true;
      });
   }, [ms]);

   return { flipped, flip };
}

/** Renders `front` or `back`, replaying a quick flip each time it switches. */
export function FlipFace({ flipped, front, back }: { flipped: boolean; front: ReactNode; back: ReactNode }) {
   const [hasFlipped, setHasFlipped] = useState(false);
   useEffect(() => {
      if (flipped) setHasFlipped(true);
   }, [flipped]);
   // No animation on first render, only once the person has tapped.
   return (
      <span key={flipped ? 'back' : 'front'} className={hasFlipped ? 'tap-flip-in' : 'inline-block'}>
         {flipped ? back : front}
      </span>
   );
}

/** Restart a one-shot CSS animation class (e.g. squish, wiggle) on the element behind `ref`. */
export function useReplayClass<T extends HTMLElement>() {
   const ref = useRef<T | null>(null);
   const timerRef = useRef<number | null>(null);

   useEffect(() => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
   }, []);

   const play = useCallback((className: string) => {
      const el = ref.current;
      if (!el) return;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      el.classList.remove('tap-squish', 'tap-dizzy', 'tap-wiggle');
      void el.offsetWidth; // reflow so the same animation can run again
      el.classList.add(className);
      // A timer rather than `animationend`: that event never fires when the tab is hidden mid-animation.
      timerRef.current = window.setTimeout(() => el.classList.remove(className), 1000);
   }, []);
   return { ref, play };
}

interface Particle {
   id: number;
   node: ReactNode;
   style: CSSProperties;
}

/**
 * Things that float up from a point and fade (pandesal, hearts, stars, confetti).
 * Render `layer` inside a `relative` container; call `burst()` on tap.
 */
export function useFloatingParticles() {
   const [particles, setParticles] = useState<Particle[]>([]);
   const nextId = useRef(0);

   const burst = useCallback(
      (
         render: (index: number) => ReactNode,
         {
            count = 1,
            spreadX = 50,
            rise = 80,
            fullCircle = false,
            originY = '35%'
         }: { count?: number; spreadX?: number; rise?: number; fullCircle?: boolean; originY?: string } = {}
      ) => {
         const fresh: Particle[] = Array.from({ length: count }, (_, index) => {
            const angle = fullCircle ? (index / count) * Math.PI * 2 + Math.random() * 0.5 : 0;
            const dx = fullCircle ? Math.cos(angle) * spreadX : (Math.random() - 0.5) * spreadX;
            const dy = fullCircle ? Math.sin(angle) * rise : -(rise * (0.75 + Math.random() * 0.5));
            return {
               id: nextId.current++,
               node: render(index),
               style: {
                  left: '50%',
                  top: originY,
                  animationDelay: `${index * 60}ms`,
                  ['--tap-dx' as string]: `${Math.round(dx)}px`,
                  ['--tap-dy' as string]: `${Math.round(dy)}px`,
                  ['--tap-rot' as string]: `${Math.round((Math.random() - 0.5) * 60)}deg`
               }
            };
         });
         setParticles((current) => [...current, ...fresh]);
         const ids = new Set(fresh.map((p) => p.id));
         window.setTimeout(() => setParticles((current) => current.filter((p) => !ids.has(p.id))), 1000 + count * 60);
      },
      []
   );

   const layer = (
      <span className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
         {particles.map((p) => (
            <span key={p.id} className="tap-float absolute -ml-3 -mt-3 opacity-0" style={p.style}>
               {p.node}
            </span>
         ))}
      </span>
   );

   return { burst, layer };
}
