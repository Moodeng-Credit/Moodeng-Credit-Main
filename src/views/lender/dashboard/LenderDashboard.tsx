import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Check, CheckCircle, ChevronLeft, ChevronRight, HelpCircle, Search, X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';

import { useClickOutside } from '@/hooks/useClickOutside';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { fetchUserProfiles } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortBy = 'low-to-high' | 'high-to-low' | '';
type StatusFilter = 'new-to-old' | 'old-to-new' | 'pending' | 'active' | 'default' | '';
type LoanDisplayStatus = 'REPAID' | 'ACTIVE' | 'DEFAULT' | 'PENDING';

interface FilterState {
   sortBy: SortBy;
   status: StatusFilter;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLACEHOLDER_AVATAR =
   'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Chiaroscuro_lighting_illuminates_a_Chibi-style_SVG_logo_a_gray_and_light_pink_hippo__joyfully_jumping__thumbs_up__holding_a_gold_Japanese_Mon_coin.__Hayao_Miyazaki_inspired__deep_teal_hues__warm_candl-uvt0ZI3fogcgqDR4Y2gCSRZfq8QmtX.png';

function getLoanDisplayStatus(loan: Loan): LoanDisplayStatus {
   if (loan.repaymentStatus === 'Paid') return 'REPAID';
   if (loan.loanStatus === 'Requested') return 'PENDING';
   const dueDate = new Date(loan.dueDate);
   if (dueDate < new Date()) return 'DEFAULT';
   return 'ACTIVE';
}

function formatCurrency(amount: number): string {
   return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
   }).format(amount);
}

function formatDateShort(dateStr: string): string {
   return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
   });
}

