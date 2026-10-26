import type { ReactNode } from 'react';

import clsx from 'clsx';

// The tabbed card shape (white card with a lavender tab behind the title) is drawn in code so it
// stretches to its content; the designer exported it only as a fixed-size vector.

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
               'absolute right-0 flex h-10 items-start rounded-t-[12px] bg-gradient-to-b from-dv2-tab to-dv2-card-tint pl-2.5 pt-1.5',
               overlapTitle ? 'top-0' : '-top-0.5'
            )}
            style={{ width: tabWidth }}
         >
            {tab}
         </div>
         <h2
            id={titleId}
            className="relative whitespace-nowrap text-[clamp(18px,5.6vw,22px)] font-black italic leading-[18px] text-[#594d65] dark:text-[#d9cfe6]"
         >
            {title}
         </h2>
         <div
            className={clsx(
               'relative rounded-[8px] rounded-tr-none bg-dv2-card bg-gradient-to-b from-dv2-card-tint to-dv2-card to-[48px]',
               overlapTitle ? 'mt-2.5' : 'mt-4'
            )}
         >
            {/* Concave corner where the tab meets the card, so tab + card read as one shape (Figma "Rectangle 3467568"). */}
            <span
               className="pointer-events-none absolute -top-3 h-3 w-3"
               style={{ right: tabWidth, background: 'radial-gradient(circle at 0 0, transparent 11.5px, var(--dv2-card-tint) 12px)' }}
               aria-hidden="true"
            />
            {children}
         </div>
      </section>
   );
}
