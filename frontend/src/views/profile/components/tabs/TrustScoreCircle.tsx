import { useEffect, useRef } from 'react';

import { getTrustScoreInfo } from '@/views/profile/components/tabs/useDashboardData';

interface TrustScoreCircleProps {
   score: number;
}

// Arc parameters: 240° horseshoe opening at the BOTTOM (like the screenshot)
// SVG angles are measured clockwise from the positive x-axis (right = 0°, down = 90°)
// Start: 150° (lower-left)   End: 30° (lower-right)   Route: clockwise over the top (through 270°=top)
const toRad = (deg: number) => (deg * Math.PI) / 180;

const CX = 100;
const CY = 110; // arc center, shifted down so the top of the arc is visible
const R = 80;

const startAngle = 150; // SVG-clockwise degrees → lower-left
const endAngle = 30;   // SVG-clockwise degrees → lower-right

const sx = CX + R * Math.cos(toRad(startAngle));
const sy = CY + R * Math.sin(toRad(startAngle));
const ex = CX + R * Math.cos(toRad(endAngle));
const ey = CY + R * Math.sin(toRad(endAngle));

// Clockwise (sweep-flag=1) from lower-left to lower-right goes OVER the top (240° arc)
// large-arc-flag=1 because 240° > 180°
const TRACK_PATH = `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${R} ${R} 0 1 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;

// Total arc length for 240°
const ARC_LENGTH = (240 / 360) * 2 * Math.PI * R;

const TrustScoreCircle = ({ score }: TrustScoreCircleProps) => {
   const progressRef = useRef<SVGPathElement>(null);
   const { color, label } = getTrustScoreInfo(score);

   // Animate from 0 → score on mount
   useEffect(() => {
      const el = progressRef.current;
      if (!el) return;

      const targetOffset = ARC_LENGTH * (1 - score / 100);

      // Start fully hidden then animate to target
      el.style.strokeDashoffset = String(ARC_LENGTH);
      const raf = requestAnimationFrame(() => {
         el.style.transition = 'stroke-dashoffset 1s ease-out';
         el.style.strokeDashoffset = String(targetOffset);
      });

      return () => cancelAnimationFrame(raf);
   }, [score]);

   return (
      <div className="flex flex-col items-center">
         {/* viewBox fits the arc: top at y≈30, bottom at y≈150, sides at x≈20 & x≈180 */}
         <div className="relative" style={{ width: 200, height: 160 }}>
            <svg viewBox="0 0 200 155" width="200" height="160" aria-label={`Trust score: ${score} out of 100`}>
               {/* Background track */}
               <path d={TRACK_PATH} fill="none" stroke="#e5e7eb" strokeWidth="14" strokeLinecap="round" />
               {/* Coloured progress arc */}
               <path
                  ref={progressRef}
                  d={TRACK_PATH}
                  fill="none"
                  stroke={color}
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={ARC_LENGTH}
                  strokeDashoffset={ARC_LENGTH}
               />
            </svg>

            {/* Centre label — positioned in the visual centre of the horseshoe */}
            <div
               className="absolute left-0 right-0 flex flex-col items-center pointer-events-none"
               style={{ top: '30%' }}
            >
               <span
                  className="text-xs font-semibold px-3 py-1 rounded-full border mb-1"
                  style={{ color, borderColor: color }}
               >
                  {label}
               </span>
               <span className="text-3xl font-extrabold text-[#111827] leading-none">{score} points</span>
               <span className="text-xs text-[#6b7280] mt-0.5">Trust Score</span>
            </div>
         </div>
      </div>
   );
};

export default TrustScoreCircle;
