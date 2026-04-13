import { useEffect, useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';

import BottomNav from '@/components/BottomNav';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TimePeriod = '1D' | '3D' | '5D' | '1W' | '1M' | '3M' | '6M' | '1Y';

const TIME_PERIODS: TimePeriod[] = ['1D', '3D', '5D', '1W', '1M', '3M', '6M', '1Y'];

const PERIOD_DAYS: Record<TimePeriod, number> = {
   '1D': 1,
   '3D': 3,
   '5D': 5,
   '1W': 7,
   '1M': 30,
   '3M': 90,
   '6M': 180,
   '1Y': 365,
};

interface ChartPoint {
   label: string;
   lent: number;
   loss: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLACEHOLDER_AVATAR =
   'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Chiaroscuro_lighting_illuminates_a_Chibi-style_SVG_logo_a_gray_and_light_pink_hippo__joyfully_jumping__thumbs_up__holding_a_gold_Japanese_Mon_coin.__Hayao_Miyazaki_inspired__deep_teal_hues__warm_candl-uvt0ZI3fogcgqDR4Y2gCSRZfq8QmtX.png';

function getLoanDisplayStatus(loan: Loan): 'REPAID' | 'ACTIVE' | 'DEFAULT' | 'PENDING' {
   if (loan.repaymentStatus === 'Paid') return 'REPAID';
   if (loan.loanStatus === 'Requested') return 'PENDING';
   if (new Date(loan.dueDate) < new Date()) return 'DEFAULT';
   return 'ACTIVE';
}

function formatCurrency(amount: number): string {
   return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
   }).format(amount);
}

function formatMemberSince(dateStr: string | null | undefined): string {
   if (!dateStr) return '—';
   const date = new Date(dateStr);
   const formatted = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
   const daysDiff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
   return `${formatted} (${daysDiff} days)`;
}

function formatYAxis(value: number): string {
   if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
   return `$${value}`;
}

function buildChartData(loans: Loan[], period: TimePeriod): ChartPoint[] {
   const now = new Date();
   const days = PERIOD_DAYS[period];
   const ms = days * 24 * 60 * 60 * 1000;
   const startTime = now.getTime() - ms;
   const bucketCount = 8;
   const bucketMs = ms / bucketCount;

   // Only loans funded within the selected window
   const windowLoans = loans.filter((l) => {
      const d = new Date(l.fundedAt ?? l.updatedAt ?? l.createdAt).getTime();
      return d >= startTime;
   });

   return Array.from({ length: bucketCount }, (_, i) => {
      const bucketEnd = startTime + (i + 1) * bucketMs;
      const date = new Date(bucketEnd);

      // Cumulative: all window loans funded UP TO this bucket end
      const cumulative = windowLoans.filter((l) => {
         const d = new Date(l.fundedAt ?? l.updatedAt ?? l.createdAt).getTime();
         return d <= bucketEnd;
      });

      // Purple line: cumulative principal lent out
      const lent = cumulative.reduce((sum, l) => sum + l.loanAmount, 0);

      // Red line: cumulative losses — loans past due date with unpaid balance
      const loss = cumulative
         .filter((l) => getLoanDisplayStatus(l) === 'DEFAULT')
         .reduce((sum, l) => sum + Math.max(0, l.loanAmount - (l.repaidAmount ?? 0)), 0);

      let label: string;
      if (days <= 1) {
         label = date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      } else if (days <= 90) {
         label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
         label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }

      return { label, lent, loss };
   });
}

function computeStats(loans: Loan[]) {
   const now = new Date();
   const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
   const thirtyDaysAgo = new Date(now.getTime() - thirtyDaysMs);
   const sixtyDaysAgo = new Date(now.getTime() - 2 * thirtyDaysMs);

   // Total Earnings = all repayments actually received across all loans
   const total = loans.reduce((sum, l) => sum + (l.repaidAmount ?? 0), 0);

   // Badge: current 30-day window vs previous 30-day window
   const current30 = loans
      .filter((l) => new Date(l.updatedAt ?? l.createdAt) >= thirtyDaysAgo)
      .reduce((sum, l) => sum + (l.repaidAmount ?? 0), 0);

   const prev30 = loans
      .filter((l) => {
         const d = new Date(l.updatedAt ?? l.createdAt);
         return d >= sixtyDaysAgo && d < thirtyDaysAgo;
      })
      .reduce((sum, l) => sum + (l.repaidAmount ?? 0), 0);

   const changePercent = prev30 > 0 ? ((current30 - prev30) / prev30) * 100 : 0;

   // Total Lent = total principal put out
   const totalLent = loans.reduce((sum, l) => sum + l.loanAmount, 0);

   // Total Loss = unpaid balance on loans that have passed their due date
   const totalLoss = loans
      .filter((l) => getLoanDisplayStatus(l) === 'DEFAULT')
      .reduce((sum, l) => sum + Math.max(0, l.loanAmount - (l.repaidAmount ?? 0)), 0);

   return { total, changePercent, totalLent, totalLoss };
}

