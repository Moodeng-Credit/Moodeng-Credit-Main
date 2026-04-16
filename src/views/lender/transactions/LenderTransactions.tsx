import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AlertCircle, ChevronLeft, ChevronRight, HelpCircle, Search } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';

import BottomNav from '@/components/BottomNav';
import { useClickOutside } from '@/hooks/useClickOutside';
import { fetchUserProfiles } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import UserAvatar from '@/components/UserAvatar';
import type { Loan } from '@/types/loanTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'all' | 'active' | 'completed';
type SortOption = 'new-to-old' | 'old-to-new' | 'low-to-high' | 'high-to-low' | '';
type LoanStatus = 'REPAID' | 'ACTIVE' | 'DEFAULT' | 'PENDING';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLoanStatus(loan: Loan): LoanStatus {
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

function formatDate(dateStr: string | undefined | null): string {
   if (!dateStr) return '—';
   return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function fundedTime(loan: Loan): number {
   return new Date(loan.fundedAt ?? loan.updatedAt ?? loan.createdAt).getTime();
}

// ---------------------------------------------------------------------------
// Status chip
// ---------------------------------------------------------------------------

function StatusChip({ status }: { status: LoanStatus }) {
   const map: Record<LoanStatus, { label: string; className: string; icon: React.ReactNode }> = {
      REPAID: {
         label: 'REPAID',
         className: 'border-md-green-700 text-md-green-700',
         icon: (
            <span className="w-3.5 h-3.5 rounded-full bg-md-green-700 flex items-center justify-center shrink-0">
               <span className="text-white text-[8px] font-bold leading-none">&#10003;</span>
            </span>
         ),
      },
      ACTIVE: {
         label: 'ACTIVE',
         className: 'border-md-blue-500 text-md-blue-500',
         icon: <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />,
      },
      DEFAULT: {
         label: 'DEFAULT',
         className: 'border-md-red-500 text-md-red-500',
         icon: <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />,
      },
      PENDING: {
         label: 'PENDING',
         className: 'border-[#e65100] text-[#e65100]',
         icon: (
            <span className="w-3.5 h-3.5 rounded-full border-[1.5px] border-[#e65100] flex items-center justify-center shrink-0">
               <span className="text-[8px] font-bold leading-none">!</span>
            </span>
         ),
      },
   };
   const { label, className, icon } = map[status];
   return (
      <span className={`inline-flex items-center gap-1 px-3 py-[5px] rounded-[30px] border ${className}`}>
         {icon}
         <span className="text-md-b4 font-semibold uppercase tracking-wide">{label}</span>
      </span>
   );
}

// ---------------------------------------------------------------------------
// Transaction row
// ---------------------------------------------------------------------------

interface TransactionRowProps {
   loan: Loan;
   borrowerName: string;
   borrowerAvatar?: string;
   showOutOf?: boolean;
}

function TransactionRow({ loan, borrowerName, borrowerAvatar, showOutOf = false }: TransactionRowProps) {
   const status = getLoanStatus(loan);
   return (
      <div className="flex items-start gap-2 py-1">
         {/* Avatar */}
         <UserAvatar src={borrowerAvatar} alt={borrowerName} size={48} />

         {/* Info */}
         <div className="flex-1 min-w-0 flex flex-col gap-1 justify-center">
            <p className="text-md-b1 font-semibold text-md-primary-2000">
               {loan.reason || 'Loan'}
            </p>
            <div className="flex items-center gap-1 flex-wrap">
               <span className="text-md-b3 text-md-neutral-1200">Borrowed by {borrowerName}</span>
               <span className="w-1 h-1 rounded-full bg-md-neutral-600 shrink-0" />
               <span className="text-md-b3 text-md-neutral-1200 shrink-0">
                  {formatDate(loan.fundedAt ?? loan.updatedAt)}
               </span>
            </div>
         </div>

         {/* Amounts + status chip */}
         <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="text-md-b1 font-semibold text-md-primary-2000">{formatCurrency(loan.loanAmount)}</span>
            {showOutOf && (
               <span className="text-md-b3 text-md-neutral-1200">out of {formatCurrency(loan.totalRepaymentAmount)}</span>
            )}
            <StatusChip status={status} />
         </div>
      </div>
   );
}

// ---------------------------------------------------------------------------
// Filter modal
// ---------------------------------------------------------------------------

interface FilterModalProps {
   isOpen: boolean;
   onClose: () => void;
   sort: SortOption;
   onApply: (sort: SortOption) => void;
   dropdownRef: React.RefObject<HTMLDivElement>;
   openUpward: boolean;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
   { value: 'new-to-old', label: 'New to Old' },
   { value: 'old-to-new', label: 'Old to New' },
   { value: 'low-to-high', label: 'Amount: Low to High' },
   { value: 'high-to-low', label: 'Amount: High to Low' },
];

function FilterModal({ isOpen, onClose, sort, onApply, dropdownRef, openUpward }: FilterModalProps) {
   const [draft, setDraft] = useState<SortOption>(sort);

   useEffect(() => {
      if (isOpen) setDraft(sort);
   }, [isOpen, sort]);

   if (!isOpen) return null;

   const positionClass = openUpward ? 'bottom-full mb-2' : 'top-full mt-2';

   return (
      <div
         ref={dropdownRef}
         className={`absolute right-0 z-50 w-[220px] bg-md-neutral-100 rounded-md-xl shadow-[0_8px_32px_rgba(0,0,0,0.14)] border border-md-neutral-300 overflow-hidden ${positionClass}`}
      >
         <div className="px-4 pt-4 pb-2">
            <p className="text-md-b3 font-bold text-md-neutral-2000 mb-2 uppercase tracking-wide">Sort By</p>
            {SORT_OPTIONS.map((opt) => (
               <button
                  key={opt.value}
                  onClick={() => setDraft((d) => (d === opt.value ? '' : opt.value))}
                  className={`w-full text-left px-3 py-2 rounded-md-md text-md-b2 transition-colors ${
                     draft === opt.value
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
               onClick={() => {
                  onApply(draft);
                  onClose();
               }}
               className="w-full bg-md-primary-1200 text-md-neutral-100 text-md-b2 font-semibold py-2.5 rounded-md-lg"
            >
               Apply Filter
            </button>
         </div>
      </div>
   );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
   return (
      <div className="flex flex-col items-center justify-center gap-md-3 py-16 px-md-5">
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
   );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LenderTransactions() {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const gloans = useSelector((state: RootState) => state.loans.loans.gloans);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const isLoansLoading = useSelector((state: RootState) => state.loans.isLoading);

   const [activeTab, setActiveTab] = useState<Tab>('all');
   const [searchQuery, setSearchQuery] = useState('');
   const [showFilter, setShowFilter] = useState(false);
   const [openUpward, setOpenUpward] = useState(false);
   const [appliedSort, setAppliedSort] = useState<SortOption>('new-to-old');

   const filterBtnRef = useRef<HTMLButtonElement>(null);
   const filterDropdownRef = useClickOutside<HTMLDivElement>(
      () => setShowFilter(false),
      showFilter,
      filterBtnRef
   ) as React.RefObject<HTMLDivElement>;

   const handleFilterToggle = () => {
      if (!showFilter && filterBtnRef.current) {
         const rect = filterBtnRef.current.getBoundingClientRect();
         setOpenUpward(window.innerHeight - rect.bottom < 300);
      }
      setShowFilter((v) => !v);
   };

   // Fetch loans + borrower profiles
   useEffect(() => {
      if (!user?.id) return;
      const load = async () => {
         const loans = await dispatch(getUserLoans({ userId: user.id })).unwrap();
         const lenderLoans = (loans as Loan[]).filter((l) => l.lenderUser === user.id);
         const ids = [...new Set(lenderLoans.map((l) => l.borrowerUser).filter(Boolean))] as string[];
         if (ids.length > 0) await dispatch(fetchUserProfiles(ids)).unwrap();
      };
      load().catch((err: Error) => console.error('Error loading transactions:', err.message));
   }, [dispatch, user?.id]);

   const lenderLoans = useMemo(() => gloans.filter((l) => l.lenderUser === user?.id), [gloans, user?.id]);

   const visibleLoans = useMemo(() => {
      let result = [...lenderLoans];

      // Tab filter
      if (activeTab === 'active') result = result.filter((l) => getLoanStatus(l) === 'ACTIVE');
      if (activeTab === 'completed') result = result.filter((l) => getLoanStatus(l) === 'REPAID');

      // Search
      if (searchQuery.trim()) {
         const q = searchQuery.toLowerCase();
         result = result.filter(
            (l) =>
               l.reason?.toLowerCase().includes(q) ||
               (userProfiles[l.borrowerUser ?? '']?.username ?? '').toLowerCase().includes(q)
         );
      }

      // Sort
      if (appliedSort === 'new-to-old') result.sort((a, b) => fundedTime(b) - fundedTime(a));
      else if (appliedSort === 'old-to-new') result.sort((a, b) => fundedTime(a) - fundedTime(b));
      else if (appliedSort === 'low-to-high') result.sort((a, b) => a.loanAmount - b.loanAmount);
      else if (appliedSort === 'high-to-low') result.sort((a, b) => b.loanAmount - a.loanAmount);

      return result;
   }, [lenderLoans, activeTab, searchQuery, appliedSort, userProfiles]);

   const handleApplySort = useCallback((sort: SortOption) => setAppliedSort(sort), []);

   const TABS: { key: Tab; label: string }[] = [
      { key: 'all', label: 'All Transactions' },
      { key: 'active', label: 'Active Loans' },
      { key: 'completed', label: 'Completed' },
   ];

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
                  <h1 className="text-md-h3 font-semibold text-md-primary-2000">Funding Transactions</h1>
               </div>
               <button
                  className="shrink-0 w-12 h-12 bg-white rounded-full shadow-md-card flex items-center justify-center"
                  aria-label="Help"
               >
                  <HelpCircle className="w-6 h-6 text-md-primary-900" strokeWidth={1.5} />
               </button>
            </div>

            {/* ── Content ── */}
            <div className="flex flex-col gap-md-3 px-md-4 py-md-3">

               {/* Search + Filter */}
               <div className="flex items-center gap-md-3">
                  <div className="flex-1 bg-md-neutral-100 border border-md-neutral-600 rounded-[12px] shadow-md-card flex items-center gap-[10px] p-3">
                     <Search className="w-6 h-6 text-md-neutral-800 shrink-0" strokeWidth={1.5} />
                     <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-transparent text-md-b2 text-md-neutral-2000 placeholder:text-md-neutral-800 outline-none"
                        placeholder="Search transaction history"
                        type="search"
                     />
                  </div>

                  <div className="relative shrink-0">
                     <button
                        ref={filterBtnRef}
                        onClick={handleFilterToggle}
                        className="w-[48px] h-[48px] rounded-[12px] flex items-center justify-center border border-md-primary-1200"
                        aria-label="Filter"
                     >
                        <img src="/icons/filter.png" alt="Filter" className="w-6 h-6 object-contain" />
                     </button>

                     <FilterModal
                        isOpen={showFilter}
                        onClose={() => setShowFilter(false)}
                        sort={appliedSort}
                        onApply={handleApplySort}
                        dropdownRef={filterDropdownRef}
                        openUpward={openUpward}
                     />
                  </div>
               </div>

               {/* Tab bar */}
               <div className="bg-white border border-[#efedf1] rounded-[8px] p-2 flex items-center shadow-[inset_0px_4px_4px_0px_rgba(0,0,0,0.04)]">
                  {TABS.map(({ key, label }) => {
                     const isActive = key === activeTab;
                     return (
                        <button
                           key={key}
                           onClick={() => setActiveTab(key)}
                           className={`flex-1 px-2 py-1.5 rounded-[8px] text-md-b2 font-semibold transition-all ${
                              isActive
                                 ? 'bg-md-primary-800 text-md-neutral-100 opacity-80 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.12)]'
                                 : 'text-md-heading opacity-40'
                           }`}
                        >
                           {label}
                        </button>
                     );
                  })}
               </div>

               {/* Transaction list */}
               {isLoansLoading ? (
                  <div className="flex justify-center py-16">
                     <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-md-primary-900" />
                  </div>
               ) : visibleLoans.length > 0 ? (
                  <div className="bg-white rounded-md-lg px-3 py-md-3 shadow-md-card flex flex-col gap-5">
                     {visibleLoans.map((loan, i) => (
                        <div key={loan.id}>
                           <TransactionRow
                              loan={loan}
                              borrowerName={userProfiles[loan.borrowerUser ?? '']?.username ?? 'Unknown'}
                              borrowerAvatar={userProfiles[loan.borrowerUser ?? '']?.avatarUrl}
                              showOutOf={activeTab === 'all'}
                           />
                           {i < visibleLoans.length - 1 && (
                              <div className="h-px bg-md-neutral-300 mt-5" />
                           )}
                        </div>
                     ))}
                  </div>
               ) : (
                  <EmptyState />
               )}
            </div>

         </div>

         <BottomNav />
      </div>
   );
}
