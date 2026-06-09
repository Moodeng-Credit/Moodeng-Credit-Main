import { useMemo } from 'react';

import { getTrustPointRewardProgress } from '@/views/dashboard/trustPointRewards';

interface TrustScoreSectionProps {
   trustScore: number;
}

const getTierFillPercent = (score: number, tierFloor: number, tierCeiling: number | null): number => {
   if (tierCeiling === null) return 100;

   const normalizedPoints = Math.max(0, Math.floor(score));
   const tierSpan = tierCeiling - tierFloor;

   return tierSpan > 0 ? Math.min(100, Math.max(0, Math.round(((normalizedPoints - tierFloor) / tierSpan) * 100))) : 100;
};

const getTrustLabel = (score: number): { label: string; color: string; bgColor: string } => {
   if (score >= 100) return { label: 'Excellent', color: 'text-md-green-800', bgColor: 'bg-md-green-100' };
   if (score >= 60) return { label: 'Good Standing', color: 'text-md-green-800', bgColor: 'bg-md-green-100' };
   if (score >= 40) return { label: 'Fair Standing', color: 'text-[#b8860b]', bgColor: 'bg-[#fff8e0]' };
   if (score >= 20) return { label: 'Building Trust', color: 'text-[#b8860b]', bgColor: 'bg-[#fff8e0]' };
   return { label: 'Getting Started', color: 'text-md-neutral-700', bgColor: 'bg-md-neutral-300' };
};

const GAUGE_CX = 150;
const GAUGE_CY = 140;
const GAUGE_R = 120;
const STROKE_W = 18;

function arcPoint(angle: number) {
   return {
      x: GAUGE_CX + GAUGE_R * Math.cos(angle),
      y: GAUGE_CY - GAUGE_R * Math.sin(angle)
   };
}

function TrustGauge({ progressPercent }: { progressPercent: number }) {
   const pct = Math.min(progressPercent / 100, 1);
   const gradientId = 'trustGaugeGradient';

   const start = arcPoint(Math.PI);
   const end = arcPoint(0);
   const fill = arcPoint(Math.PI * (1 - pct));
   const large = pct > 0.5 ? 1 : 0;
   const arcD = `M ${start.x} ${start.y} A ${GAUGE_R} ${GAUGE_R} 0 ${large} 1 ${fill.x} ${fill.y}`;

   return (
      <svg viewBox="-10 0 320 175" className="w-full max-w-[260px] mx-auto">
         <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
               <stop offset="0%" stopColor="#0F5B32" />
               <stop offset="100%" stopColor="#1FC16B" />
            </linearGradient>
         </defs>

         <path
            className="trust-gauge-track"
            d={`M ${start.x} ${start.y} A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${end.x} ${end.y}`}
            stroke="#e8e4ed"
            strokeWidth={STROKE_W}
            fill="none"
            strokeLinecap="round"
         />
         {pct > 0 && <path d={arcD} stroke={`url(#${gradientId})`} strokeWidth={STROKE_W} fill="none" strokeLinecap="round" />}
      </svg>
   );
}

export default function TrustScoreSection({ trustScore }: TrustScoreSectionProps) {
   const { label, color, bgColor } = useMemo(() => getTrustLabel(trustScore), [trustScore]);
   const { nextReward, pointsToNext, rewards } = useMemo(() => getTrustPointRewardProgress(trustScore), [trustScore]);
   const previousReward = useMemo(() => [...rewards].reverse().find((reward) => reward.status === 'unlocked') ?? null, [rewards]);
   const tierFillPercent = useMemo(
      () => getTierFillPercent(trustScore, previousReward?.threshold ?? 0, nextReward?.threshold ?? null),
      [trustScore, previousReward, nextReward]
   );
   const nextRewardCaption = nextReward ? `${pointsToNext} pts to ${nextReward.title}` : 'Top tier reached';

   return (
      <>
         <div className="flex items-center gap-1.5" data-tour-target="dashboard-trust-score-heading">
            <h2 className="text-md-h5 font-semibold text-md-heading">Trust Score</h2>
            <img src="/icons/question_light.svg" alt="Info" className="w-5 h-5" />
         </div>

         <div className="flex flex-col items-center -mt-2">
            <div className="relative w-full max-w-[260px]">
               <TrustGauge progressPercent={tierFillPercent} />
               <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-md-b4 font-medium ${color} ${bgColor} mb-1`}>{label}</span>
                  <p className="text-md-h3 font-semibold text-md-heading">{trustScore} points</p>
                  <p className="text-md-b3 text-md-neutral-700">{nextRewardCaption}</p>
               </div>
            </div>
         </div>

         <p className="text-md-b3 text-md-neutral-700 text-center">
            Your Trust Score grows with every on-time repayment and lives with your wallet.
         </p>
      </>
   );
}
