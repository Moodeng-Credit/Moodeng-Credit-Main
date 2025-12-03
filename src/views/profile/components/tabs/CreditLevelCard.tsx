import { Star } from 'lucide-react';

import Crown from '@/components/svgs/Crown';
import Lock from '@/components/svgs/Lock';
import Trophy from '@/components/svgs/Trophy';

import { formatNumber } from '@/utils/decimalHelpers';

import type { CreditLevel } from '@/views/profile/components/tabs/types';

interface CreditLevelCardProps {
   level: CreditLevel;
   onShowLoanRequestForm?: () => void;
}

const carouselClasses = 'translate-x-0 translate-y-0 pl-[var(--slide-spacing)]';
const CreditLevelCard = ({ level, onShowLoanRequestForm }: CreditLevelCardProps) => {
   if (level.unlocked && !level.isMaxCredit) {
      return (
         <div className={` ${carouselClasses} flex-[0_0_196px] h-[313px]`}>
            <div className="bg-accent h-full rounded-xl rounded-b-none p-4 pb-6 min-w-[180px] text-center text-primary text-xs flex flex-col gap-4">
               <div>
                  Credit Unlocked
                  <br />
                  on {level.date}
               </div>
               <div className="text-[40px] font-bold my-4 flex items-center justify-center w-full relative">
                  ${formatNumber(level.amount)}
                  <span className="text-lg relative top-2">+</span>
               </div>
               <div className="flex items-center flex-col justify-center">
                  <div className="relative">
                     <Crown className="text-primary absolute -top-4 -left-5" />
                     <span className="font-semibold text-sm">{level.lender}</span>
                  </div>
                  <div className="text-sm text-black font-normal">Helped you with</div>
               </div>
               <div className="text-sm text-black font-extrabold whitespace-pre-line">{level.reason}</div>
               <div className="text-sm text-black font-normal mt-auto">{level.repayTime}</div>
            </div>
         </div>
      );
   }

   if (level.unlocked && level.isMaxCredit) {
      return (
         <div className={`${carouselClasses} flex-[0_0_400px] h-[313px]`}>
            <div className="relaitve bg-[#003EFCB2] h-full rounded-xl rounded-b-none px-6 pt-4 pb-6 min-w-[384px] text-center text-white text-xs font-semibold flex flex-col gap-5">
               <Star className="w-8 h-8 -rotate-[176deg]  absolute top-0 left-3 text-4xl fill-[#FFDE96] text-[#FFDE96]" />
               <Star className="w-11 h-11 -rotate-[17.76deg] absolute -top-6 left-[75px] text-4xl fill-[#FFACF9] text-[#FFACF9]" />
               <Star className="w-[58px] h-[58px] rotate-[6.97deg] absolute -top-[20px] right-3 text-4xl fill-[#B996FF] text-[#B996FF]" />
               <div className="mb-2 text-sm font-normal">Unlocked on {level.date}</div>
               <div className="text-[75px] font-bold my-4 inline-flex items-center justify-center w-full px-5 relative">
                  <span>${formatNumber(level.amount)}</span>
                  <span className="text-2xl relative top-4">+</span>
               </div>
               <div className="flex items-center justify-center gap-2 font-semibold mb-2 w-full px-5">
                  <Trophy className="text-[#FFDE96] text-3xl" />
                  <div className="text-3xl text-left">
                     Max Credit
                     <br />
                     <span className="font-normal">Unlocked!</span>
                  </div>
               </div>
               <div className="text-base font-normal mt-auto">Repay a ${level.amount} Loan to Unlock Next Level</div>
            </div>
         </div>
      );
   }

   return (
      <div className={`${carouselClasses} flex-[0_0_196px] h-[313px]`}>
         <div className="relative bg-[#e5e7eb] h-full rounded-xl rounded-b-none p-6 min-w-[180px] text-center text-[#6b7280] text-lg font-bold flex flex-col gap-5">
            <Lock className="absolute -top-2 left-1/2 -translate-x-1/2 text-4xl text-gray-400" />
            <div className="mt-10 text-[40px]">${formatNumber(level.amount)}</div>
            <div className="text-[32px] font-bold mt-6">LOCKED</div>
            <div className="text-sm font-normal text-gray-600 mt-3 whitespace-pre-line">{level.unlockRequirement}</div>
            {level.hasRequestButton === true ? (
               <button
                  className="font-normal bg-[#6b7280] text-white text-sm rounded-md px-4 py-2.5 mt-auto w-full hover:bg-[#4b5563] transition"
                  type="button"
                  onClick={onShowLoanRequestForm}
               >
                  Request Loan
               </button>
            ) : null}
         </div>
      </div>
   );
};

export default CreditLevelCard;
