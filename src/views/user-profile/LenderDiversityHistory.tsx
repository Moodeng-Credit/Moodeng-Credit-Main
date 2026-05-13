import { useEffect, useMemo, useState } from 'react';

import { ChevronLeft, HelpCircle, Moon, Sun, Users } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import Loading from '@/components/Loading';
import { PLACEHOLDER_AVATAR } from '@/components/UserAvatar';

import { formatNumber, toNumber } from '@/utils/decimalHelpers';
import { calculateLenderDiversity, getDiversityStatus, type WalletLivenessData } from '@/utils/diversityScore';

import { getWalletAgeInfo } from '@/lib/web3/walletAge';
import { fetchUserProfiles, getUserProfile } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { User } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';

import { DEMO_BORROWER_INSIGHTS_LOANS, DEMO_BORROWER_INSIGHTS_USER, DEMO_LENDER_PROFILES } from './demoBorrowerInsights';

const CHART_COLORS = ['#5b21b6', '#7c3aed', '#3b82f6', '#60a5fa', '#c4b5fd', '#a78bfa', '#93c5fd'];
const BORROWER_INSIGHTS_THEME_KEY = 'borrower-insights-theme';

type LenderDistributionDatum = {
   id: string;
   name: string;
   avatarUrl?: string;
   count: number;
   totalAmount: number;
   percentValue: number;
   color: string;
};

type PieLabelProps = {
   cx?: number;
   cy?: number;
   midAngle?: number;
   innerRadius?: number;
   outerRadius?: number;
   percent?: number;
};

const getDiversityBadgeClassName = (status: string) => {
   if (status === 'Excellent' || status === 'Good') return 'bg-md-green-100 text-md-green-900 border-[#bfe8cf]';
   if (status === 'Fair') return 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]';
   if (status === 'Low') return 'bg-orange-50 text-orange-500 border-orange-100';
   return 'bg-red-50 text-md-red-500 border-red-100';
};

const renderPieLabel = ({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }: PieLabelProps) => {
   if (percent < 0.08) return null;

   const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
   const radians = Math.PI / 180;
   const x = cx + radius * Math.cos(-midAngle * radians);
   const y = cy + radius * Math.sin(-midAngle * radians);
   const label = `${Math.round(percent * 100)}%`;

   return (
      <g style={{ pointerEvents: 'none' }}>
         <rect x={x - 18} y={y - 10} width={36} height={20} rx={10} fill="white" />
         <text x={x} y={y + 1} fill="#7c3aed" textAnchor="middle" dominantBaseline="central" style={{ fontSize: '11px', fontWeight: 700 }}>
            {label}
         </text>
      </g>
   );
};

const buildLenderDistribution = (loans: Loan[], userProfiles: Record<string, User>): LenderDistributionDatum[] => {
   const lenderMap = loans.reduce<Record<string, { id: string; name: string; avatarUrl?: string; count: number; totalAmount: number }>>(
      (acc, loan) => {
         const lenderId = loan.lenderUser || 'unknown';
         const profile = lenderId === 'unknown' ? undefined : userProfiles[lenderId];
         const lenderName = profile?.username || lenderId;

         if (!acc[lenderId]) {
            acc[lenderId] = {
               id: lenderId,
               name: lenderName === 'unknown' ? 'Unknown lender' : lenderName,
               avatarUrl: profile?.avatarUrl,
               count: 0,
               totalAmount: 0
            };
         }

         acc[lenderId].count += 1;
         acc[lenderId].totalAmount += toNumber(loan.loanAmount);
         return acc;
      },
      {}
   );

   return Object.values(lenderMap)
      .sort((a, b) => b.count - a.count || b.totalAmount - a.totalAmount)
      .map((lender, index) => ({
         ...lender,
         percentValue: Math.round((lender.count / loans.length) * 100),
         color: CHART_COLORS[index % CHART_COLORS.length]
      }));
};

