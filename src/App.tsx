import { useEffect } from 'react';

import posthog from 'posthog-js';
import { useSelector } from 'react-redux';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import AdminPanel from '@/app/admin/page';
import LenderDashboard from '@/app/lender/dashboard/page';
import LenderPerformance from '@/app/lender/performance/page';
import LenderRequestBoard from '@/app/lender/request-board/page';
import WalletConnect from '@/app/onboarding/wallet/page';
import WalletConnected from '@/app/onboarding/wallet/connected/page';
import OnboardingWelcome from '@/app/onboarding/welcome/page';
import WorldIdVerification from '@/app/verify-world-id/page';
import CongratulationsPage from '@/app/onboarding/congratulations/page';
import BottomNav from '@/components/BottomNav';
import Footer from '@/components/Footer';
import Header from '@/components/Header/Header';
import MarketingPageShell from '@/components/marketing/MarketingPageShell';
import { WalletLoadingOverlay } from '@/components/loading/WalletLoadingOverlay';
import { AdminGuard } from '@/components/AdminGuard';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RoleGuard } from '@/components/RoleGuard';
import { useDefaultedBorrowerSupport } from '@/hooks/useDefaultedBorrowerSupport';

import AuthSuccess from '@/app/auth-success/page';
import AuthConfirm from '@/app/auth/confirm/page';
import AccountRestrictedPage from '@/app/account-restricted/page';
import Benefits from '@/app/benefits/page';
import Dashboard from '@/views/dashboard/Dashboard';
import RequestBoard from '@/views/dashboard/RequestBoard';
import FAQ from '@/app/faq/page';
import ForgotPassword from '@/app/forgot-password/page';
import Guide from '@/app/guide/page';
import CreditLevelingGuidePage from '@/app/credit-leveling-guide/page';
import Login from '@/app/login/page';
// Import pages
import Home from '@/app/page';
import Profile from '@/app/profile/page';
import ResetPassword from '@/app/reset-password/page';
import SignUp from '@/app/signup/page';
import Simple from '@/app/simple/page';
import Test from '@/app/test/page';
import SupportPage from '@/app/support/page';
import SupportGettingStartedPage from '@/app/support/getting-started/page';
import SupportGuidesPage from '@/app/support/guides/page';
import SupportGuideDetailPage from '@/app/support/guides/[slug]/page';
import SupportFAQPage from '@/app/support/faq/page';
import SupportUpdatesPage from '@/app/support/updates/page';
import SupportUpdateDetailPage from '@/app/support/updates/[slug]/page';
import LenderDiversityPage from '@/app/lender-diversity/page';
import MilestonesPage from '@/app/milestones/page';
import UserLenderDiversityPage from '@/app/user/[username]/lender-diversity/page';
import UserProfile from '@/app/user/[username]/page';
import UserProgressHistoryPage from '@/app/user/[username]/progress-history/page';
import Ut from '@/app/ut/page';
import WhyLend from '@/app/whylend/page';
import { type RootState } from '@/store/store';
import Account from '@/views/account/Account';
import AccountSettings from '@/views/account/AccountSettings';
import Repay from '@/views/repay/Repay';
import TransactionDetail from '@/views/transactions/TransactionDetail';
import TransactionHistory from '@/views/transactions/TransactionHistory';
import RoleSelection from '@/app/role-selection/page';

function Layout({ children }: { children: React.ReactNode }) {
   return (
      <div className="flex flex-col min-h-screen">
         <Header />
         <main className="flex-grow">{children}</main>
         <Footer />
      </div>
   );
}

const BOTTOM_NAV_ROUTES = ['/request-board', '/repay', '/dashboard', '/lender/dashboard', '/lender/transactions', '/history', '/account', '/account/settings'];

