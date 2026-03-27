import { useEffect, useState } from 'react';

import { Check, ChevronLeft, CircleAlert, HelpCircle } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';

import Loading from '@/components/Loading';

import { formatDate, getMemberSinceText, parseDateSafely } from '@/utils/dateFormatters';
import { formatNumber, toNumber } from '@/utils/decimalHelpers';
import { calculateLenderDiversity, getDiversityStatus } from '@/utils/diversityScore';

import { CREDIT_TIER_INCREMENT } from '@/config/creditTiers';
import { fetchUserProfiles, getUserProfile } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { User } from '@/types/authTypes';
import { type Loan } from '@/types/loanTypes';

const PLACEHOLDER_AVATAR =
   'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Chiaroscuro_lighting_illuminates_a_Chibi-style_SVG_logo_a_gray_and_light_pink_hippo__joyfully_jumping__thumbs_up__holding_a_gold_Japanese_Mon_coin.__Hayao_Miyazaki_inspired__deep_teal_hues__warm_candl-uvt0ZI3fogcgqDR4Y2gCSRZfq8QmtX.png';

const getDiversityBorderColor = (score: number) => {
   if (score >= 80) return 'border-green-400 text-green-600';
   if (score >= 60) return 'border-blue-400 text-blue-600';
   if (score >= 40) return 'border-yellow-400 text-yellow-600';
   if (score >= 20) return 'border-orange-400 text-orange-600';
   return 'border-red-400 text-red-600';
};

