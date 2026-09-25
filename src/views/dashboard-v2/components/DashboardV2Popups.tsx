import { type ReactNode, useEffect } from 'react';

import { ChevronRight, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { DASHBOARD_V2_ASSETS } from '@/views/dashboard-v2/assets';
import DesignImage from '@/views/dashboard-v2/components/DesignImage';
import type { DashboardV2Milestone } from '@/views/dashboard-v2/types';

const PRIMARY_GRADIENT = 'linear-gradient(77.66deg, #9584ff 0.5%, #6b55f7 98.16%)';

/** Dimmed full-screen overlay with the design's white-to-lavender card and the round close button below it. */
function PopupShell({
   title,
   onClose,
   labelledBy,
   children
}: {
   title?: ReactNode;
   onClose: () => void;
   labelledBy: string;
   children: ReactNode;
}) {
   useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
         if (event.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
   }, [onClose]);

   return (
      <div
         className="fixed inset-0 z-[80] flex overflow-y-auto overscroll-contain bg-black/80 px-5 py-6"
         role="dialog"
         aria-modal="true"
         aria-labelledby={labelledBy}
         onClick={onClose}
      >
         {/* m-auto centres the popup when it fits and lets it scroll on short screens (small or landscape phones). */}
         <div className="m-auto flex w-full max-w-[400px] flex-col items-center" onClick={(event) => event.stopPropagation()}>
            {title}
            <div className="w-full rounded-[26px] bg-gradient-to-b from-[#f3ecff] via-white via-40% to-white shadow-[0_-1px_0_0_#fff]">
               {children}
            </div>
            <button type="button" onClick={onClose} className="mt-14 h-[50px] w-[50px]" aria-label="Close">
               <DesignImage src={DASHBOARD_V2_ASSETS.closeLarge} className="h-[50px] w-[50px]" />
            </button>
         </div>
      </div>
   );
}

/** Design uses a hand-lettered title image for the first milestone; the rest reuse its type style. */
function MilestoneTitle({ milestone }: { milestone: DashboardV2Milestone }) {
   if (milestone.id === 'first-loan-request') {
      return (
         <DesignImage src={DASHBOARD_V2_ASSETS.firstLoanTitle} alt={milestone.title} className="mb-1 h-[60px] w-[350px] object-contain" />
      );
   }

   return (
      <p className="mb-2 max-w-[350px] text-center text-[26px] font-black italic leading-7 text-[#4c239f] underline decoration-[#7e6afa] decoration-4 underline-offset-8">
         {milestone.title}
      </p>
   );
}

const MILESTONE_CTA: Record<string, string> = {
   'first-loan-request': 'Request Loan & Feed Moodeng',
   'first-funded-loan': 'View Requests & Feed Moodeng',
   'first-on-time-repayment': 'Repay On Time & Earn Voucher'
};

export function MilestonePopup({
   milestone,
   isVerified,
   onClose,
   onVerify
}: {
   milestone: DashboardV2Milestone;
   isVerified: boolean;
   onClose: () => void;
   onVerify: () => void;
}) {
   const navigate = useNavigate();
   const cta = isVerified
      ? (MILESTONE_CTA[milestone.id] ?? `${milestone.actionLabel ?? 'Keep going'} & Feed Moodeng`)
      : 'Verify to Start Feeding';

   const handleCta = () => {
      onClose();
      if (!isVerified) {
         onVerify();
         return;
      }
      navigate(milestone.actionTo ?? '/request-board');
   };

   return (
      <PopupShell title={<MilestoneTitle milestone={milestone} />} onClose={onClose} labelledBy="dv2-milestone-popup-title">
         <div className="flex flex-col items-center gap-[9px] px-5 pb-6 pt-[18px] text-center">
            <div className="text-[#594d65]">
               <p id="dv2-milestone-popup-title" className="text-[24px] font-bold leading-6">
                  {milestone.isVoucher ? 'Repay on time, eat on us.' : 'Feed Moodeng to level up.'}
               </p>
               <p className="mt-1 text-[20px] leading-6">
                  {milestone.isVoucher ? 'A GrabFood voucher for your first on-time repayment!' : 'Bigger Moodeng = Higher cash limits!'}
               </p>
            </div>
            <div className="flex items-center gap-1.5">
               <DesignImage
                  src={milestone.isVoucher ? DASHBOARD_V2_ASSETS.coupon : DASHBOARD_V2_ASSETS.pandesalLarge}
                  className={milestone.isVoucher ? 'h-20 w-20 object-contain' : 'h-[94px] w-[94px] object-contain'}
               />
               <p className="font-black leading-6 text-[#5d4ccc]">
                  {milestone.isVoucher ? (
                     <span className="text-[30px]">₱50</span>
                  ) : (
                     <>
                        <span className="text-[24px]">+</span>
                        <span className="text-[30px]">{milestone.points}</span>
                     </>
                  )}
               </p>
            </div>
            <button
               type="button"
               onClick={handleCta}
               className="flex h-[52px] w-full max-w-[346px] items-center justify-center rounded-[35px] px-5 text-[20px] font-semibold tracking-[-0.4px] text-white transition active:scale-[0.99]"
               style={{ backgroundImage: PRIMARY_GRADIENT }}
            >
               {cta}
            </button>
         </div>
      </PopupShell>
   );
}

