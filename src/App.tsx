import { useEffect } from 'react';

import posthog from 'posthog-js';
import { useSelector } from 'react-redux';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AdminGuard } from '@/components/AdminGuard';
import BottomNav from '@/components/BottomNav';
import { BottomNavActionProvider } from '@/components/BottomNavActionContext';
import { ExpiredLoanRequestNotifier } from '@/components/ExpiredLoanRequestNotifier';
import { VerifiedCelebrationNotifier } from '@/components/verification/VerifiedCelebrationNotifier';
import Footer from '@/components/Footer';
import { LenderFundingPrompt } from '@/components/funding/LenderFundingPrompt';
import Header from '@/components/Header/Header';
import InAppBrowserNotice from '@/components/InAppBrowserNotice';
import { WalletLoadingOverlay } from '@/components/loading/WalletLoadingOverlay';
import WalletNetworkBlockNotice from '@/components/WalletNetworkBlockNotice';
import MarketingPageShell from '@/components/marketing/MarketingPageShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RoleGuard } from '@/components/RoleGuard';

import { useDefaultedBorrowerSupport } from '@/hooks/useDefaultedBorrowerSupport';
import { usePostLoginReturn } from '@/hooks/usePostLoginReturn';

import { identifyClarity } from '@/lib/analytics/clarity';

import AccountRestrictedPage from '@/app/account-restricted/page';
import LendLoanPage from '@/app/lend/loan/[loanId]/page';
import LenderSupportedPage from '@/app/lender/supported/page';
import AdminPanel from '@/app/admin/page';
import AuthSuccess from '@/app/auth-success/page';
import AuthConfirm from '@/app/auth/confirm/page';
import LineCallback from '@/app/auth/line/callback/page';
import TelegramCallback from '@/app/auth/telegram/callback/page';
import AuthVerifyCode from '@/app/auth/verify-code/page';
import Benefits from '@/app/benefits/page';
import BlogDetailPage from '@/app/blogs/[slug]/page';
import BlogsPage from '@/app/blogs/page';
import CreditLevelingGuidePage from '@/app/credit-leveling-guide/page';
import LearnHowCreditLevelsWorkPage from '@/app/learn/how-credit-levels-work/page';
import LearnWhyWeUseUsdcPage from '@/app/learn/why-we-use-usdc/page';
import LearnIndexPage from '@/app/learn/page';
import PublicGuidePage from '@/app/learn/[slug]/page';
import ForgotPassword from '@/app/forgot-password/page';
import Guide from '@/app/guide/page';
import HelpPage from '@/app/help/page';
import MoneyGuide from '@/views/academy/MoneyGuide';
import MoneyGuideTopic from '@/views/academy/MoneyGuideTopic';
import LenderDiversityPage from '@/app/lender-diversity/page';
import LenderDashboard from '@/app/lender/dashboard/page';
import LenderPerformance from '@/app/lender/performance/page';
import LenderRequestBoard from '@/app/lender/request-board/page';
import Login from '@/app/login/page';
import MilestonesPage from '@/app/milestones/page';
import CongratulationsPage from '@/app/onboarding/congratulations/page';
import WalletBlocked from '@/app/onboarding/wallet/blocked/page';
import WalletConnected from '@/app/onboarding/wallet/connected/page';
import WalletConnect from '@/app/onboarding/wallet/page';
import OnboardingWelcome from '@/app/onboarding/welcome/page';
// Import pages
import Home from '@/app/page';
import Profile from '@/app/profile/page';
import DataDeletionPage from '@/app/data-deletion/page';
import PrivacyPage from '@/app/privacy/page';
import PrivacyPolicyPage from '@/app/privacy-policy/page';
import ResetPassword from '@/app/reset-password/page';
import RoleSelection from '@/app/role-selection/page';
import SignUp from '@/app/signup/page';
import Simple from '@/app/simple/page';
import SupportFAQPage from '@/app/support/faq/page';
import SupportGettingStartedPage from '@/app/support/getting-started/page';
import SupportGuideDetailPage from '@/app/support/guides/[slug]/page';
import SupportGuidesPage from '@/app/support/guides/page';
import SupportPage from '@/app/support/page';
import SupportUpdateDetailPage from '@/app/support/updates/[slug]/page';
import SupportUpdatesPage from '@/app/support/updates/page';
import TeamPage from '@/app/team/page';
import TermsPage from '@/app/terms/page';
import Test from '@/app/test/page';
import UserLenderDiversityPage from '@/app/user/[username]/lender-diversity/page';
import UserProfile from '@/app/user/[username]/page';
import UserProgressHistoryPage from '@/app/user/[username]/progress-history/page';
import Ut from '@/app/ut/page';
import WorldIdVerification from '@/app/verify-world-id/page';
import DiditVerification from '@/app/verify-didit/page';
import VerifyFlow from '@/app/verify/page';
import WhyLend from '@/app/whylend/page';
import { VerificationUnsuccessfulModal } from '@/components/verification/VerificationUnsuccessfulModal';
import { type RootState } from '@/store/store';
import Account from '@/views/account/Account';
import AccountWalletPreview from '@/views/account/AccountWalletPreview';
import LoanRequestPreview from '@/views/dashboard/LoanRequestPreview';
import PricingHealthPreview from '@/app/admin/PricingHealthPreview';
import AccountSettings from '@/views/account/AccountSettings';
import Dashboard from '@/views/dashboard/Dashboard';
import RequestBoard from '@/views/dashboard/RequestBoard';
import Repay from '@/views/repay/Repay';
import Withdraw from '@/views/withdraw/Withdraw';
import TransactionDetail from '@/views/transactions/TransactionDetail';
import TransactionHistory from '@/views/transactions/TransactionHistory';

