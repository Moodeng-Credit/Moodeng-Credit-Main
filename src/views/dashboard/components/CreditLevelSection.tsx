import { Link } from 'react-router-dom';

import { getCreditLevelNumber, MAX_CREDIT_LIMIT } from '@/config/creditTiers';
import { getEffectiveCreditLimit } from '@/lib/creditLeveling';

import InfoIconButton from './InfoIconButton';

interface CreditLevelSectionProps {
   currentCs: number;
   isVerified: boolean;
   onInfoClick: () => void;
}

const MAX_BARS = 8;

function LevelBadge({ level }: { level: number }) {
   const isActive = level > 0;
   const bars = Math.min(Math.max(level, 0), MAX_BARS);

   return (
      <div className="flex items-center">
         <div
            className={`relative z-10 flex h-[42px] w-[42px] items-center justify-center rounded-full ${isActive ? 'bg-md-green-100' : 'bg-md-neutral-500'}`}
         >
            <div className={`h-7 w-7 rounded-full ${isActive ? 'bg-[#5be59b]' : 'bg-md-neutral-1900'}`} />
            {isActive ? (
               <div className="absolute right-[6px] top-1/2 flex -translate-y-1/2 flex-col items-end gap-[2px]">
                  {Array.from({ length: bars }, (_, index) => {
                     const width = 10 + (index / Math.max(bars - 1, 1)) * 22;
                     return (
                        <span
                           key={index}
                           className="block h-[5px] bg-[#009145]"
                           style={{
                              width,
                              clipPath: 'polygon(3px 0, 100% 0, 100% 100%, 0 100%)'
                           }}
                        />
                     );
                  })}
               </div>
            ) : null}
         </div>
         <div
            className={`-ml-md-2 flex h-[26px] w-[68px] items-center justify-end rounded-md-sm px-md-1 ${isActive ? 'bg-md-green-100' : 'bg-md-neutral-500'}`}
         >
            <span className={`font-knewave text-md-b2 ${isActive ? 'text-md-green-800' : 'text-md-neutral-1900'}`}>LVL {level}</span>
         </div>
      </div>
   );
}

export default function CreditLevelSection({ currentCs, isVerified, onInfoClick }: CreditLevelSectionProps) {
   const effectiveLimit = getEffectiveCreditLimit(currentCs, isVerified);
   const level = effectiveLimit > 0 ? getCreditLevelNumber(effectiveLimit) : 0;
   const progress = Math.max(0, Math.min((effectiveLimit / MAX_CREDIT_LIMIT) * 100, 100));

   return (
      <section>
         <div className="mb-md-4 flex items-center justify-between gap-md-2">
            <div className="flex items-center gap-md-1">
               <h2 className="text-md-h5 font-semibold text-md-heading">Credit Level</h2>
               <InfoIconButton label="Open Credit Level explanation" onClick={onInfoClick} />
            </div>
            <Link
               className="inline-flex items-center gap-md-1 text-right text-md-b3 font-semibold text-md-blue-600 underline"
               to="/credit-leveling-guide"
            >
               Watch guide
            </Link>
         </div>
         <div className="flex items-center justify-between gap-md-3">
            <LevelBadge level={level} />
            <p className="text-md-b2 font-semibold">
               <span className="text-md-primary-900">${effectiveLimit}</span>
               <span className="text-md-neutral-1200"> / ${MAX_CREDIT_LIMIT}</span>
            </p>
         </div>
         <div className="mt-md-2 h-3 overflow-hidden rounded-md-pill bg-md-neutral-300">
            <div
               className="h-full rounded-md-pill bg-md-primary-900 transition-all duration-300"
               style={{ width: `${Math.max(progress, effectiveLimit > 0 ? 4 : 0)}%` }}
            />
         </div>
      </section>
   );
}
