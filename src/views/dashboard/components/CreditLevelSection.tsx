import { useMemo } from 'react';

import { Link } from 'react-router-dom';

import { getCreditLevelNumber, MAX_CREDIT_LIMIT } from '@/config/creditTiers';
import { getEffectiveCreditLimit } from '@/lib/creditLeveling';

interface CreditLevelSectionProps {
   currentCs: number;
   isVerified: boolean;
}

const MAX_BARS = 8;
const BAR_GRADIENT = 'linear-gradient(to top left, #009145, #009145 60%, #5BE59B)';

function LvlBadge({ level }: { level: number }) {
   const isActive = level > 0;
   const blockCount = Math.min(level, MAX_BARS);
   const blockH = blockCount > 5 ? 5.5 : 7.5;

   return (
      <div className="flex items-center">
         <div
            className={`w-[42px] h-[42px] rounded-full flex items-center justify-center z-10 relative ${isActive ? '' : 'bg-md-neutral-500'}`}
            style={isActive ? { background: '#d6f8e6' } : undefined}
         >
            <div
               className={`w-[28px] h-[28px] rounded-full ${isActive ? '' : 'bg-md-neutral-1400'}`}
               style={isActive ? { background: '#5be59b' } : undefined}
            />
            {isActive && (
               <div className="absolute right-[6px] top-1/2 -translate-y-1/2 flex flex-col items-end" style={{ gap: '1.5px' }}>
                  {Array.from({ length: blockCount }, (_, i) => {
                     const t = blockCount === 1 ? 1 : i / (blockCount - 1);
                     const width = 10 + t * 22;
                     return (
                        <div
                           key={i}
                           style={{
                              width: `${width}px`,
                              height: `${blockH}px`,
                              background: BAR_GRADIENT,
                              clipPath: 'polygon(3px 0, 100% 0, 100% 100%, 0 100%)',
                           }}
                        />
                     );
                  })}
               </div>
            )}
         </div>
         <div
            className={`rounded-md-sm flex items-center justify-end px-md-1 h-[26px] w-[62px] -ml-3 ${isActive ? '' : 'bg-md-neutral-500'}`}
            style={isActive ? { background: '#d6f8e6' } : undefined}
         >
            <span className={`font-knewave text-md-b2 ${isActive ? 'text-md-green-700' : 'text-md-neutral-1400'} text-center`}>
               LVL {level}
            </span>
         </div>
      </div>
   );
}

export default function CreditLevelSection({ currentCs, isVerified }: CreditLevelSectionProps) {
   const effectiveLimit = useMemo(() => getEffectiveCreditLimit(currentCs, isVerified), [currentCs, isVerified]);
   const levelNumber = useMemo(() => (effectiveLimit > 0 ? getCreditLevelNumber(effectiveLimit) : 0), [effectiveLimit]);
   const progress = effectiveLimit / MAX_CREDIT_LIMIT;

   return (
      <>
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
               <h2 className="text-md-h5 font-semibold text-md-heading">Credit Level</h2>
               <img src="/icons/question_light.svg" alt="Info" className="w-5 h-5" />
            </div>
            <Link
               to="/support"
               className="inline-flex items-center gap-1.5 text-md-b3 font-medium text-md-blue-600"
            >
               <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                  <circle cx="7" cy="7" r="6" fill="#0076eb" />
                  <polygon points="6,4 10,7 6,10" fill="white" />
               </svg>
               Watch our credit levelling guide
            </Link>
         </div>

         <div className="flex items-center justify-between">
            <LvlBadge level={levelNumber} />
            <span className="text-md-b2 font-semibold">
               <span className="text-md-primary-800">${effectiveLimit}</span>
               <span className="text-md-neutral-700"> / ${MAX_CREDIT_LIMIT}</span>
            </span>
         </div>

         <div className="w-full h-2 bg-md-neutral-300 rounded-full overflow-hidden">
            <div
               className="h-full bg-md-primary-900 rounded-full transition-all duration-500"
               style={{ width: `${Math.max(progress * 100, 2)}%` }}
            />
         </div>
      </>
   );
}
