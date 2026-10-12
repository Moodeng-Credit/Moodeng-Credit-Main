import { type ButtonHTMLAttributes, type CSSProperties, type ReactNode, useRef, useState } from 'react';

import { Check } from 'lucide-react';

// Visual kit for the Connect → Approve → Apply screens, taken from the Milestone_9.23 Figma
// (verify_popup / milestones): a lavender-to-white hero with a 3D hippo, a short bold title, a
// step trail, big tappable option cards (#f8f1ff fill, #7661f9 border, speech-bubble badge) and a
// purple gradient pill CTA. Kept deliberately text-light — one line of copy per idea.

// Per-moment hippo art (same character as the dashboard's Rookie hippos, one pose per moment).
export const CONNECT_HIPPOS = {
   hello: '/hippos/connect/hello.png', // waving with a phone — Messenger
   call: '/hippos/connect/call.png', // headset + laptop — book the call
   waiting: '/hippos/connect/waiting.png', // hugging the calendar — call booked
   approved: '/hippos/connect/approved.png', // confetti — ready to apply
   cashout: '/hippos/connect/cashout.png', // wallet — what's the loan for
   missed: '/hippos/connect/missed.png' // "oops" + reschedule — coming back after a rejection
} as const;

const FIGMA = {
   heading: '#594d65',
   muted: '#7b6b8c',
   purple: '#6b55f7',
   cardFill: '#f8f1ff',
   cardBorder: '#7661f9'
};

export function ConnectHero({
   image,
   title,
   subtitle,
   trail
}: {
   image: string;
   title: ReactNode;
   subtitle?: ReactNode;
   trail?: ReactNode;
}) {
   return (
      <div className="-mx-5 -mt-5 flex flex-col items-center gap-2 bg-gradient-to-b from-[#f3ecff] via-white to-white px-5 pb-1 pt-4 text-center">
         <img
            alt=""
            aria-hidden="true"
            className="h-[112px] w-auto select-none object-contain drop-shadow-[0_8px_12px_rgba(89,77,101,0.18)]"
            draggable={false}
            src={image}
         />
         <h3 className="text-[24px] font-bold leading-[28px] tracking-[-0.02em]" style={{ color: FIGMA.heading }}>
            {title}
         </h3>
         {subtitle ? (
            <p className="max-w-[320px] text-[15px] font-normal leading-[20px]" style={{ color: FIGMA.muted }}>
               {subtitle}
            </p>
         ) : null}
         {trail ? <div className="mt-2 w-full">{trail}</div> : null}
      </div>
   );
}

// "1 Messenger — 2 About you — 3 Your goal — 4 Book call": done steps turn into purple checks,
// the current one glows, upcoming ones stay grey. Gamified progress in one glance, no prose.
export function StepTrail({ steps, current }: { steps: string[]; current: number }) {
   return (
      <ol
         aria-label={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}
         className="flex w-full items-start justify-between gap-1"
      >
         {steps.map((label, index) => {
            const done = index < current;
            const now = index === current;
            return (
               <li className="flex min-w-0 flex-1 flex-col items-center gap-1" key={label}>
                  <span
                     className={`grid size-7 place-items-center rounded-full text-[12px] font-bold transition ${
                        done
                           ? 'bg-[#6b55f7] text-white'
                           : now
                             ? 'bg-white text-[#6b55f7] ring-2 ring-[#6b55f7] shadow-[0_0_0_4px_rgba(107,85,247,0.15)]'
                             : 'bg-[#efedf1] text-[#b3a9bf]'
                     }`}
                  >
                     {done ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : index + 1}
                  </span>
                  <span
                     className={`truncate text-[11px] font-semibold leading-[14px] ${now ? 'text-[#6b55f7]' : done ? 'text-[#594d65]' : 'text-[#b3a9bf]'}`}
                  >
                     {label}
                  </span>
               </li>
            );
         })}
      </ol>
   );
}

