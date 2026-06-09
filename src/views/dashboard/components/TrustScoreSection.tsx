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

// Gauge geometry — all coordinates + half stroke-width must fit within viewBox "0 0 240 140"
// CX=120, CY=115, R=95, STROKE=16 → half-stroke=8
// Left endpoint:  (120-95, 115) = (25, 115)  → left edge with stroke:  25-8=17  ✓ (≥0)
// Right endpoint: (120+95, 115) = (215, 115) → right edge with stroke: 215+8=223 ✓ (≤240)
// Top of arc:     (120, 115-95) = (120, 20)  → top edge with stroke:   20-8=12  ✓ (≥0)
// Round cap at endpoints extends 8px along tangent → bottom: 115+8=123 ✓ (≤140)
const GAUGE_CX = 120;
const GAUGE_CY = 115;
const GAUGE_R = 95;
const STROKE_W = 16;

function arcPoint(angle: number) {
   return {
      x: GAUGE_CX + GAUGE_R * Math.cos(angle),
      y: GAUGE_CY - GAUGE_R * Math.sin(angle)
   };
}

function TrustGauge({ progressPercent }: { progressPercent: number }) {
   const pct = Math.min(Math.max(progressPercent / 100, 0), 1);
   const gradientId = 'trustGaugeGradient';

   // Track: left endpoint (angle=π) → right endpoint (angle=0), clockwise over the top
   const left = arcPoint(Math.PI); // (25, 115)
   const right = arcPoint(0);      // (215, 115)

   // Fill arc: left → some point along the track
   // fill angle decreases from π (left) toward 0 (right) as pct increases
   const fillAngle = Math.PI * (1 - pct);
   const fill = arcPoint(fillAngle);

   // The fill arc is always ≤ 180°, so large-arc-flag is always 0
   // sweep-flag=1 = clockwise in SVG (y-down), which goes upward over the top
   const trackD = `M ${left.x} ${left.y} A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${right.x} ${right.y}`;
   const arcD = `M ${left.x} ${left.y} A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${fill.x} ${fill.y}`;

   return (
      <div className="w-full max-w-[260px] mx-auto">
         {/* Use className w-full h-auto (no explicit width/height attrs) for correct Safari scaling */}
         <svg viewBox="0 0 240 140" className="w-full h-auto block">
            <defs>
               <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0F5B32" />
                  <stop offset="100%" stopColor="#1FC16B" />
               </linearGradient>
            </defs>

            {/* Grey track */}
            <path d={trackD} stroke="#e8e4ed" strokeWidth={STROKE_W} fill="none" strokeLinecap="round" />

            {/* Green fill arc */}
            {pct > 0 && (
               <path d={arcD} stroke={`url(#${gradientId})`} strokeWidth={STROKE_W} fill="none" strokeLinecap="round" />
            )}
         </svg>
      </div>
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
