import { useCallback, useEffect, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { usePreKycGate } from '@/hooks/usePreKycGate';
import { isTikTokAccountEmail } from '@/lib/phoneAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { WalletSetupPhase } from '@/lib/web3/openfort';

import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { User } from '@/types/authTypes';
import { CONNECT_HIPPOS, StepCelebration, StepTrail } from '@/views/dashboard/components/connectKit';
import ConnectStep, { type ConnectPage, LoanAccessPendingCard } from '@/views/dashboard/components/ConnectStep';
import GrowingWalletHippo from '@/views/onboarding/GrowingWalletHippo';
import OnboardingBio from '@/views/onboarding/OnboardingBio';
import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';
import TikTokPhoneStep, { wasTikTokPhoneSkipped } from '@/views/onboarding/TikTokPhoneStep';

// /onboarding/connect — the pre-KYC gate (src/hooks/usePreKycGate.ts). After the wallet, a new
// borrower connects Messenger, fills in their bio (work, payday, income — shown to the team on the
// Telegram card), says what the loan is for and books the 15-min intro call; an admin
// taps ✅ Showed up after it, which approves them (loan_access_status = 'approved') and unlocks ID
// verification. Same ConnectStep + loan-access machinery as the gated loan flows, just before KYC.
//
// Anyone not gated (approved, verified, gate switched off) goes straight on to the loan form, where
// verifying their ID is the last step of sending the request.

// While they wait on the team, JourneyNudge (mounted app-wide) watches for the approval, so this
// screen moves them on to the loan form without a reload.

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
   // Dev-only /onboarding/connect-preview(?view=pending|about|celebrate|wallet-grow): the screens without an account.
   const isPreview = import.meta.env.DEV && location.pathname.includes('preview');
   const user = isPreview ? PREVIEW_USER : authUser;
   const gate = usePreKycGate();
   const { isGated, isLoading } = isPreview ? { isGated: true, isLoading: false } : gate;
   const isPending = isPreview ? new URLSearchParams(location.search).get('view') === 'pending' : user?.loanAccessStatus === 'pending';

   // The sub-step lives in the URL, so the phone's back button moves between steps.
   const [searchParams] = useSearchParams();
   const stepParam = searchParams.get('step');
   const page: ConnectPage = stepParam === 'about' || stepParam === 'intro' || stepParam === 'call' ? stepParam : 'contact';
   const setPage = useCallback((next: ConnectPage) => navigate(next === 'contact' ? '?' : `?step=${next}`), [navigate]);

   // TikTok sign-ups (no email or phone from TikTok) add a phone for texts before Messenger: TikTokPhoneStep.
   const isTikTok = isPreview ? new URLSearchParams(location.search).get('view') === 'tiktok-phone' : isTikTokAccountEmail(user?.email);
   const [phoneState, setPhoneState] = useState<'checking' | 'needed' | 'done'>('checking');
   useEffect(() => {
      if (!isTikTok || !user) return;
      if (isPreview) return setPhoneState('needed');
      if (wasTikTokPhoneSkipped(user.id)) return setPhoneState('done');
      let cancelled = false;
      void getSupabaseBrowserClient()
         .auth.getUser()
         .then(({ data }) => {
            if (!cancelled) setPhoneState(data.user?.phone ? 'done' : 'needed');
         });
      return () => {
         cancelled = true;
      };
   }, [isTikTok, isPreview, user]);

   if (!user) return null;
   if (!user.userRole) return <Navigate replace to="/onboarding/role" />;
   if (isLoading) return null;
   // Through onboarding (the team approved them, or the gate is off): straight to the loan form —
   // the ID check is the last step of sending their first request.
   if (!isGated) return <Navigate replace state={{ openLoanRequest: true }} to="/request-board" />;
   if (isTikTok && phoneState === 'checking') return null;

   return (
      <div className="connect-ui mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-white dark:bg-[#100d17]">
         <OnboardingHeader
            hideBack
            soundToggle
            tooltip="Questions? Message Moodeng Credit on Facebook or email support@moodeng.app — we usually reply within a day."
         />
         {isTikTok && phoneState === 'needed' && !isPending && page === 'contact' ? (
            <TikTokPhoneStep onDone={() => setPhoneState('done')} preview={isPreview} userId={user.id} />
         ) : isPreview && new URLSearchParams(location.search).get('view') === 'wallet-grow' ? (
            <WalletGrowPreview />
         ) : isPreview && new URLSearchParams(location.search).get('view') === 'celebrate' ? (
            <StepCelebration
               image={CONNECT_HIPPOS.approved}
               onDone={() => undefined}
               stats={[
                  { label: 'Done', value: 'Facebook ✓', tone: 'green' },
                  { label: 'Next up', value: 'About you', tone: 'purple' },
                  { label: 'Steps left', value: 3, tone: 'amber' }
               ]}
               subtitle="Nice job — now we can message you about your loan."
               title="Facebook connected!"
               trail={<StepTrail current={1} steps={['Messenger', 'About you', 'Your goal', 'Book call']} />}
            />
         ) : isPreview && new URLSearchParams(location.search).get('view') === 'about' ? (
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

// Dev preview: the Instant Wallet hippo growing through the setup phases on a loop.
const PREVIEW_PHASES: (WalletSetupPhase | null)[] = [null, 'securing', 'creating', 'saving', 'done', 'done', 'done'];
function WalletGrowPreview() {
   const [index, setIndex] = useState(0);
   useEffect(() => {
      const timer = window.setInterval(() => setIndex((i) => (i + 1) % PREVIEW_PHASES.length), 1200);
      return () => window.clearInterval(timer);
   }, []);
   return (
      <div className="flex flex-1 flex-col items-center justify-center px-md-4 text-center">
         <GrowingWalletHippo idleSrc="/hippos/hippo-wallet.png" phase={PREVIEW_PHASES[index]} />
         <p className="text-md-b2 text-md-neutral-700">phase: {PREVIEW_PHASES[index] ?? 'idle'}</p>
      </div>
   );
}