function formatMemberSince(dateStr: string | null | undefined): string {
   if (!dateStr) return '—';
   return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function computeEarningsChange(loans: Loan[]): { total: number; changePercent: number } {
   const now = new Date();
   const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
   const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

   const repaidLoans = loans.filter((l) => l.repaymentStatus === 'Paid');
   const total = repaidLoans.reduce((sum, l) => sum + l.totalRepaymentAmount, 0);

   const currentPeriod = repaidLoans
      .filter((l) => new Date(l.updatedAt ?? l.createdAt) >= thirtyDaysAgo)
      .reduce((sum, l) => sum + l.totalRepaymentAmount, 0);

   const previousPeriod = repaidLoans
      .filter((l) => {
         const d = new Date(l.updatedAt ?? l.createdAt);
         return d >= sixtyDaysAgo && d < thirtyDaysAgo;
      })
      .reduce((sum, l) => sum + l.totalRepaymentAmount, 0);

   const changePercent = previousPeriod > 0 ? ((currentPeriod - previousPeriod) / previousPeriod) * 100 : 0;
   return { total, changePercent };
}

// ---------------------------------------------------------------------------
// Status chip — pill style matching Figma (checkmark/alert icon + label)
// ---------------------------------------------------------------------------

function StatusChip({ status }: { status: LoanDisplayStatus }) {
   if (status === 'REPAID') {
      return (
         <span className="inline-flex items-center gap-1 px-3 py-[5px] rounded-[30px] border border-md-green-700">
            <CheckCircle className="w-3.5 h-3.5 text-md-green-700 shrink-0" strokeWidth={2.5} />
            <span className="text-md-b4 font-semibold text-md-green-700 uppercase tracking-wide">REPAID</span>
         </span>
      );
   }
   if (status === 'ACTIVE') {
      return (
         <span className="inline-flex items-center gap-1 px-3 py-[5px] rounded-[30px] border border-md-blue-500">
            <AlertCircle className="w-3.5 h-3.5 text-md-blue-500 shrink-0" strokeWidth={2.5} />
            <span className="text-md-b4 font-semibold text-md-blue-500 uppercase tracking-wide">ACTIVE</span>
         </span>
      );
   }
   if (status === 'DEFAULT') {
      return (
         <span className="inline-flex items-center gap-1 px-3 py-[5px] rounded-[30px] border border-md-red-500">
            <AlertCircle className="w-3.5 h-3.5 text-md-red-500 shrink-0" strokeWidth={2.5} />
            <span className="text-md-b4 font-semibold text-md-red-500 uppercase tracking-wide">DEFAULT</span>
         </span>
      );
   }
   // PENDING
   return (
      <span className="inline-flex items-center gap-1 px-3 py-[5px] rounded-[30px] border border-[#e65100]">
         <span className="w-3.5 h-3.5 rounded-full border-[1.5px] border-[#e65100] flex items-center justify-center shrink-0">
            <span className="text-[8px] font-bold text-[#e65100] leading-none">!</span>
         </span>
         <span className="text-md-b4 font-semibold text-[#e65100] uppercase tracking-wide">PENDING</span>
      </span>
   );
}

// ---------------------------------------------------------------------------
// Stat card — label on top, value beneath
// ---------------------------------------------------------------------------

interface StatCardProps {
   label: string;
   value: string;
   valueSize?: 'h3' | 'h4';
   valueClassName?: string;
   showHelp?: boolean;
   rightSlot?: React.ReactNode;
   children?: React.ReactNode;
}

function StatCard({ label, value, valueSize = 'h3', valueClassName = 'text-md-heading', showHelp = true, rightSlot, children }: StatCardProps) {
   const valueCls = valueSize === 'h4' ? 'text-md-h4' : 'text-md-h3';
   return (
      <div className="bg-md-neutral-100 rounded-md-lg p-4 shadow-md-card flex flex-col gap-1">
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
               <span className="text-md-b2 font-medium text-md-neutral-1500">{label}</span>
               {showHelp && <HelpCircle className="w-4 h-4 text-md-primary-900 shrink-0" strokeWidth={1.5} />}
            </div>
            {rightSlot}
         </div>
         <p className={`${valueCls} font-semibold ${valueClassName}`}>{value}</p>
         {children}
      </div>
   );
}

// ---------------------------------------------------------------------------
// Transaction row — avatar + title (16px) + meta + amount + status chip
// ---------------------------------------------------------------------------

interface TransactionRowProps {
   loan: Loan;
   borrowerAvatar?: string;
   borrowerName: string;
}

function TransactionRow({ loan, borrowerAvatar, borrowerName }: TransactionRowProps) {
   const status = getLoanDisplayStatus(loan);
   return (
      <div className="bg-md-neutral-100 rounded-md-lg px-4 py-3 flex items-center gap-3 shadow-md-card">
         {/* Borrower avatar */}
         <img
            src={borrowerAvatar ?? PLACEHOLDER_AVATAR}
            alt={borrowerName}
            className="w-10 h-10 rounded-full object-cover shrink-0"
         />

         {/* Loan info */}
         <div className="flex-1 min-w-0 flex flex-col gap-1">
            <p className="text-md-b1 font-semibold text-md-heading truncate">{loan.reason || 'Loan'}</p>
            <div className="flex items-center gap-1.5">
               <span className="text-md-b3 text-md-neutral-1200 truncate max-w-[100px]">{borrowerName}</span>
               <span className="w-1 h-1 rounded-full bg-md-neutral-600 shrink-0" />
               <span className="text-md-b3 text-md-neutral-1200 shrink-0">{formatDateShort(loan.createdAt)}</span>
            </div>
         </div>

         {/* Amount + status */}
         <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-md-b1 font-semibold text-md-heading">{formatCurrency(loan.loanAmount)}</span>
            <StatusChip status={status} />
         </div>
      </div>
   );
}

// ---------------------------------------------------------------------------
// Filter dropdown — no radio dots, colour-only selection
// ---------------------------------------------------------------------------

interface FilterDropdownProps {
   isOpen: boolean;
   onClose: () => void;
   filters: FilterState;
   onApply: (filters: FilterState) => void;
   dropdownRef: React.RefObject<HTMLDivElement>;
   openUpward: boolean;
}

function FilterDropdown({ isOpen, onClose, filters, onApply, dropdownRef, openUpward }: FilterDropdownProps) {
   const [draft, setDraft] = useState<FilterState>(filters);

   useEffect(() => {
      if (isOpen) setDraft(filters);
   }, [isOpen, filters]);

   if (!isOpen) return null;

   const sortOptions: { value: SortBy; label: string }[] = [
      { value: 'low-to-high', label: 'Low to High' },
      { value: 'high-to-low', label: 'High to Low' }
   ];

   const statusOptions: { value: StatusFilter; label: string }[] = [
      { value: 'new-to-old', label: 'New to Old' },
      { value: 'old-to-new', label: 'Old to New' },
      { value: 'pending', label: 'Pending' },
      { value: 'active', label: 'Active' },
      { value: 'default', label: 'Default' }
   ];

   const positionClass = openUpward ? 'bottom-full mb-2' : 'top-full mt-2';

   return (
      <div
         ref={dropdownRef}
         className={`absolute right-0 z-50 w-[200px] bg-md-neutral-100 rounded-md-xl shadow-[0_8px_32px_rgba(0,0,0,0.14)] border border-md-neutral-300 overflow-hidden ${positionClass}`}
      >
         {/* Sort By */}
         <div className="px-4 pt-4 pb-2">
            <p className="text-md-b3 font-bold text-md-neutral-2000 mb-2 uppercase tracking-wide">Sort By</p>
            {sortOptions.map((opt) => (
               <button
                  key={opt.value}
                  onClick={() => setDraft((d) => ({ ...d, sortBy: d.sortBy === opt.value ? '' : opt.value }))}
                  className={`w-full text-left px-3 py-2 rounded-md-md text-md-b2 transition-colors ${
                     draft.sortBy === opt.value
                        ? 'bg-md-primary-100 text-md-primary-1200 font-semibold'
                        : 'text-md-neutral-1400 font-medium hover:bg-md-neutral-200'
                  }`}
               >
                  {opt.label}
               </button>
            ))}
         </div>

         <div className="h-px bg-md-neutral-300 mx-4" />

         {/* Status */}
         <div className="px-4 pt-3 pb-3">
            <p className="text-md-b3 font-bold text-md-neutral-2000 mb-2 uppercase tracking-wide">Status</p>
            {statusOptions.map((opt) => (
               <button
                  key={opt.value}
                  onClick={() => setDraft((d) => ({ ...d, status: d.status === opt.value ? '' : opt.value }))}
                  className={`w-full text-left px-3 py-2 rounded-md-md text-md-b2 transition-colors ${
                     draft.status === opt.value
                        ? 'bg-md-primary-100 text-md-primary-1200 font-semibold'
                        : 'text-md-neutral-1400 font-medium hover:bg-md-neutral-200'
                  }`}
               >
                  {opt.label}
               </button>
            ))}
         </div>

         <div className="px-4 pb-4">
            <button
               onClick={() => { onApply(draft); onClose(); }}
               className="w-full bg-md-primary-1200 text-md-neutral-100 text-md-b2 font-semibold py-2.5 rounded-md-lg"
            >
               Apply Filter
            </button>
         </div>
      </div>
   );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LenderDashboard() {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const gloans = useSelector((state: RootState) => state.loans.loans.gloans);
   const isLoansLoading = useSelector((state: RootState) => state.loans.isLoading);

   const [searchQuery, setSearchQuery] = useState('');
   const [showFilter, setShowFilter] = useState(false);
   const [openUpward, setOpenUpward] = useState(false);
   const [appliedFilters, setAppliedFilters] = useState<FilterState>({ sortBy: '', status: '' });

   const filterBtnRef = useRef<HTMLButtonElement>(null);
   const filterDropdownRef = useClickOutside<HTMLDivElement>(
      () => setShowFilter(false),
      showFilter
   ) as React.RefObject<HTMLDivElement>;

   const handleFilterToggle = () => {
      if (!showFilter && filterBtnRef.current) {
         const rect = filterBtnRef.current.getBoundingClientRect();
         setOpenUpward(window.innerHeight - rect.bottom < 360);
      }
      setShowFilter((v) => !v);
   };

   // IOU Points via TanStack Query
   const { data: userPointsData } = useQuery({
      queryKey: ['user-points', user?.id],
      queryFn: async () => {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.from('user_points').select('points_total').eq('user_id', user.id).single();
         if (error) throw error;
         return data;
      },
      enabled: !!user?.id
   });

   const iouPoints = userPointsData?.points_total ?? 0;

   // Fetch lender loans + borrower profiles
   useEffect(() => {
      if (!user?.id) return;
      const load = async () => {
         const loans = await dispatch(getUserLoans({ userId: user.id })).unwrap();
         const lenderLoans = (loans as Loan[]).filter((l) => l.lenderUser === user.id);
         const ids = [...new Set(lenderLoans.map((l) => l.borrowerUser).filter(Boolean))] as string[];
         if (ids.length > 0) await dispatch(fetchUserProfiles(ids)).unwrap();
      };
      load().catch((err: Error) => console.error('Error loading lender data:', err.message));
   }, [dispatch, user?.id]);

   const lenderLoans = useMemo(() => gloans.filter((l) => l.lenderUser === user?.id), [gloans, user?.id]);

   const { total: totalEarnings, changePercent } = useMemo(() => computeEarningsChange(lenderLoans), [lenderLoans]);
   const totalLoansLent = useMemo(() => lenderLoans.reduce((sum, l) => sum + l.loanAmount, 0), [lenderLoans]);
   const totalLoansFunded = lenderLoans.length;
   const totalLoss = useMemo(
      () => lenderLoans.filter((l) => getLoanDisplayStatus(l) === 'DEFAULT').reduce((sum, l) => sum + Math.max(0, l.loanAmount - (l.repaidAmount ?? 0)), 0),
      [lenderLoans]
   );
   const activeLoansCount = useMemo(() => lenderLoans.filter((l) => getLoanDisplayStatus(l) === 'ACTIVE').length, [lenderLoans]);

   const filteredTransactions = useMemo(() => {
      let result = [...lenderLoans];

      if (searchQuery.trim()) {
         const q = searchQuery.toLowerCase();
         result = result.filter(
            (l) => l.reason?.toLowerCase().includes(q) || (userProfiles[l.borrowerUser ?? '']?.username ?? '').toLowerCase().includes(q)
         );
      }

      const statusMap: Record<string, LoanDisplayStatus> = { pending: 'PENDING', active: 'ACTIVE', default: 'DEFAULT' };
      if (appliedFilters.status === 'new-to-old') result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      else if (appliedFilters.status === 'old-to-new') result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      else if (appliedFilters.status in statusMap) result = result.filter((l) => getLoanDisplayStatus(l) === statusMap[appliedFilters.status]);

      if (appliedFilters.sortBy === 'low-to-high') result.sort((a, b) => a.loanAmount - b.loanAmount);
      else if (appliedFilters.sortBy === 'high-to-low') result.sort((a, b) => b.loanAmount - a.loanAmount);

      if (!appliedFilters.sortBy && !appliedFilters.status) result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return result;
   }, [lenderLoans, searchQuery, appliedFilters, userProfiles]);

   const previewTransactions = filteredTransactions.slice(0, 5);
   const handleApplyFilter = useCallback((filters: FilterState) => setAppliedFilters(filters), []);

   const firstName = user?.username?.split(' ')[0] || 'there';
   const memberSince = formatMemberSince(user?.createdAt);
   const isPositiveChange = changePercent >= 0;

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28">

            {/* ── Nav header — matches UserProfile "Borrower Insights" pattern ── */}
            <div className="flex items-center justify-between px-md-5 py-md-3">
               <div className="flex-1 flex items-center gap-4">
                  <button
                     onClick={() => navigate(-1)}
                     className="shrink-0 w-6 h-6 flex items-center justify-center"
                  >
                     <ChevronLeft className="w-6 h-6 text-md-primary-2000" strokeWidth={2} />
                  </button>
                  <h1 className="text-md-h3 font-semibold text-md-primary-2000">Dashboard</h1>
               </div>
               <button className="shrink-0 w-12 h-12 bg-white rounded-full shadow-md-card flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-md-primary-900" strokeWidth={1.5} />
               </button>
            </div>

            {/* ── Profile section ── */}
            <div className="flex items-start gap-3 px-md-5 pb-md-3">
               <img src={PLACEHOLDER_AVATAR} alt="Profile" className="w-[70px] h-[70px] rounded-full object-cover shrink-0" />
               <div className="flex flex-col gap-1 justify-center pt-1">
                  <div className="flex items-center gap-2 flex-wrap">
                     <p className="text-[18px] tracking-[-0.04em] leading-[1.2] font-semibold text-md-primary-2000">
                        Hello, {firstName}
                     </p>
                     <span className="inline-flex items-center px-2.5 py-0.5 bg-md-primary-900 rounded-md-sm">
                        <span className="text-md-b3 font-semibold text-md-neutral-100 whitespace-nowrap">
                           IOU {iouPoints.toLocaleString()}
                        </span>
                     </span>
                  </div>
                  <p className="text-md-b3 font-normal text-md-neutral-1400">Member since {memberSince}</p>
               </div>
            </div>

            {/* ── Content ── */}
            <div className="flex flex-col gap-5 px-md-5 pb-md-3">

               {/* ── Performance Summary ── */}
               <div className="flex flex-col gap-3">
                  <p className="text-md-h5 font-semibold text-md-heading">Performance Summary</p>

                  {/* Total Earnings — label on top, value below, no ? icon, View More on right */}
                  <StatCard
                     label="Total Earnings"
                     value={formatCurrency(totalEarnings)}
                     valueSize="h3"
                     showHelp={false}
                     rightSlot={
                        <Link
                           to="/lender/performance"
                           className="flex items-center gap-0.5 text-md-b3 font-semibold text-md-blue-500 shrink-0 underline"
                        >
                           View More
                           <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </Link>
                     }
                  >
                     {totalLoansFunded > 0 && changePercent !== 0 && (
                        <p className="text-md-b3 text-md-neutral-1000">
                           <span className={`font-semibold ${isPositiveChange ? 'text-md-green-700' : 'text-md-red-500'}`}>
                              {isPositiveChange ? '+' : ''}{changePercent.toFixed(1)}%
                           </span>
                           {' '}{isPositiveChange ? 'higher' : 'lower'} vs previous period
                        </p>
                     )}
                  </StatCard>

                  {/* Row 1: Total Loans Lent out (h4 / 24px) + Total Loss (h4 / 24px) */}
                  <div className="grid grid-cols-2 gap-3">
                     <StatCard
                        label="Total Loans Lent out"
                        value={formatCurrency(totalLoansLent)}
                        valueSize="h4"
                        showHelp
                     />
                     <StatCard
                        label="Total Loss"
                        value={formatCurrency(totalLoss)}
                        valueSize="h4"
                        valueClassName={totalLoss > 0 ? 'text-md-red-500' : 'text-md-green-700'}
                        showHelp
                     />
                  </div>

                  {/* Row 2: Total Loans Funded (h3 / 28px) + Active Loans (h3 / 28px) */}
                  <div className="grid grid-cols-2 gap-3">
                     <StatCard
                        label="Total Loans Funded"
                        value={totalLoansFunded.toString()}
                        valueSize="h3"
                        showHelp
                     />
                     <StatCard
                        label="Active Loans"
                        value={activeLoansCount.toString()}
                        valueSize="h3"
                        showHelp
                     />
                  </div>
               </div>

               {/* ── Funding Transactions ── */}
               <div className="flex flex-col gap-3">
                  {/* Header row — section title + View All always visible */}
                  <div className="flex items-center justify-between">
                     <p className="text-md-h5 font-semibold text-md-heading">Funding Transactions</p>
                     <Link
                        to="/lender/transactions"
                        className="flex items-center gap-0.5 text-md-b3 font-semibold text-md-blue-500 underline"
                     >
                        View All Transactions
                        <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                     </Link>
                  </div>

                  {/* Search + Filter */}
                  <div className="flex items-center gap-3">
                     <div className="flex-1 bg-md-neutral-100 border border-md-neutral-500 rounded-[12px] shadow-md-card flex items-center gap-2.5 px-3 py-[11px]">
                        <Search className="w-5 h-5 text-md-neutral-800 shrink-0" strokeWidth={1.5} />
                        <input
                           value={searchQuery}
                           onChange={(e) => setSearchQuery(e.target.value)}
                           className="flex-1 bg-transparent text-md-b2 text-md-neutral-2000 placeholder:text-md-neutral-800 outline-none"
                           placeholder="Search Fundings"
                           type="search"
                        />
                     </div>

                     {/* Filter button — border matches filter.png icon color (purple) */}
                     <div className="relative shrink-0">
                        <button
                           ref={filterBtnRef}
                           onClick={handleFilterToggle}
                           className="w-[46px] h-[46px] rounded-[12px] flex items-center justify-center bg-md-neutral-100 border border-md-primary-900"
                        >
                           <img src="/icons/filter.png" alt="Filter" className="w-5 h-5 object-contain" />
                        </button>

                        <FilterDropdown
                           isOpen={showFilter}
                           onClose={() => setShowFilter(false)}
                           filters={appliedFilters}
                           onApply={handleApplyFilter}
                           dropdownRef={filterDropdownRef}
                           openUpward={openUpward}
                        />
                     </div>
                  </div>

                  {/* Transactions list */}
                  {isLoansLoading ? (
                     <div className="flex justify-center py-10">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-md-primary-900" />
                     </div>
                  ) : previewTransactions.length > 0 ? (
                     <div className="flex flex-col gap-3">
                        {previewTransactions.map((loan) => (
                           <TransactionRow
                              key={loan.id}
                              loan={loan}
                              borrowerName={userProfiles[loan.borrowerUser ?? '']?.username ?? 'Unknown'}
                           />
                        ))}
                     </div>
                  ) : (
                     <div className="bg-md-neutral-100 rounded-md-lg p-8 flex flex-col items-center gap-2 shadow-md-card">
                        <p className="text-md-b2 font-medium text-md-neutral-1200 text-center">No transactions found</p>
                        <p className="text-md-b3 text-md-neutral-1000 text-center">
                           {lenderLoans.length === 0 ? "You haven't funded any loans yet." : 'No transactions match your search or filters.'}
                        </p>
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
}
