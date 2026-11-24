import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';

import { Check, Hourglass, Lock } from 'lucide-react';
import posthog from 'posthog-js';
import { useSelector } from 'react-redux';

import { useFriendReferrals } from '@/hooks/useFriendReferrals';

import { useLocalization } from '@/i18n';
import type { RepayStreak } from '@/lib/friendReferrals';
import { isUserVerified } from '@/lib/isUserVerified';
import type { RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';
import { DASHBOARD_V2_ASSETS } from '@/views/dashboard-v2/assets';
import DesignImage from '@/views/dashboard-v2/components/DesignImage';
import { type FastRepayNotice, getFastRepayNotice, isFastRepayNoticeDue } from '@/views/dashboard-v2/fastRepayNotice';

// "Before you repay" carousel (George, 2026-11-24): for a loan funded under 48 hours ago, one or two
// cards to look through before paying it back: keep it 2+ days so it raises your limit, and the days
// that earn the food reward. Each line comes from the real rules (fastRepayNotice.ts), with their own
// dates. Shown on the dashboard and on Repay; closing it hides it for 24 hours (it can come back once
// while the 48 hours last). They swipe or tap Next through the cards; ✕ and "Got it" are on the last
// one. Same look as the dashboard's other popups (RatesAnnouncement). Previews: ?fast=1.

const PRIMARY_GRADIENT = 'linear-gradient(77.66deg, #9584ff 0.5%, #6b55f7 98.16%)';
const GOLD_TEXT = 'text-[#b07800] dark:text-[#ffe27a]';

type Slide = 'limit' | 'food';

const COPY = {
   en: {
      title: 'Before you repay',
      limitTitle: 'Keep your loan 2+ days',
      before: (when: string) => `Before ${when}`,
      from: (when: string) => `From ${when}`,
      limitStays: (amount: number) => `Stays $${amount}`,
      limitUp: (amount: number) => `Limit $${amount}`,
      foodTitle: 'Best days to pay',
      noReward: 'No reward',
      next: 'Next',
      gotIt: 'Got it',
      close: 'Close'
   },
   fil: {
      title: 'Bago ka magbayad',
      limitTitle: 'Hawakan muna ang loan nang 2+ araw',
      before: (when: string) => `Bago ${when}`,
      from: (when: string) => `Simula ${when}`,
      limitStays: (amount: number) => `$${amount} pa rin`,
      limitUp: (amount: number) => `Limit $${amount}`,
      foodTitle: 'Pinakamagandang araw magbayad',
      noReward: 'Walang reward',
      next: 'Susunod',
      gotIt: 'Sige',
      close: 'Isara'
   }
};

// Moodeng art made for these cards (Gemini, from the stopwatch / chef hippos).
const SLIDE_ART: Record<Slide, string> = {
   limit: '/fast-repay/keep-two-days.webp',
   food: '/fast-repay/best-days-food.webp'
};

/** One line of the card's mini schedule: grey "too early" or green "this counts". */
function TimeRow({ good, when, result }: { good: boolean; when: string; result: string }) {
   return (
      <li
         className={`flex items-center gap-2.5 rounded-[16px] border-2 px-3 py-2.5 text-left ${
            good
               ? 'border-[#9fe3b4] bg-[#eefbf2] dark:border-[#2f6b45] dark:bg-[#123222]'
               : 'border-transparent bg-[#f4f2f8] dark:bg-[#211a2d]'
         }`}
      >
         <span
            aria-hidden="true"
            className={`grid size-7 shrink-0 place-items-center rounded-full ${
               good ? 'bg-[#4aa256] text-white' : 'bg-[#e2dde9] text-[#8f86a0] dark:bg-[#33294a] dark:text-[#a99cb8]'
            }`}
         >
            {good ? <Check className="size-4" strokeWidth={3} /> : <Lock className="size-3.5" strokeWidth={2.5} />}
         </span>
         <span
            className={`min-w-0 flex-1 text-[14px] font-semibold leading-[18px] ${good ? 'text-[#1f5c33] dark:text-[#bfeccc]' : 'text-[#8f86a0] dark:text-[#a99cb8]'}`}
         >
            {when}
         </span>
         <span
            className={`shrink-0 text-[15px] font-extrabold leading-[18px] ${good ? 'text-[#2f8a4a] dark:text-[#7fd693]' : 'text-[#8f86a0] dark:text-[#a99cb8]'}`}
         >
            {result}
         </span>
      </li>
   );
}

// Preview (?fast=1): a $15 loan funded 3 hours ago, due in 30 days, first on-time payment pays ₱50.
const PREVIEW_STREAK: RepayStreak = { current: 0, best: 0, nextStep: 1, toGo: 1, nextPhp: 50 };
export const buildFastRepayPreviewLoan = (now: number = Date.now()): Loan =>
   ({
      id: 'preview-fast-repay',
      loanAmount: 15,
      totalRepaymentAmount: 16.5,
      repaidAmount: 0,
      loanStatus: 'Lent',
      fundedAt: new Date(now - 3 * 3_600_000).toISOString(),
      dueDate: new Date(now + 30 * 864e5).toISOString(),
      dueTimezone: 'Asia/Manila'
   }) as unknown as Loan;

// Facebook's in-app browser can lose localStorage: this keeps it from reopening on every page this visit.
const seenThisSession = new Map<string, number>();
const seenKey = (userId: string, loanId: string) => `fast-repay-notice:${userId}:${loanId}`;

const readLastSeen = (key: string): number | null => {
   const session = seenThisSession.get(key) ?? null;
   try {
      const stored = Number(window.localStorage.getItem(key));
      return Number.isFinite(stored) && stored > 0 ? Math.max(stored, session ?? 0) : session;
   } catch {
      return session;
   }
};

const writeSeen = (key: string, at: number) => {
   seenThisSession.set(key, at);
   try {
      window.localStorage.setItem(key, String(at));
   } catch {
      // Storage blocked: the session map still keeps it closed for this visit.
   }
};

const track = (event: string, properties: Record<string, unknown>) => {
   try {
      posthog.capture(event, properties);
   } catch {
      // Analytics unavailable: the popup still works.
   }
};

/**
 * Whether this borrower should see the carousel now, and what it says. `loans` = their active loans.
 * The caller renders <FastRepayCarousel> while `isOpen`, and holds its own popups back meanwhile.
 */
export function useFastRepayNotice({ loans, isPreview = false }: { loans: Loan[]; isPreview?: boolean }) {
   const user = useSelector((state: RootState) => state.auth.user);
   const { locale } = useLocalization();
   const { rewards } = useFriendReferrals(!isPreview && Boolean(user?.id));
   const streak = isPreview ? PREVIEW_STREAK : (rewards?.streak ?? null);
   const isVerified = isPreview || isUserVerified(user);

   const notice = useMemo(
      () =>
         getFastRepayNotice({
            loans,
            currentLimit: isPreview ? 15 : user?.cs,
            isVerified,
            joinedAt: isPreview ? null : user?.createdAt,
            streak,
            locale
         }),
      [loans, isPreview, user?.cs, user?.createdAt, isVerified, streak, locale]
   );

   const [closedLoanId, setClosedLoanId] = useState<string | null>(null);
   const key = notice && user?.id ? seenKey(user.id, notice.loanId) : null;
   const isDue = Boolean(notice) && (isPreview || (key !== null && isFastRepayNoticeDue(readLastSeen(key))));
   const isOpen = isDue && closedLoanId !== notice?.loanId;

   const close = () => {
      if (!notice) return;
      setClosedLoanId(notice.loanId);
      if (!isPreview && key) writeSeen(key, Date.now());
   };

   return { notice, isOpen, close, locale };
}

export function FastRepayCarousel({
   notice,
   locale,
   where,
   onClose
}: {
   notice: FastRepayNotice;
   locale: string;
   where: 'dashboard' | 'repay';
   onClose: () => void;
}) {
   const copy = locale === 'fil' ? COPY.fil : COPY.en;
   const slides = useMemo<Slide[]>(
      () => [...(notice.levelUp ? (['limit'] as const) : []), ...(notice.rewardLine ? (['food'] as const) : [])],
      [notice.levelUp, notice.rewardLine]
   );
   const [index, setIndex] = useState(0);
   const [dragX, setDragX] = useState(0);
   const dragStart = useRef<number | null>(null);
   const slide = slides[Math.min(index, slides.length - 1)];
   const isLast = index >= slides.length - 1;

   const when = notice.countsFrom.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: notice.zone
   });

   useEffect(() => {
      track('fast_repay_notice_shown', {
         where,
         slides: slides.join(','),
         level_up: Boolean(notice.levelUp),
         reward: Boolean(notice.rewardLine)
      });
      // Once per opening.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   const finish = () => {
      track('fast_repay_notice_closed', { where, reached: index + 1, of: slides.length });
      onClose();
   };
   const goTo = (next: number) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, next));
      if (clamped !== index) track('fast_repay_notice_slide', { where, slide: clamped + 1 });
      setIndex(clamped);
   };

   useEffect(() => {
      if (!isLast) return;
      const onKeyDown = (event: KeyboardEvent) => {
         if (event.key === 'Escape') finish();
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
   });

   const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest('button')) return;
      dragStart.current = event.clientX;
      event.currentTarget.setPointerCapture(event.pointerId);
   };
   const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
      if (dragStart.current == null) return;
      setDragX(event.clientX - dragStart.current);
   };
   const onPointerEnd = () => {
      if (dragStart.current == null) return;
      dragStart.current = null;
      if (dragX < -60) goTo(index + 1);
      else if (dragX > 60) goTo(index - 1);
      setDragX(0);
   };

   if (!slide) return null;

   return (
      <div
         className="fixed inset-0 z-[80] flex overflow-y-auto overscroll-contain bg-[#140e22]/85 px-5 py-6 backdrop-blur-[3px]"
         role="dialog"
         aria-modal="true"
         aria-labelledby="fast-repay-title"
         data-testid="fast-repay-notice"
      >
         <div className="m-auto flex w-full max-w-[400px] flex-col items-center">
            <div
               className="w-full touch-pan-y select-none overflow-hidden rounded-[26px] bg-gradient-to-b from-[#f3ecff] via-white via-40% to-white dark:from-dv2-tab dark:via-dv2-card dark:to-dv2-card"
               style={{
                  transform: `translateX(${dragX * 0.4}px)`,
                  transition: dragStart.current == null ? 'transform 200ms ease' : 'none'
               }}
               onPointerDown={onPointerDown}
               onPointerMove={onPointerMove}
               onPointerUp={onPointerEnd}
               onPointerCancel={onPointerEnd}
            >
               {/* The title sits inside the card: floating above it, it ran into the page header behind. */}
               <div className="flex justify-center pt-5">
                  <span
                     id="fast-repay-title"
                     className="inline-flex items-center gap-1.5 rounded-full bg-[#efeaff] px-3 py-1 text-[13px] font-bold uppercase tracking-[0.06em] text-[#6b55f7] dark:bg-[#2a1f45] dark:text-[#c9bcff]"
                  >
                     <Hourglass aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
                     {copy.title}
                  </span>
               </div>
               <div key={slide} className="connect-stat-in flex flex-col items-center">
                  <img src={SLIDE_ART[slide]} alt="" className="mt-1 h-[180px] w-[180px] object-contain" draggable={false} />
                  <div className="flex w-full flex-col items-center gap-3 px-5 pb-2 pt-1 text-center">
                     <p className="text-[22px] font-extrabold leading-7 text-[#2b2140] dark:text-[#f5f0ff]">
                        {slide === 'limit' ? copy.limitTitle : copy.foodTitle}
                     </p>
                     {slide === 'limit' && notice.levelUp ? (
                        <>
                           <p className={`-mt-1 text-[32px] font-black leading-9 ${GOLD_TEXT}`}>
                              ${notice.levelUp.from} → ${notice.levelUp.to}
                           </p>
                           <ul className="flex w-full flex-col gap-2">
                              <TimeRow good={false} result={copy.limitStays(notice.levelUp.from)} when={copy.before(when)} />
                              <TimeRow good result={copy.limitUp(notice.levelUp.to)} when={copy.from(when)} />
                           </ul>
                        </>
                     ) : notice.reward ? (
                        <ul className="flex w-full flex-col gap-2">
                           <TimeRow good={false} result={copy.noReward} when={copy.before(notice.reward.from)} />
                           <TimeRow good result={notice.reward.label} when={`${notice.reward.from} – ${notice.reward.to}`} />
                        </ul>
                     ) : (
                        <p className="text-[18px] font-bold leading-6 text-[#2f8a4a] dark:text-[#7fd693]">{notice.rewardLine}</p>
                     )}
                  </div>
               </div>

               <div className="flex flex-col items-center gap-4 px-5 pb-6 pt-2">
                  {slides.length > 1 ? (
                     <div className="flex gap-2" aria-hidden="true">
                        {slides.map((name, dot) => (
                           <span
                              key={name}
                              className={`h-2 rounded-full transition-all ${dot === index ? 'w-6 bg-[#6b55f7]' : 'w-2 bg-[#d6d0e3] dark:bg-[#40354f]'}`}
                           />
                        ))}
                     </div>
                  ) : null}
                  <button
                     type="button"
                     onClick={isLast ? finish : () => goTo(index + 1)}
                     className="flex h-[52px] w-full max-w-[346px] items-center justify-center rounded-[35px] px-5 text-[20px] font-semibold tracking-[-0.4px] text-white transition active:scale-[0.99]"
                     style={{ backgroundImage: PRIMARY_GRADIENT }}
                  >
                     {isLast ? copy.gotIt : copy.next}
                  </button>
               </div>
            </div>
            {/* Look through every card first: ✕ comes with the last one. */}
            {isLast ? (
               <button type="button" onClick={finish} className="mt-10 h-[50px] w-[50px]" aria-label={copy.close}>
                  <DesignImage src={DASHBOARD_V2_ASSETS.closeLarge} className="h-[50px] w-[50px]" />
               </button>
            ) : (
               <span className="mt-10 h-[50px]" aria-hidden="true" />
            )}
         </div>
      </div>
   );
}