const UserProfile = () => {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const { username } = useParams();
   const [profileUser, setProfileUser] = useState<User | null>(null);

   useEffect(() => {
      window.scrollTo(0, 0);
   }, []);

   useEffect(() => {
      const loadProfile = async () => {
         if (!username) return;
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

   const user = useSelector((state: RootState) => state.auth.user);
   const loans = useSelector((state: RootState) => state.loans.loans.gloans);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const resolvedUser = profileUser ?? user;

   useEffect(() => {
      const lenderUserIds = [...new Set(loans.map((loan) => loan.lenderUser).filter(Boolean))] as string[];
      if (lenderUserIds.length > 0) {
         dispatch(fetchUserProfiles(lenderUserIds)).catch(() => undefined);
      }
   }, [dispatch, loans]);

   if (!resolvedUser || !loans) {
      return <Loading />;
   }

   const memberSince = getMemberSinceText(resolvedUser.createdAt);
   const resolveUsername = (userId?: string | null) => (userId ? userProfiles[userId]?.username ?? userId : '');

   // Credit Unlocking loans (exact tier amounts, first occurrence only)
   const uniqueLoans: Loan[] = [];
   const seenAmounts = new Set();
   for (const loan of loans) {
      const loanAmountNum = toNumber(loan.loanAmount);
      if (loanAmountNum % CREDIT_TIER_INCREMENT === 0 && !seenAmounts.has(loanAmountNum)) {
         uniqueLoans.push(loan);
         seenAmounts.add(loanAmountNum);
      }
   }

   // Trust Building loans (non-tier or duplicate tier amounts)
   const ignoredTier = new Set();
   const trustBuildingLoans = loans.reduce((acc: Loan[], loan: Loan) => {
      const loanAmountNum = toNumber(loan.loanAmount);
      const remainder = loanAmountNum % CREDIT_TIER_INCREMENT;
      const key = Math.floor(loanAmountNum / CREDIT_TIER_INCREMENT) * CREDIT_TIER_INCREMENT;
      if (remainder === 0) {
         if (ignoredTier.has(key)) {
            acc.push(loan);
         } else {
            ignoredTier.add(key);
         }
      } else {
         acc.push(loan);
      }
      return acc;
   }, []);

   // Repeat lender count
   const countMap = loans.reduce((acc: Record<string, number>, loan: Loan) => {
      const usernameToCount = resolveUsername(loan.lenderUser) || 'Unknown';
      acc[usernameToCount] = (acc[usernameToCount] || 0) + 1;
      return acc;
   }, {});

   // Average days between loans
   const sortedLoans = [...loans].sort((a, b) => parseDateSafely(a.createdAt).getTime() - parseDateSafely(b.createdAt).getTime());
   let totalDays = 0;
   for (let i = 1; i < sortedLoans.length; i++) {
      const prev = parseDateSafely(sortedLoans[i].createdAt);
      const next = parseDateSafely(sortedLoans[i - 1].createdAt);
      totalDays += (prev.getTime() - next.getTime()) / (1000 * 3600 * 24);
   }
   const avgDays = sortedLoans.length > 1 ? Math.round(totalDays / (sortedLoans.length - 1)) : 0;

   // Average payment time for paid loans
   const paidLoans = loans.filter((loan) => loan.repaymentStatus === 'Paid');
   let totalPaymentTime = 0;
   paidLoans.forEach((loan) => {
      const loanedAt = parseDateSafely(loan.createdAt);
      const paidAt = parseDateSafely(loan.updatedAt);
      totalPaymentTime += (paidAt.getTime() - loanedAt.getTime()) / (1000 * 60 * 60 * 24);
   });
   const avgPaymentTime = paidLoans.length > 0 ? Math.round(totalPaymentTime / paidLoans.length) : 0;

   // Usual loan size
   const usualLoanSize = loans.length > 0 ? Math.round(loans.reduce((sum, loan) => sum + toNumber(loan.loanAmount), 0) / loans.length) : 0;

   // Typical loan term
   const avgLoanTerm =
      loans.length > 0
         ? Math.round(
              loans.reduce((sum, loan) => {
                 const dueDate = new Date(loan.dueDate);
                 const createdDate = new Date(loan.createdAt);
                 return sum + Math.round((dueDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
              }, 0) / loans.length
           )
         : 0;

   // Repeat lenders
   const totalUniqueLenders = Object.keys(countMap).length;
   const repeatLenderCount = totalUniqueLenders - Object.values(countMap).filter((count) => count === 1).length;

   const lenderDiversity = calculateLenderDiversity(loans, userProfiles);

   const totalBorrowed = loans.reduce((sum, loan) => (loan.loanStatus === 'Lent' ? sum + toNumber(loan.loanAmount) : sum), 0);
   const totalRepaid = loans.reduce((sum, loan) => (loan.repaymentStatus === 'Paid' ? sum + toNumber(loan.loanAmount) : sum), 0);

   // Credit level
   const creditLevel = Math.floor(resolvedUser.cs / CREDIT_TIER_INCREMENT);
   const creditMax = resolvedUser.cs;
   const creditProgress = creditMax > 0 ? Math.min((totalBorrowed / creditMax) * 100, 100) : 0;

   const diversityScore = lenderDiversity.score;
   const diversityStatus = getDiversityStatus(diversityScore);

   return (
      <div className="min-h-screen bg-[#F4F4F5]">
         <div className="max-w-lg mx-auto pb-8">
            {/* Top App Bar */}
            <div className="flex items-center justify-between px-5 py-4 bg-white">
               <button onClick={() => navigate(-1)} className="text-[#111827] hover:text-gray-600">
                  <ChevronLeft className="w-6 h-6" />
               </button>
               <h1 className="text-[22px] font-bold text-[#111827]">Borrower Insights</h1>
               <button className="w-8 h-8 rounded-full border-2 border-[#6366F1] flex items-center justify-center text-[#6366F1] hover:bg-indigo-50">
                  <span className="text-sm font-bold">?</span>
               </button>
            </div>

            <div className="px-5 pt-5 space-y-4">
               {/* User Profile Section */}
               <div className="flex items-center gap-3">
                  <img
                     src={PLACEHOLDER_AVATAR}
                     alt="Profile"
                     className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex flex-col">
                     <span className="text-[16px] font-bold text-[#111827]">{resolvedUser.username || username}</span>
                     <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 rounded-full w-fit">
                        <Check className="w-3 h-3 text-green-600" />
                        <span className="text-[10px] font-medium text-green-700">Verified Lender</span>
                     </span>
                     <span className="text-[12px] text-[#6B7280] mt-0.5">Member since {memberSince}</span>
                  </div>
               </div>

               {/* Credit Level Section */}
               <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center gap-1.5">
                        <span className="text-[15px] font-bold text-[#111827]">Credit Level</span>
                        <HelpCircle className="w-4 h-4 text-[#6366F1]" />
                     </div>
                     <button className="text-[13px] font-bold text-[#3B82F6] underline">View Progress History</button>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-gray-500" />
                        <span className="text-[12px] text-gray-400 italic">LVL {creditLevel}</span>
                     </span>
                     <span className="text-[13px]">
                        <span className="text-[#6366F1] font-bold">${formatNumber(creditMax)}</span>
                        <span className="text-[#6B7280]"> / ${formatNumber(creditMax)}</span>
                     </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                     <div
                        className="h-full bg-[#6366F1] rounded-full transition-all duration-500"
                        style={{ width: `${creditProgress}%` }}
                     />
                  </div>
               </div>

               {/* Loan Summary Section */}
               <div>
                  <div className="flex items-center gap-2 mb-3">
                     <span className="text-[15px] font-bold text-[#111827]">Loan Summary</span>
                     <span className="px-2.5 py-0.5 bg-white border border-green-400 rounded-full text-[11px] font-medium text-green-600">
                        Good Standing
                     </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     {/* Total Borrowed Card */}
                     <div className="bg-white rounded-2xl p-4 shadow-sm">
                        <span className="text-[12px] text-[#6B7280]">Total Borrowed</span>
                        <div className="text-[28px] font-bold text-[#111827] leading-tight mt-1">${formatNumber(totalBorrowed)}</div>
                        <div className="text-[12px] text-green-500 mt-1">${formatNumber(totalRepaid)} Repaid</div>
                        <div className="text-[12px] text-[#6B7280]">0 Defaults</div>
                     </div>
                     {/* Total Loans Card */}
                     <div className="bg-white rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center gap-1">
                           <span className="text-[12px] text-[#6B7280]">Total Loans</span>
                           <HelpCircle className="w-3.5 h-3.5 text-[#6366F1]" />
                        </div>
                        <div className="text-[28px] font-bold text-[#111827] leading-tight mt-1">{loans.length}</div>
                        <div className="text-[12px] text-[#6B7280] mt-1">{uniqueLoans.length} Credit Unlocking</div>
                        <div className="text-[12px] text-[#6B7280]">{trustBuildingLoans.length} Trust Building</div>
                     </div>
                  </div>
               </div>

               {/* Lender Diversity Score Section */}
               <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-[15px] font-bold text-[#111827]">Lender Diversity Score</span>
                     <button className="text-[13px] font-bold text-[#3B82F6] underline">
                        {lenderDiversity.uniqueLenders} Unique Lenders
                     </button>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="text-[28px] font-bold text-[#111827]">{diversityScore} points</span>
                     <span className={`px-2.5 py-0.5 bg-white border rounded-full text-[11px] font-medium ${getDiversityBorderColor(diversityScore)}`}>
                        {diversityStatus} Diversity
                     </span>
                  </div>
               </div>

               {/* Borrower Insights Section */}
               <div>
                  <span className="text-[15px] font-bold text-[#111827] mb-3 block">Borrower Insights</span>
                  <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50">
                     <InsightRow label="Avg days between loans" value={`${avgDays} days`} showHelp valueColor="text-[#6366F1]" />
                     <InsightRow label="Typical payment time" value={`${avgPaymentTime} day`} showHelp valueColor="text-[#6366F1]" />
                     <InsightRow label="Usual loan size" value={`$${usualLoanSize}`} showHelp valueColor="text-[#6366F1]" />
                     <InsightRow label="Typical loan term" value={`${avgLoanTerm} days`} valueColor="text-[#111827]" />
                     <InsightRow
                        label="Repeat lenders"
                        value={`${repeatLenderCount} of ${totalUniqueLenders}`}
                        showHelp
                        valueColor="text-red-500"
                     />
                  </div>
               </div>

               {/* Recent Loans Section */}
               <div>
                  <div className="flex items-center justify-between mb-1">
                     <span className="text-[15px] font-bold text-[#111827]">Recent Loans</span>
                     <button className="text-[13px] font-bold text-[#3B82F6] underline">View History</button>
                  </div>
                  <p className="text-[12px] text-[#6B7280] mb-4">View who you've lent to and the status of each loan.</p>
                  <div className="space-y-5">
                     {loans.slice(0, 5).map((loan: Loan) => (
                        <RecentLoanItem key={loan.id} loan={loan} resolveUsername={resolveUsername} />
                     ))}
                     {loans.length === 0 && <p className="text-sm text-[#6B7280] text-center py-4">No loans yet</p>}
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};

const InsightRow = ({
   label,
   value,
   showHelp,
   valueColor
}: {
   label: string;
   value: string;
   showHelp?: boolean;
   valueColor: string;
}) => (
   <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-1.5">
         <span className="text-[13px] text-[#6B7280]">{label}</span>
         {showHelp && <HelpCircle className="w-3.5 h-3.5 text-[#6366F1]" />}
      </div>
      <span className={`text-[13px] font-bold ${valueColor}`}>{value}</span>
   </div>
);

const RecentLoanItem = ({
   loan,
   resolveUsername
}: {
   loan: Loan;
   resolveUsername: (userId?: string | null) => string;
}) => {
   const isPaid = loan.repaymentStatus === 'Paid';
   const lenderName = resolveUsername(loan.lenderUser) || 'Unknown';
   const lentDate = formatDate(loan.createdAt);

   return (
      <div className="flex items-center gap-3">
         <img
            src={PLACEHOLDER_AVATAR}
            alt="Borrower"
            className="w-10 h-10 rounded-full object-cover shrink-0"
         />
         <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-[#111827] leading-tight line-clamp-2">{loan.reason || 'Loan request'}</p>
            <p className="text-[12px] text-[#6B7280] mt-0.5">
               Lent to {lenderName} &bull; {lentDate}
            </p>
         </div>
         <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="text-[14px] font-bold text-[#111827]">${formatNumber(loan.loanAmount)}</span>
            {isPaid ? (
               <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-green-400 rounded-full">
                  <Check className="w-3 h-3 text-green-500" />
                  <span className="text-[10px] font-bold text-green-500">REPAID</span>
               </span>
            ) : (
               <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-blue-400 rounded-full">
                  <CircleAlert className="w-3 h-3 text-blue-500" />
                  <span className="text-[10px] font-bold text-blue-500">ACTIVE</span>
               </span>
            )}
         </div>
      </div>
   );
};

export default UserProfile;
