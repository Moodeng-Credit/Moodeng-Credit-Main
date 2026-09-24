import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Check } from 'lucide-react';

// Visual kit for the Connect → Approve → Apply screens, taken from the Milestone_9.23 Figma
// (verify_popup / milestones): a lavender-to-white hero with a 3D hippo, a short bold title, a
// step trail, big tappable option cards (#f8f1ff fill, #7661f9 border, speech-bubble badge) and a
// purple gradient pill CTA. Kept deliberately text-light — one line of copy per idea.

// Per-moment hippo art. These are placeholders copied from the dashboard's Rookie hippos until the
// dedicated renders land — drop new PNGs in with the same names to swap them, no code change.
export const CONNECT_HIPPOS = {
   hello: '/hippos/connect/hello.png',
   call: '/hippos/connect/call.png',
   waiting: '/hippos/connect/waiting.png',
   approved: '/hippos/connect/approved.png'
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
         <img alt="" aria-hidden="true" className="h-[112px] w-auto select-none object-contain drop-shadow-[0_8px_12px_rgba(89,77,101,0.18)]" draggable={false} src={image} />
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
      <ol aria-label={`Step ${current + 1} of ${steps.length}: ${steps[current]}`} className="flex w-full items-start justify-between gap-1">
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
                  <span className={`truncate text-[11px] font-semibold leading-[14px] ${now ? 'text-[#6b55f7]' : done ? 'text-[#594d65]' : 'text-[#b3a9bf]'}`}>
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
                  <span className="rounded-br-[12px] rounded-tl-[12px] rounded-tr-[12px] px-2 py-0.5 text-[12px] font-semibold leading-[16px] text-white" style={{ background: FIGMA.purple }}>
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
