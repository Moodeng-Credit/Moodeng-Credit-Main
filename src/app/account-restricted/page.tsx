import { useEffect, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { EXTERNAL_LINKS } from '@/config/externalLinks';
import { useDefaultedBorrowerSupport } from '@/hooks/useDefaultedBorrowerSupport';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { fetchUser, logoutUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { AccountStatus } from '@/types/authTypes';

type MockStatus = Extract<AccountStatus, 'blocked' | 'banned'>;
const isPreviewHost = () =>
   window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname.endsWith('.vercel.app');

const getMockStatus = (): MockStatus | null => {
   const mockStatus = new URLSearchParams(window.location.search).get('mockStatus');
   if (!isPreviewHost()) return null;
   return mockStatus === 'blocked' || mockStatus === 'banned' ? mockStatus : null;
};

const formatOverdueAmount = (amount: number) => {
   return amount.toLocaleString(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2
   });
};

export default function AccountRestrictedPage() {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const { user, username, isAuthChecked } = useSelector((state: RootState) => state.auth);
   const userLoansFetchedAt = useSelector((state: RootState) => state.loans.userLoansFetchedAt);
   const [isRecoveringSession, setIsRecoveringSession] = useState(false);
   const [isSigningOut, setIsSigningOut] = useState(false);
   const mockStatus = getMockStatus();
   const status = mockStatus ?? user?.accountStatus;
   const isRestricted = status === 'blocked' || status === 'banned';
   const defaultedBorrower = useDefaultedBorrowerSupport(!mockStatus && isAuthChecked ? user?.id : null, userLoansFetchedAt);
   const isDefaultedBorrower = defaultedBorrower.support.overdueAmount > 0;
   const hasProfileSession = Boolean(user?.id && username);
   const isCheckingAuth = !mockStatus && (!isAuthChecked || isRecoveringSession);
   const isMissingSession = !mockStatus && isAuthChecked && !isRecoveringSession && !hasProfileSession;
   const isCheckingDefaultedLoans = !mockStatus && Boolean(user?.id) && defaultedBorrower.isLoading;
   const hasDefaultedCheckError = !mockStatus && Boolean(user?.id) && Boolean(defaultedBorrower.error);
   const supportLink = isDefaultedBorrower
      ? EXTERNAL_LINKS.support.messengerDefaulted
      : EXTERNAL_LINKS.support.messenger;

   const handleSignOut = async () => {
      if (isSigningOut) return;
      setIsSigningOut(true);
      await dispatch(logoutUser());
      navigate('/sign-in', { replace: true });
   };

   useEffect(() => {
      if (mockStatus || !isAuthChecked || user?.id || !isSupabaseBrowserConfigured()) {
         return;
      }

      let isMounted = true;
      setIsRecoveringSession(true);

      const recoverSession = async () => {
         const supabase = getSupabaseBrowserClient();
         const {
            data: { session }
         } = await supabase.auth.getSession();

         if (session?.user) {
            await dispatch(fetchUser()).unwrap();
         }
      };

      recoverSession()
         .catch((error) => {
            console.error('Failed to recover account support session:', error);
         })
         .finally(() => {
            if (isMounted) {
               setIsRecoveringSession(false);
            }
         });

      return () => {
         isMounted = false;
      };
   }, [dispatch, isAuthChecked, mockStatus, user?.id]);

   if (
      !mockStatus &&
      isAuthChecked &&
      hasProfileSession &&
      !isRestricted &&
      !isDefaultedBorrower &&
      !isCheckingDefaultedLoans &&
      !hasDefaultedCheckError
   ) {
      return <Navigate to="/dashboard" replace />;
   }

   if (isCheckingAuth || isCheckingDefaultedLoans) {
      return <main className="min-h-screen bg-[#F7F4FB]" aria-label="Loading account support" />;
   }

   const title = (() => {
      if (isMissingSession) return 'Sign in to view account support';
      if (hasDefaultedCheckError) return 'We could not confirm your account status.';
      if (isDefaultedBorrower) return `Repay $${formatOverdueAmount(defaultedBorrower.support.overdueAmount)} to continue.`;
      return `Your account is currently ${status === 'banned' ? 'banned' : 'blocked'}.`;
   })();

   const description = (() => {
      if (isMissingSession) {
         return 'Your session is not active in this browser. Sign in again, or message Moodeng Credit support if you need help.';
      }
      if (hasDefaultedCheckError) {
         return 'We could not load the repayment details for this account. Message Moodeng Credit support so we can review it.';
      }
      if (isDefaultedBorrower) {
         return 'Borrowing is paused while this loan is overdue. You are still signed in, and you can repay now or message support for help.';
      }
      return 'If you think this is a mistake, message Moodeng Credit support on Messenger. We can review your account from there.';
   })();

   return (
      <main className="relative min-h-screen bg-[#F7F4FB] px-4 py-8 flex items-center justify-center">
         {hasProfileSession ? (
            <button
               type="button"
               onClick={handleSignOut}
               disabled={isSigningOut}
               className="absolute right-4 top-4 inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold tracking-[-0.02em] text-[#6010D2] shadow-[0_8px_24px_rgba(44,19,82,0.10)] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
               {isSigningOut ? 'Signing out...' : 'Log out'}
            </button>
         ) : null}
         <section className="w-full max-w-[440px] rounded-[24px] bg-white px-6 py-8 shadow-[0_18px_50px_rgba(44,19,82,0.12)]">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-[#EFE7FF] text-[#8336F0]">
               <i className="fas fa-lock text-2xl" aria-hidden="true" />
            </div>

            <div className="text-center">
               <p className="mb-3 text-sm font-bold uppercase tracking-[0.08em] text-[#8336F0]">
                  Account support
               </p>
               <h1 className="text-[clamp(1.9rem,8vw,2.4rem)] font-semibold leading-[1.1] tracking-[-0.04em] text-[#040033]">
                  {title}
               </h1>
               <p className="mt-4 text-base font-medium leading-6 tracking-[-0.02em] text-[#5F536D]">
                  {description}
               </p>
            </div>

            <div className="mt-7 flex flex-col gap-3">
               {isDefaultedBorrower && (
                  <Link
                     to="/repay"
                     className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#16A34A] px-4 text-base font-semibold tracking-[-0.02em] text-white transition-opacity hover:opacity-95"
                  >
                     <i className="fas fa-credit-card text-lg" aria-hidden="true" />
                     Repay Now
                  </Link>
               )}
               {isMissingSession && (
                  <Link
                     to="/sign-in"
                     className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#6010D2] px-4 text-base font-semibold tracking-[-0.02em] text-white transition-opacity hover:opacity-95"
                  >
                     Sign In
                  </Link>
               )}
               <a
                  href={supportLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl px-4 text-base font-semibold tracking-[-0.02em] text-white transition-opacity hover:opacity-95 ${isMissingSession ? 'bg-[#16A34A]' : 'bg-[#6010D2]'}`}
               >
                  <i className="fab fa-facebook-messenger text-xl" aria-hidden="true" />
                  Message Support
               </a>
            </div>
         </section>
      </main>
   );
}
