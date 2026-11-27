import { useState } from 'react';

import { useFloatingParticles } from '@/components/motion/TapDelight';

import { useLocalization } from '@/i18n';

// Limit Spin wheel (2026-11-27): the server already drew the raise (limit_boost_spins); this only lands on it.
// Mostly +$3, like the odds (+$2 25% · +$3 60% · +$4 10% · +$5 5%).
// 2026-11-28 (George: "hard to see the numbers… not nice… add some try again ones", then game wheels as the
// look): a game-show wheel on a dark stage: turning light rays, a gold rim with chasing bulbs, ten glossy
// rainbow slices with big upright numbers, a still gold hub with Moodeng, and a pointer that ticks. Two
// "Try again" slices: sometimes the first spin lands there and they get one more spin, which then lands on
// their real result (the result never changes).
type Slice = { value: number | 'again'; fill: string; light: string; ink: string };
const SLICES: readonly Slice[] = [
   { value: 3, fill: '#e8244f', light: '#ff6b8a', ink: '#fff' },
   { value: 'again', fill: '#24124f', light: '#3d2580', ink: '#fff' },
   { value: 2, fill: '#ff7a00', light: '#ffae4d', ink: '#fff' },
   { value: 3, fill: '#f2c200', light: '#ffe45c', ink: '#4a2c00' },
   { value: 4, fill: '#14b25c', light: '#4fe08f', ink: '#fff' },
   { value: 3, fill: '#0096d6', light: '#45c8ff', ink: '#fff' },
   { value: 'again', fill: '#24124f', light: '#3d2580', ink: '#fff' },
   { value: 2, fill: '#3557ff', light: '#7690ff', ink: '#fff' },
   { value: 3, fill: '#8a2be2', light: '#b875ff', ink: '#fff' },
   { value: 5, fill: '#e6199b', light: '#ff62c6', ink: '#fff' }
];
const SLICE_DEG = 360 / SLICES.length;
const SPIN_MS = 3600;
const AGAIN_CHANCE = 0.35;
const BULBS = 20;
const CONFETTI = ['#6b55f7', '#ffce1b', '#2f8a4a', '#ff5c8a', '#4492f1'];
const EASE = 'cubic-bezier(0.12, 0.72, 0.12, 1)';
const HIPPO = '/hippos/body/hippo-body.webp';

const STYLES = `
@keyframes lswRays { to { transform: rotate(360deg); } }
@keyframes lswBulb { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
@keyframes lswTick { 0%, 100% { transform: translateX(-50%) rotate(0deg); } 50% { transform: translateX(-50%) rotate(-16deg); } }
@keyframes lswPop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
`;

const COPY = {
   en: {
      title: 'You earned a spin!',
      body: 'Paying back on time grows your limit. Spin to see by how much.',
      spin: 'Spin',
      again: 'So close! Spin again 🔄',
      againBody: 'One more spin, on us.',
      spinAgain: 'Spin again',
      tryAgain: ['TRY', 'AGAIN'],
      won: (amount: number) => `+$${amount}!`,
      now: (limit: number) => `Your limit is now $${limit}.`,
      bonus: (amount: number) => `🦈 + Shark bonus $${amount}`,
      done: 'Nice'
   },
   fil: {
      title: 'May spin ka!',
      body: 'Ang on-time na bayad ay nagpapalaki ng limit mo. I-spin para makita kung magkano.',
      spin: 'I-spin',
      again: 'Muntik na! I-spin ulit 🔄',
      againBody: 'Isa pang spin, libre.',
      spinAgain: 'I-spin ulit',
      tryAgain: ['SUBOK', 'ULIT'],
      won: (amount: number) => `+$${amount}!`,
      now: (limit: number) => `$${limit} na ang limit mo.`,
      bonus: (amount: number) => `🦈 + Shark bonus na $${amount}`,
      done: 'Ayos'
   }
};

const point = (deg: number, radius: number) => {
   const rad = ((deg - 90) * Math.PI) / 180;
   return [120 + radius * Math.cos(rad), 120 + radius * Math.sin(rad)];
};

