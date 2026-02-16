import { useEffect, useState } from 'react';

import type { TrustScoreData } from '@/lib/trustScore';

interface TrustScoreWidgetProps {
   trustScoreData: TrustScoreData;
   onHelpClick?: () => void;
}

const TrustScoreWidget = ({ trustScoreData, onHelpClick }: TrustScoreWidgetProps) => {
   const [animatedPercentage, setAnimatedPercentage] = useState(0);
   const { score, level, color, percentage } = trustScoreData;

   // Animate the circular progress on mount
   useEffect(() => {
      const timeout = setTimeout(() => {
         setAnimatedPercentage(percentage);
      }, 100);

      return () => clearTimeout(timeout);
   }, [percentage]);

   // Calculate circle properties for SVG
   const radius = 70;
   const strokeWidth = 12;
   const normalizedRadius = radius - strokeWidth / 2;
   const circumference = normalizedRadius * 2 * Math.PI;
   const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;

   return (
      <div className="bg-white rounded-xl p-6 space-y-4">
         <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-xl select-none">Trust Score</h2>
            {onHelpClick && (
               <button
                  onClick={onHelpClick}
                  aria-label="Trust Score Info"
                  className="text-[#374151] text-sm rounded-full border border-[#374151] w-6 h-6 flex items-center justify-center hover:bg-gray-50 transition"
                  type="button"
               >
                  <i className="fa-solid fa-circle-info" />
               </button>
            )}
         </div>

         <div className="flex flex-col items-center justify-center py-6">
            {/* Circular Progress Indicator */}
            <div className="relative w-48 h-48">
               <svg className="transform -rotate-90" width="192" height="192">
                  {/* Background circle */}
                  <circle
                     stroke="#e5e7eb"
                     fill="transparent"
                     strokeWidth={strokeWidth}
                     r={normalizedRadius}
                     cx="96"
                     cy="96"
                  />
                  {/* Progress circle */}
                  <circle
                     stroke={color}
                     fill="transparent"
                     strokeWidth={strokeWidth}
                     strokeDasharray={`${circumference} ${circumference}`}
                     style={{
                        strokeDashoffset,
                        transition: 'stroke-dashoffset 1s ease-in-out'
                     }}
                     strokeLinecap="round"
                     r={normalizedRadius}
                     cx="96"
                     cy="96"
                  />
               </svg>

               {/* Center content */}
               <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div
                     className="text-sm font-semibold px-3 py-1 rounded-full mb-2"
                     style={{
                        backgroundColor: `${color}20`,
                        color: color
                     }}
                  >
                     {level}
                  </div>
                  <div className="text-4xl font-bold text-gray-900">{score} points</div>
                  <div className="text-sm text-gray-500">Trust Score</div>
               </div>
            </div>
         </div>

         <p className="text-sm text-gray-600 text-center">
            Your Trust Score grows with every on-time repayment and lives with your wallet.
         </p>
      </div>
   );
};

export default TrustScoreWidget;
