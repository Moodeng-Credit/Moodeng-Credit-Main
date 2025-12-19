import { Routes, Route } from 'react-router-dom';

import Header from '@/components/Header/Header';
import Footer from '@/components/Footer';

// Views
import MainLandingPage from '@/views/landing/MainLandingPage';
import Login from '@/views/login/Login';
import Dashboard from '@/views/dashboard/Dashboard';
import Profile from '@/views/profile/Profile';
import UserProfile from '@/views/user-profile/UserProfile';

// Lazy load less critical pages
import { lazy, Suspense } from 'react';

const BorrowerBenefits = lazy(() => import('@/views/borrowerBenefits/BorrowerBenefits'));
const FAQsComponent = lazy(() => import('@/views/FAQ'));
const About = lazy(() => import('@/views/about/About'));
const LenderBenefits = lazy(() => import('@/views/lenderBenefits/LenderBenefits'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPassword'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPassword'));

// Auth guard wrapper for protected routes
import { useAuthGuard } from '@/hooks/useAuthGuard';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
   const { isAuthenticated } = useAuthGuard();

   if (!isAuthenticated) {
      return null;
   }

   return <>{children}</>;
}

function LoadingFallback() {
   return (
      <div className="flex items-center justify-center min-h-[50vh]">
         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
   );
}

export default function App() {
   return (
      <>
         <Header />
         <main>
            <Suspense fallback={<LoadingFallback />}>
               <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<MainLandingPage />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/benefits" element={<BorrowerBenefits />} />
                  <Route path="/faq" element={<FAQsComponent />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/guide" element={<About />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/whylend" element={<LenderBenefits />} />
                  <Route path="/user/:username" element={<UserProfile />} />

                  {/* Protected routes */}
                  <Route
                     path="/dashboard"
                     element={
                        <ProtectedRoute>
                           <Dashboard />
                        </ProtectedRoute>
                     }
                  />
                  <Route
                     path="/profile"
                     element={
                        <ProtectedRoute>
                           <Profile />
                        </ProtectedRoute>
                     }
                  />
               </Routes>
            </Suspense>
         </main>
         <Footer />
      </>
   );
}