/** "Verify My Identity" — one clear primary path (Didit) with World ID as the secondary option. */
export function VerifyPopup({ onClose, returnTo }: { onClose: () => void; returnTo?: string }) {
   const navigate = useNavigate();
   const start = (method: 'didit' | 'worldid') => {
      onClose();
      navigate('/verify', { state: { method, returnTo } });
   };

   return (
      <PopupShell onClose={onClose} labelledBy="dv2-verify-popup-title">
         <div className="flex flex-col items-center px-2.5 pb-6 pt-9 text-center">
            <h2 id="dv2-verify-popup-title" className="text-[28px] font-bold leading-8 text-[#594d65]">
               Verify My Identity
            </h2>
            <p className="mt-2 px-4 text-[18px] leading-6 text-[#594d65]">
               Verify to unlock your account — a one-time check that takes about 3 minutes.
            </p>
            <button
               type="button"
               onClick={() => start('didit')}
               className="relative mt-5 w-full overflow-hidden rounded-[20px] border-2 border-[#7b67f9] bg-[#f8f1ff] px-[18px] pb-4 pt-5 text-left transition active:scale-[0.99]"
            >
               <span className="flex items-center gap-2.5">
                  <span className="text-[30px] font-bold leading-8 text-[#6b55f7]">Verify Now</span>
                  <span className="flex h-7 items-center gap-1 rounded-[10px] bg-[#6b55f7] px-2 text-[17px] font-medium text-white">
                     <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                     Most used
                  </span>
               </span>
               <span className="mt-3 block max-w-[62%] text-[18px] leading-[22px] text-[#7b67f9]">
                  Quick national ID &amp; selfie check. Available in VN, TW, KR, PH, MY, JP, ID, TH
               </span>
               <span className="block h-10" aria-hidden="true" />
               <DesignImage src={DASHBOARD_V2_ASSETS.verifyHippo} className="absolute bottom-0 right-0 h-[98px] w-[117px] object-contain" />
            </button>
            <button
               type="button"
               onClick={() => start('worldid')}
               className="mt-6 flex items-center gap-1 text-[18px] font-semibold text-[#4492f1]"
            >
               Verify with World ID
               <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
         </div>
      </PopupShell>
   );
}

const STREAK_COPY = {
   en: {
      title: 'Milestone Streak!',
      unit: (count: number) => (count === 1 ? 'milestone this week' : 'milestones this week'),
      fed: 'Pandesal fed to Moodeng',
      nudge: 'Keep the streak going: your next milestone is waiting.',
      cta: 'See My Next Milestone'
   },
   fil: {
      title: 'Milestone Streak!',
      unit: () => 'milestone ngayong linggo',
      fed: 'Pandesal na naipakain kay Moodeng',
      nudge: 'Ituloy mo lang: naghihintay na ang susunod mong milestone.',
      cta: 'Tingnan ang Susunod'
   }
} as const;

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Local-date key so "which day" matches the borrower's own calendar. */
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/**
 * Duolingo-style celebration for 2+ milestones completed in the last 7 days: a big streak number, the
 * week as seven day dots (checked on days a milestone landed), and what earned it.
 */
