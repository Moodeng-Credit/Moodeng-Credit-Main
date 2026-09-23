import type { ReactNode } from 'react';

import clsx from 'clsx';

// Vector pieces of the Figma design (tier track, scene arrows, tabbed cards) drawn in code so they
// scale cleanly and follow real data (e.g. the highlighted tier) instead of shipping one export per state.

const TRACK_NODE_X = [69, 170, 270, 371];
// Quadratic curve M20,4 Q220,40 420,4 — node y values sit on that curve.
const trackY = (x: number) => {
   const t = (x - 20) / 400;
   return 4 + 72 * t * (1 - t);
};

export function TierTrack({ currentIndex, className }: { currentIndex: number; className?: string }) {
   const currentX = TRACK_NODE_X[currentIndex] ?? TRACK_NODE_X[0];
   const gradientId = `dv2-track-${currentIndex}`;

   return (
      <svg viewBox="0 0 440 28" className={className} aria-hidden="true">
         <defs>
            <linearGradient id={gradientId} x1="0" x2="440" y1="0" y2="0" gradientUnits="userSpaceOnUse">
               <stop offset="0" stopColor="#ec6a82" stopOpacity="0" />
               <stop offset={currentX / 440} stopColor="#ec6a82" stopOpacity="0.95" />
               <stop offset="1" stopColor="#ec6a82" stopOpacity="0.08" />
            </linearGradient>
         </defs>
         <path d="M20 4 Q220 40 420 4" fill="none" stroke={`url(#${gradientId})`} strokeWidth="2" strokeLinecap="round" />
         {TRACK_NODE_X.map((x, index) => {
            const y = trackY(x);
            if (index === currentIndex) {
               return <circle key={x} cx={x} cy={y} r="4.5" fill="#fff" stroke="#e5334b" strokeWidth="2.5" />;
            }
            const isMiddle = index === 1 || index === 2;
            return isMiddle ? (
               <circle key={x} cx={x} cy={y} r="6" fill="#f6dfbf" stroke="#c8634c" strokeWidth="2.5" />
            ) : (
               <circle key={x} cx={x} cy={y} r="4" fill="#fff" stroke="#eba196" strokeWidth="2" />
            );
         })}
      </svg>
   );
}

export function SceneArrow({ direction, className }: { direction: 'left' | 'right'; className?: string }) {
   return (
      <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
         <path
            d="M29 13c-4-3-8 1-5.5 5L39 40 23.5 62c-2.5 4 1.5 8 5.5 5l27-22.5c3.2-2.6 3.2-6.4 0-9Z"
            fill="rgba(255,255,255,0.72)"
            stroke="rgba(214,210,196,0.95)"
            strokeWidth="2"
            strokeLinejoin="round"
            transform={direction === 'left' ? 'translate(80 0) scale(-1 1)' : undefined}
         />
      </svg>
   );
}

/**
 * White card with the lavender tab that rises behind the section title on the right
 * (Figma "Rectangle 3467568" / "Rectangle 3467571").
 */
export function TabbedCard({
   title,
   titleId,
   tab,
   tabWidth,
   overlapTitle = false,
   children,
   className
}: {
   title: string;
   titleId: string;
   tab?: ReactNode;
   /** Width of the tab as a share of the card, e.g. '37%'. */
   tabWidth: string;
   /** Loan Summary's title sits inside the card's top band; Milestones' sits above it. */
   overlapTitle?: boolean;
   children: ReactNode;
   className?: string;
}) {
   return (
      <section className={clsx('relative mx-5', className)} aria-labelledby={titleId}>
         <div
            className={clsx(
               'absolute right-0 flex h-10 items-start rounded-t-[12px] bg-gradient-to-b from-[#efeaff] to-white pl-2.5 pt-1.5',
               overlapTitle ? 'top-0' : '-top-0.5'
            )}
            style={{ width: tabWidth }}
         >
            {tab}
         </div>
         <h2 id={titleId} className="relative text-[22px] font-black italic leading-[18px] text-[#594d65]">
            {title}
         </h2>
         <div
            className={clsx(
               'relative rounded-[8px] rounded-tr-none bg-white bg-gradient-to-b from-[#f8f6ff] to-white to-[48px]',
               overlapTitle ? 'mt-2.5' : 'mt-4'
            )}
         >
            {children}
         </div>
      </section>
   );
}
