import { useEffect, useRef, useState } from 'react';

/**
 * "Checking the vault" loader: Moodeng peers through a magnifying glass and what she sees grows
 * bigger and sharper as the check runs — the vault shut, then cracked open on coins, then
 * overflowing with pandesal, and finally a lone pandesal when it's done.
 *
 * The art is one cut-out of Moodeng whose lens glass is transparent; the scenes sit behind it in an
 * ellipse matching the glass (measured on the 1156×1572 source: centre 883,574, glass ≈ 214×248
 * radii, tilted 18°), so the gold rim frames whatever is inside.
 */

const SCENES = [
   { src: '/vault-lens/vault-closed.webp', from: 0 },
   { src: '/vault-lens/vault-open.webp', from: 34 },
   { src: '/vault-lens/vault-bread.webp', from: 67 },
   { src: '/dashboard-v2/pandesal-large.png', from: 100 }
] as const;

// Display can't run ahead faster than this (percent per second), so a quick check still plays every scene.
const MAX_RATE = 55;

function useEasedPercent(target: number): number {
   const [shown, setShown] = useState(0);
   const shownRef = useRef(0);
   useEffect(() => {
      if (target <= 0) {
         shownRef.current = 0;
         setShown(0);
         return undefined;
      }
      let last = performance.now();
      const timer = window.setInterval(() => {
         const now = performance.now();
         const step = (Math.min(now - last, 250) / 1000) * MAX_RATE;
         last = now;
         const next = Math.min(target, shownRef.current + step);
         shownRef.current = Math.max(shownRef.current, next);
         setShown(shownRef.current);
         if (shownRef.current >= target) window.clearInterval(timer);
      }, 40);
      return () => window.clearInterval(timer);
   }, [target]);
   return shown;
}

export function VaultLensLoader({ percent, title, hint }: { percent: number; title: string; hint?: string }) {
   const shown = useEasedPercent(Math.max(0, Math.min(100, percent)));
   const p = shown / 100;
   const sceneIndex = SCENES.reduce((idx, scene, i) => (shown >= scene.from ? i : idx), 0);
   const isFinal = sceneIndex === SCENES.length - 1;
   // Magnify: the vault starts small and soft and fills the glass by the end.
   // Near the end it outgrows the glass (the rim crops it), which reads as "magnified".
   const scale = isFinal ? 0.95 : 0.4 + 0.95 * p;
   const blur = isFinal ? 0 : Math.max(0, 2.2 * (1 - p * 1.6));

   return (
      <div
         className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-[24px] bg-white/90 px-6 text-center backdrop-blur-sm dark:bg-[#1b1525]/90"
         role="status"
         aria-live="polite"
      >
         <div className="relative w-[200px]" style={{ aspectRatio: '560 / 762' }}>
            {/* What Moodeng sees through the glass (clipped to the lens ellipse). */}
            <div
               className="absolute overflow-hidden rounded-[50%] bg-[radial-gradient(circle_at_40%_35%,#ffffff_0%,#f3eefb_60%,#e6ddf3_100%)]"
               style={{ left: '57.35%', top: '20.35%', width: '38.06%', height: '32.32%', transform: 'rotate(18deg)' }}
               aria-hidden="true"
            >
               <div className="absolute inset-[-15%] flex items-center justify-center" style={{ transform: 'rotate(-18deg)' }}>
                  {SCENES.map((scene, i) => (
                     <img
                        key={scene.src}
                        src={scene.src}
                        alt=""
                        draggable={false}
                        className="absolute w-[72%] select-none transition-opacity duration-300 ease-out"
                        style={{
                           opacity: i === sceneIndex ? 1 : 0,
                           transform: `scale(${scale})`,
                           filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
                           transition: 'opacity 300ms ease-out, transform 200ms linear'
                        }}
                     />
                  ))}
               </div>
               {/* Glass glare on top of the scene. */}
               <div className="pointer-events-none absolute left-[18%] top-[10%] h-[45%] w-[16%] rotate-[28deg] rounded-full bg-white/45 blur-[1px]" />
            </div>
            <img
               src="/vault-lens/moodeng-magnifier.webp"
               alt=""
               draggable={false}
               className="pointer-events-none absolute inset-0 h-full w-full select-none"
               aria-hidden="true"
            />
         </div>
         <div>
            <p className="text-md-b1 font-semibold text-md-heading">
               {title} <span className="tabular-nums text-md-neutral-1000">{Math.floor(shown)}%</span>
            </p>
            {hint ? <p className="mt-1 text-md-b3 text-md-neutral-1200">{hint}</p> : null}
         </div>
      </div>
   );
}

/** Lets the closing scene (the lone pandesal) stay up for a beat after the eased display reaches 100%. */
export const VAULT_LENS_MIN_MS = 2600;
