import { type ButtonHTMLAttributes, type CSSProperties, type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';

import { Check, Lock } from 'lucide-react';

import { playSuccess } from '@/lib/uiSounds';

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
   // Duolingo-style: the step trail on top as the progress bar, then the hippo "saying" the step in
   // a speech bubble — one compact header, so the step's content and its button get the screen.
   return (
      <div className="-mx-5 -mt-5 flex flex-col gap-3 bg-gradient-to-b from-[#f3ecff] via-[#faf7ff] to-white px-5 pb-1 pt-4 dark:from-[#211735] dark:via-[#171024] dark:to-[#100d17]">
         {trail ? <div className="w-full">{trail}</div> : null}
         <div className="flex items-end gap-1">
            <img
               alt=""
               aria-hidden="true"
               className="h-[112px] w-[96px] shrink-0 select-none object-contain drop-shadow-[0_8px_12px_rgba(89,77,101,0.18)]"
               draggable={false}
               src={image}
            />
            <div className="connect-bubble-in relative mb-5 min-w-0 flex-1 rounded-[18px] border-2 border-[#e5ddf0] bg-white px-4 py-3 text-left shadow-[0_3px_0_#e5ddf0] dark:border-[#3a2d4f] dark:shadow-[0_3px_0_#3a2d4f]">
               <span
                  aria-hidden="true"
                  className="absolute -left-[9px] bottom-4 size-4 rotate-45 border-b-2 border-l-2 border-[#e5ddf0] bg-white dark:border-[#3a2d4f]"
               />
               <h3 className="relative text-[20px] font-extrabold leading-[24px] tracking-[-0.01em] text-[#3b2f4a] dark:text-[#f5f0ff]">
                  {title}
               </h3>
               {subtitle ? (
                  <p className="relative mt-1 text-[14px] font-normal leading-[19px] text-[#7b6b8c] dark:text-[#b9abcc]">{subtitle}</p>
               ) : null}
            </div>
         </div>
      </div>
   );
}

// "1 Messenger — 2 About you — 3 Your goal — 4 Book call", joined by a line. Each time a step opens it
// plays forward: the first circle fills with a check, the line draws to the next, that one fills…
// until it reaches the current step, which lights up. Done = purple check, current = glowing ring,
// upcoming = grey. All CSS (connect-trail-* in globals.css), off for reduced motion.
const TRAIL_START_S = 0.15;
const TRAIL_STEP_S = 0.42;