export default function LimitSpinWheel({
   amount,
   toLimit,
   bonus = 0,
   onDone
}: {
   /** The raise the server drew (to_limit − from_limit). */
   amount: number;
   toLimit: number;
   /** Shark Chomp's +$1 on top of the wheel (chomp_level_reward), shown after it lands. */
   bonus?: number;
   /** After they've seen the result (mark it seen, close a sheet…). */
   onDone?: () => void;
}) {
   const { locale } = useLocalization();
   const t = COPY[locale === 'fil' ? 'fil' : 'en'];
   const [rotation, setRotation] = useState(0);
   const [phase, setPhase] = useState<'ready' | 'spinning' | 'again' | 'done'>('ready');
   const [retried, setRetried] = useState(false);
   const { burst, layer } = useFloatingParticles();
   const spinning = phase === 'spinning';

   const spin = () => {
      if (phase !== 'ready' && phase !== 'again') return;
      // The first spin sometimes lands on "Try again"; the next one always lands on their real result.
      const teaser = phase === 'ready' && !retried && Math.random() < AGAIN_CHANCE;
      const indexes = SLICES.map((slice, index) => ({ value: slice.value, index }));
      const matches = indexes.filter((slice) => slice.value === (teaser ? 'again' : amount));
      // A capped raise smaller than every slice lands on +$2.
      const pool = matches.length ? matches : indexes.filter((slice) => slice.value === 2);
      const target = pool[Math.floor(Math.random() * pool.length)];
      // Land inside the slice, not dead centre, so it feels like a real wheel.
      const sliceCenter = target.index * SLICE_DEG + SLICE_DEG / 2 + (Math.random() - 0.5) * SLICE_DEG * 0.5;
      // Always forward: 6 more turns from wherever it stopped, then onto the slice.
      setRotation((current) => Math.ceil(current / 360) * 360 + 360 * 6 + (360 - sliceCenter));
      setPhase('spinning');
      window.setTimeout(() => {
         if (teaser) {
            setRetried(true);
            setPhase('again');
            return;
         }
         setPhase('done');
         try {
            navigator.vibrate?.([30, 40, 60]);
         } catch {
            /* no vibration on this device */
         }
         burst((index) => <span className="block h-2.5 w-1.5 rounded-[2px]" style={{ background: CONFETTI[index % CONFETTI.length] }} />, {
            count: 24,
            fullCircle: true,
            spreadX: 140,
            rise: 110,
            originY: '55%'
         });
      }, SPIN_MS);
   };

   return (
      <div className="relative flex flex-col items-center gap-3 text-center" data-testid="limit-spin">
         <style>{STYLES}</style>
         <p
            key={phase}
            className="text-[24px] font-extrabold text-[#040033] dark:text-[#F0EAFF]"
            style={phase === 'done' ? { animation: 'lswPop 420ms ease-out both' } : undefined}
         >
            {phase === 'done' ? t.won(amount) : phase === 'again' ? t.again : t.title}
         </p>
         {phase === 'done' && bonus > 0 ? <p className="text-[16px] font-bold text-[#2f7a3a] dark:text-[#8FDB9C]">{t.bonus(bonus)}</p> : null}
         <p className="text-[14px] leading-[20px] text-[#70617F] dark:text-[#A89BB8]">
            {phase === 'done' ? t.now(toLimit) : phase === 'again' ? t.againBody : t.body}
         </p>

         {/* The stage: dark purple with slowly turning light rays behind the wheel. */}
         <div className="relative w-full overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_50%_45%,#4b1fa3_0%,#24095e_55%,#12042f_100%)] px-4 py-6">
            <div
               aria-hidden="true"
               className="pointer-events-none absolute left-1/2 top-1/2 h-[160%] w-[160%] -translate-x-1/2 -translate-y-1/2"
               style={{
                  background: 'repeating-conic-gradient(rgba(255,255,255,0.09) 0deg 9deg, transparent 9deg 18deg)',
                  maskImage: 'radial-gradient(circle, black 30%, transparent 68%)',
                  WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 68%)',
                  animation: `lswRays ${spinning ? 6 : 28}s linear infinite`
               }}
            />
            <div className="relative mx-auto aspect-square w-full max-w-[280px]">
               {/* Gold rim + chasing bulbs (still). */}
               <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full drop-shadow-[0_12px_28px_rgba(0,0,0,0.45)]" aria-hidden="true">
                  <defs>
                     <linearGradient id="lswRim" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#fff3b0" />
                        <stop offset="45%" stopColor="#f5b700" />
                        <stop offset="100%" stopColor="#b97800" />
                     </linearGradient>
                  </defs>
                  <circle cx="120" cy="120" r="119" fill="url(#lswRim)" />
                  <circle cx="120" cy="120" r="107" fill="#1a0a3d" />
                  {Array.from({ length: BULBS }, (_, index) => {
                     const [bx, by] = point((index * 360) / BULBS, 113);
                     return (
                        <circle
                           key={index}
                           cx={bx}
                           cy={by}
                           r="3.4"
                           fill="#fffbe6"
                           style={{
                              filter: 'drop-shadow(0 0 3px #fff6a8)',
                              animation: `lswBulb ${spinning ? 0.35 : 1.4}s ease-in-out infinite`,
                              animationDelay: index % 2 ? `${spinning ? 0.175 : 0.7}s` : '0s'
                           }}
                        />
                     );
                  })}
               </svg>

               {/* The slices (turn). Numbers turn back so they always read upright. */}
               <svg
                  viewBox="0 0 240 240"
                  className="absolute inset-0 h-full w-full"
                  style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? `transform ${SPIN_MS}ms ${EASE}` : 'none' }}
                  role="img"
                  aria-label="Limit spin wheel"
               >
                  <defs>
                     {SLICES.map((slice, index) => (
                        <radialGradient key={index} id={`lswS${index}`} cx="120" cy="120" r="104" gradientUnits="userSpaceOnUse">
                           <stop offset="25%" stopColor={slice.fill} />
                           <stop offset="100%" stopColor={slice.light} />
                        </radialGradient>
                     ))}
                     <radialGradient id="lswGloss" cx="120" cy="60" r="120" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
                        <stop offset="60%" stopColor="rgba(255,255,255,0)" />
                     </radialGradient>
                  </defs>
                  {SLICES.map((slice, index) => {
                     const start = index * SLICE_DEG;
                     const [x1, y1] = point(start, 104);
                     const [x2, y2] = point(start + SLICE_DEG, 104);
                     const [tx, ty] = point(start + SLICE_DEG / 2, 75);
                     const [px, py] = point(start, 101);
                     return (
                        <g key={index}>
                           <path d={`M120,120 L${x1},${y1} A104,104 0 0,1 ${x2},${y2} Z`} fill={`url(#lswS${index})`} stroke="#f7c948" strokeWidth="1.6" />
                           {/* A gold peg at each slice edge. */}
                           <circle cx={px} cy={py} r="2.6" fill="#ffe27a" stroke="#a86b00" strokeWidth="0.8" />
                           <g transform={`translate(${tx} ${ty})`}>
                              <g style={{ transform: `rotate(${-rotation}deg)`, transition: spinning ? `transform ${SPIN_MS}ms ${EASE}` : 'none' }}>
                                 {slice.value === 'again' ? (
                                    <text textAnchor="middle" fontWeight="900" fill={slice.ink} letterSpacing="0.5">
                                       <tspan x="0" dy="-8" fontSize="13">
                                          🔄
                                       </tspan>
                                       <tspan x="0" dy="13" fontSize="9.5">
                                          {t.tryAgain[0]}
                                       </tspan>
                                       <tspan x="0" dy="10" fontSize="9.5">
                                          {t.tryAgain[1]}
                                       </tspan>
                                    </text>
                                 ) : (
                                    <text
                                       y="6"
                                       textAnchor="middle"
                                       fontSize="17.5"
                                       fontWeight="900"
                                       fill={slice.ink}
                                       stroke={slice.ink === '#fff' ? 'rgba(40,10,60,0.55)' : 'rgba(255,255,255,0.6)'}
                                       strokeWidth="3"
                                       paintOrder="stroke"
                                    >
                                       +${slice.value}
                                    </text>
                                 )}
                              </g>
                           </g>
                        </g>
                     );
                  })}
                  <circle cx="120" cy="120" r="104" fill="url(#lswGloss)" pointerEvents="none" />
               </svg>

               {/* Gold hub with Moodeng (still). */}
               <div className="absolute left-1/2 top-1/2 flex h-[24%] w-[24%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff6c2,#f5b700_55%,#a86b00)] p-[6%] shadow-[0_0_18px_rgba(255,214,77,0.75),inset_0_-3px_6px_rgba(0,0,0,0.25)]">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
                     <img src={HIPPO} alt="" aria-hidden="true" className="h-[86%] w-auto select-none object-contain" draggable={false} />
                  </div>
               </div>

               {/* The pointer: ticks while the wheel turns. */}
               <div
                  aria-hidden="true"
                  className="absolute left-1/2 top-[-5%] z-10 h-[15%] w-[11%] drop-shadow-[0_3px_3px_rgba(0,0,0,0.45)]"
                  style={{ transformOrigin: '50% 20%', animation: spinning ? 'lswTick 140ms ease-in-out infinite' : 'none', transform: 'translateX(-50%)' }}
               >
                  <svg viewBox="0 0 30 42" className="h-full w-full">
                     <path d="M15 41 L3 12 A12 12 0 1 1 27 12 Z" fill="#e8243b" stroke="#fff3b0" strokeWidth="2.5" />
                     <circle cx="15" cy="12" r="4.5" fill="#fff3b0" />
                  </svg>
               </div>
            </div>
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
               disabled={spinning}
               onClick={spin}
               className="h-12 w-full rounded-2xl bg-[#ffce1b] text-[17px] font-extrabold text-[#704518] shadow-[0_4px_0_#d99a00] transition-transform active:translate-y-[2px] active:shadow-[0_2px_0_#d99a00] disabled:opacity-70"
            >
               {phase === 'again' ? t.spinAgain : t.spin}
            </button>
         )}
      </div>
   );
}
