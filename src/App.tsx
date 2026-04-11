import { useEffect } from 'react';

import posthog from 'posthog-js';
import { useSelector } from 'react-redux';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import AdminPanel from '@/app/admin/page';
import LenderDashboard from '@/app/lender/dashboard/page';
import LenderPerformance from '@/app/lender/performance/page';
import LenderRequestBoard from '@/app/lender/request-board/page';
import LenderTransactions from '@/app/lender/transactions/page';
import WalletConnect from '@/app/onboarding/wallet/page';
import WorldIdVerification from '@/app/verify-world-id/page';
import BottomNav from '@/components/BottomNav';
import Footer from '@/components/Footer';
import Header from '@/components/Header/Header';
import { WalletLoadingOverlay } from '@/components/loading/WalletLoadingOverlay';
import { AdminGuard } from '@/components/AdminGuard';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RoleGuard } from '@/components/RoleGuard';

import AuthSuccess from '@/app/auth-success/page';
import AuthConfirm from '@/app/auth/confirm/page';
import Benefits from '@/app/benefits/page';
import Dashboard from '@/views/dashboard/Dashboard';
import RequestBoard from '@/views/dashboard/RequestBoard';
import FAQ from '@/app/faq/page';
import ForgotPassword from '@/app/forgot-password/page';
import Guide from '@/app/guide/page';
import Login from '@/app/login/page';
// Import pages
import Home from '@/app/page';
import Profile from '@/app/profile/page';
import ResetPassword from '@/app/reset-password/page';
import SignUp from '@/app/signup/page';
import Simple from '@/app/simple/page';
import Test from '@/app/test/page';
import UserProfile from '@/app/user/[username]/page';
import Ut from '@/app/ut/page';
import WhyLend from '@/app/whylend/page';
import { type RootState } from '@/store/store';
import Account from '@/views/account/Account';
import History from '@/views/history/History';
import Repay from '@/views/repay/Repay';
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

const BOTTOM_NAV_ROUTES = ['/request-board', '/repay', '/dashboard', '/lender/dashboard', '/history', '/account'];

export default function App() {
   const location = useLocation();
   const isPosthogEnabled = import.meta.env.PROD && Boolean(import.meta.env.VITE_PUBLIC_POSTHOG_KEY);
   const { user, username } = useSelector((state: RootState) => state.auth);
   const showBottomNav =
      user?.id && user?.userRole && (BOTTOM_NAV_ROUTES.includes(location.pathname) || location.pathname.startsWith('/user/'));

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

   return (
      <>
         <WalletLoadingOverlay />
         <Routes>
            <Route path="/" element={<Layout><Home /></Layout>} />

            {/* Auth */}
            <Route path="/sign-in" element={<Login />} />
            <Route path="/sign-up" element={<SignUp />} />

            {/* Onboarding */}
            <Route path="/onboarding/role" element={<ProtectedRoute><RoleSelection /></ProtectedRoute>} />
            <Route path="/onboarding/wallet" element={<ProtectedRoute><WalletConnect /></ProtectedRoute>} />

            {/* Verification */}
            <Route path="/verify-world-id" element={<ProtectedRoute><RoleGuard><WorldIdVerification /></RoleGuard></ProtectedRoute>} />

            {/* Borrower */}
            <Route path="/dashboard" element={<ProtectedRoute><RoleGuard><Dashboard /></RoleGuard></ProtectedRoute>} />
            <Route path="/request-board" element={<ProtectedRoute><RoleGuard><RequestBoard /></RoleGuard></ProtectedRoute>} />
            <Route path="/repay" element={<ProtectedRoute><RoleGuard><Repay /></RoleGuard></ProtectedRoute>} />

            {/* Lender */}
            <Route path="/lender/dashboard" element={<ProtectedRoute><RoleGuard><LenderDashboard /></RoleGuard></ProtectedRoute>} />
            <Route path="/lender/request-board" element={<ProtectedRoute><RoleGuard><LenderRequestBoard /></RoleGuard></ProtectedRoute>} />
            <Route path="/lender/performance" element={<ProtectedRoute><RoleGuard><LenderPerformance /></RoleGuard></ProtectedRoute>} />
            <Route path="/lender/transactions" element={<ProtectedRoute><RoleGuard><LenderTransactions /></RoleGuard></ProtectedRoute>} />

            {/* Shared authenticated */}
            <Route path="/history" element={<ProtectedRoute><RoleGuard><History /></RoleGuard></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><RoleGuard><Account /></RoleGuard></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin" element={<AdminGuard><AdminPanel /></AdminGuard>} />

            {/* Profile */}
            <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />

            {/* Auth flows */}
            <Route path="/forgot-password" element={<Layout><ForgotPassword /></Layout>} />
            <Route path="/reset-password" element={<Layout><ResetPassword /></Layout>} />
            <Route path="/auth-success" element={<AuthSuccess />} />
            <Route path="/auth/confirm" element={<AuthConfirm />} />

            {/* Public */}
            <Route path="/faq" element={<Layout><FAQ /></Layout>} />
            <Route path="/guide" element={<Layout><Guide /></Layout>} />
            <Route path="/benefits" element={<Layout><Benefits /></Layout>} />
            <Route path="/whylend" element={<Layout><WhyLend /></Layout>} />
            <Route path="/simple" element={<Layout><Simple /></Layout>} />
            <Route path="/test" element={<Layout><Test /></Layout>} />
            <Route path="/user/:username" element={<UserProfile />} />
            <Route path="/ut" element={<Layout><Ut /></Layout>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
         </Routes>
         {showBottomNav && <BottomNav />}
      </>
   );
}
