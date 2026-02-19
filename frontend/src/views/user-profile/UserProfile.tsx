

import { useEffect, useState } from 'react';

import { ChevronDown, HelpCircle, TrendingUp, Users, XCircle } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';

import LenderBoardHeader from '@v2/views/lenderBoard/components/LenderBoardHeader';
import Loading from '@/components/Loading';
import CollapsibleSection from '@/components/ui/CollapsibleSection';

import { formatDate, getMemberSinceText, parseDateSafely } from '@/utils/dateFormatters';
import { formatNumber, toNumber } from '@/utils/decimalHelpers';
import { calculateLenderDiversity, getDiversityColor, getDiversityStatus } from '@/utils/diversityScore';
import { getNetworkColor } from '@/utils/networkColors';

import { ALLOWED_CHAIN_DISPLAY_NAME } from '@/config/wagmiConfig';
import { fetchUserProfiles, getUserProfile } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { User } from '@/types/authTypes';
import { type Loan } from '@/types/loanTypes';

const LevelBadge = ({ status }: { status: string }) => (
   <svg viewBox="0 0 40 40" className="w-10 h-10">
      <path
         d="M20 2L4 8v12c0 11 13 18 16 20 3-2 16-9 16-20V8L20 2z"
         fill={status === 'current' ? '#059669' : status === 'next' ? '#2563EB' : '#4B5563'}
      />
      <path
         d="M20 4L6 9.4v10.2C6 29 17.5 35.2 20 37c2.5-1.8 14-8 14-17.4V9.4L20 4z"
         fill={status === 'current' ? '#10B981' : status === 'next' ? '#3B82F6' : '#6B7280'}
      />
      <path d="M20 8l2.5 5 5.5.8-4 3.9.9 5.3-4.9-2.6-4.9 2.6 1-5.3-4-3.9 5.5-.8L20 8z" fill="#E5E7EB" />
   </svg>
);

