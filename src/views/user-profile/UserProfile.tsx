'use client';

import { useEffect, useState } from 'react';

import Image from 'next/image';

import { ChevronDown, HelpCircle, TrendingUp, Users, XCircle } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';

import Loading from '@/components/Loading';
import CollapsibleSection from '@/components/ui/CollapsibleSection';

import { MONTHS } from '@/constants/dates';
import { getUserProfile } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { type Loan } from '@/types/loanTypes';
import { formatDate, getMemberSinceText } from '@/utils/dateFormatters';
import { calculateLenderDiversity, getDiversityColor, getDiversityStatus } from '@/utils/diversityScore';
import { getNetworkColor } from '@/utils/networkColors';

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

// Utility functions moved to @/utils

const UserProfile = () => {
   const dispatch = useDispatch<AppDispatch>();
   const { username } = useParams();

   useEffect(() => {
      const Profile = async () => {
         await dispatch(getUserProfile(username as string))
            .unwrap()
            .then(() => {
               console.log('Profile fetched successfully');
            })
            .catch((error: Error) => {
               console.error('Error fetching profile:', error.message || error);
            });
      };
      const Loan = async () => {
         await dispatch(getUserLoans(username || ''))
            .unwrap()
            .then(() => {
               console.log('Loan fetched successfully');
            })
            .catch((error: Error) => {
               console.error('Error fetching loan:', error.message || error);
            });
      };
      Profile();
      Loan();
   }, [dispatch, username]);

   const user = useSelector((state: RootState) => state.auth.user);
   const loans = useSelector((state: RootState) => state.loans.loans.gloans);
   const [showDetailedHistory, setShowDetailedHistory] = useState(false);
   const [showLenderNames, setShowLenderNames] = useState(false);
   const [showAllTiers, setShowAllTiers] = useState(false);

   if (!user || !loans) {
      return <Loading />;
   }

   // Date calculations using utilities
   const memberSince = getMemberSinceText(user.createdAt);

   const ignoredTier = new Set();
   const TierLists = loans.reduce((acc: Loan[], loan: Loan) => {
      const remainder = loan.loanAmount % 20;
      const key = Math.floor(loan.loanAmount / 20) * 20;
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
      const remainder = loan.loanAmount % 20;
      if (remainder === 0) {
         const key = Math.floor(loan.loanAmount / 20) * 20;
         if (ignoredTiers.has(key)) {
            if (!acc[key]) acc[key] = [];
            acc[key].push(loan);
         } else {
            ignoredTiers.add(key);
         }
         return acc;
      }
      const key = Math.floor(loan.loanAmount / 20) * 20;
      if (!acc[key]) acc[key] = [];
      acc[key].push(loan);
      return acc;
   }, {});

   const uniqueLoans: Loan[] = [];
   const seenAmounts = new Set();
   for (const loan of loans) {
      if (loan.loanAmount % 20 === 0 && !seenAmounts.has(loan.loanAmount)) {
         uniqueLoans.push(loan);
         seenAmounts.add(loan.loanAmount);
      }
   }

   const countMap = loans.reduce((acc: Record<string, number>, loan: Loan) => {
      const usernameToCount = loan.lenderUser || 'Unknown';
      acc[usernameToCount] = (acc[usernameToCount] || 0) + 1;
      return acc;
   }, {});

   const sortedLoans = [...loans].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
   let totalDays = 0;
   for (let i = 1; i < sortedLoans.length; i++) {
      const prev = new Date(sortedLoans[i].createdAt);
      const next = new Date(sortedLoans[i - 1].createdAt);
      const diffInTime = prev.getTime() - next.getTime();
      const diffInDays = diffInTime / (1000 * 3600 * 24);
      totalDays += diffInDays;
   }
   const avgDays = Math.round(totalDays / (sortedLoans.length - 1));

   const paidLoans = loans.filter((loan) => loan.repaymentStatus === 'Paid');
   let totalPaymentTime = 0;
   paidLoans.forEach((loan) => {
      const loanedAt = new Date(loan.createdAt);
      const paidAt = new Date(loan.updatedAt);
      const timeDiff = (paidAt.getTime() - loanedAt.getTime()) / (1000 * 60 * 60 * 24);
      totalPaymentTime += timeDiff;
   });
   const avgPaymentTime = Math.round(totalPaymentTime / paidLoans.length);

   // Calculate lender diversity using utility
   const lenderDiversity = calculateLenderDiversity(loans);

   const borrowerData = {
      username: username,
      memberSince: memberSince,
      stats: {
         totalLoans: loans.length,
         defaults: 0,
         totalBorrowed: loans.reduce((sum, loan) => (loan.loanStatus === 'Lent' ? sum + loan.loanAmount : sum), 0),
         totalRepaid: loans.reduce((sum, loan) => (loan.repaymentStatus === 'Paid' ? sum + loan.loanAmount : sum), 0),
         uniqueLenders: lenderDiversity.uniqueLenders,
         unlocking: uniqueLoans.length,
         building: TierLists.length
      },
      creditGrowth: {
         currentLimit: user.cs > 20 ? user.cs - 20 : user.cs,
         nextLimit: user.cs,
         currentDate: user.cs > 20 && user.updatedAt ? formatDate(user.updatedAt) : formatDate(user.createdAt)
      },
      lenderDiversity: lenderDiversity
   };

   return (
      <div className="min-h-screen bg-[#0B1120] text-white">
         <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 mb-8">
               <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Chiaroscuro_lighting_illuminates_a_Chibi-style_SVG_logo_a_gray_and_light_pink_hippo__joyfully_jumping__thumbs_up__holding_a_gold_Japanese_Mon_coin.__Hayao_Miyazaki_inspired__deep_teal_hues__warm_candl-uvt0ZI3fogcgqDR4Y2gCSRZfq8QmtX.png"
                  alt="Friendly hippo mascot"
                  className="w-24 h-24 md:w-32 md:h-32"
                  width={96}
                  height={96}
               />
               <div className="space-y-1 text-center md:text-left">
                  <h1 className="text-xl md:text-2xl font-semibold">Dashboard Summary</h1>
                  <p className="text-sm md:text-base text-gray-400">
                     {borrowerData.username} • Member since {borrowerData.memberSince}
                  </p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="bg-[#1F2937] rounded-xl p-6">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <div className="text-5xl font-bold mb-2">{borrowerData.stats.totalLoans}</div>
                        <div className="text-gray-400">Total Loans</div>
                     </div>
                     <TrendingUp className="text-blue-500 w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                     <div className="flex items-center gap-2">
                        <span className="text-green-400">{borrowerData.stats.unlocking} Credit Unlocking</span>
                        <div className="relative group">
                           <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                           <div className="absolute invisible group-hover:visible bg-[#111827] text-gray-100 p-3 rounded-lg text-sm w-64 bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 shadow-xl border border-gray-800">
                              <p className="mb-2">
                                 <span className="font-medium">Credit Unlocking Loans:</span> Loans that match exact credit tier amounts
                                 ($20, $40, etc.). These help increase your credit limit.
                              </p>
                           </div>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <span className="text-blue-400">{borrowerData.stats.building} Trust Building</span>
                        <div className="relative group">
                           <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                           <div className="absolute invisible group-hover:visible bg-[#111827] text-gray-100 p-3 rounded-lg text-sm w-64 bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 shadow-xl border border-gray-800">
                              <p>
                                 <span className="font-medium">Trust Building Loans:</span> Loans below the next credit tier amount. These
                                 don't affect credit limit but help build trust with lenders.
                              </p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="bg-[#1F2937] rounded-xl p-6">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <div className="text-5xl font-bold mb-2">{borrowerData.stats.defaults}</div>
                        <div className="text-gray-400">Defaults</div>
                     </div>
                     <XCircle className="text-red-500 w-6 h-6" />
                  </div>
                  <div className="text-green-400">Good Standing</div>
               </div>

               <div className="bg-[#1F2937] rounded-xl p-6">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <div className="text-5xl font-bold mb-2">${borrowerData.stats.totalBorrowed}</div>
                        <div className="text-gray-400">Total Borrowed</div>
                     </div>
                     <div className="text-emerald-500 text-2xl">$</div>
                  </div>
                  <div className="text-green-400">${borrowerData.stats.totalRepaid} Repaid</div>
               </div>

               <div className="bg-[#1F2937] rounded-xl p-6">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <div className="text-5xl font-bold mb-2">{borrowerData.stats.uniqueLenders}</div>
                        <div className="text-gray-400">Unique Lenders</div>
                     </div>
                     <Users className="text-purple-500 w-6 h-6" />
                  </div>
                  <div className={'text-' + getDiversityColor(borrowerData.lenderDiversity.score) + '-400'}>
                     {getDiversityStatus(borrowerData.lenderDiversity.score)} Diversity
                  </div>
               </div>
            </div>

            <div className="bg-[#1F2937] rounded-xl p-6">
               <h2 className="text-lg md:text-xl font-semibold mb-6">Credit Growth</h2>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
                  <div className="bg-gray-800 rounded-xl p-6 text-center">
                     <div className="text-gray-400 mb-4">Previous Credit Level</div>
                     <div className="inline-block bg-gray-700 rounded-full p-4 mb-4">
                        <div className="w-12 h-12 flex items-center justify-center">
                           <LevelBadge status="completed" />
                        </div>
                     </div>
                     <div className="text-4xl font-bold mb-2">${borrowerData.creditGrowth.currentLimit}</div>
                     <div className="text-gray-400">{borrowerData.creditGrowth.currentDate}</div>
                  </div>

                  <div className="bg-green-800/20 rounded-xl p-6 text-center border border-green-700">
                     <div className="text-green-400 mb-4">Current Credit Level</div>
                     <div className="inline-block bg-green-700/30 rounded-full p-4 mb-4">
                        <div className="w-12 h-12 flex items-center justify-center">
                           <LevelBadge status="current" />
                        </div>
                     </div>
                     <div className="text-4xl font-bold text-green-400 mb-2">${borrowerData.creditGrowth.nextLimit}</div>
                     <div className="text-green-400">Available to Borrow Now</div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex justify-between text-sm text-gray-400">
                     <span>Starting Credit Limit ($20)</span>
                     <span>Current Credit Limit (${borrowerData.creditGrowth.nextLimit})</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                     <div className={'h-full bg-blue-500 w-[' + parseInt(((user.cs * 100) / (user.cs + 20)).toString()) + '%]'} />
                  </div>
                  <div className="flex justify-between text-sm text-gray-400">
                     <span>Total Borrowed: ${borrowerData.stats.totalBorrowed}</span>
                     <span>{borrowerData.stats.totalLoans} Total Loans</span>
                  </div>
               </div>

               <CollapsibleSection
                  isOpen={showAllTiers}
                  onToggle={() => setShowAllTiers(!showAllTiers)}
                  buttonText={showAllTiers ? 'Hide Progress History' : 'View Progress History'}
               >
                     <div className="mt-6 space-y-4">
                        <h3 className="text-lg font-medium text-gray-100">Credit Growth Timeline</h3>
                        {uniqueLoans.map((tier: Loan) => (
                           <div
                              key={tier._id}
                              className={`p-4 rounded-lg ${
                                 tier.loanAmount === user.cs - 20 && tier.repaymentStatus === 'Paid'
                                    ? 'bg-green-900/20 border border-green-800'
                                    : tier.loanAmount === user.cs
                                      ? 'bg-blue-800/50 border border-blue-800'
                                      : 'bg-gray-800/50 border border-gray-800'
                              }`}
                           >
                              <div className="flex justify-between items-start">
                                 <div className="flex items-center gap-4">
                                    <LevelBadge
                                       status={
                                          tier.loanAmount === user.cs - 20 && tier.repaymentStatus === 'Paid'
                                             ? 'current'
                                             : tier.loanAmount === user.cs
                                               ? 'next'
                                               : 'completed'
                                       }
                                    />
                                    <div className="flex flex-col gap-1">
                                       <div className="flex items-center gap-2">
                                          <span
                                             className={`text-lg font-medium ${
                                                tier.loanAmount === user.cs - 20 && tier.repaymentStatus === 'Paid'
                                                   ? 'text-green-400'
                                                   : tier.loanAmount === user.cs
                                                     ? 'text-blue-100'
                                                     : 'text-gray-100'
                                             }`}
                                          >
                                             ${tier.loanAmount} Credit Limit
                                          </span>
                                          <span className="text-sm text-gray-400">{formatDate(tier.updatedAt)}</span>
                                       </div>
                                       <span className="text-xs text-gray-400">
                                          ${tier.loanAmount} loan repaid ${tier.repaymentAmount} unlocked ${tier.loanAmount + 20} limit
                                       </span>
                                    </div>
                                 </div>

                                 {TierList[tier.loanAmount]?.length > 0 ? (
                                    <div className="flex items-start gap-2">
                                       <div className="contents text-xs text-gray-400">Trust-Building Loans</div>
                                       <div className="relative group">
                                          <div className="flex items-center gap-1 cursor-help">
                                             <span className="text-gray-400">+</span>
                                             <div className="px-2 py-1 rounded-full bg-gray-700/40 border border-gray-600 text-sm text-gray-300">
                                                {TierList[tier.loanAmount]?.length}
                                             </div>
                                          </div>
                                          <div className="absolute invisible group-hover:visible bg-gray-700 text-gray-100 p-3 rounded-lg text-sm w-64 right-0 top-full mt-2 z-10 shadow-xl border border-gray-600">
                                             <div className="space-y-2">
                                                <p className="font-medium">Trust-Building Loans at ${tier.loanAmount} credit limit:</p>
                                                <ul className="list-disc pl-4 space-y-1">
                                                   {TierList[tier.loanAmount]?.map((loan: Loan) => (
                                                      <li key={loan._id}>
                                                         ${loan.loanAmount} loan - {formatDate(loan.updatedAt)}
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
                        ))}
                     </div>

                     <div className="mt-6 space-y-4">
                        <div className="p-4 rounded-lg bg-green-900/20 border border-green-800">
                           <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-green-500"></div>
                              <h3 className="font-medium text-green-400">Credit Unlocking Loans</h3>
                              <div className="relative group">
                                 <HelpCircle className="w-4 h-4 text-green-400 cursor-help" />
                                 <div className="absolute invisible group-hover:visible w-64 p-3 bg-[#1F2937] rounded-lg shadow-xl text-sm text-gray-100 -translate-x-1/2 left-1/2 bottom-full mb-2 z-10 border border-gray-700">
                                    <p>
                                       Loans that match exact credit tier amounts ($20, $40, etc.). Successfully repaying these loans
                                       unlocks the next credit tier.
                                    </p>
                                    <ul className="mt-2 list-disc pl-4 space-y-1 text-gray-400">
                                       <li>Must match exact tier amount</li>
                                       <li>Unlocks next credit level on repayment</li>
                                       <li>Shows strong borrowing responsibility</li>
                                    </ul>
                                 </div>
                              </div>
                           </div>
                           <p className="mt-2 text-sm text-green-400">Example: $20 loan unlocks $40 credit limit when repaid</p>
                        </div>

                        <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-800">
                           <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                              <h3 className="font-medium text-blue-400">Trust Building Loans</h3>
                              <div className="relative group">
                                 <HelpCircle className="w-4 h-4 text-blue-400 cursor-help" />
                                 <div className="absolute invisible group-hover:visible w-64 p-3 bg-[#1F2937] rounded-lg shadow-xl text-sm text-gray-100 -translate-x-1/2 left-1/2 bottom-full mb-2 z-10 border border-gray-700">
                                    <p>
                                       Smaller loans below your current credit tier. These help build trust with lenders but don't unlock
                                       higher credit limits.
                                    </p>
                                    <ul className="mt-2 list-disc pl-4 space-y-1 text-gray-400">
                                       <li>Must be at least $20</li>
                                       <li>Shows active platform usage</li>
                                       <li>Builds lender confidence</li>
                                       <li>Doesn't affect credit limit</li>
                                    </ul>
                                 </div>
                              </div>
                           </div>
                           <p className="mt-2 text-sm text-blue-400">Example: $20 loan while at $40 credit limit</p>
                        </div>
                     </div>
               </CollapsibleSection>
            </div>

            <div className="bg-[#1F2937] rounded-xl p-6">
               <h2 className="text-xl font-semibold mb-6">Borrower Insights</h2>

               <div className="space-y-4">
                  <div className="flex justify-between items-center">
                     <span className="text-gray-400">Avg days between loans:</span>
                     <div className="flex items-center gap-2">
                        <span className="text-yellow-400">{loans.length > 0 ? avgDays : '0'} days</span>
                        <div className="relative group">
                           <HelpCircle className="w-4 h-4 text-gray-500 cursor-help" />
                           <div className="absolute invisible group-hover:visible bg-gray-800 text-gray-100 p-2 rounded text-sm w-64 right-0 bottom-full mb-2 z-10">
                              The average number of days this borrower waits between taking out new loans.
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex justify-between items-center">
                     <span className="text-gray-400">Typical payment time:</span>
                     <div className="flex items-center gap-2">
                        <span className="text-yellow-400">{loans.length > 0 ? avgPaymentTime : '0'} day</span>
                        <div className="relative group">
                           <HelpCircle className="w-4 h-4 text-gray-500 cursor-help" />
                           <div className="absolute invisible group-hover:visible bg-gray-800 text-gray-100 p-2 rounded text-sm w-64 right-0 bottom-full mb-2 z-10">
                              The most common time it takes for this borrower to repay their loans after receiving them.
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex justify-between items-center">
                     <span className="text-gray-400">Usual loan size:</span>
                     <div className="flex items-center gap-2">
                        <span className="text-yellow-400">
                           ${loans.length > 0 ? Math.round(loans.reduce((sum, loan) => sum + loan.loanAmount, 0) / loans.length) : '0'}
                        </span>
                        <div className="relative group">
                           <HelpCircle className="w-4 h-4 text-gray-500 cursor-help" />
                           <div className="absolute invisible group-hover:visible bg-gray-800 text-gray-100 p-2 rounded text-sm w-64 right-0 bottom-full mb-2 z-10">
                              The amount this borrower most frequently requests for their loans. Currently at their maximum credit limit.
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex justify-between items-center">
                     <span className="text-gray-400">Typical loan term:</span>
                     <div className="flex items-center gap-2">
                        <span className="text-white">
                           {loans.length > 0 ? Math.round(loans.reduce((sum, loan) => sum + loan.days, 0) / loans.length) : '0'} days
                        </span>
                        <div className="absolute invisible group-hover:visible bg-gray-800 text-gray-100 p-2 rounded text-sm w64 right-0 bottom-full mb-2 z-10">
                           The most common duration this borrower requests for their loans. This reflects their consistent pattern of loan
                           term preferences rather than an average.
                        </div>
                     </div>
                  </div>

                  <div className="flex justify-between items-center">
                     <span className="text-gray-400">Repeat lenders:</span>
                     <div className="flex items-center gap-2">
                        <span className="text-red-400">
                           {Object.keys(countMap).length - Object.values(countMap).filter((count) => count === 1).length} of{' '}
                           {Object.keys(countMap).length}
                        </span>
                        <div className="relative group">
                           <HelpCircle className="w-4 h-4 text-gray-500 cursor-help" />
                           <div className="absolute invisible group-hover:visible bg-gray-800 text-gray-100 p-2 rounded text-sm w-64 right-0 bottom-full mb-2 z-10">
                              The number of lenders who have provided multiple loans to this borrower out of their total unique lenders.
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-[#1F2937] rounded-xl p-6">
               <div className="space-y-4">
                  <h2 className="text-xl font-semibold">Lender Diversity</h2>
                  <div className="flex items-center justify-between">
                     <div className="space-y-2">
                        <div className={'text-4xl font-bold text-' + getDiversityColor(borrowerData.lenderDiversity.score) + '-400'}>
                           {borrowerData.lenderDiversity.score} %
                        </div>
                        <div className="text-sm text-gray-400">Diversity Score</div>
                     </div>
                     <div
                        className={
                           'h-16 w-16 rounded-full bg-' +
                           getDiversityColor(borrowerData.lenderDiversity.score) +
                           '-900/20 border border-' +
                           getDiversityColor(borrowerData.lenderDiversity.score) +
                           '-800 flex items-center justify-center'
                        }
                     >
                        <Users className={'w-8 h-8 text-' + getDiversityColor(borrowerData.lenderDiversity.score) + '-500'} />
                     </div>
                  </div>

                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                     <div
                        className={
                           'h-full transition-all duration-500 bg-' + getDiversityColor(borrowerData.lenderDiversity.score) + '-500'
                        }
                        style={{ width: borrowerData.lenderDiversity.score + '%' }}
                     />
                  </div>

                  <button
                     onClick={() => setShowLenderNames(!showLenderNames)}
                     className="w-full px-4 py-2.5 text-sm font-medium text-blue-400 hover:bg-blue-900/20 border border-blue-800 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                     {showLenderNames ? 'Hide' : 'Show'} Lender Distribution
                     <ChevronDown className={`w-4 h-4 transform transition-transform ${showLenderNames ? 'rotate-180' : ''}`} />
                  </button>

                  {showLenderNames ? (
                     <div className="space-y-2 pt-2">
                        {borrowerData.lenderDiversity.distribution.map((lender) => (
                           <div key={lender.name} className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-800/50">
                              <span className="font-medium text-gray-100">{lender.name || 'Others'}</span>
                              <span className="text-gray-400">{lender.percent} of total loans</span>
                           </div>
                        ))}
                     </div>
                  ) : null}
               </div>
            </div>

            <div className="bg-[#1F2937] rounded-xl p-6">
               <h2 className="text-xl font-semibold mb-6">Recent Loans</h2>
               <div className="space-y-4">
                  {loans
                     .filter((loan) => loan.repaymentStatus === 'Paid')
                     .slice(0, 5)
                     .map((loan: Loan) => {
                        const unlock = uniqueLoans.some((item) => item._id === loan._id);
                        const build = TierLists.some((item) => item._id === loan._id);
                        return (
                           <div key={loan._id} className="bg-[#111827] rounded-lg p-4 space-y-3">
                              <div className="flex justify-between items-start">
                                 <div>
                                    <div className="flex items-center gap-2">
                                       <span className="text-lg font-semibold text-gray-100">${loan.loanAmount}</span>
                                       <span className="text-sm text-gray-400">→ ${loan.repayedAmount} repaid</span>
                                    </div>
                                    <div className="text-sm text-gray-400">{loan.createdAt.split('T')[0].replaceAll('-', '/')}</div>
                                 </div>
                                 <div className="flex flex-col items-end gap-2">
                                    <span className={`px-3 py-1 ${getNetworkColor(loan.block)} rounded-lg text-sm font-medium`}>
                                       {loan.block}
                                    </span>
                                    <span
                                       className={`text-sm font-medium ${loan.repaymentStatus !== 'Paid' ? 'text-blue-400' : 'text-emerald-400'}`}
                                    >
                                       {loan.repaymentStatus === 'Paid' ? 'Repaid' : 'Active'}
                                    </span>
                                 </div>
                              </div>
                              <div className="flex justify-between items-center">
                                 <span className="text-sm text-gray-400">{loan.lenderUser || 'Others'}</span>
                                 <span
                                    className={`text-sm font-medium px-2 py-1 rounded-lg ${
                                       unlock
                                          ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-800/40'
                                          : build && loan.lenderUser !== ''
                                            ? 'bg-blue-900/20 text-blue-400 border border-blue-800/40'
                                            : 'bg-gray-800 text-gray-400'
                                    }`}
                                 >
                                    {unlock
                                       ? 'Credit Unlocking Loan'
                                       : build && loan.lenderUser !== ''
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
               className="w-full px-4 py-2.5 text-sm font-medium text-blue-400 hover:bg-blue-900/20 border border-blue-800 rounded-lg transition-colors flex items-center justify-center gap-1"
            >
               {showDetailedHistory ? 'Hide' : 'Show'} All History
               <ChevronDown className={`w-4 h-4 transform transition-transform ${showDetailedHistory ? 'rotate-180' : ''}`} />
            </button>

            {showDetailedHistory ? (
               <div className="bg-[#1F2937] rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                     <thead>
                        <tr className="bg-[#111827]">
                           <th className="py-3 px-4 text-left font-medium text-gray-200">Date</th>
                           <th className="py-3 px-4 text-left font-medium text-gray-200">Amount</th>
                           <th className="py-3 px-4 text-left font-medium text-gray-200">Network</th>
                           <th className="py-3 px-4 text-left font-medium text-gray-200">Lender</th>
                           <th className="py-3 px-4 text-left font-medium text-gray-200">Status</th>
                           <th className="py-3 px-4 text-left font-medium text-gray-200">Type</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-700">
                        {uniqueLoans.map((loan: Loan) => {
                           return (
                              <tr key={loan._id} className="hover:bg-[#111827]">
                                 <td className="py-3 px-4 text-gray-300">{loan.createdAt.split('T')[0].replaceAll('-', '/')}</td>
                                 <td className="py-3 px-4 font-medium text-white">${loan.loanAmount}</td>
                                 <td className="py-3 px-4">
                                    <span className={`px-2.5 py-1 ${getNetworkColor(loan.block)} rounded-lg text-xs font-medium`}>
                                       {loan.block}
                                    </span>
                                 </td>
                                 <td className="py-3 px-4 text-gray-400">{loan.lenderUser || 'Others'}</td>
                                 <td className="py-3 px-4">
                                    <span
                                       className={`font-medium ${loan.repaymentStatus !== 'Paid' ? 'text-blue-400' : 'text-emerald-400'}`}
                                    >
                                       {loan.repaymentStatus === 'Paid' ? 'Repaid' : 'Active'}
                                    </span>
                                 </td>
                                 <td className="py-3 px-4">
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-900/20 text-emerald-400 border border-emerald-800/40">
                                       Credit Unlocking Loan
                                    </span>
                                 </td>
                              </tr>
                           );
                        })}
                        {TierLists.map((loan: Loan) => {
                           return (
                              <tr key={loan._id} className="hover:bg-[#111827]">
                                 <td className="py-3 px-4 text-gray-300">{loan.createdAt.split('T')[0].replaceAll('-', '/')}</td>
                                 <td className="py-3 px-4 font-medium text-white">${loan.loanAmount}</td>
                                 <td className="py-3 px-4">
                                    <span className={`px-2.5 py-1 ${getNetworkColor(loan.block)} rounded-lg text-xs font-medium`}>
                                       {loan.block}
                                    </span>
                                 </td>
                                 <td className="py-3 px-4 text-gray-400">{loan.lenderUser || 'Others'}</td>
                                 <td className="py-3 px-4">
                                    <span
                                       className={`font-medium ${loan.repaymentStatus !== 'Paid' ? 'text-blue-400' : 'text-emerald-400'}`}
                                    >
                                       {loan.repaymentStatus === 'Paid' ? 'Repaid' : 'Active'}
                                    </span>
                                 </td>
                                 <td className="py-3 px-4">
                                    <span
                                       className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                                          loan.lenderUser !== ''
                                             ? 'bg-blue-900/20 text-blue-400 border border-blue-800/40'
                                             : 'bg-gray-800 text-gray-400'
                                       }`}
                                    >
                                       {loan.lenderUser !== '' ? 'Trust Building Loan' : 'Regular Loan'}
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
      </div>
   );
};

export default UserProfile;
