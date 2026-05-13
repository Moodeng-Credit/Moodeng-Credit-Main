import { useMemo } from 'react';

interface TrustScoreSectionProps {
   trustScore: number;
}

const getTrustLabel = (score: number): { label: string; color: string; bgColor: string } => {
   if (score >= 100) return { label: 'Excellent', color: 'text-md-green-800', bgColor: 'bg-md-green-100' };
   if (score >= 60) return { label: 'Good Standing', color: 'text-md-green-800', bgColor: 'bg-md-green-100' };
   if (score >= 40) return { label: 'Fair Standing', color: 'text-[#b8860b]', bgColor: 'bg-[#fff8e0]' };
   if (score >= 20) return { label: 'Building Trust', color: 'text-[#b8860b]', bgColor: 'bg-[#fff8e0]' };
   return { label: 'Getting Started', color: 'text-md-neutral-700', bgColor: 'bg-md-neutral-300' };
};

const MAX_SCORE = 140;
const GAUGE_CX = 150;
const GAUGE_CY = 140;
const GAUGE_R = 120;
const STROKE_W = 18;

function arcPoint(angle: number) {
   return {
      x: GAUGE_CX + GAUGE_R * Math.cos(angle),
      y: GAUGE_CY - GAUGE_R * Math.sin(angle),
   };
}

function TrustGauge({ score }: { score: number }) {
   const pct = Math.min(score / MAX_SCORE, 1);
   const gradientId = 'trustGaugeGradient';

   const start = arcPoint(Math.PI);
   const end = arcPoint(0);
   const fill = arcPoint(Math.PI * (1 - pct));
   const large = pct > 0.5 ? 1 : 0;
   const arcD = `M ${start.x} ${start.y} A ${GAUGE_R} ${GAUGE_R} 0 ${large} 1 ${fill.x} ${fill.y}`;

   return (
      <svg viewBox="0 0 300 165" className="w-full max-w-[260px] mx-auto overflow-visible">
         <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
               <stop offset="0%" stopColor="#0F5B32" />
               <stop offset="100%" stopColor="#1FC16B" />
            </linearGradient>
         </defs>

         <path
            d={`M ${start.x} ${start.y} A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${end.x} ${end.y}`}
            stroke="#e8e4ed"
            strokeWidth={STROKE_W}
            fill="none"
            strokeLinecap="round"
         />
         {pct > 0 && (
            <path
               d={arcD}
               stroke={`url(#${gradientId})`}
               strokeWidth={STROKE_W}
               fill="none"
               strokeLinecap="round"
            />
         )}
      </svg>
   );
}

export default function TrustScoreSection({ trustScore }: TrustScoreSectionProps) {
   const { label, color, bgColor } = useMemo(() => getTrustLabel(trustScore), [trustScore]);

   return (
      <>
         <div className="flex items-center gap-1.5">
            <h2 className="text-md-h5 font-semibold text-md-heading">Trust Score</h2>
            <img src="/icons/question_light.svg" alt="Info" className="w-5 h-5" />
         </div>

         <div className="flex flex-col items-center -mt-2">
            <div className="relative w-full max-w-[260px]">
               <TrustGauge score={trustScore} />
               <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-md-b4 font-medium ${color} ${bgColor} mb-1`}>
                     {label}
                  </span>
                  <p className="text-md-h3 font-semibold text-md-heading">{trustScore} points</p>
                  <p className="text-md-b3 text-md-neutral-700">Trust Score</p>
               </div>
            </div>
         </div>

         <p className="text-md-b3 text-md-neutral-700 text-center">
            Your Trust Score grows with every on-time repayment and lives with your wallet.
         </p>
      </>
   );
}
