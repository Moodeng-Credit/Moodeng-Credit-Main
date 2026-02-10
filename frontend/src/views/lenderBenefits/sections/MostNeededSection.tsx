import { type JSX } from 'react';

import { mostNeededCards } from '@/views/lenderBenefits/config/mostNeededConfig';
import MostNeededCard from '@/views/lenderBenefits/sections/MostNeededCard';

export default function MostNeededSection(): JSX.Element {
   return (
      <>
         <div className="overflow-hidden z-10 self-end px-9 py-2.5 mt-12 mr-7 text-lg leading-none uppercase rounded-2xl bg-blend-normal bg-zinc-900 text-neutral-100 max-md:px-5 max-md:mt-10 max-md:mr-2.5">
            Most NEEDED
         </div>
         <div id="market" className="flex flex-col items-start pl-4 mt-0 w-full max-md:pb-24 max-md:max-w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
               {mostNeededCards.map((cardData) => (
                  <MostNeededCard key={cardData.id} data={cardData} />
               ))}
            </div>
         </div>
      </>
   );
}
