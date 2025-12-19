import { type JSX } from 'react';

import { type VerifyStatsCardProps } from '@/views/lenderBenefits/config/verifyStatsConfig';

export const VerifyStatsCard = ({ card }: { card: VerifyStatsCardProps }): JSX.Element => {
   return (
      <div className="flex flex-col w-[33%] max-md:ml-0 max-md:w-full">
         <div className="flex flex-col grow pb-11 w-full bg-white rounded-xl max-md:mt-2.5">
            <div className="flex relative flex-col px-16 w-full rounded-xl aspect-[1.63] max-md:px-5">
               <img
                  alt=""
                  loading="lazy"
                  src={card.bgImage}
                  className="object-cover absolute inset-0 size-full"
                  width={339}
                  height={208}
               />
               <img
                  loading="lazy"
                  src={card.image}
                  className="object-contain w-full h-full z-10 aspect-[1.27]"
                  alt="Product showcase"
                  width={211}
                  height={208}
               />
            </div>
            <div className="flex flex-col items-start pr-16 pl-4 mt-3 text-black max-md:pr-5">
               <div className={`text-lg leading-loose ${card.titleColor}`}>{card.title}</div>
               <div className="mt-3.5 text-xl leading-none">{card.subtitle}</div>
               <div className="mt-4 text-base leading-7">{card.description}</div>
            </div>
         </div>
      </div>
   );
};