const UserProfile = () => {
   const dispatch = useDispatch<AppDispatch>();
   const { username } = useParams();
   const [profileUser, setProfileUser] = useState<User | null>(null);

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
   const [showDetailedHistory, setShowDetailedHistory] = useState(false);
   const [showLenderNames, setShowLenderNames] = useState(false);
   const [showAllTiers, setShowAllTiers] = useState(false);

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

   const ignoredTier = new Set();
   const TierLists = loans.reduce((acc: Loan[], loan: Loan) => {
      const loanAmountNum = toNumber(loan.loanAmount);
      const remainder = loanAmountNum % 20;
      const key = Math.floor(loanAmountNum / 20) * 20;
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

   const ignoredTiers = new Set();
   const TierList = loans.reduce((acc: Record<number, Loan[]>, loan: Loan) => {
      const loanAmountNum = toNumber(loan.loanAmount);
      const remainder = loanAmountNum % 20;
      if (remainder === 0) {
         const key = Math.floor(loanAmountNum / 20) * 20;
         if (ignoredTiers.has(key)) {
            if (!acc[key]) acc[key] = [];
            acc[key].push(loan);
         } else {
            ignoredTiers.add(key);
         }
         return acc;
      }
      const key = Math.floor(loanAmountNum / 20) * 20;
      if (!acc[key]) acc[key] = [];
      acc[key].push(loan);
      return acc;
   }, {});

   const uniqueLoans: Loan[] = [];
   const seenAmounts = new Set();
   for (const loan of loans) {
      const loanAmountNum = toNumber(loan.loanAmount);
      if (loanAmountNum % 20 === 0 && !seenAmounts.has(loanAmountNum)) {
         uniqueLoans.push(loan);
         seenAmounts.add(loanAmountNum);
      }
   }

   const countMap = loans.reduce((acc: Record<string, number>, loan: Loan) => {
      const usernameToCount = resolveUsername(loan.lenderUser) || 'Unknown';
      acc[usernameToCount] = (acc[usernameToCount] || 0) + 1;
      return acc;
   }, {});

   const sortedLoans = [...loans].sort((a, b) => parseDateSafely(a.createdAt).getTime() - parseDateSafely(b.createdAt).getTime());
   let totalDays = 0;
   for (let i = 1; i < sortedLoans.length; i++) {
      const prev = parseDateSafely(sortedLoans[i].createdAt);
      const next = parseDateSafely(sortedLoans[i - 1].createdAt);
      const diffInTime = prev.getTime() - next.getTime();
      const diffInDays = diffInTime / (1000 * 3600 * 24);
      totalDays += diffInDays;
   }
   const avgDays = Math.round(totalDays / (sortedLoans.length - 1));

   const paidLoans = loans.filter((loan) => loan.repaymentStatus === 'Paid');
   let totalPaymentTime = 0;
   paidLoans.forEach((loan) => {
      const loanedAt = parseDateSafely(loan.createdAt);
      const paidAt = parseDateSafely(loan.updatedAt);
      const timeDiff = (paidAt.getTime() - loanedAt.getTime()) / (1000 * 60 * 60 * 24);
      totalPaymentTime += timeDiff;
   });
   const avgPaymentTime = Math.round(totalPaymentTime / paidLoans.length);

   const lenderDiversity = calculateLenderDiversity(loans, userProfiles);

   const borrowerData = {
      username: resolvedUser.username || username,
      memberSince: memberSince,
      stats: {
         totalLoans: loans.length,
         defaults: 0,
         totalBorrowed: loans.reduce((sum, loan) => (loan.loanStatus === 'Lent' ? sum + toNumber(loan.loanAmount) : sum), 0),
         totalRepaid: loans.reduce((sum, loan) => (loan.repaymentStatus === 'Paid' ? sum + toNumber(loan.loanAmount) : sum), 0),
         uniqueLenders: lenderDiversity.uniqueLenders,
         unlocking: uniqueLoans.length,
         building: TierLists.length
      },
      creditGrowth: {
         currentLimit: resolvedUser.cs > 20 ? resolvedUser.cs - 20 : resolvedUser.cs,
         nextLimit: resolvedUser.cs,
         currentDate:
            resolvedUser.cs > 20 && resolvedUser.updatedAt ? formatDate(resolvedUser.updatedAt) : formatDate(resolvedUser.createdAt)
      },
      lenderDiversity: lenderDiversity
   };

   return (
      <div className="min-h-screen bg-gray-50">
         <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-24">
            <LenderBoardHeader />
            <div className="space-y-6">
               <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 mb-8">
               {/* We don't need Image later */}
               {/* eslint-disable-next-line */}
               <img
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Chiaroscuro_lighting_illuminates_a_Chibi-style_SVG_logo_a_gray_and_light_pink_hippo__joyfully_jumping__thumbs_up__holding_a_gold_Japanese_Mon_coin.__Hayao_Miyazaki_inspired__deep_teal_hues__warm_candl-uvt0ZI3fogcgqDR4Y2gCSRZfq8QmtX.png"
                  alt="Friendly hippo mascot"
                  className="w-24 h-24 md:w-32 md:h-32"
               />
               <div className="space-y-1 text-center md:text-left">
                  <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Dashboard Summary</h1>
                  <p className="text-sm md:text-base text-gray-600">
                     {borrowerData.username} • Member since {borrowerData.memberSince}
                  </p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <div className="text-5xl font-bold mb-2 text-gray-900">{borrowerData.stats.totalLoans}</div>
                        <div className="text-gray-600">Total Loans</div>
                     </div>
                     <TrendingUp className="text-blue-500 w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                     <div className="flex items-center gap-2">
                        <span className="text-green-600">{borrowerData.stats.unlocking} Credit Unlocking</span>
                        <div className="relative group">
                           <HelpCircle className="w-4 h-4 text-gray-500 cursor-help" />
                           <div className="absolute invisible group-hover:visible bg-white text-gray-800 p-3 rounded-lg text-sm w-64 bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 shadow-xl border border-gray-200">
                              <p className="mb-2">
                                 <span className="font-medium">Credit Unlocking Loans:</span> Loans that match exact credit tier amounts
                                 ($20, $40, etc.). These help increase your credit limit.
                              </p>
                           </div>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <span className="text-blue-600">{borrowerData.stats.building} Trust Building</span>
                        <div className="relative group">
                           <HelpCircle className="w-4 h-4 text-gray-500 cursor-help" />
                           <div className="absolute invisible group-hover:visible bg-white text-gray-800 p-3 rounded-lg text-sm w-64 bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 shadow-xl border border-gray-200">
                              <p>
                                 <span className="font-medium">Trust Building Loans:</span> Loans below the next credit tier amount. These
                                 don't affect credit limit but help build trust with lenders.
                              </p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <div className="text-5xl font-bold mb-2 text-gray-900">{borrowerData.stats.defaults}</div>
                        <div className="text-gray-600">Defaults</div>
                     </div>
                     <XCircle className="text-red-500 w-6 h-6" />
                  </div>
                  <div className="text-green-600">Good Standing</div>
               </div>

               <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <div className="text-5xl font-bold mb-2 text-gray-900">${formatNumber(borrowerData.stats.totalBorrowed)}</div>
                        <div className="text-gray-600">Total Borrowed</div>
                     </div>
                     <div className="text-emerald-500 text-2xl">$</div>
                  </div>
                  <div className="text-green-600">${formatNumber(borrowerData.stats.totalRepaid)} Repaid</div>
               </div>

               <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <div className="text-5xl font-bold mb-2 text-gray-900">{borrowerData.stats.uniqueLenders}</div>
                        <div className="text-gray-600">Unique Lenders</div>
                     </div>
                     <Users className="text-purple-500 w-6 h-6" />
                  </div>
                  <div className={'text-' + getDiversityColor(borrowerData.lenderDiversity.score) + '-600'}>
                     {getDiversityStatus(borrowerData.lenderDiversity.score)} Diversity
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
               <h2 className="text-lg md:text-xl font-semibold mb-6 text-gray-900">Credit Growth</h2>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
                  <div className="bg-gray-100 rounded-xl p-6 text-center border border-gray-200">
                     <div className="text-gray-600 mb-4">Previous Credit Level</div>
                     <div className="inline-block bg-gray-200 rounded-full p-4 mb-4">
                        <div className="w-12 h-12 flex items-center justify-center">
                           <LevelBadge status="completed" />
                        </div>
                     </div>
                     <div className="text-4xl font-bold mb-2 text-gray-900">${formatNumber(borrowerData.creditGrowth.currentLimit)}</div>
                     <div className="text-gray-600">{borrowerData.creditGrowth.currentDate}</div>
                  </div>

                  <div className="bg-green-50 rounded-xl p-6 text-center border border-green-200">
                     <div className="text-green-700 mb-4">Current Credit Level</div>
                     <div className="inline-block bg-green-100 rounded-full p-4 mb-4">
                        <div className="w-12 h-12 flex items-center justify-center">
                           <LevelBadge status="current" />
                        </div>
                     </div>
                     <div className="text-4xl font-bold text-green-700 mb-2">${formatNumber(borrowerData.creditGrowth.nextLimit)}</div>
                     <div className="text-green-700">Available to Borrow Now</div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex justify-between text-sm text-gray-600">
                     <span>Starting Credit Limit ($20)</span>
                     <span>Current Credit Limit (${formatNumber(borrowerData.creditGrowth.nextLimit)})</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                     <div className={'h-full bg-blue-500 w-[' + parseInt(((user.cs * 100) / (user.cs + 20)).toString()) + '%]'} />
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                     <span>Total Borrowed: ${formatNumber(borrowerData.stats.totalBorrowed)}</span>
                     <span>{borrowerData.stats.totalLoans} Total Loans</span>
                  </div>
               </div>

               <CollapsibleSection
                  isOpen={showAllTiers}
                  onToggle={() => setShowAllTiers(!showAllTiers)}
                  buttonText={showAllTiers ? 'Hide Progress History' : 'View Progress History'}
               >
                  <div className="mt-6 space-y-4">
                     <h3 className="text-lg font-medium text-gray-900">Credit Growth Timeline</h3>
                     {uniqueLoans.map((tier: Loan) => {
                        const tierLoanAmount = toNumber(tier.loanAmount);
                        return (
                           <div
                              key={tier.id}
                              className={`p-4 rounded-lg ${
                                 tierLoanAmount === user.cs - 20 && tier.repaymentStatus === 'Paid'
                                    ? 'bg-green-50 border border-green-200'
                                    : tierLoanAmount === user.cs
                                      ? 'bg-blue-50 border border-blue-200'
                                      : 'bg-gray-50 border border-gray-200'
                              }`}
                           >
                              <div className="flex justify-between items-start">
                                 <div className="flex items-center gap-4">
                                    <LevelBadge
                                       status={
                                          tierLoanAmount === user.cs - 20 && tier.repaymentStatus === 'Paid'
                                             ? 'current'
                                             : tierLoanAmount === user.cs
                                               ? 'next'
                                               : 'completed'
                                       }
                                    />
                                    <div className="flex flex-col gap-1">
                                       <div className="flex items-center gap-2">
                                          <span
                                             className={`text-lg font-medium ${
                                                tierLoanAmount === user.cs - 20 && tier.repaymentStatus === 'Paid'
                                                   ? 'text-green-700'
                                                   : tierLoanAmount === user.cs
                                                     ? 'text-blue-700'
                                                     : 'text-gray-900'
                                             }`}
                                          >
                                             ${formatNumber(tier.loanAmount)} Credit Limit
                                          </span>
                                          <span className="text-sm text-gray-600">{formatDate(tier.updatedAt)}</span>
                                       </div>
                                       <span className="text-xs text-gray-600">
                                          ${formatNumber(tier.loanAmount)} loan repaid ${formatNumber(tier.totalRepaymentAmount)} unlocked $
                                          {tierLoanAmount + 20} limit
                                       </span>
                                    </div>
                                 </div>

                                 {TierList[tierLoanAmount]?.length > 0 ? (
                                    <div className="flex items-start gap-2">
                                       <div className="contents text-xs text-gray-600">Trust-Building Loans</div>
                                       <div className="relative group">
                                          <div className="flex items-center gap-1 cursor-help">
                                             <span className="text-gray-600">+</span>
                                             <div className="px-2 py-1 rounded-full bg-gray-200 border border-gray-300 text-sm text-gray-700">
                                                {TierList[tierLoanAmount]?.length}
                                             </div>
                                          </div>
                                          <div className="absolute invisible group-hover:visible bg-white text-gray-800 p-3 rounded-lg text-sm w-64 right-0 top-full mt-2 z-10 shadow-xl border border-gray-200">
                                             <div className="space-y-2">
                                                <p className="font-medium">
                                                   Trust-Building Loans at ${formatNumber(tier.loanAmount)} credit limit:
                                                </p>
                                                <ul className="list-disc pl-4 space-y-1">
                                                   {TierList[tierLoanAmount]?.map((loan: Loan) => (
                                                      <li key={loan.id}>
                                                         ${formatNumber(loan.loanAmount)} loan - {formatDate(loan.updatedAt)}
                                                      </li>
                                                   ))}
                                                </ul>
                                             </div>
                                          </div>
                                       </div>
                                    </div>
                                 ) : null}
                              </div>
                           </div>
                        );
                     })}
                  </div>

                  <div className="mt-6 space-y-4">
                     <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                        <div className="flex items-center gap-2">
                           <div className="h-2 w-2 rounded-full bg-green-500"></div>
                           <h3 className="font-medium text-green-700">Credit Unlocking Loans</h3>
                           <div className="relative group">
                              <HelpCircle className="w-4 h-4 text-green-600 cursor-help" />
                              <div className="absolute invisible group-hover:visible w-64 p-3 bg-white rounded-lg shadow-xl text-sm text-gray-800 -translate-x-1/2 left-1/2 bottom-full mb-2 z-10 border border-gray-200">
                                 <p>
                                    Loans that match exact credit tier amounts ($20, $40, etc.). Successfully repaying these loans unlocks
                                    the next credit tier.
                                 </p>
                                 <ul className="mt-2 list-disc pl-4 space-y-1 text-gray-600">
                                    <li>Must match exact tier amount</li>
                                    <li>Unlocks next credit level on repayment</li>
                                    <li>Shows strong borrowing responsibility</li>
                                 </ul>
                              </div>
                           </div>
                        </div>
                        <p className="mt-2 text-sm text-green-700">Example: $20 loan unlocks $40 credit limit when repaid</p>
                     </div>

                     <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                        <div className="flex items-center gap-2">
                           <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                           <h3 className="font-medium text-blue-700">Trust Building Loans</h3>
                           <div className="relative group">
                              <HelpCircle className="w-4 h-4 text-blue-600 cursor-help" />
                              <div className="absolute invisible group-hover:visible w-64 p-3 bg-white rounded-lg shadow-xl text-sm text-gray-800 -translate-x-1/2 left-1/2 bottom-full mb-2 z-10 border border-gray-200">
                                 <p>
                                    Smaller loans below your current credit tier. These help build trust with lenders but don't unlock
                                    higher credit limits.
                                 </p>
                                 <ul className="mt-2 list-disc pl-4 space-y-1 text-gray-600">
                                    <li>Must be at least $20</li>
                                    <li>Shows active platform usage</li>
                                    <li>Builds lender confidence</li>
                                    <li>Doesn't affect credit limit</li>
                                 </ul>
                              </div>
                           </div>
                        </div>
                        <p className="mt-2 text-sm text-blue-700">Example: $20 loan while at $40 credit limit</p>
                     </div>
                  </div>
               </CollapsibleSection>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
               <h2 className="text-xl font-semibold mb-6 text-gray-900">Borrower Insights</h2>

               <div className="space-y-4">
                  <div className="flex justify-between items-center">
                     <span className="text-gray-600">Avg days between loans:</span>
                     <div className="flex items-center gap-2">
                        <span className="text-amber-600 font-medium">{loans.length > 0 ? avgDays : '0'} days</span>
                        <div className="relative group">
                           <HelpCircle className="w-4 h-4 text-gray-500 cursor-help" />
                           <div className="absolute invisible group-hover:visible bg-white text-gray-800 p-2 rounded text-sm w-64 right-0 bottom-full mb-2 z-10 shadow-lg border border-gray-200">
                              The average number of days this borrower waits between taking out new loans.
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex justify-between items-center">
                     <span className="text-gray-600">Typical payment time:</span>
                     <div className="flex items-center gap-2">
                        <span className="text-amber-600 font-medium">{loans.length > 0 ? avgPaymentTime : '0'} day</span>
                        <div className="relative group">
                           <HelpCircle className="w-4 h-4 text-gray-500 cursor-help" />
                           <div className="absolute invisible group-hover:visible bg-white text-gray-800 p-2 rounded text-sm w-64 right-0 bottom-full mb-2 z-10 shadow-lg border border-gray-200">
                              The most common time it takes for this borrower to repay their loans after receiving them.
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex justify-between items-center">
                     <span className="text-gray-600">Usual loan size:</span>
                     <div className="flex items-center gap-2">
                        <span className="text-amber-600 font-medium">
                           $
                           {loans.length > 0
                              ? Math.round(loans.reduce((sum, loan) => sum + toNumber(loan.loanAmount), 0) / loans.length)
                              : '0'}
                        </span>
                        <div className="relative group">
                           <HelpCircle className="w-4 h-4 text-gray-500 cursor-help" />
                           <div className="absolute invisible group-hover:visible bg-white text-gray-800 p-2 rounded text-sm w-64 right-0 bottom-full mb-2 z-10 shadow-lg border border-gray-200">
                              The amount this borrower most frequently requests for their loans. Currently at their maximum credit limit.
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex justify-between items-center">
                     <span className="text-gray-600">Typical loan term:</span>
                     <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-medium">
                           {loans.length > 0
                              ? Math.round(
                                   loans.reduce((sum, loan) => {
                                      const dueDate = new Date(loan.dueDate);
                                      const createdDate = new Date(loan.createdAt);
                                      const days = Math.round((dueDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                                      return sum + days;
                                   }, 0) / loans.length
                                )
                              : '0'}{' '}
                           days
                        </span>
                        <div className="relative group">
                           <HelpCircle className="w-4 h-4 text-gray-500 cursor-help" />
                           <div className="absolute invisible group-hover:visible bg-white text-gray-800 p-2 rounded text-sm w-64 right-0 bottom-full mb-2 z-10 shadow-lg border border-gray-200">
                              The most common duration this borrower requests for their loans. This reflects their consistent pattern of loan
                              term preferences rather than an average.
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex justify-between items-center">
                     <span className="text-gray-600">Repeat lenders:</span>
                     <div className="flex items-center gap-2">
                        <span className="text-red-600 font-medium">
                           {Object.keys(countMap).length - Object.values(countMap).filter((count) => count === 1).length} of{' '}
                           {Object.keys(countMap).length}
                        </span>
                        <div className="relative group">
                           <HelpCircle className="w-4 h-4 text-gray-500 cursor-help" />
                           <div className="absolute invisible group-hover:visible bg-white text-gray-800 p-2 rounded text-sm w-64 right-0 bottom-full mb-2 z-10 shadow-lg border border-gray-200">
                              The number of lenders who have provided multiple loans to this borrower out of their total unique lenders.
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
               <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900">Lender Diversity</h2>
                  <div className="flex items-center justify-between">
                     <div className="space-y-2">
                        <div className={'text-4xl font-bold text-' + getDiversityColor(borrowerData.lenderDiversity.score) + '-600'}>
                           {borrowerData.lenderDiversity.score} %
                        </div>
                        <div className="text-sm text-gray-600">Diversity Score</div>
                     </div>
                     <div
                        className={
                           'h-16 w-16 rounded-full bg-' +
                           getDiversityColor(borrowerData.lenderDiversity.score) +
                           '-100 border border-' +
                           getDiversityColor(borrowerData.lenderDiversity.score) +
                           '-300 flex items-center justify-center'
                        }
                     >
                        <Users className={'w-8 h-8 text-' + getDiversityColor(borrowerData.lenderDiversity.score) + '-600'} />
                     </div>
                  </div>

                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                     <div
                        className={
                           'h-full transition-all duration-500 bg-' + getDiversityColor(borrowerData.lenderDiversity.score) + '-500'
                        }
                        style={{ width: borrowerData.lenderDiversity.score + '%' }}
                     />
                  </div>

                  <button
                     onClick={() => setShowLenderNames(!showLenderNames)}
                     className="w-full px-4 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                     {showLenderNames ? 'Hide' : 'Show'} Lender Distribution
                     <ChevronDown className={`w-4 h-4 transform transition-transform ${showLenderNames ? 'rotate-180' : ''}`} />
                  </button>

                  {showLenderNames ? (
                     <div className="space-y-2 pt-2">
                        {borrowerData.lenderDiversity.distribution.map((lender) => (
                           <div key={lender.name} className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-50 border border-transparent">
                              <span className="font-medium text-gray-900">{lender.name || 'Others'}</span>
                              <span className="text-gray-600">{lender.percent} of total loans</span>
                           </div>
                        ))}
                     </div>
                  ) : null}
               </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
               <h2 className="text-xl font-semibold mb-6 text-gray-900">Recent Loans</h2>
               <div className="space-y-4">
                  {loans
                     .filter((loan) => loan.repaymentStatus === 'Paid')
                     .slice(0, 5)
                     .map((loan: Loan) => {
                        const unlock = uniqueLoans.some((item) => item.id === loan.id);
                        const build = TierLists.some((item) => item.id === loan.id);
                        return (
                           <div key={loan.id} className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                              <div className="flex justify-between items-start">
                                 <div>
                                    <div className="flex items-center gap-2">
                                       <span className="text-lg font-semibold text-gray-900">${formatNumber(loan.loanAmount)}</span>
                                       <span className="text-sm text-gray-600">→ ${formatNumber(loan.repaidAmount)} repaid</span>
                                    </div>
                                    <div className="text-sm text-gray-600">{loan.createdAt.split('T')[0].replaceAll('-', '/')}</div>
                                 </div>
                                 <div className="flex flex-col items-end gap-2">
                                    <span
                                       className={`px-3 py-1 ${getNetworkColor(ALLOWED_CHAIN_DISPLAY_NAME)} rounded-lg text-sm font-medium`}
                                    >
                                       {ALLOWED_CHAIN_DISPLAY_NAME}
                                    </span>
                                    <span
                                       className={`text-sm font-medium ${loan.repaymentStatus !== 'Paid' ? 'text-blue-600' : 'text-emerald-600'}`}
                                    >
                                       {loan.repaymentStatus === 'Paid' ? 'Repaid' : 'Active'}
                                    </span>
                                 </div>
                              </div>
                              <div className="flex justify-between items-center">
                                 <span className="text-sm text-gray-600">{resolveUsername(loan.lenderUser) || 'Others'}</span>
                                 <span
                                    className={`text-sm font-medium px-2 py-1 rounded-lg ${
                                       unlock
                                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                          : build && Boolean(loan.lenderUser)
                                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                            : 'bg-gray-200 text-gray-700'
                                    }`}
                                 >
                                    {unlock
                                       ? 'Credit Unlocking Loan'
                                       : build && Boolean(loan.lenderUser)
                                         ? 'Trust Building Loan'
                                         : 'Regular Loan'}
                                 </span>
                              </div>
                           </div>
                        );
                     })}
               </div>
            </div>

            <button
               onClick={() => setShowDetailedHistory(!showDetailedHistory)}
               className="w-full px-4 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors flex items-center justify-center gap-1"
            >
               {showDetailedHistory ? 'Hide' : 'Show'} All History
               <ChevronDown className={`w-4 h-4 transform transition-transform ${showDetailedHistory ? 'rotate-180' : ''}`} />
            </button>

            {showDetailedHistory ? (
               <div className="bg-white rounded-xl overflow-x-auto shadow-sm border border-gray-200">
                  <table className="w-full text-sm">
                     <thead>
                        <tr className="bg-gray-100 border-b border-gray-200">
                           <th className="py-3 px-4 text-left font-medium text-gray-700">Date</th>
                           <th className="py-3 px-4 text-left font-medium text-gray-700">Amount</th>
                           <th className="py-3 px-4 text-left font-medium text-gray-700">Network</th>
                           <th className="py-3 px-4 text-left font-medium text-gray-700">Lender</th>
                           <th className="py-3 px-4 text-left font-medium text-gray-700">Status</th>
                           <th className="py-3 px-4 text-left font-medium text-gray-700">Type</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-200">
                        {uniqueLoans.map((loan: Loan) => {
                           return (
                              <tr key={loan.id} className="hover:bg-gray-50">
                                 <td className="py-3 px-4 text-gray-700">{loan.createdAt.split('T')[0].replaceAll('-', '/')}</td>
                                 <td className="py-3 px-4 font-medium text-gray-900">${formatNumber(loan.loanAmount)}</td>
                                 <td className="py-3 px-4">
                                    <span
                                       className={`px-2.5 py-1 ${getNetworkColor(ALLOWED_CHAIN_DISPLAY_NAME)} rounded-lg text-xs font-medium`}
                                    >
                                       {ALLOWED_CHAIN_DISPLAY_NAME}
                                    </span>
                                 </td>
                                 <td className="py-3 px-4 text-gray-600">{resolveUsername(loan.lenderUser) || 'Others'}</td>
                                 <td className="py-3 px-4">
                                    <span
                                       className={`font-medium ${loan.repaymentStatus !== 'Paid' ? 'text-blue-600' : 'text-emerald-600'}`}
                                    >
                                       {loan.repaymentStatus === 'Paid' ? 'Repaid' : 'Active'}
                                    </span>
                                 </td>
                                 <td className="py-3 px-4">
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                                       Credit Unlocking Loan
                                    </span>
                                 </td>
                              </tr>
                           );
                        })}
                        {TierLists.map((loan: Loan) => {
                           return (
                              <tr key={loan.id} className="hover:bg-gray-50">
                                 <td className="py-3 px-4 text-gray-700">{loan.createdAt.split('T')[0].replaceAll('-', '/')}</td>
                                 <td className="py-3 px-4 font-medium text-gray-900">${formatNumber(loan.loanAmount)}</td>
                                 <td className="py-3 px-4">
                                    <span
                                       className={`px-2.5 py-1 ${getNetworkColor(ALLOWED_CHAIN_DISPLAY_NAME)} rounded-lg text-xs font-medium`}
                                    >
                                       {ALLOWED_CHAIN_DISPLAY_NAME}
                                    </span>
                                 </td>
                                 <td className="py-3 px-4 text-gray-600">{resolveUsername(loan.lenderUser) || 'Others'}</td>
                                 <td className="py-3 px-4">
                                    <span
                                       className={`font-medium ${loan.repaymentStatus !== 'Paid' ? 'text-blue-600' : 'text-emerald-600'}`}
                                    >
                                       {loan.repaymentStatus === 'Paid' ? 'Repaid' : 'Active'}
                                    </span>
                                 </td>
                                 <td className="py-3 px-4">
                                    <span
                                       className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                                          Boolean(loan.lenderUser)
                                             ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                             : 'bg-gray-200 text-gray-700'
                                       }`}
                                    >
                                       {loan.lenderUser ? 'Trust Building Loan' : 'Regular Loan'}
                                    </span>
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            ) : null}
            </div>
         </main>
      </div>
   );
};

export default UserProfile;
