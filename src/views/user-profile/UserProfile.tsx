import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import {
   BarChart3,
   CalendarDays,
   Check,
   ChevronLeft,
   ChevronRight,
   Clock3,
   DollarSign,
   FileText,
   HelpCircle,
   RefreshCcw,
   ShieldCheck,
   Sparkles,
   TrendingUp,
   Users,
   X
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';

import Loading from '@/components/Loading';
import { PLACEHOLDER_AVATAR } from '@/components/UserAvatar';

import { formatDate, getMemberSinceText, parseDateSafely } from '@/utils/dateFormatters';
import { formatNumber, toNumber } from '@/utils/decimalHelpers';
import { calculateLenderDiversity, getDiversityStatus } from '@/utils/diversityScore';

import { getCreditLevelNumber, getCreditTierKey, isExactCreditTier, STARTING_CREDIT_LIMIT } from '@/config/creditTiers';
import { getEffectiveCreditLimit } from '@/lib/creditLeveling';
import { fetchUserProfiles, getUserProfile } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { type User, WorldId } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';

const DIVERSITY_STYLES: Record<string, { border: string; text: string; bg: string }> = {
   Excellent: { border: 'border-md-green-600', text: 'text-md-green-600', bg: 'bg-[rgba(0,134,36,0.05)]' },
   Good: { border: 'border-md-blue-500', text: 'text-md-blue-500', bg: 'bg-[rgba(0,118,235,0.1)]' },
   Fair: { border: 'border-md-yellow-700', text: 'text-md-yellow-700', bg: 'bg-[rgba(211,170,0,0.05)]' },
   Low: { border: 'border-orange-400', text: 'text-orange-500', bg: 'bg-orange-50' },
   Poor: { border: 'border-md-red-500', text: 'text-md-red-500', bg: 'bg-red-50' }
};

const getDiversityBadgeStyle = (status: string) => DIVERSITY_STYLES[status] ?? DIVERSITY_STYLES.Poor;

const UserProfile = () => {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const { username } = useParams();
   const [profileUser, setProfileUser] = useState<User | null>(null);
   const [isLoanMixSheetOpen, setIsLoanMixSheetOpen] = useState(false);

   const user = useSelector((state: RootState) => state.auth.user);
   const loans = useSelector((state: RootState) => state.loans.loans.gloans);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const resolvedUser = profileUser ?? user;

   useEffect(() => {
      window.scrollTo(0, 0);
   }, []);

   useEffect(() => {
      if (!username) return;
      const loadProfile = async () => {
         try {
            const { user: fetchedUser } = await dispatch(getUserProfile(username)).unwrap();
            setProfileUser(fetchedUser);
            await dispatch(getUserLoans({ userId: fetchedUser.id })).unwrap();
         } catch (error) {
            console.error('Error fetching profile:', (error as Error).message || error);
         }
      };
      loadProfile();
   }, [dispatch, username]);

   useEffect(() => {
      const lenderUserIds = [...new Set(loans.map((loan) => loan.lenderUser).filter(Boolean))] as string[];
      if (lenderUserIds.length > 0) {
         dispatch(fetchUserProfiles(lenderUserIds)).catch(() => undefined);
      }
   }, [dispatch, loans]);

   if (!resolvedUser || !loans) return <Loading />;

   const memberSince = getMemberSinceText(resolvedUser.createdAt);
   const resolveUsername = (userId?: string | null) => (userId ? (userProfiles[userId]?.username ?? userId) : '');

   // --- Computed loan data ---

   const uniqueLoans: Loan[] = [];
   const seenAmounts = new Set<number>();
   for (const loan of loans) {
      const amt = toNumber(loan.loanAmount);
      if (isExactCreditTier(amt) && !seenAmounts.has(amt)) {
         uniqueLoans.push(loan);
         seenAmounts.add(amt);
      }
   }

   const ignoredTier = new Set<number>();
   const trustBuildingLoans = loans.reduce((acc: Loan[], loan: Loan) => {
      const amt = toNumber(loan.loanAmount);
      const key = getCreditTierKey(amt);
      if (isExactCreditTier(amt)) {
         if (ignoredTier.has(key)) acc.push(loan);
         else ignoredTier.add(key);
      } else {
         acc.push(loan);
      }
      return acc;
   }, []);

   const countMap = loans.reduce<Record<string, number>>((acc, loan) => {
      const name = resolveUsername(loan.lenderUser) || 'Unknown';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
   }, {});

   const sortedLoans = [...loans].sort((a, b) => parseDateSafely(a.createdAt).getTime() - parseDateSafely(b.createdAt).getTime());
   let totalDaysBetween = 0;
   for (let i = 1; i < sortedLoans.length; i++) {
      totalDaysBetween +=
         (parseDateSafely(sortedLoans[i].createdAt).getTime() - parseDateSafely(sortedLoans[i - 1].createdAt).getTime()) /
         (1000 * 3600 * 24);
   }
   const avgDays = sortedLoans.length > 1 ? Math.round(totalDaysBetween / (sortedLoans.length - 1)) : 0;

   const paidLoans = loans.filter((l) => l.repaymentStatus === 'Paid');
   const avgPaymentTime =
      paidLoans.length > 0
         ? Math.round(
              paidLoans.reduce((sum, l) => {
                 return sum + (parseDateSafely(l.updatedAt).getTime() - parseDateSafely(l.createdAt).getTime()) / (1000 * 3600 * 24);
              }, 0) / paidLoans.length
           )
         : 0;

   const usualLoanSize = loans.length > 0 ? Math.round(loans.reduce((sum, l) => sum + toNumber(l.loanAmount), 0) / loans.length) : 0;

   const avgLoanTerm =
      loans.length > 0
         ? Math.round(
              loans.reduce((sum, l) => {
                 return sum + (new Date(l.dueDate).getTime() - new Date(l.createdAt).getTime()) / (1000 * 3600 * 24);
              }, 0) / loans.length
           )
         : 0;

   const totalUniqueLenders = Object.keys(countMap).length;
   const repeatLenderCount = totalUniqueLenders - Object.values(countMap).filter((c) => c === 1).length;

   const lenderDiversity = calculateLenderDiversity(loans, userProfiles);
   const totalBorrowed = loans.reduce((sum, l) => (l.loanStatus === 'Lent' ? sum + toNumber(l.loanAmount) : sum), 0);
   const totalRepaid = loans.reduce((sum, l) => (l.repaymentStatus === 'Paid' ? sum + toNumber(l.loanAmount) : sum), 0);

   const isVerifiedBorrower = resolvedUser.isWorldId === WorldId.ACTIVE;
   const displayedCreditLimit = isVerifiedBorrower ? getEffectiveCreditLimit(resolvedUser.cs, true) : STARTING_CREDIT_LIMIT;
   const creditMax = displayedCreditLimit;
   const creditLevel = getCreditLevelNumber(creditMax);
   const creditProgress = creditMax > 0 ? 100 : 0;

   const diversityScore = lenderDiversity.score;
   const diversityStatus = getDiversityStatus(diversityScore);
   const badge = getDiversityBadgeStyle(diversityStatus);
   const creditBuildingCount = uniqueLoans.length;
   const trustBuildingCount = trustBuildingLoans.length;
   const hasLoanHistory = loans.length > 0;
   const loanMixLabel = !hasLoanHistory
      ? 'No loan mix yet'
      : trustBuildingCount > creditBuildingCount
        ? 'Trust-Building Focused'
        : creditBuildingCount > trustBuildingCount
          ? 'Credit-Building Focused'
          : 'Balanced Loan Mix';

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28">
            {/* Header */}
            <div className="flex items-center justify-between px-md-5 py-md-3">
               <div className="flex-1 flex items-center gap-4">
                  <button onClick={() => navigate(-1)} className="shrink-0 w-6 h-6 flex items-center justify-center">
                     <ChevronLeft className="w-6 h-6 text-md-primary-2000" />
                  </button>
                  <h1 className="text-md-h3 font-semibold text-md-primary-2000">Borrower Insights</h1>
               </div>
               <button
                  type="button"
                  onClick={() => navigate('/support')}
                  aria-label="Open help and support center"
                  className="shrink-0 w-12 h-12 bg-white rounded-full shadow-md-card flex items-center justify-center"
               >
                  <HelpCircle className="w-6 h-6 text-md-primary-900" strokeWidth={1.5} />
               </button>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-5 px-md-4 py-md-3">
               {/* User Profile */}
               <div className="flex items-center gap-4 rounded-[20px] border border-[#eadfff] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(131,54,240,0.08)]">
                  <img src={PLACEHOLDER_AVATAR} alt="Profile" className="h-[72px] w-[72px] shrink-0 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                     <p className="truncate text-[22px] font-bold leading-tight tracking-[-0.01em] text-[#2d1b69]">
                        {resolvedUser.username || username}
                     </p>
                     <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bfe8cf] bg-md-green-100 px-3 py-1.5">
                           <span className="flex h-4 w-4 items-center justify-center rounded-full bg-md-green-900">
                              <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />
                           </span>
                           <span className="text-[13px] font-semibold leading-none text-md-green-900">Verified Borrower</span>
                        </span>
                     </div>
                     <p className="mt-3 text-[14px] font-medium leading-none text-[#6b5f7c]">Member since {memberSince}</p>
                  </div>
               </div>

               {/* Credit Level */}
               <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <span className="text-md-h5 font-semibold text-md-heading">Credit Level</span>
                        <HelpCircle className="w-5 h-5 text-md-primary-900" strokeWidth={1.5} />
                     </div>
                     <button
                        type="button"
                        onClick={() => navigate(`/user/${resolvedUser.username || username}/progress-history`)}
                        className="text-md-b2 font-semibold text-md-blue-600 underline"
                     >
                        View Progress History
                     </button>
                  </div>
                  <div className="flex flex-col gap-3">
                     <div className="flex items-center gap-2">
                        {/* LVL Badge */}
                        <div className="flex items-center">
                           <div className="w-[28px] h-[28px] rounded-full bg-md-neutral-500 flex items-center justify-center z-10">
                              <div className="w-4 h-4 rounded-full bg-md-neutral-1400" />
                           </div>
                           <div className="bg-md-neutral-500 rounded-md-sm flex items-center justify-end px-md-1 h-[22px] w-[58px] -ml-2">
                              <span className="font-knewave text-md-b2 text-md-neutral-1400 text-center">LVL {creditLevel}</span>
                           </div>
                        </div>
                        <div className="flex-1 flex items-center justify-end gap-1 text-md-b2">
                           <span className="font-semibold text-md-primary-800">${formatNumber(creditMax)}</span>
                           <span className="font-normal text-md-neutral-700">/ ${formatNumber(creditMax)}</span>
                        </div>
                     </div>
                     {/* Progress Bar */}
                     <div className="h-3 bg-md-neutral-100 rounded-md-pill overflow-hidden">
                        <div
                           className="h-full bg-md-primary-900 rounded-md-pill transition-all duration-500"
                           style={{ width: `${Math.max(creditProgress, 8)}%` }}
                        />
                     </div>
                  </div>
               </div>

               {/* Loan Summary */}
               <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                     <span className="text-md-h5 font-semibold text-md-heading">Loan Summary</span>
                     <span className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#d4f4e2] to-[#e8f9f0] px-3 py-1.5 shadow-sm">
                        <span className="text-[11px] leading-none font-semibold text-[#059669]">Good Standing</span>
                     </span>
                  </div>

                  <div className="grid grid-cols-2 gap-[14px]">
                     <SummaryMetricCard
                        icon={<DollarSign className="h-5 w-5 text-white" strokeWidth={2.5} />}
                        iconClassName="from-[#8b5cf6] to-[#7c3aed] shadow-purple-200"
                        waveId="borrowed-wave"
                        waveStart="#e9d5ff"
                        waveEnd="#ddd6fe"
                        title="Total Borrowed"
                        value={`$${formatNumber(totalBorrowed)}`}
                     >
                        <div className="relative z-10 space-y-[3px]">
                           {totalRepaid > 0 ? (
                              <p className="text-[12px] font-medium text-[#10b981]">${formatNumber(totalRepaid)} Repaid</p>
                           ) : null}
                           <p className="text-[12px] font-medium text-[#9ca3af]">0 Defaults</p>
                        </div>
                     </SummaryMetricCard>

                     <SummaryMetricCard
                        icon={<FileText className="h-5 w-5 text-white" strokeWidth={2.5} />}
                        iconClassName="from-[#3b82f6] to-[#2563eb] shadow-blue-200"
                        waveId="loans-wave"
                        waveStart="#ddd6fe"
                        waveEnd="#c4b5fd"
                        title="Total Loans"
                        value={String(loans.length)}
                     >
                        <div className="relative z-10 space-y-[6px]">
                           <button
                              type="button"
                              onClick={() => setIsLoanMixSheetOpen(true)}
                              className="group inline-flex max-w-full items-center gap-1 rounded-full bg-[#f5f3ff] px-2 py-1 transition-colors hover:bg-[#ede9fe] active:scale-[0.98]"
                           >
                              <span className="truncate text-[11px] font-medium text-[#8b5cf6]">{loanMixLabel}</span>
                              <ChevronRight className="h-2.5 w-2.5 shrink-0 text-[#8b5cf6]" strokeWidth={2.5} />
                           </button>
                           {hasLoanHistory ? (
                              <p className="text-[12px] font-medium leading-[1.3] text-[#9ca3af]">
                                 {trustBuildingCount} Trust Building · {creditBuildingCount} Credit Building
                              </p>
                           ) : null}
                        </div>
                     </SummaryMetricCard>

                     <div className="relative col-span-2 overflow-hidden rounded-[24px] border border-[#e9d5ff] bg-gradient-to-br from-white to-[#faf5ff] p-5 shadow-[0_6px_24px_rgba(131,54,240,0.12)]">
                        <div className="absolute right-0 top-0 h-[120px] w-[120px] rounded-full bg-gradient-to-br from-[#f3e8ff] to-transparent opacity-60 blur-2xl" />
                        <div className="relative z-10 flex items-start justify-between gap-3">
                           <div className="min-w-0 flex-1">
                              <p className="mb-3 text-[15px] font-semibold text-[#6b7280]">Lender Diversity Score</p>
                              {hasLoanHistory ? (
                                 <>
                                    <div className="mb-3 flex flex-wrap items-center gap-2.5">
                                       <div className="flex items-baseline gap-1.5">
                                          <p className="text-[32px] font-bold leading-none tracking-tight text-[#7c3aed]">
                                             {diversityScore}
                                          </p>
                                          <p className="text-[16px] font-medium text-[#4b5563]">points</p>
                                       </div>
                                       <span
                                          className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 ${badge.border} ${badge.bg}`}
                                       >
                                          <span className={`text-[11px] font-semibold leading-none ${badge.text}`}>
                                             {diversityStatus} Diversity
                                          </span>
                                       </span>
                                    </div>
                                    <button type="button" className="flex items-center gap-1.5">
                                       <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#dbeafe]">
                                          <Users className="h-3.5 w-3.5 text-[#3b82f6]" strokeWidth={2.5} />
                                       </span>
                                       <span className="text-[13px] font-semibold text-[#3b82f6]">
                                          {lenderDiversity.uniqueLenders} Unique{' '}
                                          {lenderDiversity.uniqueLenders === 1 ? 'Lender' : 'Lenders'}
                                       </span>
                                    </button>
                                 </>
                              ) : (
                                 <div className="max-w-[210px]">
                                    <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#f5f3ff] px-3 py-2">
                                       <Sparkles className="h-4 w-4 text-[#8b5cf6]" strokeWidth={2.5} />
                                       <span className="text-[15px] font-bold leading-none text-[#8b5cf6]">New borrower</span>
                                    </span>
                                    <p className="mb-2 text-[16px] font-semibold leading-[1.25] text-[#4b5563]">
                                       No lender diversity history yet
                                    </p>
                                    <p className="text-[14px] leading-5 text-[#6b7280]">
                                       This score becomes more useful after completed loans.
                                    </p>
                                 </div>
                              )}
                           </div>
                           <img
                              src="/hippos/borrower-insights-trophy.png"
                              alt="Moodeng with trophy"
                              className="h-[96px] w-[96px] shrink-0 object-contain drop-shadow-lg"
                           />
                        </div>
                     </div>
                  </div>
               </div>

               {/* Borrower Insights */}
               <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2.5">
                     <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] shadow-md shadow-purple-200">
                        <BarChart3 className="h-[18px] w-[18px] text-white" strokeWidth={2.5} />
                     </span>
                     <p className="text-[20px] font-bold leading-none tracking-[-0.01em] text-[#2d1b69]">Borrower Insights</p>
                  </div>
                  {hasLoanHistory ? (
                     <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_4px_16px_rgba(131,54,240,0.08)] divide-y divide-[#f3f4f6]">
                        <InsightRow
                           icon={<CalendarDays className="h-4 w-4 text-[#8b5cf6]" strokeWidth={2.5} />}
                           iconClassName="bg-[#ede9fe]"
                           label="Avg days between loans"
                           value={`${avgDays} days`}
                           valueColor="text-[#8b5cf6]"
                        />
                        <InsightRow
                           icon={<Clock3 className="h-4 w-4 text-[#3b82f6]" strokeWidth={2.5} />}
                           iconClassName="bg-[#dbeafe]"
                           label="Typical payment time"
                           value={`${avgPaymentTime} ${avgPaymentTime === 1 ? 'day' : 'days'}`}
                           valueColor="text-[#3b82f6]"
                        />
                        <InsightRow
                           icon={<DollarSign className="h-4 w-4 text-[#8b5cf6]" strokeWidth={2.5} />}
                           iconClassName="bg-[#ede9fe]"
                           label="Usual loan size"
                           value={`$${usualLoanSize}`}
                           valueColor="text-[#8b5cf6]"
                        />
                        <InsightRow
                           icon={<FileText className="h-4 w-4 text-[#6b7280]" strokeWidth={2.5} />}
                           iconClassName="bg-[#f3f4f6]"
                           label="Typical loan term"
                           value={`${avgLoanTerm} days`}
                           valueColor="text-[#1f2937]"
                        />
                        <InsightRow
                           icon={<RefreshCcw className="h-4 w-4 text-[#ef4444]" strokeWidth={2.5} />}
                           iconClassName="bg-[#fee2e2]"
                           label="Repeat lenders"
                           value={`${repeatLenderCount} of ${totalUniqueLenders}`}
                           valueColor="text-[#ef4444]"
                        />
                     </div>
                  ) : (
                     <NewBorrowerInsightsCard />
                  )}
               </div>

               {/* Recent Loans */}
               <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-2">
                     <div className="flex items-center justify-between">
                        <span className="text-md-h5 font-semibold text-md-heading">Recent Loans</span>
                        <button className="text-md-b2 font-semibold text-md-blue-600 underline">View History</button>
                     </div>
                     <p className="text-md-b3 font-normal text-md-neutral-1500">View who you've lent to and the status of each loan.</p>
                  </div>
                  <div className="bg-white rounded-md-lg shadow-md-card py-4 px-3 flex flex-col gap-5">
                     {loans.slice(0, 5).map((loan: Loan) => (
                        <RecentLoanItem key={loan.id} loan={loan} resolveUsername={resolveUsername} />
                     ))}
                     {loans.length === 0 && <p className="text-md-b2 text-md-neutral-1200 text-center py-4">No loans yet</p>}
                  </div>
               </div>
            </div>
         </div>
         <LoanMixBottomSheet
            isOpen={isLoanMixSheetOpen}
            onClose={() => setIsLoanMixSheetOpen(false)}
            label={loanMixLabel}
            trustBuildingCount={trustBuildingCount}
            creditBuildingCount={creditBuildingCount}
         />
      </div>
   );
};

const SummaryMetricCard = ({
   icon,
   iconClassName,
   waveId,
   waveStart,
   waveEnd,
   title,
   value,
   children
}: {
   icon: ReactNode;
   iconClassName: string;
   waveId: string;
   waveStart: string;
   waveEnd: string;
   title: string;
   value: string;
   children: ReactNode;
}) => (
   <div className="relative min-h-[200px] overflow-hidden rounded-[20px] bg-white px-[18px] pb-8 pt-5 shadow-[0_4px_16px_rgba(131,54,240,0.08)]">
      <div className="absolute inset-x-0 bottom-0 h-[45px]">
         <svg className="absolute bottom-0 w-full" viewBox="0 0 200 45" preserveAspectRatio="none" aria-hidden="true">
            <defs>
               <linearGradient id={waveId} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: waveStart, stopOpacity: 0.35 }} />
                  <stop offset="100%" style={{ stopColor: waveEnd, stopOpacity: 0.5 }} />
               </linearGradient>
            </defs>
            <path d="M0,22 Q50,10 100,22 T200,22 L200,45 L0,45 Z" fill={`url(#${waveId})`} opacity="0.85" />
            <path d="M0,28 Q50,18 100,28 T200,28 L200,45 L0,45 Z" fill="#f3e8ff" opacity="0.6" />
         </svg>
      </div>
      <div className={`mb-[14px] flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br shadow-lg ${iconClassName}`}>
         {icon}
      </div>
      <p className="mb-2 text-[13px] font-medium text-[#6b7280]">{title}</p>
      <p className="mb-3.5 text-[28px] font-bold leading-none tracking-tight text-[#1f2937]">{value}</p>
      {children}
   </div>
);

const InsightRow = ({
   icon,
   iconClassName,
   label,
   value,
   valueColor
}: {
   icon: ReactNode;
   iconClassName: string;
   label: string;
   value: string;
   valueColor: string;
}) => (
   <div className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-[#fafafa]">
      <div className="flex min-w-0 items-center gap-2.5">
         <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>{icon}</span>
         <span className="min-w-0 text-[15px] font-medium leading-[1.2] text-[#4b5563]">{label}</span>
      </div>
      <span className={`shrink-0 text-[16px] font-bold leading-none ${valueColor}`}>{value}</span>
   </div>
);

const NewBorrowerInsightsCard = () => (
   <div className="flex items-center gap-4 rounded-[20px] bg-white p-5 shadow-[0_4px_16px_rgba(131,54,240,0.08)]">
      <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-[#ede9fe]">
         <FileText className="h-8 w-8 text-[#8b5cf6]" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
         <p className="mb-2 text-[16px] font-bold leading-tight text-[#2d1b69]">Not enough loan history yet</p>
         <p className="text-[14px] leading-5 text-[#6b7280]">
            Once this borrower completes more loans, you'll see repayment timing, usual loan size, repeat lenders, and borrowing patterns
            here.
         </p>
      </div>
   </div>
);

const LoanMixBottomSheet = ({
   isOpen,
   onClose,
   label,
   trustBuildingCount,
   creditBuildingCount
}: {
   isOpen: boolean;
   onClose: () => void;
   label: string;
   trustBuildingCount: number;
   creditBuildingCount: number;
}) => {
   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-50 flex items-end">
         <button
            type="button"
            aria-label="Close loan mix explanation"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
         />
         <div className="relative mx-auto w-full max-w-[440px] rounded-t-[24px] bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.15)]">
            <div className="flex justify-center pb-2 pt-3">
               <div className="h-1 w-10 rounded-full bg-[#e5e7eb]" />
            </div>
            <div className="px-6 pb-8 pt-2">
               <div className="mb-3 flex items-start justify-between gap-4">
                  <h3 className="text-[20px] font-bold leading-tight tracking-tight text-[#1f2937]">{label}</h3>
                  <button
                     type="button"
                     onClick={onClose}
                     className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6]"
                  >
                     <X className="h-4 w-4 text-[#4b5563]" />
                  </button>
               </div>
               <p className="mb-4 text-[15px] leading-[22px] text-[#4b5563]">
                  {trustBuildingCount + creditBuildingCount === 0
                     ? 'This borrower does not have enough loan history for a loan mix yet.'
                     : `This borrower has ${trustBuildingCount} trust-building ${trustBuildingCount === 1 ? 'loan' : 'loans'} and ${creditBuildingCount} credit-building ${creditBuildingCount === 1 ? 'loan' : 'loans'}.`}
               </p>
               <div className="mb-5 rounded-[16px] bg-[#f9fafb] p-4">
                  <p className="mb-2 text-[13px] font-semibold text-[#8b5cf6]">Why it matters to lenders</p>
                  <p className="text-[14px] leading-5 text-[#6b7280]">
                     Loan mix helps show whether this borrower usually builds trust with smaller repeat loans or focuses on increasing
                     available credit.
                  </p>
               </div>
               <div className="space-y-3">
                  <LoanMixType
                     icon={<ShieldCheck className="h-4 w-4 text-[#3b82f6]" strokeWidth={2.5} />}
                     iconClassName="bg-[#eff6ff]"
                     title="Trust Building"
                     description="Smaller loans below the current credit limit."
                  />
                  <LoanMixType
                     icon={<TrendingUp className="h-4 w-4 text-[#10b981]" strokeWidth={2.5} />}
                     iconClassName="bg-[#f0fdf4]"
                     title="Credit Building"
                     description="Loans used to progress toward a higher limit."
                  />
               </div>
            </div>
         </div>
      </div>
   );
};

const LoanMixType = ({
   icon,
   iconClassName,
   title,
   description
}: {
   icon: ReactNode;
   iconClassName: string;
   title: string;
   description: string;
}) => (
   <div className="flex gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>{icon}</span>
      <div className="flex-1">
         <p className="mb-0.5 text-[14px] font-semibold text-[#1f2937]">{title}</p>
         <p className="text-[13px] leading-[18px] text-[#6b7280]">{description}</p>
      </div>
   </div>
);

const RecentLoanItem = ({ loan, resolveUsername }: { loan: Loan; resolveUsername: (id?: string | null) => string }) => {
   const isPaid = loan.repaymentStatus === 'Paid';
   const lenderName = resolveUsername(loan.lenderUser) || 'Unknown';
   const lentDate = formatDate(loan.createdAt);

   return (
      <div className="flex items-start gap-2 py-md-0">
         <img src={PLACEHOLDER_AVATAR} alt="Avatar" className="shrink-0 w-12 rounded-full object-cover" />
         <div className="flex-1 min-w-0 flex flex-col gap-1">
            <p className="text-md-b1 font-semibold text-md-primary-2000 line-clamp-2">{loan.reason || 'Loan request'}</p>
            <div className="flex items-center gap-1 text-md-b3 text-md-neutral-1200">
               <span>Lent to {lenderName}</span>
               <span className="w-1 h-1 rounded-full bg-md-neutral-1200" />
               <span>{lentDate}</span>
            </div>
         </div>
         <div className="shrink-0 flex flex-col items-end gap-1">
            <p className="text-md-b1 font-semibold text-md-primary-2000 overflow-hidden text-ellipsis whitespace-nowrap">
               ${formatNumber(loan.loanAmount)}
            </p>
            {isPaid ? (
               <span className="inline-flex items-center gap-1 px-md-1 py-md-0 rounded-[24px] border border-md-primary-900 bg-[rgba(131,54,240,0.1)]">
                  <Check className="w-3 h-3 text-md-primary-900" strokeWidth={3} />
                  <span className="text-md-b4 font-semibold text-md-primary-900">REPAID</span>
               </span>
            ) : (
               <span className="inline-flex items-center gap-1 px-md-1 py-md-0 rounded-[24px] border border-md-green-700 bg-[rgba(31,193,107,0.1)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-md-green-700" />
                  <span className="text-md-b4 font-semibold text-md-green-700">ACTIVE</span>
               </span>
            )}
         </div>
      </div>
   );
};

export default UserProfile;
