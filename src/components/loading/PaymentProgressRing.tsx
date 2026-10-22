import { useEffect, useRef, useState } from 'react';

const SIZE = 148;
const CENTER = SIZE / 2;
const RADIUS = 56;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CHECKPOINTS = [20, 40, 60, 80];

interface Props {
   /** 0–100, from useStagedProgress. */
   percent: number;
   /** Read out by screen readers alongside the percent, e.g. "Sending your help". */
   label: string;
}

/**
 * Circular payment progress as a little race track: the hippo runs clockwise around the ring as the
 * percent climbs, hops at each 20% checkpoint as it lights up, and jumps at the finish flag on 100%.
 */
export default function PaymentProgressRing({ percent, label }: Props) {
   const clamped = Math.max(0, Math.min(100, percent));
   const done = clamped >= 100;

   // Re-trigger the bob each time the hippo passes another checkpoint.
   const passed = CHECKPOINTS.filter((c) => clamped >= c).length;
   const [hopKey, setHopKey] = useState(0);
   const lastPassed = useRef(passed);
   useEffect(() => {
      if (passed > lastPassed.current) setHopKey((k) => k + 1);
      lastPassed.current = passed;
   }, [passed]);

   const angle = (clamped / 100) * 2 * Math.PI;
   const hippoX = CENTER + RADIUS * Math.sin(angle);
   const hippoY = CENTER - RADIUS * Math.cos(angle);
   // Running clockwise, the hippo heads left along the bottom half: face it that way.
   const facingLeft = Math.cos(angle) < -0.05;
   const pose = done ? 'finish' : clamped >= 80 ? 'sprint' : 'jog';

   return (
      <div
         className="relative"
         style={{ width: SIZE, height: SIZE }}
         role="progressbar"
         aria-label={label}
         aria-valuemin={0}
         aria-valuemax={100}
         aria-valuenow={clamped}
      >
         <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" aria-hidden="true">
            <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" strokeWidth={10} className="stroke-[#ede8f3] dark:stroke-white/10" />
            <circle
               cx={CENTER}
               cy={CENTER}
               r={RADIUS}
               fill="none"
               strokeWidth={10}
               strokeLinecap="round"
               stroke="#22a35a"
               strokeDasharray={CIRCUMFERENCE}
               strokeDashoffset={CIRCUMFERENCE * (1 - clamped / 100)}
            />
            {/* Lane line down the middle of the track. */}
            <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" strokeWidth={1} strokeDasharray="3 5" className="stroke-white/70 dark:stroke-white/20" />
            {CHECKPOINTS.map((c) => {
               const a = (c / 100) * 2 * Math.PI;
               const reached = clamped >= c;
               return (
                  <circle
                     key={c}
                     cx={CENTER + RADIUS * Math.cos(a)}
                     cy={CENTER + RADIUS * Math.sin(a)}
                     r={reached ? 4.5 : 3.5}
                     strokeWidth={2}
                     className={reached ? 'fill-white stroke-[#1f7a3d]' : 'fill-[#d6cfe0] stroke-white dark:fill-white/25 dark:stroke-transparent'}
                  />
               );
            })}
         </svg>

         <img
            src="/hippos/progress/finish-flag.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute h-6 w-auto select-none"
            // The flag steps aside at the finish so the hippo can celebrate on the line.
            style={{ left: done ? CENTER - 34 : CENTER + 4, top: CENTER - RADIUS - 26 }}
         />

         <img
            key={done ? 'finish' : hopKey}
            src={`/hippos/progress/hippo-${pose}.png`}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={`pointer-events-none absolute h-9 w-auto select-none ${done ? 'connect-hippo-jump' : hopKey > 0 ? 'connect-hippo-run' : ''}`}
            style={{ left: hippoX, top: hippoY, transform: `translate(-50%, -82%)${facingLeft ? ' scaleX(-1)' : ''}` }}
         />

         <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[30px] font-bold leading-none tracking-[-0.04em] text-md-heading tabular-nums">{clamped}%</span>
         </div>
      </div>
   );
}

/** The ring laid over a card or modal (parent must be `relative`), with a title and hint below it. */
export function PaymentProgressOverlay({ percent, title, hint }: { percent: number; title: string; hint?: string }) {
   return (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-[24px] bg-white/90 px-6 text-center backdrop-blur-sm dark:bg-[#1b1525]/90">
         <PaymentProgressRing percent={percent} label={title} />
         <div>
            <p className="text-md-b1 font-semibold text-md-heading">{title}</p>
            {hint ? <p className="mt-1 text-md-b3 text-md-neutral-1200">{hint}</p> : null}
         </div>
      </div>
   );
}
