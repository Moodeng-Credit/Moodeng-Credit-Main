import { useEffect, useMemo, useState } from 'react';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { ChevronLeft, HelpCircle, Users } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import Loading from '@/components/Loading';
import { PLACEHOLDER_AVATAR } from '@/components/UserAvatar';

import { fetchUserProfiles, getUserProfile } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { User } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';
import { formatNumber, toNumber } from '@/utils/decimalHelpers';
import { calculateLenderDiversity, getDiversityStatus } from '@/utils/diversityScore';
import { DEMO_BORROWER_INSIGHTS_LOANS, DEMO_BORROWER_INSIGHTS_USER, DEMO_LENDER_PROFILES } from './demoBorrowerInsights';

const CHART_COLORS = ['#5b21b6', '#7c3aed', '#3b82f6', '#60a5fa', '#c4b5fd', '#a78bfa', '#93c5fd'];

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
         <text
            x={x}
            y={y + 1}
            fill="#7c3aed"
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontSize: '11px', fontWeight: 700 }}
         >
            {label}
         </text>
      </g>
   );
};

const buildLenderDistribution = (loans: Loan[], userProfiles: Record<string, User>): LenderDistributionDatum[] => {
   const lenderMap = loans.reduce<
      Record<string, { id: string; name: string; avatarUrl?: string; count: number; totalAmount: number }>
   >((acc, loan) => {
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
   }, {});

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
   const lenderDiversity = useMemo(() => calculateLenderDiversity(fundedLoans, userProfiles), [fundedLoans, userProfiles]);
   const distribution = useMemo(() => buildLenderDistribution(fundedLoans, userProfiles), [fundedLoans, userProfiles]);
   const diversityStatus = getDiversityStatus(lenderDiversity.score);
   const borrowerName = borrower?.displayName || borrower?.username || username || 'Borrower';
   const hasLenderHistory = fundedLoans.length > 0;

   if (!borrower) return <Loading />;

   return (
      <div className="min-h-screen bg-[#f7f3ff]">
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
               <button
                  type="button"
                  onClick={() => navigate('/support')}
                  aria-label="Open help and support center"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eadfff] text-md-primary-900 active:scale-95"
               >
                  <HelpCircle className="h-5 w-5" strokeWidth={2.2} />
               </button>
            </div>

            <section className="px-4 pb-4">
               <div className="relative overflow-hidden rounded-[24px] bg-white p-5 shadow-[0_12px_32px_rgba(48,24,92,0.08)]">
                  <div className="absolute bottom-0 right-0 h-[176px] w-[176px] rounded-tl-[90px] bg-gradient-to-br from-[#f5f3ff] via-[#ede9fe] to-[#f8f5ff]" />
                  <div className="absolute right-8 top-10 text-[24px] font-bold leading-none text-[#a78bfa]">✦</div>
                  <div className="absolute bottom-8 right-3 text-[18px] font-bold leading-none text-[#c4b5fd]">✦</div>
                  <div className="relative z-10 flex items-start justify-between gap-2">
                     <div className="min-w-0 flex-1 pt-1 pr-1">
                        <p className="mb-1.5 text-[13px] font-semibold text-md-neutral-1400">Lender Diversity Score</p>
                        {hasLenderHistory ? (
                           <>
                              <div className="mb-3 flex items-end gap-2">
                                 <span className="text-[56px] font-bold leading-none text-md-primary-900">{lenderDiversity.score}</span>
                                 <span className="pb-2 text-[16px] font-medium text-md-neutral-1400">points</span>
                              </div>
                              <span
                                 className={`mb-3 inline-flex rounded-full border px-3 py-1.5 text-[12px] font-semibold ${getDiversityBadgeClassName(diversityStatus)}`}
                              >
                                 {diversityStatus} Diversity
                              </span>
                           </>
                        ) : (
                           <>
                              <p className="mb-3 mt-5 text-[28px] font-bold leading-tight text-md-primary-2000">No score yet</p>
                              <span className="mb-3 inline-flex rounded-full border border-[#e3d4ff] bg-[#f5f3ff] px-3 py-1.5 text-[12px] font-semibold text-md-primary-900">
                                 Not enough history yet
                              </span>
                              <p className="mb-3 max-w-[190px] text-[13px] leading-5 text-md-neutral-1400">
                                 This becomes useful after the borrower receives funded loans.
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

               <div className="rounded-[24px] bg-white px-4 pb-3 pt-4 shadow-[0_12px_32px_rgba(48,24,92,0.08)]">
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
                                             className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white"
                                             style={{ backgroundColor: lender.color }}
                                          />
                                       </span>
                                       <span className="min-w-0">
                                          <span
                                             className="block truncate text-[14px] font-semibold"
                                             style={{ color: isActive ? lender.color : '#1f2937' }}
                                          >
                                             {lender.name}
                                          </span>
                                          <span className="block text-[12px] text-md-neutral-1200">
                                             {lender.count} {lender.count === 1 ? 'loan' : 'loans'} · ${formatNumber(lender.totalAmount)} funded
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