export function MilestoneStreakPopup({
   milestones,
   language,
   onClose,
   onSeeNext
}: {
   milestones: { id: string; title: string; points: number; completedAt: string }[];
   language: 'en' | 'fil';
   onClose: () => void;
   onSeeNext: () => void;
}) {
   const copy = STREAK_COPY[language];
   const totalPandesal = milestones.reduce((sum, milestone) => sum + milestone.points, 0);
   const hitDays = new Set(milestones.map((milestone) => dayKey(new Date(milestone.completedAt))));
   const today = new Date();
   const week = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return { key: dayKey(date), letter: WEEKDAY_LETTERS[date.getDay()], isToday: index === 6 };
   });

   return (
      <PopupShell
         title={
            <p className="mb-2 max-w-[350px] text-center text-[26px] font-black italic leading-7 text-[#4c239f] underline decoration-[#7e6afa] decoration-4 underline-offset-8">
               {copy.title}
            </p>
         }
         onClose={onClose}
         labelledBy="dv2-streak-popup-title"
      >
         <div className="flex flex-col items-center px-5 pb-6 pt-5 text-center">
            <div className="relative flex items-center justify-center">
               <span className="absolute h-28 w-28 rounded-full bg-[#b9aeff]/60 blur-2xl" aria-hidden="true" />
               <DesignImage src="/icons/streak-3d.png" className="relative h-[92px] w-[92px] object-contain" />
            </div>
            <p id="dv2-streak-popup-title" className="-mt-2 flex flex-col items-center">
               <span
                  className="bg-clip-text text-[72px] font-black italic leading-none tracking-[-2px] text-transparent"
                  style={{ backgroundImage: 'linear-gradient(180deg, #9584ff 0%, #4f36ef 100%)' }}
               >
                  {milestones.length}
               </span>
               <span className="text-[22px] font-bold leading-6 text-[#594d65]">{copy.unit(milestones.length)}</span>
            </p>

            <ol className="mt-4 flex w-full justify-between px-1" aria-label="This week">
               {week.map((day) => {
                  const isHit = hitDays.has(day.key);
                  return (
                     <li key={day.key} className="flex flex-col items-center gap-1">
                        <span className={day.isToday ? 'text-[12px] font-bold text-[#4f36ef]' : 'text-[12px] font-medium text-[#c0b9c8]'}>
                           {day.letter}
                        </span>
                        <span
                           className={
                              isHit
                                 ? 'flex h-7 w-7 items-center justify-center rounded-full text-white shadow-[0_2px_6px_rgba(79,54,239,0.35)]'
                                 : 'flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#e0dbff] bg-white'
                           }
                           style={isHit ? { backgroundImage: PRIMARY_GRADIENT } : undefined}
                        >
                           {isHit ? (
                              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                                 <path
                                    d="M3 8.5l3 3 7-7"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                 />
                              </svg>
                           ) : null}
                        </span>
                     </li>
                  );
               })}
            </ol>

            <ul className="mt-5 flex w-full flex-col gap-2 text-left">
               {milestones.map((milestone) => (
                  <li key={milestone.id} className="flex items-center gap-2.5 rounded-[12px] bg-[#f6f3ff] px-3 py-2.5">
                     <DesignImage src={DASHBOARD_V2_ASSETS.pandesalSmall} className="h-6 w-6 shrink-0 object-contain" />
                     <span className="min-w-0 flex-1 text-[16px] font-medium leading-5 text-[#0f172b]">{milestone.title}</span>
                     <span className="shrink-0 text-[16px] font-bold text-[#7e6afa]">+{milestone.points}</span>
                  </li>
               ))}
            </ul>

            <p className="mt-4 text-[18px] font-bold text-[#594d65]">
               <span className="text-[#4f36ef]">+{totalPandesal}</span> {copy.fed}
            </p>
            <p className="mt-1 text-[15px] leading-5 text-[#877897]">{copy.nudge}</p>

            <button
               type="button"
               onClick={onSeeNext}
               className="mt-5 flex h-[52px] w-full items-center justify-center rounded-[35px] text-[20px] font-semibold text-white"
               style={{ backgroundImage: PRIMARY_GRADIENT }}
            >
               {copy.cta}
            </button>
         </div>
      </PopupShell>
   );
}