// Big tappable card (Figma "btn_verify"): icon, bold purple title + speech-bubble badge, one line.
export function OptionCard({
   icon,
   title,
   badge,
   subtitle,
   onClick,
   disabled,
   done,
   doneLabel = 'Confirmed'
}: {
   icon: ReactNode;
   title: string;
   badge?: string;
   subtitle?: ReactNode;
   onClick?: () => void;
   disabled?: boolean;
   done?: boolean;
   doneLabel?: string;
}) {
   if (done) {
      return (
         <div className="flex min-h-[88px] w-full items-center gap-3 rounded-[18px] border-2 border-[#4aa256] bg-[#eefbf2] px-4 py-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#4aa256] text-white">
               <Check aria-hidden="true" className="size-6" strokeWidth={3} />
            </span>
            <div className="flex min-w-0 flex-col text-left">
               <span className="text-[18px] font-bold leading-[22px] text-[#2f7a3a]">{title}</span>
               <span className="text-[14px] leading-[18px] text-[#3c8248]">{doneLabel}</span>
            </div>
         </div>
      );
   }
   return (
      <button
         className="flex min-h-[88px] w-full items-center gap-3 rounded-[18px] border-2 px-4 py-3 text-left transition duration-150 ease-out hover:brightness-[0.98] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
         disabled={disabled}
         onClick={onClick}
         style={{ background: FIGMA.cardFill, borderColor: FIGMA.cardBorder }}
         type="button"
      >
         <span className="grid size-11 shrink-0 place-items-center">{icon}</span>
         <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
               <span className="text-[20px] font-bold leading-[24px]" style={{ color: FIGMA.purple }}>
                  {title}
               </span>
               {badge ? (
                  <span
                     className="rounded-br-[12px] rounded-tl-[12px] rounded-tr-[12px] px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-white"
                     style={{ background: FIGMA.purple }}
                  >
                     {badge}
                  </span>
               ) : null}
            </span>
            {subtitle ? (
               <span className="text-[14px] leading-[18px]" style={{ color: FIGMA.purple, opacity: 0.85 }}>
                  {subtitle}
               </span>
            ) : null}
         </span>
      </button>
   );
}

