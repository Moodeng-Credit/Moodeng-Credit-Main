import { useEffect, useMemo, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import GuidedTourPreview from '@/components/GuidedTourPreview';
import { useIsBorrower } from '@/hooks/useIsBorrower';

import type { WalletLivenessData } from '@/utils/diversityScore';

import { getWalletAgeInfo } from '@/lib/web3/walletAge';
import { fetchUserProfiles } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { type Loan, LoanStatus, RepaymentStatus } from '@/types/loanTypes';
import CreditLevelSection from '@/views/dashboard/components/CreditLevelSection';
import DashboardHeader from '@/views/dashboard/components/DashboardHeader';
import LenderDiversitySection from '@/views/dashboard/components/LenderDiversitySection';
import LoanSummarySection from '@/views/dashboard/components/LoanSummarySection';
import ReputationMilestones from '@/views/dashboard/components/ReputationMilestones';
import TrustScoreSection from '@/views/dashboard/components/TrustScoreSection';
import UpcomingLoanDues from '@/views/dashboard/components/UpcomingLoanDues';
import UserGreeting from '@/views/dashboard/components/UserGreeting';
import VerificationCTA from '@/views/dashboard/components/VerificationCTA';
import { buildReputationMilestones, getBorrowerLoans } from '@/views/dashboard/dashboardHelpers';
import { useDashboardData } from '@/views/profile/components/tabs/useDashboardData';
import { DEMO_LENDER_PROFILES } from '@/views/user-profile/demoBorrowerInsights';

const REQUEST_BOARD_TOUR_STEP_COUNT = 5;
const DASHBOARD_TOUR_STEP_COUNT = 3;

const buildPreviewLoans = (borrowerUser: string): Loan[] => [
   {
      id: 'mock-paid-1',
      trackingId: 'mock-paid-1',
      borrowerUser,
      lenderUser: 'demo-lender-a',
      borrowerWallet: '0x71c...9d42',
      lenderWallet: '0x8a4...19b0',
      loanAmount: 15,
      repaidAmount: 18,
      totalRepaymentAmount: 18,
      reason: 'Mock paid loan',
      loanStatus: LoanStatus.LENT,
      repaymentStatus: RepaymentStatus.PAID,
      dueDate: '2026-05-20T00:00:00.000Z',
      coin: 'USDC',
      hash: [],
      createdAt: '2026-05-10T00:00:00.000Z',
      updatedAt: '2026-05-18T00:00:00.000Z',
      fundedAt: '2026-05-10T00:00:00.000Z'
   },
   {
      id: 'mock-paid-2',
      trackingId: 'mock-paid-2',
      borrowerUser,
      lenderUser: 'demo-lender-b',
      borrowerWallet: '0x71c...9d42',
      lenderWallet: '0x31d...f6aa',
      loanAmount: 20,
      repaidAmount: 24,
      totalRepaymentAmount: 24,
      reason: 'Mock second paid loan',
      loanStatus: LoanStatus.LENT,
      repaymentStatus: RepaymentStatus.PAID,
      dueDate: '2026-05-28T00:00:00.000Z',
      coin: 'USDC',
      hash: [],
      createdAt: '2026-05-21T00:00:00.000Z',
      updatedAt: '2026-05-27T00:00:00.000Z',
      fundedAt: '2026-05-21T00:00:00.000Z'
   },
   {
      id: 'mock-active-1',
      trackingId: 'mock-active-1',
      borrowerUser,
      lenderUser: 'demo-lender-c',
      borrowerWallet: '0x71c...9d42',
      lenderWallet: '0x9db...7710',
      loanAmount: 60,
      repaidAmount: 0,
      totalRepaymentAmount: 71.5,
      reason: 'Mock active loan',
      loanStatus: LoanStatus.LENT,
      repaymentStatus: RepaymentStatus.UNPAID,
      dueDate: '2026-06-12T00:00:00.000Z',
      coin: 'USDC',
      hash: [],
      createdAt: '2026-05-30T00:00:00.000Z',
      updatedAt: '2026-05-30T00:00:00.000Z',
      fundedAt: '2026-05-30T00:00:00.000Z'
   },
   {
      id: 'mock-defaulted-1',
      trackingId: 'mock-defaulted-1',
      borrowerUser,
      lenderUser: 'demo-lender-a',
      borrowerWallet: '0x71c...9d42',
      lenderWallet: '0x8a4...19b0',
      loanAmount: 40,
      repaidAmount: 0,
      totalRepaymentAmount: 47,
      reason: 'Mock defaulted loan',
      loanStatus: LoanStatus.LENT,
      repaymentStatus: RepaymentStatus.UNPAID,
      dueDate: '2026-04-20T00:00:00.000Z',
      coin: 'USDC',
      hash: [],
      createdAt: '2026-04-10T00:00:00.000Z',
      updatedAt: '2026-04-10T00:00:00.000Z',
      fundedAt: '2026-04-10T00:00:00.000Z'
   },
   {
      id: 'mock-pending-1',
      trackingId: 'mock-pending-1',
      borrowerUser,
      lenderUser: '',
      borrowerWallet: '0x71c...9d42',
      loanAmount: 140,
      repaidAmount: 0,
      totalRepaymentAmount: 165,
      reason: 'Mock pending request',
      loanStatus: LoanStatus.REQUESTED,
      repaymentStatus: RepaymentStatus.UNPAID,
      dueDate: '2026-06-20T00:00:00.000Z',
      coin: 'USDC',
      hash: [],
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z'
   }
];

export default function Dashboard() {
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const gloanRequests = useSelector((state: RootState) => state.loans.loans.gloans || []);
   const isBorrower = useIsBorrower();
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
   const [walletData, setWalletData] = useState<Record<string, WalletLivenessData>>({});
   const { stats, creditLevels, loanArrays } = useDashboardData('borrower');
   const isMockRich = import.meta.env.DEV && searchParams.get('mockData') === 'rich';
   const showTourPreview = import.meta.env.DEV && searchParams.has('tourPreview');
   const dashboardStats = isMockRich
      ? {
           repayments: { count: 3, total: 200 },
           active: { count: 1, total: 60 },
           defaulted: { count: 1, total: 40 },
           pending: { count: 1, total: 140 }
        }
      : stats;

   const fundedLoans = useMemo(() => {
      return gloanRequests.filter((loan) => loan.borrowerUser === user.id && loan.loanStatus === 'Lent');
   }, [gloanRequests, user.id]);
   const borrowerLoans = useMemo(() => getBorrowerLoans(gloanRequests, user.id), [gloanRequests, user.id]);
   const previewLoans = useMemo(() => buildPreviewLoans(user.id), [user.id]);
   const isVerified = user.isWorldId === 'ACTIVE';
   const milestoneLoans = isMockRich ? previewLoans : borrowerLoans;
   const displayFundedLoans = useMemo(
      () => (isMockRich ? previewLoans.filter((loan) => loan.loanStatus === LoanStatus.LENT) : fundedLoans),
      [fundedLoans, isMockRich, previewLoans]
   );
   const displayUserProfiles = isMockRich ? DEMO_LENDER_PROFILES : userProfiles;
   const lenderIds = useMemo(
      () => [...new Set(displayFundedLoans.map((loan) => loan.lenderUser).filter(Boolean))] as string[],
      [displayFundedLoans]
   );
   const displayWalletData = Object.keys(walletData).length > 0 ? walletData : undefined;
   const displayLoanArrays = isMockRich
      ? {
           ...loanArrays,
           activeLoans: previewLoans.filter((loan) => loan.id === 'mock-active-1'),
           defaultedLoans: previewLoans.filter((loan) => loan.id === 'mock-defaulted-1')
        }
      : loanArrays;
   const milestones = buildReputationMilestones({ creditLevels, borrowerLoans: milestoneLoans, isVerified });

   useEffect(() => {
      if (!isBorrower || isMockRich || lenderIds.length === 0) return;
      dispatch(fetchUserProfiles(lenderIds)).catch(() => undefined);
   }, [dispatch, isBorrower, isMockRich, lenderIds]);

   useEffect(() => {
      if (!isBorrower || isMockRich) {
         setWalletData({});
         return;
      }

      const lendersWithWallets = lenderIds
         .map((lenderId) => ({ lenderId, walletAddress: displayUserProfiles[lenderId]?.walletAddress }))
         .filter(
            (lender): lender is { lenderId: string; walletAddress: string } =>
               typeof lender.walletAddress === 'string' && lender.walletAddress.startsWith('0x') && lender.walletAddress.length === 42
         );

      if (lendersWithWallets.length === 0) {
         setWalletData({});
         return;
      }

      let cancelled = false;
      const nowSeconds = Date.now() / 1000;

      Promise.all(
         lendersWithWallets.map(async ({ lenderId, walletAddress }) => {
            const info = await getWalletAgeInfo(walletAddress);
            if (!info) return null;

            return {
               lenderId,
               data: {
                  ageInDays: info.ageInDays,
                  transferCount: info.totalTransferCount,
                  hasMoreThan100Transfers: info.hasMoreThan100Transfers,
                  daysSinceLastTx: Math.max(0, (nowSeconds - info.lastTxTimestamp) / 86400),
                  hasHistory: info.hasHistory
               }
            };
         })
      )
         .then((results) => {
            if (cancelled) return;
            const nextWalletData: Record<string, WalletLivenessData> = {};
            results.forEach((result) => {
               if (result) nextWalletData[result.lenderId] = result.data;
            });
            setWalletData(nextWalletData);
         })
         .catch(() => {
            if (!cancelled) setWalletData({});
         });

      return () => {
         cancelled = true;
      };
   }, [displayUserProfiles, isBorrower, isMockRich, lenderIds]);

   if (!isBorrower) {
      return <Navigate to="/lender/dashboard" replace />;
   }

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col gap-5 px-md-4 py-md-3">
            <DashboardHeader />
            <UserGreeting user={user} />

            <div className="bg-md-neutral-100 rounded-md-lg p-4 shadow-md-card flex flex-col gap-4 bg-gradient-to-b from-white to-[#eee6fa]">
               <div data-tour-target="dashboard-trust-score">
                  <TrustScoreSection trustScore={user.cs} />
               </div>
               <div data-tour-target="dashboard-credit-level">
                  <CreditLevelSection currentCs={user.cs} isVerified={isVerified} />
               </div>
            </div>

            <div data-tour-target="dashboard-milestones">
               <ReputationMilestones milestones={milestones} />
            </div>
            {!isVerified && <VerificationCTA />}
            <LoanSummarySection stats={dashboardStats} />
            <LenderDiversitySection
               fundedLoans={displayFundedLoans}
               isVerified={isVerified}
               username={user.username}
               userProfiles={displayUserProfiles}
               walletData={displayWalletData}
               detailSearch={isMockRich ? '?demo=rich' : ''}
            />
            <UpcomingLoanDues
               activeLoans={displayLoanArrays.activeLoans}
               defaultedLoans={displayLoanArrays.defaultedLoans}
               username={user.username}
            />
         </div>
         {showTourPreview && (
            <GuidedTourPreview
               onFinish={() => navigate('/request-board')}
               stepOffset={REQUEST_BOARD_TOUR_STEP_COUNT}
               totalSteps={REQUEST_BOARD_TOUR_STEP_COUNT + DASHBOARD_TOUR_STEP_COUNT}
               steps={[
                  {
                     target: '[data-tour-target="dashboard-trust-score"]',
                     title: 'Trust Score',
                     body: 'Trust is your reputation on Moodeng. Verification, clean repayment, and healthy activity make lenders more confident in you.',
                     durationMs: 6500
                  },
                  {
                     target: '[data-tour-target="dashboard-credit-level"]',
                     title: 'Credit Level',
                     body: 'Credit Level is your borrowing tier. Trust is what you build; Credit Level is what that trust unlocks.',
                     durationMs: 7200
                  },
                  {
                     target: '[data-tour-target="dashboard-milestones"]',
                     title: 'Milestones',
                     body: 'Milestones are extra ways to earn Trust Points. Complete them to strengthen your profile and make lenders more confident in your requests.',
                     durationMs: 7600
                  }
               ]}
            />
         )}
      </div>
   );
}
