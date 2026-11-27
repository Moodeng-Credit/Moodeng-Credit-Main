import { useEffect, useState } from 'react';

import { useFloatingParticles } from '@/components/motion/TapDelight';

import { useLocalization } from '@/i18n';

// Limit Spin wheel (2026-11-27): the server already drew the raise (limit_boost_spins); this only lands on it.
// Mostly +$3, like the odds (+$2 25% · +$3 60% · +$4 10% · +$5 5%).
// 2026-11-28 (George: "hard to see the numbers… not nice… add some try again ones", then game wheels as the
// look): a game-show wheel on a dark stage: turning light rays, a gold rim with chasing bulbs, ten glossy
// rainbow slices with big upright numbers, a still gold hub with Moodeng, and a pointer that ticks. Two
// "Try again" slices: sometimes the first spin lands there and they get one more spin, which then lands on
// their real result (the result never changes).
// The win is an ACHIEVEMENT, not a jackpot (George: "the feeling of victory… not gambling but an
// achievement, maybe even badges", then "too many buttons, too much text"): "Loan paid back!", a big +$3,
// the new limit counting up, one badge (On-time payer, or a limit milestone just reached) with a small bar to
// the next one, ONE button; stars + confetti, the earned slice glowing and a warm chime. No casino cues: no "YOU WON", no raining coins, no tick sounds.
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
// Hand-painted twilight over rice terraces (made with Gemini, 2026-11-28): the stage behind the wheel.
const STAGE_BG = '/limit-spin/stage-bg.webp';

const STYLES = `
@keyframes lswRays { to { transform: rotate(360deg); } }
@keyframes lswBulb { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
@keyframes lswTick { 0%, 100% { transform: translateX(-50%) rotate(0deg); } 50% { transform: translateX(-50%) rotate(-16deg); } }
@keyframes lswPop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
@keyframes lswFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes lswSlam { 0% { transform: scale(0.2); opacity: 0; } 55% { transform: scale(1.25); opacity: 1; } 75% { transform: scale(0.94); } 100% { transform: scale(1); } }
@keyframes lswGlow { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
@keyframes lswStar { 0% { transform: translateY(0) scale(0.4) rotate(0deg); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(260px) scale(1) rotate(200deg); opacity: 0; } }
@keyframes lswBadge { 0% { transform: translateY(16px) scale(0.85); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
@keyframes lswShine { 0% { transform: translateX(-120%) rotate(20deg); } 100% { transform: translateX(320%) rotate(20deg); } }
@keyframes lswMedal { 0% { transform: scale(0) rotate(-30deg); } 60% { transform: scale(1.18) rotate(8deg); } 100% { transform: scale(1) rotate(0deg); } }
@keyframes lswTwinkle { 0%, 100% { transform: scale(0.4); opacity: 0; } 50% { transform: scale(1); opacity: 1; } }
@keyframes lswBar { from { width: 0; } }
`;

// Achievement badges: a limit milestone they just reached, else "On-time payer" (every spin = a repayment).
const MILESTONES = [
   { at: 35, icon: '🏆', en: 'Top of the ladder', fil: 'Tuktok ng hagdan' },
   { at: 30, icon: '🥇', en: '$30 club', fil: '$30 club' },
   { at: 25, icon: '🥈', en: '$25 club', fil: '$25 club' },
   { at: 20, icon: '🥉', en: '$20 club', fil: '$20 club' }
];
export const spinBadge = (fromLimit: number, toLimit: number) =>
   MILESTONES.find((m) => fromLimit < m.at && toLimit >= m.at) ?? { at: 0, icon: '✅', en: 'On-time payer', fil: 'On-time na nagbayad' };
// The next badge to aim for, and how far along they are (from the last milestone, or the $15 start). Null at the top.
export const nextBadge = (toLimit: number) => {
   const next = [...MILESTONES].reverse().find((m) => m.at > toLimit);
   if (!next) return null;
   const base = MILESTONES.find((m) => m.at <= toLimit)?.at ?? 15;
   return { ...next, progress: Math.max(0.04, Math.min(1, (toLimit - base) / (next.at - base))) };
};

// A short, warm "ta-da" (C–E–G–C) made in the browser: no sound file. Quiet; silently skipped if blocked.
const playChime = () => {
   try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
         const at = ctx.currentTime + index * 0.11;
         const osc = ctx.createOscillator();
         const gain = ctx.createGain();
         osc.type = 'triangle';
         osc.frequency.value = freq;
         gain.gain.setValueAtTime(0.0001, at);
         gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
         gain.gain.exponentialRampToValueAtTime(0.0001, at + (index === 3 ? 0.9 : 0.35));
         osc.connect(gain).connect(ctx.destination);
         osc.start(at);
         osc.stop(at + 1);
      });
      window.setTimeout(() => void ctx.close(), 1800);
   } catch {
      /* no sound on this device */
   }
};

