import { useDispatch, useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

import Loading from '@/components/Loading';
import { EXTERNAL_LINKS } from '@/config/externalLinks';
import { logoutUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { AccountStatus } from '@/types/authTypes';

const SUPPORT_LINK = EXTERNAL_LINKS.support.messenger;
type MockStatus = Extract<AccountStatus, 'blocked' | 'banned'> | 'defaulted';
const isPreviewHost = () =>
   window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname.endsWith('.vercel.app');

const getMockStatus = (): MockStatus | null => {
   const mockStatus = new URLSearchParams(window.location.search).get('mockStatus');
   if (!isPreviewHost()) return null;
   return mockStatus === 'blocked' || mockStatus === 'banned' || mockStatus === 'defaulted' ? mockStatus : null;
};

const getMockDefaultAmount = () => {
   const amount = Number(new URLSearchParams(window.location.search).get('mockAmount'));
   return Number.isFinite(amount) && amount > 0 ? amount : 37;
};

export default function AccountRestrictedPage() {
   const dispatch = useDispatch<AppDispatch>();
   const { user, username, isAuthChecked } = useSelector((state: RootState) => state.auth);
   const mockStatus = getMockStatus();
   const status = mockStatus ?? user?.accountStatus;
   const isRestricted = status === 'blocked' || status === 'banned';
   const isDefaultedPreview = mockStatus === 'defaulted';
   const defaultedAmount = getMockDefaultAmount();

   if (!mockStatus && !isAuthChecked) {
      return <Loading />;
   }

   if (!mockStatus && isAuthChecked && (!user?.id || !username)) {
      return <Navigate to="/sign-in" replace />;
   }

   if (!mockStatus && isAuthChecked && user?.id && !isRestricted) {
      return <Navigate to="/dashboard" replace />;
   }

   return (
      <main className="min-h-screen bg-[#F7F4FB] px-4 py-8 flex items-center justify-center">
         <section className="w-full max-w-[440px] rounded-[24px] bg-white px-6 py-8 shadow-[0_18px_50px_rgba(44,19,82,0.12)]">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-[#EFE7FF] text-[#8336F0]">
               <i className="fas fa-lock text-2xl" aria-hidden="true" />
            </div>

            <div className="text-center">
               <p className="mb-3 text-sm font-bold uppercase tracking-[0.08em] text-[#8336F0]">
                  Account support
               </p>
               <h1 className="text-[clamp(1.9rem,8vw,2.4rem)] font-semibold leading-[1.1] tracking-[-0.04em] text-[#040033]">
                  {isDefaultedPreview
                     ? `You have $${defaultedAmount.toLocaleString()} overdue.`
                     : `Your account is currently ${status === 'banned' ? 'banned' : 'blocked'}.`}
               </h1>
               <p className="mt-4 text-base font-medium leading-6 tracking-[-0.02em] text-[#5F536D]">
                  {isDefaultedPreview
                     ? 'Your account needs support before you can continue. Message Moodeng Credit on Messenger so we can help resolve this.'
                     : 'If you think this is a mistake, message Moodeng Credit support on Messenger. We can review your account from there.'}
               </p>
            </div>

            <div className="mt-7 flex flex-col gap-3">
               <a
                  href={SUPPORT_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#6010D2] px-4 text-base font-semibold tracking-[-0.02em] text-white transition-opacity hover:opacity-95"
               >
                  <i className="fab fa-facebook-messenger text-xl" aria-hidden="true" />
                  Message Support
               </a>
               <button
                  type="button"
                  onClick={() => {
                     if (mockStatus) {
                        window.location.href = '/sign-in';
                        return;
                     }
                     void dispatch(logoutUser());
                  }}
                  className="h-12 rounded-2xl border border-[#D8CFDF] bg-white px-4 text-sm font-semibold tracking-[-0.02em] text-[#4D4359] transition-colors hover:bg-[#F7F4FB]"
               >
                  Sign out
               </button>
            </div>
         </section>
      </main>
   );
}