export function StepTrail({ steps, current }: { steps: string[]; current: number }) {
   const at = (index: number) => `${(TRAIL_START_S + index * TRAIL_STEP_S).toFixed(2)}s`;
   return (
      <ol
         aria-label={
            current >= steps.length ? `All ${steps.length} steps done` : `Step ${current + 1} of ${steps.length}: ${steps[current]}`
         }
         className="flex w-full items-start justify-between"
      >
         {steps.map((label, index) => {
            const done = index < current;
            const now = index === current;
            const isLast = index === steps.length - 1;
            return (
               <li className="relative flex min-w-0 flex-1 flex-col items-center gap-1" key={label}>
                  {isLast ? null : (
                     <span
                        aria-hidden="true"
                        className="absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-[12.5px] h-[3px] overflow-hidden rounded-full bg-[#e7e2ee] dark:bg-[#2f2640]"
                     >
                        {done ? (
                           <span
                              className="connect-trail-line block h-full w-full origin-left rounded-full bg-[#6b55f7]"
                              style={{ animationDelay: `calc(${at(index)} + 0.2s)` }}
                           />
                        ) : null}
                     </span>
                  )}
                  <span
                     className={`relative grid size-7 place-items-center rounded-full text-[12px] font-bold ${
                        done
                           ? 'connect-trail-fill bg-[#6b55f7] text-white'
                           : now
                             ? 'connect-trail-current bg-white text-[#6b55f7] dark:text-[#b4a6ff] shadow-[0_0_0_4px_rgba(107,85,247,0.15)] ring-2 ring-[#6b55f7]'
                             : 'bg-[#efedf1] text-[#b3a9bf] dark:bg-[#2a2235] dark:text-[#6f6280]'
                     }`}
                     style={done || now ? { animationDelay: at(index) } : undefined}
                  >
                     {done ? (
                        <Check
                           aria-hidden="true"
                           className="connect-trail-check size-4"
                           strokeWidth={3}
                           style={{ animationDelay: `calc(${at(index)} + 0.08s)` }}
                        />
                     ) : (
                        index + 1
                     )}
                  </span>
                  <span
                     className={`truncate text-[11px] font-semibold leading-[14px] ${now ? 'text-[#6b55f7] dark:text-[#b4a6ff]' : done ? 'text-[#594d65] dark:text-[#d9cfe8]' : 'text-[#b3a9bf] dark:text-[#6f6280]'}`}
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
   href,
   disabled,
   done,
   doneLabel = 'Confirmed'
}: {
   icon: ReactNode;
   title: string;
   badge?: string;
   subtitle?: ReactNode;
   onClick?: (event: MouseEvent<HTMLElement>) => void;
   // Render as a real link the person taps (iPhone: a tapped m.me link opens Messenger and leaves
   // this page where it is; opened from script it lands in a new Safari tab instead).
   href?: string;
   disabled?: boolean;
   done?: boolean;
   doneLabel?: string;
}) {
   if (done) {
      return (
         <div className="flex min-h-[88px] w-full items-center gap-3 rounded-[18px] border-2 border-b-[5px] border-[#4aa256] border-b-[#3a8a45] bg-[#eefbf2] px-4 py-3 dark:bg-[#123222]">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#4aa256] text-white">
               <Check aria-hidden="true" className="size-6" strokeWidth={3} />
            </span>
            <div className="flex min-w-0 flex-col text-left">
               <span className="text-[18px] font-bold leading-[22px] text-[#2f7a3a] dark:text-[#7ee2a0]">{title}</span>
               <span className="text-[14px] leading-[18px] text-[#3c8248] dark:text-[#9fd8b2]">{doneLabel}</span>
            </div>
         </div>
      );
   }
   const cardClass =
      'flex min-h-[88px] w-full items-center gap-3 rounded-[18px] border-2 border-b-[5px] px-4 py-3 text-left transition duration-100 ease-out hover:brightness-[0.98] active:translate-y-[3px] active:border-b-2 disabled:cursor-not-allowed disabled:opacity-60 border-[#7661f9] border-b-[#4a35c9] bg-[#f8f1ff] dark:bg-[#221a31]';
   const cardStyle = undefined;
   const body = (
      <>
         <span className="grid size-11 shrink-0 place-items-center">{icon}</span>
         <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
               <span className="text-[20px] font-bold leading-[24px] text-[#6b55f7] dark:text-[#b4a6ff]">{title}</span>
               {badge ? (
                  <span
                     className="rounded-br-[12px] rounded-tl-[12px] rounded-tr-[12px] px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-white"
                     style={{ background: FIGMA.purple }}
                  >
                     {badge}
                  </span>
               ) : null}
            </span>
            {subtitle ? <span className="text-[14px] leading-[18px] text-[#6b55f7]/85 dark:text-[#c9bdff]">{subtitle}</span> : null}
         </span>
      </>
   );
   if (href && !disabled) {
      return (
         <a className={cardClass} href={href} onClick={onClick} style={cardStyle}>
            {body}
         </a>
      );
   }
   return (
      <button className={cardClass} disabled={disabled} onClick={onClick} style={cardStyle} type="button">
         {body}
      </button>
   );
}

// "Step 1 · Connect Facebook" above a card, so a two-part screen reads in order. Green with a tick once done.
export function StepLabel({ n, text, done = false }: { n: number; text: string; done?: boolean }) {
   return (
      <p className={`-mb-2 text-[13px] font-bold uppercase tracking-[0.08em] ${done ? 'text-[#2f7a3a] dark:text-[#7ee2a0]' : 'text-[#6b55f7] dark:text-[#b4a6ff]'}`}>
         Step {n}
         {done ? ' ✓' : ''} · {text}
      </p>
   );
}

// A step that can't be started yet: greyed out with a lock and what unlocks it, so nobody taps it first.
export function LockedStepCard({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
   return (
      <div
         aria-disabled="true"
         className="flex min-h-[88px] w-full items-center gap-3 rounded-[18px] border-2 border-dashed border-[#d6d0e3] bg-[#f6f5f9] px-4 py-3 text-left dark:border-[#40354f] dark:bg-[#1b1526]"
      >
         <span className="grid size-11 shrink-0 place-items-center opacity-40">{icon}</span>
         <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[20px] font-bold leading-[24px] text-[#a49cb5]">{title}</span>
            <span className="flex items-center gap-1 text-[14px] leading-[18px] text-[#a49cb5]">
               <Lock aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
               {hint}
            </span>
         </span>
      </div>
   );
}

// Full-width CTA, Duolingo-style "pressable": a darker bottom edge that squashes down on tap.
export function PrimaryButton({ children, className = '', disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
   return (
      <button
         className={`min-h-[54px] w-full rounded-[16px] px-5 text-[17px] font-bold tracking-[0.01em] transition duration-100 ease-out disabled:cursor-not-allowed ${
            disabled
               ? 'bg-[#e8e3ef] text-[#a99fb6] shadow-[0_4px_0_#d6cfe0] dark:bg-[#2a2235] dark:text-[#6f6280] dark:shadow-[0_4px_0_#1c1626]'
               : 'bg-[#6b55f7] text-white shadow-[0_4px_0_#4a35c9] hover:brightness-110 active:translate-y-[4px] active:shadow-none'
         } ${className}`}
         disabled={disabled}
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
         className={`min-h-[44px] w-full rounded-[16px] text-[15px] font-bold text-[#8a7c9c] transition duration-150 ease-out hover:text-[#594d65] dark:text-[#a99cbb] dark:hover:text-[#e8e0f5] ${className}`}
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
      <li className="flex items-center gap-3 text-[15px] leading-[20px] text-[#594d65] dark:text-[#d9cfe8]">
         <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f3ecff] text-[#6b55f7] dark:bg-[#2a1740] dark:text-[#b4a6ff]">
            {icon}
         </span>
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

// text = light-mode value color; dark = its dark-mode counterpart (light enough to read on the dark tile).
const STAT_TONES: Record<CelebrationStat['tone'], { band: string; border: string; text: string }> = {
   green: { band: '#22a35a', border: '#22a35a', text: 'text-[#1f7a3d] dark:text-[#7ee2a0]' },
   purple: { band: '#6b55f7', border: '#6b55f7', text: 'text-[#4b36d6] dark:text-[#b4a6ff]' },
   amber: { band: '#f2a516', border: '#f2a516', text: 'text-[#9a5b00] dark:text-[#f4c26b]' }
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

// Sprinkles falling from the top of the screen over everything — the "you did it!" moment (call
// booked, step done). Positions are fixed per piece (no randomness in render); plays once.
const SPRINKLE_COLORS = ['#6b55f7', '#f2a516', '#ff6b9a', '#22a35a', '#3fb6ff', '#b18cff'];
const SPRINKLES = Array.from({ length: 46 }, (_, index) => ({
   left: (index * 37) % 100,
   delay: ((index * 13) % 9) / 10,
   duration: 1.9 + ((index * 7) % 10) / 10,
   drift: ((index * 29) % 60) - 30,
   spin: (index % 2 ? 1 : -1) * (300 + ((index * 41) % 360)),
   color: SPRINKLE_COLORS[index % SPRINKLE_COLORS.length],
   long: index % 3 !== 0
}));

export function ConfettiRain() {
   return (
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
         {SPRINKLES.map((piece, index) => (
            <span
               className={`connect-sprinkle absolute top-0 rounded-full ${piece.long ? 'h-3.5 w-1.5' : 'size-2'}`}
               key={index}
               style={
                  {
                     left: `${piece.left}%`,
                     backgroundColor: piece.color,
                     animationDelay: `${piece.delay}s`,
                     animationDuration: `${piece.duration}s`,
                     '--sprinkle-drift': `${piece.drift}px`,
                     '--sprinkle-spin': `${piece.spin}deg`
                  } as CSSProperties
               }
            />
         ))}
      </div>
   );
}

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
   // A little fanfare if they turned sounds on in the bio.
   useEffect(() => {
      playSuccess();
   }, []);
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
         className="connect-celebrate-in flex min-h-[600px] flex-1 flex-col bg-gradient-to-b from-[#efe6ff] via-[#faf7ff] to-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 dark:from-[#241838] dark:via-[#171024] dark:to-[#100d17]"
         data-celebration=""
      >
         <ConfettiRain />
         <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <span className="relative mt-2 grid place-items-center">
               <span aria-hidden="true" className="absolute size-[220px] rounded-full bg-white/70 blur-2xl dark:bg-[#6b55f7]/20" />
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
               <span className="connect-celebrate-pop absolute -bottom-2 right-0 grid size-14 place-items-center rounded-full bg-[#22a35a] text-white shadow-[0_8px_18px_rgba(34,163,90,0.4)] ring-[5px] ring-white dark:ring-[#171024]">
                  <Check aria-hidden="true" className="size-8" strokeWidth={3} />
               </span>
            </span>

            <div className="flex flex-col gap-2">
               <h3 className="text-[30px] font-extrabold leading-[34px] tracking-[-0.02em] text-[#3b2f4a] dark:text-[#f5f0ff]">{title}</h3>
               {subtitle ? (
                  <p className="mx-auto max-w-[310px] text-[16px] font-normal leading-[22px] text-[#7b6b8c] dark:text-[#b9abcc]">
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
                              className={`flex min-h-[48px] items-center justify-center px-1.5 py-2 text-[15px] font-bold leading-[18px] ${tone.text}`}
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
