import { useMemo } from 'react';

import InfoIconButton from './InfoIconButton';

interface TrustScoreSectionProps {
   trustScore: number;
   onInfoClick: () => void;
}

const MAX_TRUST_SCORE = 140;
const GAUGE_CX = 150;
const GAUGE_CY = 140;
const GAUGE_R = 120;
const STROKE_WIDTH = 18;

const getTrustLabel = (score: number) => {
   if (score >= 100) return { label: 'Excellent', className: 'bg-md-green-100 text-md-green-900 border-[#bfe8cf]' };
   if (score >= 60) return { label: 'Good Standing', className: 'bg-md-green-100 text-md-green-900 border-[#bfe8cf]' };
   if (score >= 40) return { label: 'Fair Standing', className: 'bg-[#fff8e1] text-[#8a6d00] border-[#f5dd83]' };
   if (score >= 20) return { label: 'Building Trust', className: 'bg-[#fff8e1] text-[#8a6d00] border-[#f5dd83]' };
   return { label: 'Getting Started', className: 'bg-md-neutral-300 text-md-neutral-1400 border-md-neutral-500' };
};

function arcPoint(angle: number) {
   return {
      x: GAUGE_CX + GAUGE_R * Math.cos(angle),
      y: GAUGE_CY - GAUGE_R * Math.sin(angle)
   };
}

function TrustGauge({ score }: { score: number }) {
   const pct = Math.max(0, Math.min(score / MAX_TRUST_SCORE, 1));
   const start = arcPoint(Math.PI);
   const end = arcPoint(0);
   const fill = arcPoint(Math.PI * (1 - pct));
   const largeArc = pct > 0.5 ? 1 : 0;

   return (
      <svg aria-hidden="true" className="mx-auto w-full max-w-[286px] overflow-visible" viewBox="0 0 300 165">
         <defs>
            <linearGradient id="borrowerTrustGauge" x1="0%" x2="100%" y1="0%" y2="0%">
               <stop offset="0%" stopColor="#0f5b32" />
               <stop offset="100%" stopColor="#1fc16b" />
            </linearGradient>
         </defs>
         <path
            d={`M ${start.x} ${start.y} A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${end.x} ${end.y}`}
            fill="none"
            stroke="#e8e4ed"
            strokeLinecap="round"
            strokeWidth={STROKE_WIDTH}
         />
         {pct > 0 ? (
            <path
               d={`M ${start.x} ${start.y} A ${GAUGE_R} ${GAUGE_R} 0 ${largeArc} 1 ${fill.x} ${fill.y}`}
               fill="none"
               stroke="url(#borrowerTrustGauge)"
               strokeLinecap="round"
               strokeWidth={STROKE_WIDTH}
            />
         ) : null}
      </svg>
   );
}

export default function TrustScoreSection({ trustScore, onInfoClick }: TrustScoreSectionProps) {
   const label = useMemo(() => getTrustLabel(trustScore), [trustScore]);

   return (
      <section>
         <div className="mb-md-3 flex items-center gap-md-1">
            <h2 className="text-md-h5 font-semibold text-md-heading">Trust Score</h2>
            <InfoIconButton label="Open Trust Score explanation" onClick={onInfoClick} />
         </div>
         <div className="relative -mt-md-2">
            <TrustGauge score={trustScore} />
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-md-2">
               <span className={`rounded-md-pill border px-md-2 py-1 text-md-b4 font-semibold ${label.className}`}>{label.label}</span>
               <p className="mt-md-1 text-md-h4 font-semibold text-md-heading">{trustScore} points</p>
               <p className="text-md-b3 text-md-neutral-1200">Trust Score</p>
            </div>
         </div>
         <p className="mt-md-3 max-w-[306px] text-md-b2 text-md-neutral-1200">
            Your Trust Score grows with every on-time repayment and lives with your wallet.
         </p>
      </section>
   );
}
