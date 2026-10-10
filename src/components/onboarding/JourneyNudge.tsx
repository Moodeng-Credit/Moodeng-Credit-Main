import { type PointerEvent, useEffect, useRef, useState } from 'react';

import { ChevronRight } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { PRE_KYC_CONNECT_PATH } from '@/hooks/usePreKycGate';
import { useVerificationJourney } from '@/hooks/useVerificationJourney';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

// Keeps an unfinished borrower on track (onboarding: wallet → Messenger → bio → book call → ✅,
// src/lib/verificationJourney.ts). Real users were leaving onboarding within seconds and wandering
// the app with nothing pulling them back. Two things:
//   1. A slim "Step 2 of 3 · Connect Messenger ›" bar above the bottom menu, on every screen that
//      has it (except the request board, whose own card says the same thing).
//   2. Once a day, opening the app on the dashboard / request board takes them to their next step.
//      They can still leave from there ("Look around first"); it just doesn't happen by accident.
//   3. While they wait on the team's ✅ after the call, it watches for the approval on every screen
//      and, the moment it lands, takes them to the request board's glowing "You're approved 🎉"
//      Apply card — so nobody sits on "See you on the call" after being approved.

// How often to look for the approval while waiting (plus whenever the app comes back into view).
const APPROVAL_POLL_MS = 15_000;

const RESUME_PAGES = new Set(['/', '/dashboard', '/request-board']);

// The bar can sit on top of buttons near the bottom of a page (Log out on Account, 2026-10-11), so
// it can be dragged up or down out of the way. A drag doesn't count as a tap. The spot is kept for
// this visit only.
const DRAG_THRESHOLD_PX = 6;
const OFFSET_KEY = 'moodeng-journey-nudge-offset';
const readOffset = () => {
   try {
      return Number(window.sessionStorage.getItem(OFFSET_KEY)) || 0;
   } catch {
      return 0;
   }
};
const saveOffset = (offset: number) => {
   try {
      window.sessionStorage.setItem(OFFSET_KEY, String(offset));
   } catch {
      // ignore
   }
};
// Up to near the top of the screen, or down over the bottom menu.
const clampOffset = (offset: number) => Math.min(80, Math.max(-(window.innerHeight - 260), offset));

const resumeKey = (userId: string) => `moodeng-journey-resume:${userId}`;
const today = () => new Date().toISOString().slice(0, 10);

const resumedToday = (userId: string) => {
   try {
      return window.localStorage.getItem(resumeKey(userId)) === today();
   } catch {
      return true; // storage unavailable — don't redirect at all rather than on every load
   }
};

const markResumed = (userId: string) => {
   try {
      window.localStorage.setItem(resumeKey(userId), today());
   } catch {
      // ignore
   }
};

export function JourneyNudge({ bottomNavVisible }: { bottomNavVisible: boolean }) {
   const user = useSelector((state: RootState) => state.auth.user);
   const dispatch = useDispatch<AppDispatch>();
   const location = useLocation();
   const navigate = useNavigate();
   const { showToast } = useToast();
   const journey = useVerificationJourney();
   const checkedRef = useRef(false);
   const [offset, setOffset] = useState(readOffset);
   const dragRef = useRef<{ startY: number; startOffset: number; moved: boolean } | null>(null);
   const suppressClickRef = useRef(false);

   const isBorrower = user?.userRole === 'borrower';
   const loanAccessStatus = user?.loanAccessStatus;
   const isWaitingOnApproval = isBorrower && loanAccessStatus === 'pending';

   // iPhone Safari rarely fires window focus on an app switch, so also listen for visibility and
   // pageshow (back-forward cache), and poll while the screen stays open.
   useEffect(() => {
      if (!isWaitingOnApproval) return undefined;
      const refresh = () => {
         if (document.visibilityState === 'visible') void dispatch(fetchUser());
      };
      const timer = window.setInterval(refresh, APPROVAL_POLL_MS);
      document.addEventListener('visibilitychange', refresh);
      window.addEventListener('pageshow', refresh);
      window.addEventListener('focus', refresh);
      return () => {
         window.clearInterval(timer);
         document.removeEventListener('visibilitychange', refresh);
         window.removeEventListener('pageshow', refresh);
         window.removeEventListener('focus', refresh);
      };
   }, [dispatch, isWaitingOnApproval]);

   const previousStatusRef = useRef(loanAccessStatus);
   useEffect(() => {
      const previous = previousStatusRef.current;
      previousStatusRef.current = loanAccessStatus;
      if (!isBorrower || previous !== 'pending' || loanAccessStatus !== 'approved') return;
      showToast(TOAST_TYPES.SUCCESS, 'You’re approved 🎉', 'The team approved you — apply for your loan now.');
      // The onboarding screen sends them on to the loan form itself (ConnectBeforeKyc).
      if (location.pathname === PRE_KYC_CONNECT_PATH) return;
      navigate('/request-board', { state: { justApproved: true } });
   }, [isBorrower, loanAccessStatus, location.pathname, navigate, showToast]);
   const active = isBorrower && !journey.isLoading && journey.onboarding;

   // 1x a day: a plain app open (no deep-link state / query) on a home screen → their next step.
   useEffect(() => {
      if (checkedRef.current || !active || !user?.id) return;
      checkedRef.current = true;
      const plainOpen = RESUME_PAGES.has(location.pathname) && !location.search && !location.state;
      if (!plainOpen || resumedToday(user.id)) return;
      markResumed(user.id);
      journey.go();
   }, [active, user?.id, location.pathname, location.search, location.state, journey]);

   // Visiting their next step themselves counts as today's resume.
   useEffect(() => {
      if (!user?.id) return;
      if (location.pathname === PRE_KYC_CONNECT_PATH || location.pathname.startsWith('/onboarding/wallet')) markResumed(user.id);
   }, [location.pathname, user?.id]);

   const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
      dragRef.current = { startY: e.clientY, startOffset: offset, moved: false };
      suppressClickRef.current = false;
   };
   const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
      if (!drag.moved) {
         drag.moved = true;
         e.currentTarget.setPointerCapture(e.pointerId);
      }
      setOffset(clampOffset(drag.startOffset + dy));
   };
   const onPointerUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag?.moved) return;
      suppressClickRef.current = true;
      setOffset((current) => {
         saveOffset(current);
         return current;
      });
   };
   const onClick = () => {
      if (suppressClickRef.current) {
         suppressClickRef.current = false;
         return;
      }
      journey.go();
   };

   if (!active || !bottomNavVisible || location.pathname === '/request-board' || !journey.step) return null;

   return (
      <button
         className="fixed left-1/2 z-40 flex w-[calc(100%-40px)] max-w-[400px] -translate-x-1/2 touch-none select-none items-center gap-3 rounded-[18px] bg-[#6b55f7] px-4 py-3 text-left text-white shadow-[0_6px_18px_rgba(107,85,247,0.35)] active:scale-[0.99]"
         onClick={onClick}
         onPointerCancel={onPointerUp}
         onPointerDown={onPointerDown}
         onPointerMove={onPointerMove}
         onPointerUp={onPointerUp}
         style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${118 - offset}px)` }}
         title="Drag to move"
         type="button"
      >
         <span aria-hidden="true" className="absolute left-1/2 top-1 h-1 w-8 -translate-x-1/2 rounded-full bg-white/40" />
         <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-white/80">{`Step ${journey.step} of 3 to your first loan`}</span>
            <span className="truncate text-[16px] font-bold">{journey.cta}</span>
         </span>
         <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
      </button>
   );
}
