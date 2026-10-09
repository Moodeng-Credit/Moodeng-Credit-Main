import { useCallback, useEffect } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { usePreKycGate } from '@/hooks/usePreKycGate';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { User } from '@/types/authTypes';
import ConnectStep, { type ConnectPage, LoanAccessPendingCard } from '@/views/dashboard/components/ConnectStep';
import OnboardingBio from '@/views/onboarding/OnboardingBio';
import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';

// /onboarding/connect — the pre-KYC gate (src/hooks/usePreKycGate.ts). After the wallet, a new
// borrower connects Messenger, fills in their bio (work, payday, income — shown to the team on the
// Telegram card), says what the loan is for and books the 15-min intro call; an admin
// taps ✅ Showed up after it, which approves them (loan_access_status = 'approved') and unlocks ID
// verification. Same ConnectStep + loan-access machinery as the gated loan flows, just before KYC.
//
// Anyone not gated (approved, verified, gate switched off) goes straight on to the loan form, where
// verifying their ID is the last step of sending the request.

// While they wait on the team, look for the approval this often (plus on every return to the tab).
const PENDING_REFRESH_MS = 15_000;

const PREVIEW_USER = {
   id: '00000000-0000-0000-0000-000000000000',
   userRole: 'borrower',
   displayName: 'Preview',
   username: 'preview',
   loanAccessStatus: 'none',
   hasReferral: false,
   missedLastCall: false
} as unknown as User;

export default function ConnectBeforeKyc() {
   const navigate = useNavigate();
   const location = useLocation();
   const dispatch = useDispatch<AppDispatch>();
   const authUser = useSelector((state: RootState) => state.auth.user);
   // Dev-only /onboarding/connect-preview(?view=pending|about): the screens without an account.
   const isPreview = import.meta.env.DEV && location.pathname.includes('preview');
   const user = isPreview ? PREVIEW_USER : authUser;
   const gate = usePreKycGate();
   const { isGated, isLoading } = isPreview ? { isGated: true, isLoading: false } : gate;
   const isPending = isPreview ? new URLSearchParams(location.search).get('view') === 'pending' : user?.loanAccessStatus === 'pending';

   const refresh = useCallback(() => void dispatch(fetchUser()), [dispatch]);

   // The sub-step lives in the URL, so the phone's back button moves between steps.
   const [searchParams] = useSearchParams();
   const stepParam = searchParams.get('step');
   const page: ConnectPage = stepParam === 'about' || stepParam === 'intro' || stepParam === 'call' ? stepParam : 'contact';
   const setPage = useCallback((next: ConnectPage) => navigate(next === 'contact' ? '?' : `?step=${next}`), [navigate]);

   // Waiting on the call / the admin's ✅: refresh so the approval moves them on without a reload.
   useEffect(() => {
      if (!isPending || isPreview) return undefined;
      const timer = window.setInterval(refresh, PENDING_REFRESH_MS);
      const onVisible = () => {
         if (document.visibilityState === 'visible') refresh();
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => {
         window.clearInterval(timer);
         document.removeEventListener('visibilitychange', onVisible);
      };
   }, [isPending, isPreview, refresh]);

   if (!user) return null;
   if (!user.userRole) return <Navigate replace to="/onboarding/role" />;
   if (isLoading) return null;
   // Through onboarding (the team approved them, or the gate is off): straight to the loan form —
   // the ID check is the last step of sending their first request.
   if (!isGated) return <Navigate replace state={{ openLoanRequest: true }} to="/request-board" />;

   return (
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-white dark:bg-[#08040f]">
         <OnboardingHeader
            hideBack
            tooltip="Questions? Message Moodeng Credit on Facebook or email support@moodeng.app — we usually reply within a day."
         />
         {isPreview && new URLSearchParams(location.search).get('view') === 'about' ? (
            <OnboardingBio onBack={() => undefined} onDone={() => undefined} user={user} />
         ) : isPending ? (
            <LoanAccessPendingCard
               closeLabel="Look around meanwhile"
               context="kyc"
               mode="call"
               onClose={() => navigate('/request-board')}
               userId={user.id}
               withEmma={Boolean(user.hasReferral)}
            />
         ) : (
            <ConnectStep
               context="kyc"
               displayName={user.displayName ?? user.username ?? ''}
               missedCall={Boolean(user.missedLastCall)}
               mode="call"
               needsAbout={!user.incomeType}
               onPageChange={setPage}
               page={page}
               onBack={() => navigate('/request-board')}
               renderAbout={({ onBack, onDone }) => <OnboardingBio onBack={onBack} onDone={onDone} user={user} />}
               onSubmitted={async () => {
                  await dispatch(fetchUser());
               }}
               userId={user.id}
               wasRejected={user.loanAccessStatus === 'rejected'}
               withEmma={Boolean(user.hasReferral)}
            />
         )}
      </div>
   );
}