// ---------------------------------------------------------------------------
// Trend badge
// ---------------------------------------------------------------------------

function TrendBadge({ changePercent }: { changePercent: number }) {
   const isPositive = changePercent >= 0;
   return (
      <div className="flex items-center gap-1 flex-1 min-w-0">
         <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md-pill shrink-0 ${
               isPositive ? 'bg-[rgba(31,193,107,0.1)]' : 'bg-[rgba(182,4,19,0.1)]'
            }`}
         >
            {/* Up / down triangle */}
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
               {isPositive ? (
                  <path d="M4.5 1L8.5 7.5H0.5L4.5 1Z" fill="#1aa45b" />
               ) : (
                  <path d="M4.5 8L0.5 1.5H8.5L4.5 8Z" fill="#b60413" />
               )}
            </svg>
            <span className={`text-md-b3 font-medium whitespace-nowrap ${isPositive ? 'text-md-green-700' : 'text-md-red-800'}`}>
               {Math.abs(changePercent).toFixed(1)}% {isPositive ? 'higher' : 'lower'}
            </span>
         </span>
         <span className="text-md-b3 font-normal text-md-neutral-1200 truncate">vs. previous period</span>
      </div>
   );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LenderPerformance() {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const gloans = useSelector((state: RootState) => state.loans.loans.gloans);

   const [activePeriod, setActivePeriod] = useState<TimePeriod>('3D');

   // IOU points
   const { data: userPointsData } = useQuery({
      queryKey: ['user-points', user?.id],
      queryFn: async () => {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase
            .from('user_points')
            .select('points_total')
            .eq('user_id', user!.id)
            .single();
         if (error) throw error;
         return data;
      },
      enabled: !!user?.id,
   });

   const iouPoints = userPointsData?.points_total ?? 0;

   // Load lender loans
   useEffect(() => {
      if (!user?.id) return;
      dispatch(getUserLoans({ userId: user.id })).catch((err: Error) =>
         console.error('Error loading performance data:', err.message)
      );
   }, [dispatch, user?.id]);

   const lenderLoans = useMemo(() => gloans.filter((l) => l.lenderUser === user?.id), [gloans, user?.id]);
   const hasData = lenderLoans.length > 0;

   const { total, changePercent, totalLent, totalLoss } = useMemo(
      () => computeStats(lenderLoans),
      [lenderLoans]
   );

   const chartData = useMemo(() => buildChartData(lenderLoans, activePeriod), [lenderLoans, activePeriod]);

   const firstName = user?.username?.split(' ')[0] || 'there';
   const memberSince = formatMemberSince(user?.createdAt);

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28">

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-md-5 py-md-3">
               <div className="flex flex-1 items-center gap-4">
                  <button
                     onClick={() => navigate(-1)}
                     className="shrink-0 w-6 h-6 flex items-center justify-center"
                     aria-label="Go back"
                  >
                     <ChevronLeft className="w-6 h-6 text-md-primary-2000" strokeWidth={2} />
                  </button>
                  <h1 className="text-md-h3 font-semibold text-md-primary-2000">Performance Insights</h1>
               </div>
               <button
                  className="shrink-0 w-12 h-12 bg-white rounded-full shadow-md-card flex items-center justify-center"
                  aria-label="Help"
               >
                  <HelpCircle className="w-6 h-6 text-md-primary-900" strokeWidth={1.5} />
               </button>
            </div>

            {/* ── Gradient card: profile + overview ── */}
            <div className="bg-gradient-to-b from-white to-[#eee6fa] rounded-b-[32px] shadow-md-card px-md-4 pt-md-3 pb-md-5 flex flex-col gap-md-3">

               {/* Profile row */}
               <div className="flex items-start gap-3">
                  <img
                     src={user?.avatarUrl ?? PLACEHOLDER_AVATAR}
                     alt="Profile"
                     className="w-[70px] h-[70px] rounded-full object-cover shrink-0"
                     onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_AVATAR;
                     }}
                  />
                  <div className="flex flex-col gap-1 justify-center pt-1">
                     <p className="text-[18px] tracking-[-0.04em] leading-[1.2] font-semibold text-md-primary-2000">
                        Hello, {firstName}
                     </p>
                     <span className="inline-flex items-center self-start px-2 py-1 bg-md-primary-900 rounded-md-sm">
                        <span className="text-md-b3 font-semibold capitalize text-md-neutral-100 whitespace-nowrap">
                           IOU {iouPoints.toLocaleString()}
                        </span>
                     </span>
                     <p className="text-md-b3 font-normal text-md-neutral-1400">Member since {memberSince}</p>
                  </div>
               </div>

               {/* Overview section */}
               <div className="flex flex-col gap-md-3">
                  <p className="text-md-h5 font-semibold text-md-heading">Overview</p>

                  {/* Main card */}
                  <div className="bg-md-neutral-100 rounded-md-lg p-md-3 shadow-md-card flex flex-col gap-md-3">

                     {/* Total Earnings */}
                     <div className="flex flex-col gap-1">
                        <span className="text-md-b2 font-medium text-md-neutral-1500">Total Earnings</span>
                        <div className="flex items-center gap-md-1 flex-wrap">
                           <span className="text-md-h3 font-semibold text-md-neutral-2000">
                              {hasData ? formatCurrency(total) : '$0.00'}
                           </span>
                           {hasData && changePercent !== 0 && (
                              <TrendBadge changePercent={changePercent} />
                           )}
                        </div>
                     </div>

                     {/* Time filter tabs */}
                     <div className="flex items-center gap-1.5 flex-wrap">
                        {TIME_PERIODS.map((p) => {
                           const isActive = p === activePeriod;
                           return (
                              <button
                                 key={p}
                                 onClick={() => setActivePeriod(p)}
                                 className={`px-3 py-1.5 rounded-md-pill text-md-b3 font-semibold transition-colors ${
                                    isActive
                                       ? 'bg-md-primary-900 text-md-neutral-100'
                                       : 'bg-md-neutral-100 border border-[#9285a0] text-md-heading opacity-40'
                                 }`}
                              >
                                 {p}
                              </button>
                           );
                        })}
                     </div>

                     {/* Chart or empty state */}
                     {hasData ? (
                        <div className="w-full h-[202px]">
                           <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                 <defs>
                                    <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor="#8336f0" stopOpacity={0.5} />
                                       <stop offset="95%" stopColor="#8336f0" stopOpacity={0.05} />
                                    </linearGradient>
                                    <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor="#b60413" stopOpacity={0.25} />
                                       <stop offset="95%" stopColor="#b60413" stopOpacity={0.0} />
                                    </linearGradient>
                                 </defs>
                                 <XAxis dataKey="label" hide />
                                 <YAxis
                                    tickFormatter={formatYAxis}
                                    domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2) || 10]}
                                    tick={{ fontSize: 10, fill: '#a99fb4', fontFamily: 'SF Pro Display, sans-serif' }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={36}
                                    tickCount={6}
                                 />
                                 <Area
                                    type="monotone"
                                    dataKey="lent"
                                    stroke="#8336f0"
                                    strokeWidth={2}
                                    fill="url(#earningsGradient)"
                                    dot={false}
                                    activeDot={{ r: 4, fill: '#8336f0', strokeWidth: 0 }}
                                 />
                                 <Area
                                    type="monotone"
                                    dataKey="loss"
                                    stroke="#b60413"
                                    strokeWidth={1.5}
                                    fill="url(#lossGradient)"
                                    dot={false}
                                    activeDot={{ r: 4, fill: '#b60413', strokeWidth: 0 }}
                                 />
                              </AreaChart>
                           </ResponsiveContainer>
                        </div>
                     ) : (
                        <div className="flex flex-col items-center justify-center gap-md-3 h-[202px] px-md-5">
                           <p className="text-md-h5 font-semibold text-md-heading text-center">No transactions yet</p>
                           <p className="text-md-b2 font-medium text-md-neutral-1000 text-center">
                              Your transactions will appear here once you start lending.
                           </p>
                           <Link
                              to="/request-board"
                              className="flex items-center justify-center gap-2 bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold px-md-4 py-md-3 rounded-md-lg"
                           >
                              Go to Request Board
                              <ChevronRight className="w-6 h-6 shrink-0" strokeWidth={2} />
                           </Link>
                        </div>
                     )}

                     {/* Bottom stats: Total Lent | Total Loss */}
                     <div className="flex items-center gap-12">
                        <div className="flex-1 flex flex-col gap-1 items-center">
                           <div className="flex items-center gap-1">
                              <span className="text-md-b2 font-medium text-md-neutral-1500">Total Lent</span>
                              <HelpCircle className="w-4 h-4 text-md-neutral-1000 shrink-0" strokeWidth={1.5} />
                           </div>
                           <span className="text-md-h4 font-semibold text-md-neutral-2000">
                              {hasData ? formatCurrency(totalLent) : 'N/A'}
                           </span>
                        </div>
                        <div className="flex-1 flex flex-col gap-1 items-center">
                           <div className="flex items-center gap-1">
                              <span className="text-md-b2 font-medium text-md-neutral-1500">Total Loss</span>
                              <HelpCircle className="w-4 h-4 text-md-neutral-1000 shrink-0" strokeWidth={1.5} />
                           </div>
                           <span
                              className={`text-md-h4 font-semibold ${
                                 !hasData || totalLoss > 0 ? 'text-md-red-800' : 'text-md-neutral-2000'
                              }`}
                           >
                              {hasData ? (totalLoss > 0 ? `-${formatCurrency(totalLoss)}` : formatCurrency(0)) : 'N/A'}
                           </span>
                        </div>
                     </div>

                  </div>
               </div>
            </div>

         </div>

         <BottomNav />
      </div>
   );
}
