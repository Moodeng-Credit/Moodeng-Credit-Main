import { useMemo } from 'react';

import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

import { useIsBorrower } from '@/hooks/useIsBorrower';
import { useDashboardData } from '@/views/profile/components/tabs/useDashboardData';
import type { RootState } from '@/store/store';

import CreditLevelSection from '@/views/dashboard/components/CreditLevelSection';
import DashboardHeader from '@/views/dashboard/components/DashboardHeader';
import LenderDiversitySection from '@/views/dashboard/components/LenderDiversitySection';
import LoanSummarySection from '@/views/dashboard/components/LoanSummarySection';
import ReputationMilestones from '@/views/dashboard/components/ReputationMilestones';
import TrustScoreSection from '@/views/dashboard/components/TrustScoreSection';
import UpcomingLoanDues from '@/views/dashboard/components/UpcomingLoanDues';
import UserGreeting from '@/views/dashboard/components/UserGreeting';
import VerificationCTA from '@/views/dashboard/components/VerificationCTA';

export default function Dashboard() {
   const user = useSelector((state: RootState) => state.auth.user);
   const gloanRequests = useSelector((state: RootState) => state.loans.loans.gloans || []);
   const isBorrower = useIsBorrower();
   const { stats, lenderDiversityScore, loanArrays } = useDashboardData('borrower');

   const fundedLoans = useMemo(() => {
      return gloanRequests.filter((loan) => loan.borrowerUser === user.id && loan.loanStatus === 'Lent');
   }, [gloanRequests, user.id]);

   if (!isBorrower) {
      return <Navigate to="/lender/dashboard" replace />;
   }

   const isVerified = user.isWorldId === 'ACTIVE';

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col gap-5 px-md-4 py-md-3">
            <DashboardHeader />
            <UserGreeting user={user} />

            <div className="bg-md-neutral-100 rounded-md-lg p-4 shadow-md-card flex flex-col gap-4 bg-gradient-to-b from-white to-[#eee6fa]">
               <TrustScoreSection trustScore={user.cs} />
               <CreditLevelSection currentCs={user.cs} isVerified={isVerified} />
            </div>

            <ReputationMilestones />
            {!isVerified && <VerificationCTA />}
            <LoanSummarySection stats={stats} />
            <LenderDiversitySection score={lenderDiversityScore} fundedLoans={fundedLoans} isVerified={isVerified} />
            <UpcomingLoanDues activeLoans={loanArrays.activeLoans} defaultedLoans={loanArrays.defaultedLoans} />
         </div>
      </div>
   );
}