const COPY = {
   en: {
      title: 'You earned a spin!',
      body: 'Spin to grow your limit.',
      spin: 'Spin',
      again: 'So close! Spin again 🔄',
      againBody: 'One more spin, on us.',
      spinAgain: 'Spin again',
      tryAgain: ['TRY', 'AGAIN'],
      bonus: (amount: number) => `🦈 + Shark bonus $${amount}`,
      paid: '🎉 Loan paid back!',
      newLimit: 'New limit',
      top: 'You reached the top! 🏆',
      play: 'Win +$1 for your next spin 🦈',
      later: 'Later',
      done: 'Keep it up 💪'
   },
   fil: {
      title: 'May spin ka!',
      body: 'I-spin para lumaki ang limit mo.',
      spin: 'I-spin',
      again: 'Muntik na! I-spin ulit 🔄',
      againBody: 'Isa pang spin, libre.',
      spinAgain: 'I-spin ulit',
      tryAgain: ['SUBOK', 'ULIT'],
      bonus: (amount: number) => `🦈 + Shark bonus na $${amount}`,
      paid: '🎉 Bayad na ang loan!',
      newLimit: 'Bagong limit',
      top: 'Naabot mo ang tuktok! 🏆',
      play: 'Manalo ng +$1 sa susunod mong spin 🦈',
      later: 'Mamaya',
      done: 'Tuloy lang 💪'
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
   onDone?: () => void | Promise<void>;
}) {
   const { locale } = useLocalization();
   const t = COPY[locale === 'fil' ? 'fil' : 'en'];
   const [rotation, setRotation] = useState(0);
   const [phase, setPhase] = useState<'ready' | 'spinning' | 'again' | 'done'>('ready');
   const [retried, setRetried] = useState(false);
   const [landed, setLanded] = useState<number | null>(null);
   const fromLimit = Math.max(0, toLimit - amount - bonus);
   const [shownLimit, setShownLimit] = useState(fromLimit);
   const { burst, layer } = useFloatingParticles();
   const spinning = phase === 'spinning';
   const done = phase === 'done';
   const badge = spinBadge(fromLimit, toLimit);
   const upNext = nextBadge(toLimit);

   // The new limit counts up ($15 → $18) once it lands.
   useEffect(() => {
      if (!done) return;
      let raf = 0;
      const start = performance.now();
      const step = (at: number) => {
         const p = Math.min(1, (at - start) / 1100);
         setShownLimit(Math.round(fromLimit + (toLimit - fromLimit) * (1 - (1 - p) ** 3)));
         if (p < 1) raf = window.requestAnimationFrame(step);
      };
      const delay = window.setTimeout(() => (raf = window.requestAnimationFrame(step)), 500);
      return () => {
         window.clearTimeout(delay);
         window.cancelAnimationFrame(raf);
      };
   }, [done, fromLimit, toLimit]);

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
      setLanded(target.index);
      setPhase('spinning');
      window.setTimeout(() => {
         if (teaser) {
            setRetried(true);
            setPhase('again');
            return;
         }
         setPhase('done');
         playChime();
         try {
            navigator.vibrate?.([40, 60, 40, 60, 120]);
         } catch {
            /* no vibration on this device */
         }
         burst((index) => <span className="block h-2.5 w-1.5 rounded-[2px]" style={{ background: CONFETTI[index % CONFETTI.length] }} />, {
            count: 44,
            fullCircle: true,
            spreadX: 170,
            rise: 140,
            originY: '50%'
         });
      }, SPIN_MS);
   };

   return (
      <div className="relative flex w-full flex-col items-center gap-3 text-center" data-testid="limit-spin">
         <style>{STYLES}</style>
         {done ? (
            <p className="text-[24px] font-extrabold text-[#040033] dark:text-[#F0EAFF]" style={{ animation: 'lswPop 420ms ease-out both' }}>
               {t.paid}
            </p>
         ) : (
            <>
               <p key={phase} className="text-[24px] font-extrabold text-[#040033] dark:text-[#F0EAFF]">
                  {phase === 'again' ? t.again : t.title}
               </p>
               <p className="text-[14px] leading-[20px] text-[#70617F] dark:text-[#A89BB8]">{phase === 'again' ? t.againBody : t.body}</p>
            </>
         )}

         {/* The stage: a hand-painted twilight landscape, with soft light rays turning behind the wheel. */}
         <div
            className="relative w-full overflow-hidden rounded-[24px] bg-[#6b4fb8] bg-cover bg-center px-4 py-6"
            style={{ backgroundImage: `url(${STAGE_BG})` }}
         >
            <div
               aria-hidden="true"
               className="pointer-events-none absolute left-1/2 top-1/2 h-[160%] w-[160%] -translate-x-1/2 -translate-y-1/2"
               style={{
                  background: 'repeating-conic-gradient(rgba(255,244,214,0.12) 0deg 9deg, transparent 9deg 18deg)',
                  maskImage: 'radial-gradient(circle, black 30%, transparent 68%)',
                  WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 68%)',
                  animation: `lswRays ${spinning ? 6 : 28}s linear infinite`
               }}
            />
            {/* On the win the wheel steps back (soft + blurred) so the result stands alone over the painting. */}
            <div
               className="relative mx-auto aspect-square w-full max-w-[280px] transition-[opacity,filter] duration-700"
               style={done ? { opacity: 0.28, filter: 'blur(2px)' } : undefined}
            >
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
                              // Earned: every bulb flashes together. Spinning: a fast chase. Waiting: a slow one.
                              animation: `lswBulb ${done ? 0.3 : spinning ? 0.35 : 1.4}s ease-in-out infinite`,
                              animationDelay: done ? '0s' : index % 2 ? `${spinning ? 0.175 : 0.7}s` : '0s'
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
                           {done && landed === index ? (
                              // The earned slice glows.
                              <path
                                 d={`M120,120 L${x1},${y1} A104,104 0 0,1 ${x2},${y2} Z`}
                                 fill="rgba(255,255,255,0.22)"
                                 stroke="#fff7c2"
                                 strokeWidth="4"
                                 style={{ animation: 'lswGlow 0.9s ease-in-out infinite', filter: 'drop-shadow(0 0 6px #fff3a0)' }}
                              />
                           ) : null}
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
                  className="absolute left-1/2 top-[-5%] z-30 h-[15%] w-[11%] drop-shadow-[0_3px_3px_rgba(0,0,0,0.45)]"
                  style={{ transformOrigin: '50% 20%', animation: spinning ? 'lswTick 140ms ease-in-out infinite' : 'none', transform: 'translateX(-50%)' }}
               >
                  <svg viewBox="0 0 30 42" className="h-full w-full">
                     <path d="M15 41 L3 12 A12 12 0 1 1 27 12 Z" fill="#e8243b" stroke="#fff3b0" strokeWidth="2.5" />
                     <circle cx="15" cy="12" r="4.5" fill="#fff3b0" />
                  </svg>
               </div>
            </div>

            {done ? (
               // The achievement moment, over the stage: the raise and the new limit counting up.
               <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-[radial-gradient(circle,rgba(30,10,70,0.55)_0%,rgba(30,10,70,0.3)_50%,rgba(30,10,70,0)_80%)] px-4 text-white" style={{ animation: 'lswFade 350ms ease-out both' }}>
                  {Array.from({ length: 16 }, (_, index) => (
                     <span
                        key={index}
                        aria-hidden="true"
                        className="pointer-events-none absolute top-[-24px] text-[18px]"
                        style={{
                           left: `${(index * 61) % 100}%`,
                           animation: `lswStar ${1.8 + (index % 5) * 0.35}s ease-in ${(index % 7) * 0.18}s both`
                        }}
                     >
                        {index % 3 === 0 ? '✨' : '⭐'}
                     </span>
                  ))}
                  <span
                     className="bg-[linear-gradient(180deg,#fffbe0_0%,#ffd84d_45%,#f5a400_100%)] bg-clip-text text-[76px] font-black leading-none text-transparent [filter:drop-shadow(0_0_14px_rgba(255,214,77,0.65))]"
                     style={{ animation: 'lswSlam 650ms cubic-bezier(0.2, 0.9, 0.3, 1.2) 120ms both' }}
                  >
                     +${amount}
                  </span>
                  {bonus > 0 ? <span className="text-[16px] font-extrabold text-[#8fffb8]">{t.bonus(bonus)}</span> : null}
                  <span className="mt-2 rounded-full bg-white/15 px-4 py-1.5 text-[16px] font-bold">
                     {t.newLimit}: <span className="tabular-nums text-[#ffe27a]">${shownLimit}</span>
                  </span>
               </div>
            ) : null}
            {layer}
         </div>

         {done ? (
            // Achievement badge: one compact row (medal · name · bar to the next badge), same corners as the stage.
            <div
               className="relative flex w-full items-center gap-3 overflow-hidden rounded-[24px] border-[1.5px] border-[#ffd84d] bg-[linear-gradient(140deg,#fff6d1_0%,#ffffff_60%,#fff1c2_100%)] px-3.5 py-3 text-left shadow-[0_6px_16px_rgba(245,183,0,0.2)] dark:bg-[linear-gradient(140deg,#3a2e10,#1d1530_60%,#2c2210)]"
               style={{ animation: 'lswBadge 500ms ease-out 700ms both' }}
            >
               <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-[-20%] left-0 w-1/4 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.85),transparent)]"
                  style={{ animation: 'lswShine 1.3s ease-in-out 1.3s both' }}
               />
               {/* The medal: gold disc on a short ribbon. */}
               <span className="relative flex h-[54px] w-[46px] shrink-0 justify-center" style={{ animation: 'lswMedal 600ms cubic-bezier(0.2, 0.9, 0.3, 1.3) 900ms both' }}>
                  <span aria-hidden="true" className="absolute bottom-0 left-[8px] h-[22px] w-[11px] skew-x-[12deg] rounded-b-[2px] bg-[#6010d2]" />
                  <span aria-hidden="true" className="absolute bottom-0 right-[8px] h-[22px] w-[11px] -skew-x-[12deg] rounded-b-[2px] bg-[#8a3ffc]" />
                  <span className="relative z-10 flex h-[42px] w-[42px] items-center justify-center rounded-full border-2 border-[#fff3b0] bg-[radial-gradient(circle_at_35%_30%,#fff6c2,#f5b700_58%,#a86b00)] text-[20px] shadow-[0_0_12px_rgba(255,214,77,0.7)]">
                     {badge.icon}
                  </span>
                  <span aria-hidden="true" className="absolute right-[-6px] top-[-4px] z-20 text-[11px]" style={{ animation: 'lswTwinkle 1.6s ease-in-out 1.4s infinite' }}>
                     ✨
                  </span>
               </span>
               <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="text-[17px] font-black leading-tight text-[#040033] dark:text-[#F0EAFF]">{locale === 'fil' ? badge.fil : badge.en}</span>
                  {upNext ? (
                     <>
                        <span className="h-2 overflow-hidden rounded-full bg-[#ece4fb] dark:bg-[#3A2F55]">
                           <span
                              className="block h-full rounded-full bg-[linear-gradient(90deg,#8a3ffc,#6010d2)]"
                              style={{ width: `${upNext.progress * 100}%`, animation: 'lswBar 900ms ease-out 1.4s both' }}
                           />
                        </span>
                        <span className="flex justify-between text-[12px] font-semibold text-[#70617F] dark:text-[#A89BB8]">
                           <span>
                              {upNext.icon} {locale === 'fil' ? upNext.fil : upNext.en}
                           </span>
                           <span className="tabular-nums">
                              ${toLimit} / ${upNext.at}
                           </span>
                        </span>
                     </>
                  ) : (
                     <span className="text-[13px] font-bold text-[#2f7a3a] dark:text-[#8FDB9C]">{t.top}</span>
                  )}
               </span>
            </div>
         ) : null}
         {phase === 'done' ? (
            // The end of every spin offers the Shark bonus: beat level 3 of Shark Chomp → +$1 on the next spin
            // (chomp_level_reward saves it). At the top there's nothing left to win, so just one plain button.
            <>
               <button
                  type="button"
                  onClick={async () => {
                     if (!upNext) {
                        await onDone?.();
                        return;
                     }
                     await onDone?.();
                     window.location.href = '/game';
                  }}
                  className="h-[52px] w-full rounded-2xl bg-[linear-gradient(180deg,#7a2cf0,#5a0fc8)] text-[17px] font-extrabold text-white shadow-[0_5px_0_#3d0890,0_10px_20px_rgba(96,16,210,0.3)] transition-transform active:translate-y-[3px] active:shadow-[0_2px_0_#3d0890]"
                  style={{ animation: 'lswBadge 400ms ease-out 1.1s both' }}
               >
                  {upNext ? t.play : t.done}
               </button>
               {upNext ? (
                  <button
                     type="button"
                     onClick={() => void onDone?.()}
                     className="text-[14px] font-semibold text-[#70617F] underline-offset-2 hover:underline dark:text-[#A89BB8]"
                     style={{ animation: 'lswBadge 400ms ease-out 1.3s both' }}
                  >
                     {t.later}
                  </button>
               ) : null}
            </>
         ) : null}
         {phase !== 'done' ? (
            <button
               type="button"
               disabled={spinning}
               onClick={spin}
               className="h-12 w-full rounded-2xl bg-[#ffce1b] text-[17px] font-extrabold text-[#704518] shadow-[0_4px_0_#d99a00] transition-transform active:translate-y-[2px] active:shadow-[0_2px_0_#d99a00] disabled:opacity-70"
            >
               {phase === 'again' ? t.spinAgain : t.spin}
            </button>
         ) : null}
      </div>
   );
}
