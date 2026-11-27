import { useState } from 'react';

import { useFloatingParticles } from '@/components/motion/TapDelight';

import { useLocalization } from '@/i18n';

// Limit Spin wheel (2026-11-27): the server already drew the raise (limit_boost_spins); this only lands on it.
// Slices are mostly +$2, like the odds (_shared/creditAndPoints.ts LIMIT_SPIN_ODDS).
const SLICES = [2, 3, 2, 4, 2, 3, 2, 5] as const;
const SLICE_DEG = 360 / SLICES.length;
const SPIN_MS = 3200;
const FILLS = ['#7c5cff', '#ffce1b', '#9b84ff', '#ff8fb1', '#7c5cff', '#ffce1b', '#9b84ff', '#3fb46a'];
const INKS = ['#fff', '#704518', '#fff', '#fff', '#fff', '#704518', '#fff', '#fff'];
const CONFETTI = ['#6b55f7', '#ffce1b', '#2f8a4a', '#ff5c8a', '#4492f1'];
// Labels on the bottom half are turned the other way so none read upside down.
const upright = (deg: number) => (deg > 90 && deg < 270 ? deg + 180 : deg);

const COPY = {
   en: {
      title: 'You earned a spin!',
      body: 'Paying back on time grows your limit. Spin to see by how much.',
      spin: 'Spin',
      won: (amount: number) => `+$${amount}!`,
      now: (limit: number) => `Your limit is now $${limit}.`,
      done: 'Nice'
   },
   fil: {
      title: 'May spin ka!',
      body: 'Ang on-time na bayad ay nagpapalaki ng limit mo. I-spin para makita kung magkano.',
      spin: 'I-spin',
      won: (amount: number) => `+$${amount}!`,
      now: (limit: number) => `$${limit} na ang limit mo.`,
      done: 'Ayos'
   }
};

export default function LimitSpinWheel({
   amount,
   toLimit,
   onDone
}: {
   /** The raise the server drew (to_limit − from_limit). */
   amount: number;
   toLimit: number;
   /** After they've seen the result (mark it seen, close a sheet…). */
   onDone?: () => void;
}) {
   const { locale } = useLocalization();
   const t = COPY[locale === 'fil' ? 'fil' : 'en'];
   const [rotation, setRotation] = useState(0);
   const [phase, setPhase] = useState<'ready' | 'spinning' | 'done'>('ready');
   const { burst, layer } = useFloatingParticles();

   const spin = () => {
      if (phase !== 'ready') return;
      // Land on a slice showing this amount (a capped raise smaller than every slice lands on +$2).
      const matches = SLICES.map((value, index) => ({ value, index })).filter((slice) => slice.value === amount);
      const target = (matches.length ? matches : [{ value: 2, index: 0 }])[Math.floor(Math.random() * Math.max(matches.length, 1))];
      const sliceCenter = target.index * SLICE_DEG + SLICE_DEG / 2;
      setRotation(360 * 5 + (360 - sliceCenter));
      setPhase('spinning');
      window.setTimeout(() => {
         setPhase('done');
         burst((index) => <span className="block h-2.5 w-1.5 rounded-[2px]" style={{ background: CONFETTI[index % CONFETTI.length] }} />, {
            count: 18,
            fullCircle: true,
            spreadX: 120,
            rise: 90,
            originY: '40%'
         });
      }, SPIN_MS);
   };

   const point = (deg: number, radius: number) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return [120 + radius * Math.cos(rad), 120 + radius * Math.sin(rad)];
   };

   return (
      <div className="relative flex flex-col items-center gap-3 text-center" data-testid="limit-spin">
         <p className="text-[20px] font-bold text-[#040033] dark:text-[#F0EAFF]">{phase === 'done' ? t.won(amount) : t.title}</p>
         <p className="text-[14px] leading-[20px] text-[#70617F] dark:text-[#A89BB8]">{phase === 'done' ? t.now(toLimit) : t.body}</p>
         <div className="relative aspect-square w-full max-w-[240px]">
            <div
               aria-hidden="true"
               className="absolute left-1/2 top-[-4px] z-10 h-0 w-0 -translate-x-1/2 border-x-[11px] border-t-[20px] border-x-transparent border-t-[#d51728]"
            />
            <svg
               viewBox="0 0 240 240"
               className="h-full w-full drop-shadow-[0_10px_24px_rgba(107,85,247,0.28)]"
               style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: phase === 'spinning' ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.72, 0.12, 1)` : 'none'
               }}
               role="img"
               aria-label="Limit spin wheel"
            >
               <circle cx="120" cy="120" r="118" fill="#ffd84d" />
               {SLICES.map((value, index) => {
                  const start = index * SLICE_DEG;
                  const [x1, y1] = point(start, 112);
                  const [x2, y2] = point(start + SLICE_DEG, 112);
                  const [tx, ty] = point(start + SLICE_DEG / 2, 76);
                  return (
                     <g key={index}>
                        <path d={`M120,120 L${x1},${y1} A112,112 0 0,1 ${x2},${y2} Z`} fill={FILLS[index]} stroke="#fff" strokeWidth="3" />
                        <text
                           x={tx}
                           y={ty + 7}
                           textAnchor="middle"
                           fontSize="20"
                           fontWeight="900"
                           fill={INKS[index]}
                           transform={`rotate(${upright(start + SLICE_DEG / 2)} ${tx} ${ty})`}
                        >
                           +${value}
                        </text>
                     </g>
                  );
               })}
               <circle cx="120" cy="120" r="24" fill="#fff" stroke="#ffd84d" strokeWidth="5" />
               <text x="120" y="127" textAnchor="middle" fontSize="18">
                  🦛
               </text>
            </svg>
            {layer}
         </div>
         {phase === 'done' ? (
            <button
               type="button"
               onClick={onDone}
               className="h-12 w-full rounded-2xl bg-[#6010D2] text-[16px] font-bold text-white transition-transform active:scale-[0.97]"
            >
               {t.done}
            </button>
         ) : (
            <button
               type="button"
               disabled={phase === 'spinning'}
               onClick={spin}
               className="h-12 w-full rounded-2xl bg-[#ffce1b] text-[16px] font-bold text-[#704518] shadow-[0_2px_1px_rgba(63,89,79,0.35)] transition-transform active:scale-[0.97] disabled:opacity-70"
            >
               {t.spin}
            </button>
         )}
      </div>
   );
}
