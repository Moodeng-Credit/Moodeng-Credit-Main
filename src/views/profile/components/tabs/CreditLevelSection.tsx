import React from 'react';

import useEmblaCarousel from 'embla-carousel-react';

import LoanRequestForm from '@/components/loan-request/LoanRequestForm';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

import { useCarouselNav } from '@/hooks/useCarouselNav';

import CreditLevelCard from '@/views/profile/components/tabs/CreditLevelCard';
import Scroller from '@/views/profile/components/tabs/Srcoller';
import type { CreditLevel } from '@/views/profile/components/tabs/types';

type Props = {
   creditLevels: CreditLevel[];
};
const CreditLevelSection: React.FC<Props> = ({ creditLevels }) => {
   const [showModal, setShowModal] = React.useState(false);
   const [emblaRef, emblaApi] = useEmblaCarousel({
      dragFree: true,
      skipSnaps: true
   });

   const { prevBtnDisabled, nextBtnDisabled, onPrevButtonClick, onNextButtonClick } = useCarouselNav(emblaApi);

   return (
      <div
         className="bg-white rounded-xl flex flex-col select-none"
         style={
            {
               '--slide-height': '19rem',
               '--slide-spacing': '1.5rem',
               '--slide-size': '100%'
            } as React.CSSProperties
         }
      >
         <div className="flex p-6 pb-0">
            <h2 className="font-extrabold text-xl sm:text-3xl flex items-center gap-2 text-[#2D3748]">
               Credit Level{' '}
               <InfoTooltip
                  customIcon={<i className="text-[#374151] fa-solid fa-circle-info hover:bg-gray-50 text-lg sm:text-2xl transition" />}
                  content="Your Credit Level determines your loan limits and interest rates. To advance your level, consistently borrow your max eligible amount and repay on time."
               />
            </h2>
            <Scroller
               prevDisabled={prevBtnDisabled}
               nextDisabled={nextBtnDisabled}
               onNext={onNextButtonClick}
               onPrevious={onPrevButtonClick}
               className="ml-auto"
            />
         </div>
         <div ref={emblaRef} className="overflow-hidden px-3 pt-6">
            <div className="bg-white flex touch-pan-y touch-pinch-zoom -ml-[var(--slide-spacing)]">
               {creditLevels.map((level) => (
                  <CreditLevelCard key={level.id} level={level} onShowLoanRequestForm={() => setShowModal(true)} />
               ))}
            </div>
         </div>
         <LoanRequestForm open={showModal} onHide={() => setShowModal(false)} />
      </div>
   );
};

export default CreditLevelSection;
