import { useEffect, useMemo, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

import SwipeableBottomSheet from '@/components/ui/SwipeableBottomSheet';

import { useIsBorrower } from '@/hooks/useIsBorrower';

import { fetchUserProfiles } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { WorldId } from '@/types/authTypes';
import CreditLevelSection from '@/views/dashboard/components/CreditLevelSection';
import DashboardHeader from '@/views/dashboard/components/DashboardHeader';
import LenderDiversitySection from '@/views/dashboard/components/LenderDiversitySection';
import LoanSummarySection from '@/views/dashboard/components/LoanSummarySection';
import ReputationMilestones from '@/views/dashboard/components/ReputationMilestones';
import TrustScoreSection from '@/views/dashboard/components/TrustScoreSection';
import UpcomingLoanDues from '@/views/dashboard/components/UpcomingLoanDues';
import UserGreeting from '@/views/dashboard/components/UserGreeting';
import VerificationCTA from '@/views/dashboard/components/VerificationCTA';
import { buildReputationMilestones, getBorrowerLoans, getFundedBorrowerLoans } from '@/views/dashboard/dashboardHelpers';
import { useDashboardData } from '@/views/profile/components/tabs/useDashboardData';

type SheetKind = 'trust' | 'credit' | null;

export default function Dashboard() {
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const gloanRequests = useSelector((state: RootState) => state.loans.loans.gloans || []);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const isBorrower = useIsBorrower();
   const { stats, creditLevels, loanArrays } = useDashboardData('borrower');
   const [openSheet, setOpenSheet] = useState<SheetKind>(null);

   const isVerified = user.isWorldId === WorldId.ACTIVE;
   const borrowerLoans = useMemo(() => getBorrowerLoans(gloanRequests, user.id), [gloanRequests, user.id]);
   const fundedBorrowerLoans = useMemo(() => getFundedBorrowerLoans(gloanRequests, user.id), [gloanRequests, user.id]);
   const milestones = useMemo(
      () => buildReputationMilestones({ creditLevels, borrowerLoans, isVerified }),
      [borrowerLoans, creditLevels, isVerified]
   );

   useEffect(() => {
      const lenderIds = [...new Set(fundedBorrowerLoans.map((loan) => loan.lenderUser).filter(Boolean))] as string[];
      const missingIds = lenderIds.filter((lenderId) => !userProfiles[lenderId]);
      if (missingIds.length > 0) {
         dispatch(fetchUserProfiles(missingIds)).catch(() => undefined);
      }
   }, [dispatch, fundedBorrowerLoans, userProfiles]);

   if (!isBorrower) {
      return <Navigate replace to="/lender/dashboard" />;
   }

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <main className="mx-auto flex max-w-[440px] flex-col gap-md-5 px-md-4 pb-32 pt-md-3">
            <DashboardHeader />
            <UserGreeting user={user} />

            <section className="rounded-md-lg bg-gradient-to-b from-white to-[#f1e9fd] p-md-4 shadow-md-card">
               <div className="flex flex-col gap-md-5">
                  <TrustScoreSection trustScore={user.cs} onInfoClick={() => setOpenSheet('trust')} />
                  <CreditLevelSection currentCs={user.cs} isVerified={isVerified} onInfoClick={() => setOpenSheet('credit')} />
               </div>
            </section>

            <ReputationMilestones milestones={milestones} />
            {!isVerified ? <VerificationCTA /> : null}
            <LoanSummarySection stats={stats} />
            <LenderDiversitySection fundedLoans={fundedBorrowerLoans} userProfiles={userProfiles} />
            <UpcomingLoanDues activeLoans={loanArrays.activeLoans} defaultedLoans={loanArrays.defaultedLoans} />
         </main>

         <SwipeableBottomSheet
            isOpen={openSheet === 'trust'}
            title="Trust Score"
            description="A quick read on how much repayment trust this wallet has built."
            onClose={() => setOpenSheet(null)}
         >
            <div className="space-y-md-3 text-md-b1 text-md-neutral-1400">
               <p>Trust Score rises when loans are repaid fully and on time.</p>
               <p>Late or unresolved repayments can pause credit progression until they are repaid or reviewed.</p>
               <div className="rounded-[18px] border border-[#eadfff] bg-[#fbf8ff] p-md-3">
                  <p className="font-semibold text-md-heading">What lenders see</p>
                  <p className="mt-1 text-md-b2 text-md-neutral-1200">
                     Lenders use this together with loan history, lender diversity, and defaults. It is not the only signal.
                  </p>
               </div>
            </div>
         </SwipeableBottomSheet>

         <SwipeableBottomSheet
            isOpen={openSheet === 'credit'}
            title="Credit Level"
            description="Your current borrowing tier and the path to the next one."
            onClose={() => setOpenSheet(null)}
         >
            <div className="space-y-md-3 text-md-b1 text-md-neutral-1400">
               <p>Credit Level controls how much a borrower can request at once.</p>
               <p>Verified borrowers level up by successfully repaying loans at their current level.</p>
               <div className="rounded-[18px] border border-[#eadfff] bg-[#fbf8ff] p-md-3">
                  <p className="font-semibold text-md-heading">If borrowing is paused</p>
                  <p className="mt-1 text-md-b2 text-md-neutral-1200">
                     Unresolved late repayments can pause new loans until the borrower repays or enters recovery.
                  </p>
               </div>
            </div>
         </SwipeableBottomSheet>
      </div>
   );
}