function Layout({ children }: { children: React.ReactNode }) {
   return (
      <div className="flex flex-col min-h-screen">
         <Header />
         <main className="flex-grow">{children}</main>
         <Footer />
      </div>
   );
}

const BOTTOM_NAV_ROUTES = [
   '/request-board',
   '/repay',
   '/dashboard',
   '/lender/dashboard',
   '/lender/transactions',
   '/history',
   '/account',
   '/account/settings'
];

// Routes a defaulted borrower passes through when "Pay Now" requires connecting a wallet or
// verifying World ID first — Repay.tsx sends them here with `state: { returnTo: 'repay' }` so
// they can complete that detour without getting bounced to /account-restricted mid-flow.
const REPAY_CONTINUATION_ROUTES = ['/onboarding/wallet', '/onboarding/wallet/connected', '/verify-world-id'];

const canShowPreviewRoutes = () => {
   if (import.meta.env.DEV) return true;
   if (typeof window === 'undefined') return false;

   return window.location.hostname.endsWith('.vercel.app');
};

export default function App() {
   const location = useLocation();
   const isPosthogEnabled = import.meta.env.PROD && Boolean(import.meta.env.VITE_PUBLIC_POSTHOG_KEY);
   usePostLoginReturn();
   const { user, username, isAuthChecked } = useSelector((state: RootState) => state.auth);
   const userLoansFetchedAt = useSelector((state: RootState) => state.loans.userLoansFetchedAt);
   const isAuthenticated = Boolean(user?.id && username);
   const shouldCheckDefaultedBorrower = isAuthChecked && isAuthenticated;
   const defaultedBorrower = useDefaultedBorrowerSupport(shouldCheckDefaultedBorrower ? user.id : null, userLoansFetchedAt);
   const isAccountRestricted = user?.accountStatus === 'blocked' || user?.accountStatus === 'banned';
   const isDefaultedBorrower = defaultedBorrower.support.overdueAmount > 0;
   const repayReturnTo = (location.state as { returnTo?: string } | null)?.returnTo === 'repay';
   const canRepayWhileDefaulted =
      isDefaultedBorrower &&
      (location.pathname === '/repay' || (repayReturnTo && REPAY_CONTINUATION_ROUTES.includes(location.pathname)));
   const shouldShowAccountSupport = isAccountRestricted || isDefaultedBorrower;
   const isUserDetailRoute = location.pathname.includes('/progress-history') || location.pathname.includes('/lender-diversity');
   const accountSettingsParams = new URLSearchParams(location.search);
   const isAccountSettingsDetail =
      location.pathname === '/account/settings' &&
      (accountSettingsParams.has('section') || accountSettingsParams.has('edit'));
   const showPreviewRoutes = canShowPreviewRoutes();
   const showBottomNav =
      Boolean(user?.id) &&
      !isAccountSettingsDetail &&
      (!shouldShowAccountSupport || canRepayWhileDefaulted) &&
      (BOTTOM_NAV_ROUTES.includes(location.pathname) ||
         (location.pathname.startsWith('/user/') && !isUserDetailRoute) ||
         location.pathname.startsWith('/support') ||
         location.pathname === '/help' ||
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
         identifyClarity(user.id);
         return;
      }

      posthog.reset();
   }, [isPosthogEnabled, user?.email, user?.id, user?.username, username]);

   if (isAccountRestricted && location.pathname !== '/account-restricted') {
      return <Navigate to="/account-restricted" replace />;
   }

   if (shouldShowAccountSupport && !canRepayWhileDefaulted && location.pathname !== '/account-restricted') {
      return <Navigate to="/account-restricted" replace />;
   }

   return (
      <BottomNavActionProvider key={location.pathname}>
         <InAppBrowserNotice />
         <WalletNetworkBlockNotice />
         <WalletLoadingOverlay />
         <ExpiredLoanRequestNotifier />
         <VerifiedCelebrationNotifier />
         <LenderFundingPrompt />
         <Routes key={location.pathname}>
            <Route path="/" element={<Home />} />

            {/* Auth */}
            <Route path="/sign-in" element={<Login />} />
            <Route path="/sign-up" element={<SignUp />} />
            <Route path="/account-restricted" element={<AccountRestrictedPage />} />

            {/* Onboarding */}
            <Route
               path="/onboarding/role"
               element={<RoleSelection />}
            />
            <Route
               path="/onboarding/welcome"
               element={
                  <ProtectedRoute>
                     <OnboardingWelcome />
                  </ProtectedRoute>
               }
            />
            <Route
               path="/onboarding/wallet"
               element={
                  <ProtectedRoute>
                     <WalletConnect />
                  </ProtectedRoute>
               }
            />
            <Route
               path="/onboarding/wallet/connected"
               element={
                  <ProtectedRoute>
                     <WalletConnected />
                  </ProtectedRoute>
               }
            />
            <Route
               path="/onboarding/wallet/blocked"
               element={
                  <ProtectedRoute>
                     <WalletBlocked />
                  </ProtectedRoute>
               }
            />
            <Route
               path="/onboarding/congratulations"
               element={
                  <ProtectedRoute>
                     <CongratulationsPage />
                  </ProtectedRoute>
               }
            />
            {import.meta.env.DEV ? <Route path="/onboarding/start-preview" element={<OnboardingWelcome />} /> : null}
            {import.meta.env.DEV ? <Route path="/onboarding/wallet-preview" element={<WalletConnect />} /> : null}
            {import.meta.env.DEV ? <Route path="/onboarding/wallet-connected-preview" element={<WalletConnected />} /> : null}
            {import.meta.env.DEV ? <Route path="/onboarding/wallet-blocked-preview" element={<WalletBlocked />} /> : null}
            {import.meta.env.DEV ? <Route path="/onboarding/congratulations-preview" element={<CongratulationsPage />} /> : null}
            {import.meta.env.DEV ? <Route path="/account-wallet-preview" element={<AccountWalletPreview />} /> : null}
            {import.meta.env.DEV ? <Route path="/loan-request-preview" element={<LoanRequestPreview />} /> : null}
            {import.meta.env.DEV ? <Route path="/admin/pricing-preview" element={<PricingHealthPreview />} /> : null}
            {import.meta.env.DEV ? <Route path="/history-preview" element={<TransactionDetail />} /> : null}

            {/* Verification */}
            <Route
               path="/verify"
               element={
                  <ProtectedRoute>
                     <RoleGuard>
                        <VerifyFlow />
                     </RoleGuard>
                  </ProtectedRoute>
               }
            />
            <Route
               path="/verify-world-id"
               element={
                  <ProtectedRoute>
                     <RoleGuard>
                        <WorldIdVerification />
                     </RoleGuard>
                  </ProtectedRoute>
               }
            />
            {import.meta.env.DEV ? <Route path="/verify-world-id-preview" element={<WorldIdVerification />} /> : null}
            {import.meta.env.DEV ? (
               <Route
                  path="/verify-unsuccessful-preview"
                  element={<VerificationUnsuccessfulModal isOpen method="didit" onClose={() => {}} />}
               />
            ) : null}
            <Route
               path="/verify-didit"
               element={
                  <ProtectedRoute>
                     <RoleGuard>
                        <DiditVerification />
                     </RoleGuard>
                  </ProtectedRoute>
               }
            />
            {import.meta.env.DEV ? <Route path="/verify-didit-preview" element={<DiditVerification />} /> : null}

            {/* Borrower */}
            <Route
               path="/dashboard"
               element={
                  <ProtectedRoute>
                     <RoleGuard>
                        <Dashboard />
                     </RoleGuard>
                  </ProtectedRoute>
               }
            />
            <Route path="/request-board" element={<RequestBoard />} />
            <Route
               path="/repay"
               element={
                  <ProtectedRoute>
                     <RoleGuard>
                        <Repay />
                     </RoleGuard>
                  </ProtectedRoute>
               }
            />
            {showPreviewRoutes ? <Route path="/repay-preview" element={<Repay />} /> : null}
            <Route
               path="/withdraw"
               element={
                  <ProtectedRoute>
                     <RoleGuard>
                        <Withdraw />
                     </RoleGuard>
                  </ProtectedRoute>
               }
            />
            {showPreviewRoutes ? <Route path="/withdraw-preview" element={<Withdraw />} /> : null}
            <Route
               path="/milestones"
               element={
                  <ProtectedRoute>
                     <RoleGuard>
                        <MilestonesPage />
                     </RoleGuard>
                  </ProtectedRoute>
               }
            />
            {showPreviewRoutes ? <Route path="/milestones-preview" element={<MilestonesPage />} /> : null}
            <Route
               path="/lender-diversity"
               element={
                  <ProtectedRoute>
                     <RoleGuard>
                        <LenderDiversityPage />
                     </RoleGuard>
                  </ProtectedRoute>
               }
            />

            {/* Lender */}
            <Route
               path="/lender/dashboard"
               element={
                  <ProtectedRoute>
                     <RoleGuard>
                        <LenderDashboard />
                     </RoleGuard>
                  </ProtectedRoute>
               }
            />
            <Route
               path="/lender/request-board"
               element={
                  <ProtectedRoute>
                     <RoleGuard>
                        <LenderRequestBoard />
                     </RoleGuard>
                  </ProtectedRoute>
               }
            />
            <Route
               path="/lender/performance"
               element={
                  <ProtectedRoute>
                     <RoleGuard>
                        <LenderPerformance />
                     </RoleGuard>
                  </ProtectedRoute>
               }
            />
            <Route
               path="/lender/transactions"
               element={
                  <ProtectedRoute>
                     <RoleGuard>
                        <TransactionHistory />
                     </RoleGuard>
                  </ProtectedRoute>
               }
            />

            {/* Lender Loan Note purchase (direct link only — not in main nav).
                Public so logged-out users see the borrower/loan preview; the page itself
                gates the purchase action behind login + wallet. /help/:loanId aliases it. */}
            <Route
               path="/lend/loan/:loanId"
               element={
                  <Layout>
                     <LendLoanPage />
                  </Layout>
               }
            />
            <Route
               path="/help/:loanId"
               element={
                  <Layout>
                     <LendLoanPage />
                  </Layout>
               }
            />
            <Route
               path="/lender/supported"
               element={
                  <ProtectedRoute>
                     <Layout>
                        <LenderSupportedPage />
                     </Layout>
                  </ProtectedRoute>
               }
            />

            {/* Shared authenticated */}
            <Route
               path="/history"
               element={
                  <ProtectedRoute>
                     <RoleGuard>
                        <TransactionHistory />
                     </RoleGuard>
                  </ProtectedRoute>
               }
            />
            <Route
               path="/history/:loanId"
               element={
                  <ProtectedRoute>
                     <RoleGuard>
                        <TransactionDetail />
                     </RoleGuard>
                  </ProtectedRoute>
               }
            />
            <Route
               path="/account"
               element={
                  <ProtectedRoute>
                     <Account />
                  </ProtectedRoute>
               }
            />
            <Route
               path="/account/settings"
               element={
                  <ProtectedRoute>
                     <AccountSettings />
                  </ProtectedRoute>
               }
            />

            {/* Admin — :tab? makes every panel tab linkable (/admin/relay, /admin/points, …) */}
            <Route
               path="/admin/:tab?"
               element={
                  <AdminGuard>
                     <AdminPanel />
                  </AdminGuard>
               }
            />

            {/* Profile */}
            <Route
               path="/profile"
               element={
                  <ProtectedRoute>
                     <Layout>
                        <Profile />
                     </Layout>
                  </ProtectedRoute>
               }
            />

            {/* Auth flows */}
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth-success" element={<AuthSuccess />} />
            <Route path="/auth/confirm" element={<AuthConfirm />} />
            <Route path="/auth/verify-code" element={<AuthVerifyCode />} />
            <Route path="/auth/telegram/callback" element={<TelegramCallback />} />
            <Route path="/auth/line/callback" element={<LineCallback />} />

            {/* Help & Support */}
            {/* Public, shareable chat-first hub (Mecha). Coexists with /help/:loanId
                above — React Router ranks the more specific param route first. */}
            <Route path="/help" element={<HelpPage />} />
            <Route
               path="/support"
               element={
                  <ProtectedRoute>
                     <SupportPage />
                  </ProtectedRoute>
               }
            />
            <Route
               path="/support/getting-started"
               element={<SupportGettingStartedPage />}
            />
            <Route
               path="/support/guides"
               element={
                  <ProtectedRoute>
                     <SupportGuidesPage />
                  </ProtectedRoute>
               }
            />
            <Route
               path="/support/guides/:slug"
               element={
                  <ProtectedRoute>
                     <SupportGuideDetailPage />
                  </ProtectedRoute>
               }
            />
            <Route path="/support/faq" element={<SupportFAQPage />} />
            <Route
               path="/support/updates"
               element={
                  <ProtectedRoute>
                     <SupportUpdatesPage />
                  </ProtectedRoute>
               }
            />
            <Route
               path="/support/updates/:slug"
               element={
                  <ProtectedRoute>
                     <SupportUpdateDetailPage />
                  </ProtectedRoute>
               }
            />

            {/* Public */}
            <Route path="/faq" element={<Navigate to="/support/faq" replace />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/data-deletion" element={<DataDeletionPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route
               path="/academy"
               element={
                  <MarketingPageShell>
                     <Guide />
                  </MarketingPageShell>
               }
            />
            <Route
               path="/academy/money"
               element={
                  <MarketingPageShell>
                     <MoneyGuide />
                  </MarketingPageShell>
               }
            />
            <Route
               path="/academy/money/:topic"
               element={
                  <MarketingPageShell>
                     <MoneyGuideTopic />
                  </MarketingPageShell>
               }
            />
            <Route path="/guide" element={<Navigate to="/academy" replace />} />
            <Route
               path="/credit-leveling-guide"
               element={
                  <MarketingPageShell>
                     <CreditLevelingGuidePage />
                  </MarketingPageShell>
               }
            />
            <Route
               path="/learn/how-credit-levels-work"
               element={
                  <MarketingPageShell>
                     <LearnHowCreditLevelsWorkPage />
                  </MarketingPageShell>
               }
            />
            <Route
               path="/learn/why-we-use-usdc"
               element={
                  <MarketingPageShell>
                     <LearnWhyWeUseUsdcPage />
                  </MarketingPageShell>
               }
            />
            <Route
               path="/learn"
               element={
                  <MarketingPageShell>
                     <LearnIndexPage />
                  </MarketingPageShell>
               }
            />
            <Route
               path="/learn/:slug"
               element={
                  <MarketingPageShell>
                     <PublicGuidePage />
                  </MarketingPageShell>
               }
            />
            <Route path="/blog" element={<Navigate to="/blogs" replace />} />
            <Route
               path="/blogs"
               element={
                  <MarketingPageShell>
                     <BlogsPage />
                  </MarketingPageShell>
               }
            />
            <Route
               path="/blogs/:slug"
               element={
                  <MarketingPageShell>
                     <BlogDetailPage />
                  </MarketingPageShell>
               }
            />
            <Route
               path="/benefits"
               element={
                  <MarketingPageShell>
                     <Benefits />
                  </MarketingPageShell>
               }
            />
            <Route
               path="/whylend"
               element={
                  <MarketingPageShell>
                     <WhyLend />
                  </MarketingPageShell>
               }
            />
            <Route
               path="/team"
               element={
                  <MarketingPageShell>
                     <TeamPage />
                  </MarketingPageShell>
               }
            />
            <Route
               path="/simple"
               element={
                  <Layout>
                     <Simple />
                  </Layout>
               }
            />
            <Route
               path="/test"
               element={
                  <Layout>
                     <Test />
                  </Layout>
               }
            />
            <Route path="/user/:username/lender-diversity" element={<UserLenderDiversityPage />} />
            <Route path="/user/:username/progress-history" element={<UserProgressHistoryPage />} />
            <Route path="/user/:username" element={<UserProfile />} />
            <Route
               path="/ut"
               element={
                  <Layout>
                     <Ut />
                  </Layout>
               }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to={user?.id && username ? '/' : '/request-board'} replace />} />
         </Routes>
         {showBottomNav ? <BottomNav /> : null}
      </BottomNavActionProvider>
   );
}
