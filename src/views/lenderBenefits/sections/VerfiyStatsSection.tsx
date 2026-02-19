import { type JSX } from 'react';

import { VerifyStatsCardConfig } from '@/views/lenderBenefits/config/verifyStatsConfig';
import { VerifyStatsCard } from '@/views/lenderBenefits/sections/VerfiyStatsCard';

export default function VerfiyStatsSection(): JSX.Element {
   return (
      <div className="flex flex-col mt-20 max-w-full rounded-none w-[1096px] max-md:mt-10">
         <div className="max-md:max-w-full">
            <div className="flex gap-5 max-md:flex-col">
               {VerifyStatsCardConfig.map((card) => {
                  return <VerifyStatsCard key={card.title} card={card} />;
               })}
            </div>
         </div>
      </div>
   );
}