// Purple gradient pill CTA (Figma "Get" button), full width.
export function PrimaryButton({ children, className = '', disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
   return (
      <button
         className={`min-h-[52px] w-full rounded-full px-5 text-[17px] font-semibold text-white transition duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed ${
            disabled ? 'bg-[#d9d3e3] shadow-none' : 'shadow-[0_6px_16px_rgba(107,85,247,0.35)] hover:brightness-110'
         } ${className}`}
         disabled={disabled}
         style={disabled ? undefined : { backgroundImage: 'linear-gradient(85deg, #9584ff 0%, #6b55f7 98%)' }}
         type="button"
         {...rest}
      >
         {children}
      </button>
   );
}

export function GhostButton({ children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
   return (
      <button
         className={`min-h-[44px] w-full rounded-full text-[15px] font-medium text-[#877897] transition duration-150 ease-out hover:text-[#594d65] ${className}`}
         type="button"
         {...rest}
      >
         {children}
      </button>
   );
}

// One icon + one short line — replaces paragraphs of explanation.
export function PerkRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
   return (
      <li className="flex items-center gap-3 text-[15px] leading-[20px] text-[#594d65]">
         <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f3ecff] text-[#6b55f7]">{icon}</span>
         <span className="min-w-0">{children}</span>
      </li>
   );
}

// Which way the screen moved: a new step slides in from the right, going back slides in from the
// left. Pass the current step's position; null on the first render (no animation on arrival).
export function useStepDirection(index: number): 'forward' | 'back' | null {
   const [state, setState] = useState<{ index: number; direction: 'forward' | 'back' | null }>({ index, direction: null });
   if (state.index !== index) {
      const direction = index > state.index ? 'forward' : 'back';
      setState({ index, direction });
      return direction;
   }
   return state.direction;
}

// Classes live in globals.css (connect-step-in-*), reduced-motion aware.
export const stepAnimationClass = (direction: 'forward' | 'back' | null) =>
   direction === 'forward' ? 'connect-step-in-forward' : direction === 'back' ? 'connect-step-in-back' : '';

// "Nice job" moments are shown once per step per borrower (not again after a back-and-forth).
const celebratedKey = (userId: string, step: string) => `md_celebrated:${userId}:${step}`;
export const wasCelebrated = (userId: string, step: string) => {
   try {
      return window.localStorage.getItem(celebratedKey(userId, step)) === '1';
   } catch {
      return false;
   }
};
export const markCelebrated = (userId: string, step: string) => {
   try {
      window.localStorage.setItem(celebratedKey(userId, step), '1');
   } catch {
      // Storage blocked — they may just see it again.
   }
};

// A Duolingo-style stat tile: coloured label band on top, the value underneath.
export type CelebrationStat = { label: string; value: ReactNode; tone: 'green' | 'purple' | 'amber' };

const STAT_TONES: Record<CelebrationStat['tone'], { band: string; border: string; text: string }> = {
   green: { band: '#22a35a', border: '#22a35a', text: '#1f7a3d' },
   purple: { band: '#6b55f7', border: '#6b55f7', text: '#4b36d6' },
   amber: { band: '#f2a516', border: '#f2a516', text: '#9a5b00' }
};

const NO_STATS: CelebrationStat[] = [];

// Confetti pieces bursting out from behind the hippo: [x, y, colour, delay(s)].
const CONFETTI: [number, number, string, number][] = [
   [-120, -70, '#6b55f7', 0],
   [-90, -130, '#f2a516', 0.05],
   [-30, -150, '#22a35a', 0.1],
   [40, -145, '#ff6b9a', 0.02],
   [100, -120, '#6b55f7', 0.08],
   [130, -60, '#f2a516', 0.12],
   [-140, 0, '#ff6b9a', 0.06],
   [140, 10, '#22a35a', 0.04],
   [-100, 60, '#f2a516', 0.1],
   [110, 70, '#6b55f7', 0.14],
   [-50, -110, '#ff6b9a', 0.16],
   [70, -90, '#22a35a', 0.18]
];

// Between steps, full screen: confetti burst, the cheering hippo with a popping check, a big
// headline, stat tiles (done / next up / steps left), the step trail ticked, and a big Continue
// pinned at the bottom — the borrower moves on when they're ready.
export function StepCelebration({
   image,
   title,
   subtitle,
   stats = NO_STATS,
   trail,
   continueLabel = 'Continue',
   onDone
}: {
   image: string;
   title: ReactNode;
   subtitle?: ReactNode;
   stats?: CelebrationStat[];
   trail?: ReactNode;
   continueLabel?: ReactNode;
   onDone: () => void;
}) {
   // Guards a double tap from running onDone twice (it routes to the next step).
   const finishedRef = useRef(false);
   const finish = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onDone();
   };

   return (
      <div
         aria-live="polite"
         className="connect-celebrate-in flex min-h-[600px] flex-1 flex-col bg-gradient-to-b from-[#efe6ff] via-[#faf7ff] to-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6"
         data-celebration=""
      >
         <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <span className="relative mt-2 grid place-items-center">
               <span aria-hidden="true" className="absolute size-[220px] rounded-full bg-white/70 blur-2xl" />
               {CONFETTI.map(([x, y, color, delay], index) => (
                  <span
                     aria-hidden="true"
                     className="connect-confetti absolute left-1/2 top-1/2 h-3 w-2 rounded-[2px]"
                     key={index}
                     style={
                        {
                           backgroundColor: color,
                           animationDelay: `${delay}s`,
                           '--confetti-x': `${x}px`,
                           '--confetti-y': `${y}px`,
                           '--confetti-r': `${(index % 2 ? 1 : -1) * (180 + index * 25)}deg`
                        } as CSSProperties
                     }
                  />
               ))}
               <img
                  alt=""
                  aria-hidden="true"
                  className="relative h-[180px] w-auto select-none object-contain drop-shadow-[0_12px_18px_rgba(89,77,101,0.22)]"
                  draggable={false}
                  src={image}
               />
               <span className="connect-celebrate-pop absolute -bottom-2 right-0 grid size-14 place-items-center rounded-full bg-[#22a35a] text-white shadow-[0_8px_18px_rgba(34,163,90,0.4)] ring-[5px] ring-white">
                  <Check aria-hidden="true" className="size-8" strokeWidth={3} />
               </span>
            </span>

            <div className="flex flex-col gap-2">
               <h3 className="text-[30px] font-extrabold leading-[34px] tracking-[-0.02em]" style={{ color: '#3b2f4a' }}>
                  {title}
               </h3>
               {subtitle ? (
                  <p className="mx-auto max-w-[310px] text-[16px] font-normal leading-[22px]" style={{ color: FIGMA.muted }}>
                     {subtitle}
                  </p>
               ) : null}
            </div>

            {stats.length > 0 ? (
               <div
                  className="grid w-full max-w-[380px] gap-2.5"
                  style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
               >
                  {stats.map((stat, index) => {
                     const tone = STAT_TONES[stat.tone];
                     return (
                        <div
                           className="connect-stat-in overflow-hidden rounded-[16px] border-2 bg-white"
                           key={stat.label}
                           style={{ borderColor: tone.border, animationDelay: `${0.25 + index * 0.08}s` }}
                        >
                           <p
                              className="px-1 py-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-white"
                              style={{ backgroundColor: tone.band }}
                           >
                              {stat.label}
                           </p>
                           <p
                              className="flex min-h-[48px] items-center justify-center px-1.5 py-2 text-[15px] font-bold leading-[18px]"
                              style={{ color: tone.text }}
                           >
                              {stat.value}
                           </p>
                        </div>
                     );
                  })}
               </div>
            ) : null}

            {trail ? <div className="w-full max-w-[380px] pt-1">{trail}</div> : null}
         </div>

         <PrimaryButton className="mt-6 min-h-[56px]" onClick={finish}>
            {continueLabel}
         </PrimaryButton>
      </div>
   );
}
