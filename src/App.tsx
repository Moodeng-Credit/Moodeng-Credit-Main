import { Navigate, Route, Routes } from 'react-router-dom';

import Footer from '@/components/Footer';
import Header from '@/components/Header/Header';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Providers } from '@/components/providers';

import Benefits from '@/app/benefits/page';
import Dashboard from '@/app/dashboard/page';
import FAQ from '@/app/faq/page';
import ForgotPassword from '@/app/forgot-password/page';
import Guide from '@/app/guide/page';
import Login from '@/app/login/page';
// Import pages
import Home from '@/app/page';
import Profile from '@/app/profile/page';
import ResetPassword from '@/app/reset-password/page';
import Simple from '@/app/simple/page';
import Test from '@/app/test/page';
import UserProfile from '@/app/user/[username]/page';
import Ut from '@/app/ut/page';
import WhyLend from '@/app/whylend/page';

function Layout({ children }: { children: React.ReactNode }) {
   return (
      <div className="flex flex-col min-h-screen">
         <Header />
         <main className="flex-grow">{children}</main>
         <Footer />
      </div>
   );
}

export default function App() {
   return (
      <Providers>
         <Routes>
            <Route
               path="/"
               element={
                  <Layout>
                     <Home />
                  </Layout>
               }
            />
            <Route
               path="/dashboard"
               element={
                  <ProtectedRoute>
                     <Layout>
                        <Dashboard />
                     </Layout>
                  </ProtectedRoute>
               }
            />
            <Route
               path="/login"
               element={
                  <Layout>
                     <Login />
                  </Layout>
               }
            />
            <Route
               path="/faq"
               element={
                  <Layout>
                     <FAQ />
                  </Layout>
               }
            />
            <Route
               path="/guide"
               element={
                  <Layout>
                     <Guide />
                  </Layout>
               }
            />
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
            <Route
               path="/forgot-password"
               element={
                  <Layout>
                     <ForgotPassword />
                  </Layout>
               }
            />
            <Route
               path="/reset-password"
               element={
                  <Layout>
                     <ResetPassword />
                  </Layout>
               }
            />
            <Route
               path="/benefits"
               element={
                  <Layout>
                     <Benefits />
                  </Layout>
               }
            />
            <Route
               path="/whylend"
               element={
                  <Layout>
                     <WhyLend />
                  </Layout>
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
            <Route
               path="/user/:username"
               element={
                  <Layout>
                     <UserProfile />
                  </Layout>
               }
            />
            <Route
               path="/ut"
               element={
                  <Layout>
                     <Ut />
                  </Layout>
               }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
         </Routes>
      </Providers>
   );
}
