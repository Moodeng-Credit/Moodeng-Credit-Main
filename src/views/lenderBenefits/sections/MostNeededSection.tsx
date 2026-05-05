import { type JSX } from 'react';

import { mostNeededCards } from '@/views/lenderBenefits/config/mostNeededConfig';
import MostNeededCard from '@/views/lenderBenefits/sections/MostNeededCard';

export default function MostNeededSection(): JSX.Element {
   return (
      <>
         <div className="lender-market-label z-10 self-end rounded-2xl bg-zinc-900 px-9 py-2.5 text-lg uppercase leading-none text-neutral-100 max-md:mr-2.5 max-md:mt-8 max-md:px-5">
            First markets
         </div>
         <div id="market" className="mt-0 flex w-full flex-col items-start max-md:pb-16 max-md:max-w-full">
            <div className="grid w-full grid-cols-1 gap-5 px-5 md:grid-cols-3">
               {mostNeededCards.map((cardData) => (
                  <MostNeededCard key={cardData.id} data={cardData} />
               ))}
            </div>
         </div>
      </>
   );
}
