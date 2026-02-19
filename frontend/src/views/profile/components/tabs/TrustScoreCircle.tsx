import { useEffect, useRef } from 'react';

import { getTrustScoreInfo } from '@/views/profile/components/tabs/useDashboardData';

interface TrustScoreCircleProps {
   score: number;
}

// Arc parameters: 240° horseshoe opening at the BOTTOM (bigger R for prominence)
// SVG angles: clockwise from positive x-axis. Start: 150° (lower-left) End: 30° (lower-right)
const toRad = (deg: number) => (deg * Math.PI) / 180;

const CX = 100;
const CY = 125;
const R = 100; // larger arc

const startAngle = 150;
const endAngle = 30;

const sx = CX + R * Math.cos(toRad(startAngle));
const sy = CY + R * Math.sin(toRad(startAngle));
const ex = CX + R * Math.cos(toRad(endAngle));
const ey = CY + R * Math.sin(toRad(endAngle));

const TRACK_PATH = `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${R} ${R} 0 1 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
const ARC_LENGTH = (240 / 360) * 2 * Math.PI * R;

// ViewBox with padding so arc + stroke + filter glow are never clipped
const PAD = 24; // room for stroke and filter blur
const VIEWBOX_X = -PAD;
const VIEWBOX_Y = -PAD;
const VIEWBOX_WIDTH = 200 + PAD * 2;
const VIEWBOX_HEIGHT = 190 + PAD * 2;
// Badge at circle center in viewBox coords: (CX, CY) -> % of (VIEWBOX_WIDTH, VIEWBOX_HEIGHT)
const BADGE_TOP_PCT = ((CY + PAD) / VIEWBOX_HEIGHT) * 100;
const BADGE_LEFT_PCT = ((CX + PAD) / VIEWBOX_WIDTH) * 100;

const STROKE_WIDTH = 8; // thinner arc

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

   // Smaller arc, centered
   const svgW = 280;
   const svgH = Math.round(svgW * (VIEWBOX_HEIGHT / VIEWBOX_WIDTH));

   return (
      <div
         className="relative flex justify-center items-center mx-auto w-fit"
         style={{ width: svgW, height: svgH }}
         aria-label={`Trust score: ${score} out of 100`}
      >
         <svg
            viewBox={`${VIEWBOX_X} ${VIEWBOX_Y} ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            width={svgW}
            height={svgH}
            className="block"
            style={{ overflow: 'visible' }}
         >
            <defs>
               <filter id="arcGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                  <feMerge>
                     <feMergeNode in="blur" />
                     <feMergeNode in="SourceGraphic" />
                  </feMerge>
               </filter>
            </defs>
            {/* Background track — soft gray */}
            <path d={TRACK_PATH} fill="none" stroke="#e5e7eb" strokeWidth={STROKE_WIDTH} strokeLinecap="round" />
            {/* Coloured progress arc with subtle glow */}
            <path
               ref={progressRef}
               d={TRACK_PATH}
               fill="none"
               stroke={color}
               strokeWidth={STROKE_WIDTH}
               strokeLinecap="round"
               strokeDasharray={ARC_LENGTH}
               strokeDashoffset={ARC_LENGTH}
               style={{ filter: 'url(#arcGlow)' }}
            />
         </svg>

         {/* Badge + points in the center of the arc circle */}
         <div
            className="absolute flex flex-col items-center justify-center pointer-events-none"
            style={{
               left: `${BADGE_LEFT_PCT}%`,
               top: `${BADGE_TOP_PCT}%`,
               transform: 'translate(-50%, -50%)'
            }}
         >
            <span
               className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 mb-1.5 bg-background/80 backdrop-blur-sm"
               style={{ color, borderColor: color }}
            >
               {label}
            </span>
            <span className="text-3xl font-extrabold text-foreground tabular-nums leading-none">{score}</span>
            <span className="text-xs text-muted-foreground mt-0.5 font-medium">points</span>
         </div>
      </div>
   );
};

export default TrustScoreCircle;
