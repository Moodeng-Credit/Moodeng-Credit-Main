import { useMemo, useState } from 'react';

import { getTrustPointRewardProgress } from '@/views/dashboard/trustPointRewards';

interface TrustScoreSectionProps {
   trustScore: number;
   /** While true, the score/badge/caption are replaced with skeleton placeholders
    *  instead of showing "0 points / Getting Started" before the real value loads. */
   isLoading?: boolean;
}

// Fixed ceiling — the Top Borrower threshold. The gauge always represents
// the same 0→500 journey; it never resets at intermediate milestones.
const GAUGE_MAX = 500;

// Square-root scale: gives early progress meaningful visual weight while
// still representing the full lifetime journey to 500.
//   35 pts → 26%   |   50 (Silver) → 32%   |   120 (Gold) → 49%
//   250 (Trusted)  → 71%   |   500 (Top) → 100%
function getGaugeFillPct(score: number): number {
   return Math.min(Math.sqrt(Math.max(score, 0) / GAUGE_MAX), 1) * 100;
}

// Labels aligned to actual milestone thresholds.
const getTrustLabel = (score: number): { label: string; color: string; bgColor: string } => {
   if (score >= 500) return { label: 'Top Borrower', color: 'text-md-green-800', bgColor: 'bg-md-green-100' };
   if (score >= 250) return { label: 'Trusted', color: 'text-md-green-800', bgColor: 'bg-md-green-100' };
   if (score >= 120) return { label: 'Good Standing', color: 'text-md-green-800', bgColor: 'bg-md-green-100' };
   if (score >= 50) return { label: 'Building Trust', color: 'text-[#b8860b]', bgColor: 'bg-[#fff8e0]' };
   return { label: 'Getting Started', color: 'text-md-neutral-700', bgColor: 'bg-md-neutral-300' };
};

// Gauge geometry — all coordinates + half-stroke must fit inside viewBox "0 0 240 140".
// CX=120, CY=115, R=95, STROKE=16 → half-stroke=8
//   left  (25, 115): left edge with stroke  25-8=17  ✓
//   right (215,115): right edge with stroke 215+8=223 ✓
//   top   (120, 20): top edge with stroke   20-8=12  ✓
//   caps at endpoints extend 8px tangentially → bottom: 115+8=123 ✓
const GAUGE_CX = 120;
const GAUGE_CY = 115;
const GAUGE_R = 95;
const STROKE_W = 16;

function arcPoint(anglePct: number) {
   // anglePct in [0,1]: 0 = left endpoint (π), 1 = right endpoint (0)
   const angle = Math.PI * (1 - anglePct);
   return {
      x: GAUGE_CX + GAUGE_R * Math.cos(angle),
      y: GAUGE_CY - GAUGE_R * Math.sin(angle)
   };
}

function TrustGauge({ fillPct }: { fillPct: number }) {
   const pct = Math.min(Math.max(fillPct / 100, 0), 1);
   const gradientId = 'trustGaugeGradient';

   const left = arcPoint(0);   // (25, 115)
   const right = arcPoint(1);  // (215, 115)
   const fill = arcPoint(pct);

   // Track: full grey semicircle
   const trackD = `M ${left.x} ${left.y} A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${right.x} ${right.y}`;
   // Fill: always ≤ 180°, so large-arc-flag is always 0
   const fillD = `M ${left.x} ${left.y} A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${fill.x} ${fill.y}`;

   return (
      <div className="w-full max-w-[260px] mx-auto">
         {/* w-full h-auto block: correct Safari SVG scaling without explicit width/height attrs */}
         <svg viewBox="0 0 240 140" className="w-full h-auto block">
            <defs>
               <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0F5B32" />
                  <stop offset="100%" stopColor="#1FC16B" />
               </linearGradient>
            </defs>

            {/* Grey track — trust-gauge-track class picks up dark mode stroke from globals.css */}
            <path className="trust-gauge-track" d={trackD} stroke="#e8e4ed" strokeWidth={STROKE_W} fill="none" strokeLinecap="round" />

            {/* Green fill arc */}
            {pct > 0 && (
               <path d={fillD} stroke={`url(#${gradientId})`} strokeWidth={STROKE_W} fill="none" strokeLinecap="round" />
            )}
         </svg>
      </div>
   );
}

export default function TrustScoreSection({ trustScore, isLoading = false }: TrustScoreSectionProps) {
   const { label, color, bgColor } = useMemo(() => getTrustLabel(trustScore), [trustScore]);
   const { nextReward, pointsToNext } = useMemo(() => getTrustPointRewardProgress(trustScore), [trustScore]);
   const fillPct = useMemo(() => getGaugeFillPct(trustScore), [trustScore]);
   const nextRewardCaption = nextReward ? `${pointsToNext} pts to ${nextReward.title}` : 'Top tier reached';
   const [isHelpOpen, setIsHelpOpen] = useState(false);

   return (
      <>
         <div className="relative flex items-center gap-1.5" data-tour-target="dashboard-trust-score-heading">
            <h2 className="text-md-h5 font-semibold text-md-heading">Trust Score</h2>
            <button
               type="button"
               onClick={() => setIsHelpOpen((v) => !v)}
               className="flex h-6 w-6 items-center justify-center rounded-full"
               aria-label="About trust score"
            >
               <img src="/icons/question_light.svg" alt="" className="w-5 h-5" />
            </button>
            {isHelpOpen && (
               <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsHelpOpen(false)} />
                  <div
                     role="tooltip"
                     className="absolute left-0 top-8 z-20 w-[290px] rounded-[10px] bg-[#360975] px-3 py-2 shadow-[0_8px_24px_rgba(20,18,24,0.18)] before:absolute before:left-4 before:top-[-6px] before:h-0 before:w-0 before:border-x-[6px] before:border-b-[6px] before:border-x-transparent before:border-b-[#360975]"
                  >
                     <p className="text-center text-[14px] font-normal leading-[21px] tracking-[-0.28px] text-[#f1e9fd]">
                        Your Trust Score is your track record on Moodeng, out of 500 points — and counting. It already
                        unlocks perks, with bigger rewards on the way for top scorers. Keep building it!
                     </p>
                  </div>
               </>
            )}
         </div>

         <div className="flex flex-col items-center -mt-2">
            <div className="relative w-full max-w-[260px]">
               <TrustGauge fillPct={isLoading ? 0 : fillPct} />
               <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                  {isLoading ? (
                     <div className="flex animate-pulse flex-col items-center gap-2">
                        <div className="h-5 w-24 rounded-full bg-md-neutral-500" />
                        <div className="h-7 w-28 rounded-full bg-md-neutral-500" />
                        <div className="h-4 w-32 rounded-full bg-md-neutral-500" />
                     </div>
                  ) : (
                     <>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-md-b4 font-medium ${color} ${bgColor} mb-1`}>
                           {label}
                        </span>
                        <p className="text-md-h3 font-semibold text-md-heading">{trustScore} points</p>
                        <p className="text-md-b3 text-md-neutral-700">{nextRewardCaption}</p>
                     </>
                  )}
               </div>
            </div>
         </div>

         <p className="text-md-b3 text-md-neutral-700 text-center">
            Your Trust Score grows with every on-time repayment and lives with your wallet.
         </p>
      </>
   );
}
