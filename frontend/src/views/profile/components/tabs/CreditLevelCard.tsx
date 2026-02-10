import { formatNumber } from '@/utils/decimalHelpers';

import type { CreditLevel } from '@/views/profile/components/tabs/types';

interface CreditLevelCardProps {
   level: CreditLevel;
}

const CreditLevelCard = ({ level }: CreditLevelCardProps) => {
   const pausedBadge = level.progressionPaused ? (
      <div className="text-[10px] uppercase tracking-wide bg-[#fde2e2] text-[#b91c1c] px-2 py-1 rounded-full mb-2 font-bold">
         Progression Paused (Late Repayment)
      </div>
   ) : null;

   if (level.isMaxCredit) {
      return (
         <div className="bg-[#2563eb] rounded-xl p-6 min-w-[220px] text-center text-white text-xs font-semibold relative flex-shrink-0">
            <div className="absolute -top-3 -left-3 text-4xl">🎉</div>
            <div className="absolute -top-3 -right-3 text-4xl">🎉</div>
            {pausedBadge}
            <div className="mb-2">{level.date ? `Unlocked on ${level.date}` : 'Max Credit Unlocked!'}</div>
            <div className="text-5xl font-extrabold my-4">
               ${formatNumber(level.amount)}
               <span className="text-2xl">+</span>
            </div>
            <div className="flex items-center justify-center gap-2 font-extrabold mb-2">
               <i className="fas fa-trophy text-yellow-400 text-3xl" />
               <div className="text-2xl text-left">
                  Max Credit
                  <br />
                  <span className="font-normal text-base">Unlocked!</span>
               </div>
            </div>
            {level.requestable ? (
               <button className="bg-white text-[#2563eb] text-sm rounded-md px-4 py-2.5 mt-4 font-semibold w-full" type="button">
                  Request Loan
               </button>
            ) : null}
         </div>
      );
   }

   if (level.unlocked) {
      return (
         <div className="bg-[#e0e7ff] rounded-xl p-4 min-w-[160px] text-center text-[#2563eb] text-xs font-semibold flex-shrink-0">
            {pausedBadge}
            <div className="mb-2">{level.date ? `Credit Unlocked on ${level.date}` : 'Credit Unlocked'}</div>
            <div className="text-3xl font-extrabold my-3">
               ${formatNumber(level.amount)}
               <span className="text-lg">+</span>
            </div>
            {level.requestable ? (
               <button className="bg-[#2563eb] text-white text-sm rounded-md px-4 py-2.5 mt-3 font-semibold w-full" type="button">
                  Request Loan
               </button>
            ) : null}
         </div>
      );
   }

   return (
      <div className="bg-[#e5e7eb] rounded-xl p-6 min-w-[160px] text-center text-[#6b7280] text-lg font-extrabold relative flex-shrink-0">
         {pausedBadge}
         <i className="fas fa-lock absolute top-6 left-1/2 -translate-x-1/2 text-4xl text-gray-400" />
         <div className="mt-16 text-2xl">${formatNumber(level.amount)}</div>
         <div className="text-base font-bold my-2">LOCKED</div>
         <div className="text-xs font-normal text-gray-600 mt-3 whitespace-pre-line">{level.unlockRequirement}</div>
         {level.requestable ? (
            <button
               className="bg-[#6b7280] text-white text-sm rounded-md px-4 py-2.5 mt-4 font-semibold w-full hover:bg-[#4b5563] transition"
               type="button"
            >
               Request Loan
            </button>
         ) : null}
      </div>
   );
};

export default CreditLevelCard;
