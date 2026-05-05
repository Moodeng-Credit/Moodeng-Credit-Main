import { type JSX } from 'react';

import { type LendingIncentiveItem, lendingIncentivesData } from '@/views/lenderBenefits/config/lendingIncentivesConfig';

interface LendingIncentiveCardProps {
   item: LendingIncentiveItem;
}

function LendingIncentiveCard({ item }: LendingIncentiveCardProps): JSX.Element {
   const isImageLeft = item.imagePosition === 'left';

   return (
      <article className="lender-incentive-card mt-4 w-full max-w-[1064px] rounded-[28px] bg-white p-8 shadow-sm max-md:p-5">
         <div className={`grid gap-8 md:grid-cols-[0.95fr_1.05fr] md:items-center ${isImageLeft ? 'md:[&>*:first-child]:order-2' : ''}`}>
            <div className="lender-incentive-copy">
               <p className="text-md-b2 font-semibold uppercase tracking-[0.14em] text-stone-500">Lender terms</p>
               <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-normal text-neutral-950 max-md:text-3xl">
                  {item.titleHighlight ? (
                     <>
                        {item.title} <span className="rounded-lg bg-orange-200 px-2">{item.titleHighlight}</span>
                     </>
                  ) : (
                     item.title
                  )}
               </h2>
               <div className="mt-5 grid gap-3">
                  {item.description.map((paragraph) => (
                     <div key={paragraph} className="lender-incentive-point rounded-[16px] p-4 text-md-b2 leading-6 text-stone-700">
                        {paragraph}
                     </div>
                  ))}
               </div>
               {item.docsLink ? (
                  <a
                     className="lender-incentive-docs-link"
                     href={item.docsLink.href}
                     target="_blank"
                     rel="noreferrer"
                  >
                     {item.docsLink.label}
                  </a>
               ) : null}
            </div>

            <div className="lender-incentive-visual">
               <div className="lender-incentive-image-wrap overflow-hidden rounded-[22px]">
                  <img
                     loading="lazy"
                     src={item.image.src}
                     alt={item.image.alt}
                     className="h-full w-full object-cover"
                     width={477}
                     height={288}
                  />
               </div>
               {item.imageNote ? <p className="lender-incentive-image-note">{item.imageNote}</p> : null}
               <div className="lender-incentive-stage" aria-hidden="true" />
            </div>
         </div>
      </article>
   );
}

export default function LendingIncentivesSection(): JSX.Element {
   return (
      <>
         {lendingIncentivesData.map((item) => (
            <LendingIncentiveCard key={item.id} item={item} />
         ))}
      </>
   );
}