function AccountAccessChecking() {
   return (
      <main className="min-h-screen bg-[#F7F4FB] px-4 py-8 flex items-center justify-center">
         <section className="w-full max-w-[440px] rounded-[24px] bg-white px-6 py-8 shadow-[0_18px_50px_rgba(44,19,82,0.12)]">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-[#EFE7FF] text-[#8336F0]">
               <i className="fas fa-clock text-2xl" aria-hidden="true" />
            </div>
            <div className="text-center">
               <p className="mb-3 text-sm font-bold uppercase tracking-[0.08em] text-[#8336F0]">
                  Account check
               </p>
               <h1 className="text-[clamp(1.9rem,8vw,2.4rem)] font-semibold leading-[1.1] tracking-[-0.04em] text-[#040033]">
                  Checking your account
               </h1>
               <p className="mt-4 text-base font-medium leading-6 tracking-[-0.02em] text-[#5F536D]">
                  We are checking your repayment details before opening the app.
               </p>
            </div>
            <div className="mt-7 space-y-3">
               {['Signed in', 'Checking repayment status', 'Opening the right screen'].map((label, index) => (
                  <div
                     key={label}
                     className="flex items-center gap-3 rounded-2xl border border-[#E6DDEC] bg-[#FBF9FE] px-4 py-3 text-left"
                  >
                     <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#EFE7FF] text-sm font-semibold text-[#6010D2]">
                        {index + 1}
                     </span>
                     <span className="text-sm font-semibold tracking-[-0.02em] text-[#4D4359]">{label}</span>
                  </div>
               ))}
            </div>
         </section>
      </main>
   );
}

export default function App() {
   const location = useLocation();
   const isPosthogEnabled = import.meta.env.PROD && Boolean(import.meta.env.VITE_PUBLIC_POSTHOG_KEY);
   const { user, username, isAuthChecked } = useSelector((state: RootState) => state.auth);
   const isAuthenticated = Boolean(user?.id && username);
   const shouldCheckDefaultedBorrower = isAuthChecked && isAuthenticated;
   const defaultedBorrower = useDefaultedBorrowerSupport(shouldCheckDefaultedBorrower ? user.id : null);
   const isAccountRestricted = user?.accountStatus === 'blocked' || user?.accountStatus === 'banned';
   const isDefaultedBorrower = defaultedBorrower.support.overdueAmount > 0;
   const canRepayWhileDefaulted = isDefaultedBorrower && location.pathname === '/repay';
   const isCheckingDefaultedAccess =
      shouldCheckDefaultedBorrower &&
      defaultedBorrower.isLoading &&
      location.pathname !== '/account-restricted' &&
      location.pathname !== '/repay';
   const shouldShowAccountSupport = isAccountRestricted || isDefaultedBorrower;
   const isUserDetailRoute = location.pathname.includes('/progress-history') || location.pathname.includes('/lender-diversity');
   const showBottomNav =
      user?.id &&
      !shouldShowAccountSupport &&
      user?.userRole &&
      (BOTTOM_NAV_ROUTES.includes(location.pathname) ||
         (location.pathname.startsWith('/user/') && !isUserDetailRoute) ||
         location.pathname.startsWith('/support') ||
         location.pathname.startsWith('/history/'));

   useEffect(() => {
      if (!isPosthogEnabled) {
         return;
      }

      posthog.capture('$pageview', {
         $current_url: window.location.href
      });
   }, [isPosthogEnabled, location]);

   useEffect(() => {
      if (!isPosthogEnabled) {
         return;
      }

      if (user?.id) {
         posthog.identify(user.id, {
            email: user.email,
            username: user.username || username
         });
         return;
      }

      posthog.reset();
   }, [isPosthogEnabled, user?.email, user?.id, user?.username, username]);

   if (isAccountRestricted && location.pathname !== '/account-restricted') {
      return <Navigate to="/account-restricted" replace />;
   }

   if (isCheckingDefaultedAccess) {
      return (
         <>
            <WalletLoadingOverlay />
            <AccountAccessChecking />
         </>
      );
   }

   if (shouldShowAccountSupport && !canRepayWhileDefaulted && location.pathname !== '/account-restricted') {
      return <Navigate to="/account-restricted" replace />;
   }

   return (
      <>
         <WalletLoadingOverlay />
         <Routes>
            <Route path="/" element={<Home />} />

            {/* Auth */}
            <Route path="/sign-in" element={<Login />} />
            <Route path="/sign-up" element={<SignUp />} />
            <Route path="/account-restricted" element={<AccountRestrictedPage />} />

            {/* Onboarding */}
            <Route path="/onboarding/role" element={<ProtectedRoute><RoleSelection /></ProtectedRoute>} />
            <Route path="/onboarding/welcome" element={<ProtectedRoute><OnboardingWelcome /></ProtectedRoute>} />
            <Route path="/onboarding/wallet" element={<ProtectedRoute><WalletConnect /></ProtectedRoute>} />
            <Route path="/onboarding/wallet/connected" element={<ProtectedRoute><WalletConnected /></ProtectedRoute>} />
            <Route path="/onboarding/congratulations" element={<ProtectedRoute><CongratulationsPage /></ProtectedRoute>} />

            {/* Verification */}
            <Route path="/verify-world-id" element={<ProtectedRoute><RoleGuard><WorldIdVerification /></RoleGuard></ProtectedRoute>} />

            {/* Borrower */}
            <Route path="/dashboard" element={<ProtectedRoute><RoleGuard><Dashboard /></RoleGuard></ProtectedRoute>} />
            <Route path="/request-board" element={<RequestBoard />} />
            <Route path="/repay" element={<ProtectedRoute><RoleGuard><Repay /></RoleGuard></ProtectedRoute>} />
            <Route path="/milestones" element={<ProtectedRoute><RoleGuard><MilestonesPage /></RoleGuard></ProtectedRoute>} />
            <Route path="/lender-diversity" element={<ProtectedRoute><RoleGuard><LenderDiversityPage /></RoleGuard></ProtectedRoute>} />

            {/* Lender */}
            <Route path="/lender/dashboard" element={<ProtectedRoute><RoleGuard><LenderDashboard /></RoleGuard></ProtectedRoute>} />
            <Route path="/lender/request-board" element={<ProtectedRoute><RoleGuard><LenderRequestBoard /></RoleGuard></ProtectedRoute>} />
            <Route path="/lender/performance" element={<ProtectedRoute><RoleGuard><LenderPerformance /></RoleGuard></ProtectedRoute>} />
            <Route path="/lender/transactions" element={<ProtectedRoute><RoleGuard><TransactionHistory /></RoleGuard></ProtectedRoute>} />

            {/* Shared authenticated */}
            <Route path="/history" element={<ProtectedRoute><RoleGuard><TransactionHistory /></RoleGuard></ProtectedRoute>} />
            <Route path="/history/:loanId" element={<ProtectedRoute><RoleGuard><TransactionDetail /></RoleGuard></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><RoleGuard><Account /></RoleGuard></ProtectedRoute>} />
            <Route path="/account/settings" element={<ProtectedRoute><RoleGuard><AccountSettings /></RoleGuard></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin" element={<AdminGuard><AdminPanel /></AdminGuard>} />

            {/* Profile */}
            <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />

            {/* Auth flows */}
            <Route path="/forgot-password" element={<Layout><ForgotPassword /></Layout>} />
            <Route path="/reset-password" element={<Layout><ResetPassword /></Layout>} />
            <Route path="/auth-success" element={<AuthSuccess />} />
            <Route path="/auth/confirm" element={<AuthConfirm />} />

            {/* Help & Support */}
            <Route path="/support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
            <Route path="/support/getting-started" element={<ProtectedRoute><SupportGettingStartedPage /></ProtectedRoute>} />
            <Route path="/support/guides" element={<ProtectedRoute><SupportGuidesPage /></ProtectedRoute>} />
            <Route path="/support/guides/:slug" element={<ProtectedRoute><SupportGuideDetailPage /></ProtectedRoute>} />
            <Route path="/support/faq" element={<ProtectedRoute><SupportFAQPage /></ProtectedRoute>} />
            <Route path="/support/updates" element={<ProtectedRoute><SupportUpdatesPage /></ProtectedRoute>} />
            <Route path="/support/updates/:slug" element={<ProtectedRoute><SupportUpdateDetailPage /></ProtectedRoute>} />

            {/* Public */}
            <Route path="/faq" element={<Layout><FAQ /></Layout>} />
            <Route path="/guide" element={<MarketingPageShell><Guide /></MarketingPageShell>} />
            <Route path="/credit-leveling-guide" element={<MarketingPageShell><CreditLevelingGuidePage /></MarketingPageShell>} />
            <Route path="/benefits" element={<MarketingPageShell><Benefits /></MarketingPageShell>} />
            <Route path="/whylend" element={<MarketingPageShell><WhyLend /></MarketingPageShell>} />
            <Route path="/simple" element={<Layout><Simple /></Layout>} />
            <Route path="/test" element={<Layout><Test /></Layout>} />
            <Route path="/user/:username/lender-diversity" element={<UserLenderDiversityPage />} />
            <Route path="/user/:username/progress-history" element={<UserProgressHistoryPage />} />
            <Route path="/user/:username" element={<UserProfile />} />
            <Route path="/ut" element={<Layout><Ut /></Layout>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to={user?.id && username ? '/' : '/request-board'} replace />} />
         </Routes>
         {showBottomNav && <BottomNav />}
      </>
   );
}