export default function LenderDiversityHistory() {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const { username } = useParams();
   const [searchParams] = useSearchParams();
   const [profileUser, setProfileUser] = useState<User | null>(null);
   const [activeIndex, setActiveIndex] = useState<number | null>(null);
   const [walletData, setWalletData] = useState<Record<string, WalletLivenessData>>({});
   const [isDarkMode, setIsDarkMode] = useState(() => {
      if (typeof window === 'undefined') return false;
      return window.localStorage.getItem(BORROWER_INSIGHTS_THEME_KEY) === 'dark';
   });
   const isDemoInsights = searchParams.get('demo') === 'rich';

   const user = useSelector((state: RootState) => state.auth.user);
   const storedLoans = useSelector((state: RootState) => state.loans.loans.gloans);
   const storedUserProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const loans = isDemoInsights ? DEMO_BORROWER_INSIGHTS_LOANS : storedLoans;
   const userProfiles = isDemoInsights ? DEMO_LENDER_PROFILES : storedUserProfiles;
   const borrower = isDemoInsights ? DEMO_BORROWER_INSIGHTS_USER : (profileUser ?? user);

   useEffect(() => {
      window.scrollTo(0, 0);
   }, []);

   useEffect(() => {
      window.localStorage.setItem(BORROWER_INSIGHTS_THEME_KEY, isDarkMode ? 'dark' : 'light');
   }, [isDarkMode]);

   useEffect(() => {
      if (!username || isDemoInsights) return;

      const loadProfile = async () => {
         try {
            const { user: fetchedUser } = await dispatch(getUserProfile(username)).unwrap();
            setProfileUser(fetchedUser);
            const borrowerLoans = await dispatch(getUserLoans({ userId: fetchedUser.id })).unwrap();
            const lenderUserIds = [...new Set(borrowerLoans.map((loan) => loan.lenderUser).filter(Boolean))] as string[];
            if (lenderUserIds.length > 0) {
               dispatch(fetchUserProfiles(lenderUserIds)).catch(() => undefined);
            }
         } catch (error) {
            console.error('Error fetching lender diversity history:', (error as Error).message || error);
         }
      };

      loadProfile();
   }, [dispatch, isDemoInsights, username]);

   const fundedLoans = useMemo(() => loans.filter((loan) => loan.loanStatus === 'Lent'), [loans]);

   useEffect(() => {
      if (isDemoInsights) return;

      const lenderIds = [...new Set(fundedLoans.map((loan) => loan.lenderUser).filter(Boolean))] as string[];
      const lendersWithWallets = lenderIds
         .map((lenderId) => ({ lenderId, walletAddress: userProfiles[lenderId]?.walletAddress }))
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
   }, [fundedLoans, isDemoInsights, userProfiles]);

   const lenderDiversity = useMemo(
      () => calculateLenderDiversity(fundedLoans, userProfiles, Object.keys(walletData).length > 0 ? walletData : undefined),
      [fundedLoans, userProfiles, walletData]
   );
   const distribution = useMemo(() => buildLenderDistribution(fundedLoans, userProfiles), [fundedLoans, userProfiles]);
   const diversityStatus = getDiversityStatus(lenderDiversity.score);
   const borrowerName = borrower?.displayName || borrower?.username || username || 'Borrower';
   const hasEnoughLenderHistory = lenderDiversity.hasEnoughHistory;
   const isEarlyLenderDiversityScore = hasEnoughLenderHistory && lenderDiversity.confidence < 1;

   if (!borrower) return <Loading />;

   return (
      <div className={`lender-diversity-page min-h-screen bg-[#f7f3ff] transition-colors duration-200 ${isDarkMode ? 'lender-diversity-dark' : ''}`}>
         <style>{`
            .lender-diversity-dark {
               background: #0f1117;
               color: #eef2ff;
            }

            .lender-diversity-dark .bg-white {
               background-color: #171a23 !important;
            }

            .lender-diversity-dark .bg-\\[\\#f7f3ff\\],
            .lender-diversity-dark .bg-\\[\\#f5f3ff\\] {
               background-color: #202532 !important;
            }

            .lender-diversity-dark .text-md-primary-2000,
            .lender-diversity-dark .text-\\[\\#1f2937\\] {
               color: #eef2ff !important;
            }

            .lender-diversity-dark .text-md-neutral-1400,
            .lender-diversity-dark .text-md-neutral-1200,
            .lender-diversity-dark .text-\\[\\#6b7280\\] {
               color: #a8b0c3 !important;
            }

            .lender-diversity-dark .shadow-md-card,
            .lender-diversity-dark .shadow-\\[0_12px_32px_rgba\\(48\\,24\\,92\\,0\\.08\\)\\] {
               box-shadow: 0 16px 36px rgba(0, 0, 0, 0.24) !important;
            }

            .lender-diversity-dark .lender-diversity-hero {
               background: radial-gradient(circle at 82% 22%, rgba(139, 92, 246, 0.22), transparent 34%),
                  linear-gradient(135deg, #171a23 0%, #1d2230 100%) !important;
               border: 1px solid #3a2f58;
            }

            .lender-diversity-dark .lender-diversity-hero-glow {
               background: linear-gradient(135deg, rgba(139, 92, 246, 0.24), rgba(59, 130, 246, 0.08)) !important;
            }

            .lender-diversity-dark .lender-chart-card {
               background-color: #171a23 !important;
               border: 1px solid #2d3546;
            }

            .lender-diversity-dark .divide-md-neutral-300 > :not([hidden]) ~ :not([hidden]) {
               border-color: #2d3546 !important;
            }

            .lender-diversity-dark .recharts-label-list rect,
            .lender-diversity-dark .recharts-layer rect {
               fill: #202532 !important;
            }

            .lender-diversity-dark * {
               scrollbar-color: #4a5265 #151922;
            }

            .lender-diversity-dark *::-webkit-scrollbar {
               width: 8px;
            }

            .lender-diversity-dark *::-webkit-scrollbar-track {
               background: #151922;
            }

            .lender-diversity-dark *::-webkit-scrollbar-thumb {
               background: #4a5265;
               border-radius: 999px;
            }
         `}</style>
         <div className="mx-auto min-h-screen max-w-[440px] pb-10">
            <div className="flex items-center justify-between px-4 py-4">
               <div className="flex items-center gap-2">
                  <button
                     type="button"
                     onClick={() => navigate(-1)}
                     aria-label="Go back"
                     className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-md-primary-2000 shadow-md-card active:scale-95"
                  >
                     <ChevronLeft className="h-5 w-5" strokeWidth={2.3} />
                  </button>
                  <h1 className="text-[18px] font-semibold text-md-primary-2000">Lender Diversity</h1>
               </div>
               <div className="flex items-center gap-2">
                  <button
                     type="button"
                     onClick={() => setIsDarkMode((current) => !current)}
                     aria-label={isDarkMode ? 'Switch lender diversity to light mode' : 'Switch lender diversity to dark mode'}
                     aria-pressed={isDarkMode}
                     className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-md-primary-900 shadow-md-card active:scale-95"
                  >
                     {isDarkMode ? <Sun className="h-4 w-4 text-[#facc15]" strokeWidth={2.2} /> : <Moon className="h-4 w-4" strokeWidth={2.2} />}
                  </button>
                  <button
                     type="button"
                     onClick={() => navigate('/support')}
                     aria-label="Open help and support center"
                     className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eadfff] text-md-primary-900 active:scale-95"
                  >
                     <HelpCircle className="h-5 w-5" strokeWidth={2.2} />
                  </button>
               </div>
            </div>

            <section className="px-4 pb-4">
               <div className="lender-diversity-hero relative overflow-hidden rounded-[24px] bg-white p-5 shadow-[0_12px_32px_rgba(48,24,92,0.08)]">
                  <div className="lender-diversity-hero-glow absolute bottom-0 right-0 h-[176px] w-[176px] rounded-tl-[90px] bg-gradient-to-br from-[#f5f3ff] via-[#ede9fe] to-[#f8f5ff]" />
                  <div className="absolute right-8 top-10 text-[24px] font-bold leading-none text-[#a78bfa]">✦</div>
                  <div className="absolute bottom-8 right-3 text-[18px] font-bold leading-none text-[#c4b5fd]">✦</div>
                  <div className="relative z-10 flex items-start justify-between gap-2">
                     <div className="min-w-0 flex-1 pt-1 pr-1">
                        <p className="mb-1.5 text-[13px] font-semibold text-md-neutral-1400">Lender Diversity Score</p>
                        {hasEnoughLenderHistory ? (
                           <>
                              <div className="mb-3 flex items-end gap-2">
                                 <span className="text-[56px] font-bold leading-none text-md-primary-900">{lenderDiversity.score}</span>
                                 <span className="pb-2 text-[16px] font-medium text-md-neutral-1400">points</span>
                              </div>
                              <span
                                 className={`mb-3 inline-flex rounded-full border px-3 py-1.5 text-[12px] font-semibold ${getDiversityBadgeClassName(diversityStatus)}`}
                              >
                                 {isEarlyLenderDiversityScore ? 'Early Score' : `${diversityStatus} Diversity`}
                              </span>
                              {isEarlyLenderDiversityScore ? (
                                 <p className="mb-3 max-w-[210px] text-[13px] leading-5 text-md-neutral-1400">
                                    Early estimate: needs 8 funded loans before the score is fully weighted.
                                 </p>
                              ) : null}
                           </>
                        ) : (
                           <>
                              <p className="mb-3 mt-5 text-[28px] font-bold leading-tight text-md-primary-2000">Not enough history</p>
                              <span className="mb-3 inline-flex rounded-full border border-[#e3d4ff] bg-[#f5f3ff] px-3 py-1.5 text-[12px] font-semibold text-md-primary-900">
                                 Need at least 2 funded loans
                              </span>
                              <p className="mb-3 max-w-[190px] text-[13px] leading-5 text-md-neutral-1400">
                                 A lender diversity score appears once there is enough borrower history to compare.
                              </p>
                           </>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                           <Users className="h-4 w-4 text-md-blue-600" strokeWidth={2.4} />
                           <span className="text-[14px] font-semibold text-md-blue-600">
                              {lenderDiversity.uniqueLenders} Unique {lenderDiversity.uniqueLenders === 1 ? 'Lender' : 'Lenders'}
                           </span>
                        </div>
                     </div>
                     <img
                        src="/hippos/lender-diversity-piechart.png"
                        alt=""
                        className="-mr-3 mt-2 h-[160px] w-[150px] shrink-0 object-contain drop-shadow-xl"
                     />
                  </div>
               </div>
            </section>

            <section className="px-4 pb-6">
               <div className="mb-3">
                  <h2 className="text-[18px] font-semibold text-md-primary-2000">Lender Distribution</h2>
                  <p className="mt-1 text-[13px] leading-5 text-md-neutral-1400">
                     Shows how {borrowerName}&apos;s funded loan history is spread across lenders.
                  </p>
               </div>

               <div className="lender-chart-card rounded-[24px] bg-white px-4 pb-3 pt-4 shadow-[0_12px_32px_rgba(48,24,92,0.08)]">
                  {distribution.length > 0 ? (
                     <>
                        <div className="lender-diversity-chart relative mb-3 flex h-[288px] items-center justify-center">
                           <style>
                              {`
                                 .lender-diversity-chart .recharts-wrapper,
                                 .lender-diversity-chart .recharts-wrapper *,
                                 .lender-diversity-chart svg,
                                 .lender-diversity-chart svg * {
                                    outline: none !important;
                                    -webkit-tap-highlight-color: transparent;
                                    -webkit-touch-callout: none;
                                    user-select: none;
                                 }
                                 .lender-diversity-chart .recharts-sector:focus,
                                 .lender-diversity-chart .recharts-sector:active,
                                 .lender-diversity-chart .recharts-pie-sector:focus,
                                 .lender-diversity-chart .recharts-pie-sector:active {
                                    outline: none !important;
                                    filter: none !important;
                                 }
                              `}
                           </style>
                           <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                 <Pie
                                    data={distribution}
                                    cx="50%"
                                    cy="50%"
                                    dataKey="count"
                                    innerRadius={80}
                                    isAnimationActive={false}
                                    label={renderPieLabel}
                                    labelLine={false}
                                    outerRadius={128}
                                    paddingAngle={2}
                                    rootTabIndex={-1}
                                    onMouseEnter={(_, index) => setActiveIndex(index)}
                                    onMouseLeave={() => setActiveIndex(null)}
                                 >
                                    {distribution.map((lender, index) => (
                                       <Cell
                                          key={lender.id}
                                          fill={lender.color}
                                          focusable={false}
                                          opacity={activeIndex === null || activeIndex === index ? 1 : 0.32}
                                          style={{
                                             cursor: 'pointer',
                                             outline: 'none',
                                             WebkitTapHighlightColor: 'transparent',
                                             userSelect: 'none'
                                          }}
                                       />
                                    ))}
                                 </Pie>
                              </PieChart>
                           </ResponsiveContainer>
                           <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                              <div className="text-[40px] font-bold leading-none text-md-primary-2000">{lenderDiversity.uniqueLenders}</div>
                              <div className="mt-1 text-[14px] text-md-neutral-1400">
                                 {lenderDiversity.uniqueLenders === 1 ? 'lender' : 'lenders'}
                              </div>
                           </div>
                        </div>

                        <div className="divide-y divide-md-neutral-300">
                           {distribution.map((lender, index) => {
                              const isActive = activeIndex === index;
                              return (
                                 <button
                                    key={lender.id}
                                    type="button"
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onMouseLeave={() => setActiveIndex(null)}
                                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-all active:scale-[0.99]"
                                    style={{ backgroundColor: isActive ? `${lender.color}15` : 'transparent' }}
                                 >
                                    <span className="flex min-w-0 flex-1 items-center gap-3">
                                       <span className="relative shrink-0">
                                          <img
                                             src={lender.avatarUrl || PLACEHOLDER_AVATAR}
                                             alt=""
                                             className="h-10 w-10 rounded-full object-cover"
                                             style={{ boxShadow: isActive ? `0 0 0 2px ${lender.color}` : 'none' }}
                                          />
                                          <span
                                             className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 ${isDarkMode ? 'border-[#171a23]' : 'border-white'}`}
                                             style={{ backgroundColor: lender.color }}
                                          />
                                       </span>
                                       <span className="min-w-0">
                                          <span
                                             className="block truncate text-[14px] font-semibold"
                                             style={{ color: isActive ? lender.color : isDarkMode ? '#eef2ff' : '#1f2937' }}
                                          >
                                             {lender.name}
                                          </span>
                                          <span className="block text-[12px] text-md-neutral-1200">
                                             {lender.count} {lender.count === 1 ? 'loan' : 'loans'} · ${formatNumber(lender.totalAmount)}{' '}
                                             funded
                                          </span>
                                       </span>
                                    </span>
                                    <span
                                       className="shrink-0 rounded-full px-3 py-1 text-[12px] font-bold text-white"
                                       style={{ backgroundColor: lender.color }}
                                    >
                                       {lender.percentValue}%
                                    </span>
                                 </button>
                              );
                           })}
                        </div>
                     </>
                  ) : (
                     <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f3ff]">
                           <Users className="h-7 w-7 text-md-primary-900" strokeWidth={2.4} />
                        </div>
                        <p className="text-[17px] font-semibold text-md-primary-2000">No lender history yet</p>
                        <p className="mt-2 max-w-[280px] text-[14px] leading-5 text-md-neutral-1400">
                           Once this borrower receives funded loans, the lender distribution will appear here.
                        </p>
                     </div>
                  )}
               </div>
            </section>
         </div>
      </div>
   );
}
