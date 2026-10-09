import { useEffect, useRef } from 'react';

import { ChevronRight } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { PRE_KYC_CONNECT_PATH } from '@/hooks/usePreKycGate';
import { useVerificationJourney } from '@/hooks/useVerificationJourney';
import type { RootState } from '@/store/store';

// Keeps an unfinished borrower on track (onboarding: wallet → Messenger → bio → book call → ✅,
// src/lib/verificationJourney.ts). Real users were leaving onboarding within seconds and wandering
// the app with nothing pulling them back. Two things:
//   1. A slim "Step 2 of 3 · Connect Messenger ›" bar above the bottom menu, on every screen that
//      has it (except the request board, whose own card says the same thing).
//   2. Once a day, opening the app on the dashboard / request board takes them to their next step.
//      They can still leave from there ("Look around first"); it just doesn't happen by accident.

const RESUME_PAGES = new Set(['/', '/dashboard', '/request-board']);

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
   const location = useLocation();
   const navigate = useNavigate();
   const journey = useVerificationJourney();
   const checkedRef = useRef(false);

   const isBorrower = user?.userRole === 'borrower';
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

   if (!active || !bottomNavVisible || location.pathname === '/request-board' || !journey.step) return null;

   return (
      <button
         className="fixed left-1/2 z-40 flex w-[calc(100%-40px)] max-w-[400px] -translate-x-1/2 items-center gap-3 rounded-[18px] bg-[#6b55f7] px-4 py-3 text-left text-white shadow-[0_6px_18px_rgba(107,85,247,0.35)] active:scale-[0.99]"
         onClick={journey.go}
         style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 118px)' }}
         type="button"
      >
         <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-white/80">{`Step ${journey.step} of 3 to your first loan`}</span>
            <span className="truncate text-[16px] font-bold">{journey.cta}</span>
         </span>
         <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
      </button>
   );
}
