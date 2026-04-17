import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AlertCircle, ChevronLeft, ChevronRight, HelpCircle, Search } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';

import BorrowerVerificationBadge from '@/components/BorrowerVerificationBadge';
import UserAvatar from '@/components/UserAvatar';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useIsBorrower } from '@/hooks/useIsBorrower';
import { fetchUserProfiles } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';

type Tab = 'all' | 'active' | 'completed';
type SortBy = 'low-to-high' | 'high-to-low' | '';
type StatusFilter = 'new-to-old' | 'old-to-new' | 'pending' | 'active' | 'default' | '';
interface FilterState {
   sortBy: SortBy;
   status: StatusFilter;
}
type LoanStatus = 'REPAID' | 'ACTIVE' | 'DEFAULT' | 'PENDING' | 'PARTIAL';

function getLoanStatus(loan: Loan): LoanStatus {
   if (loan.repaymentStatus === 'Paid') return 'REPAID';
   if (loan.repaymentStatus === 'Partial') return 'PARTIAL';
   if (loan.loanStatus === 'Requested') return 'PENDING';
   if (new Date(loan.dueDate) < new Date()) return 'DEFAULT';
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

function formatDate(dateStr: string | undefined | null): string {
   if (!dateStr) return '—';
   return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function fundedTime(loan: Loan): number {
   return new Date(loan.fundedAt ?? loan.updatedAt ?? loan.createdAt).getTime();
}

function StatusChip({ status }: { status: LoanStatus }) {
   const map: Record<LoanStatus, { label: string; className: string; icon: React.ReactNode }> = {
      REPAID: {
         label: 'REPAID',
         className: 'border-md-green-700 text-md-green-700 bg-transparent',
         icon: (
            <span className="w-3 h-3 rounded-full bg-md-green-700 flex items-center justify-center shrink-0">
               <span className="text-white text-[8px] font-bold leading-none">&#10003;</span>
            </span>
         )
      },
      ACTIVE: {
         label: 'ACTIVE',
         className: 'border-md-blue-500 text-md-blue-500 bg-transparent',
         icon: <AlertCircle className="w-3 h-3 shrink-0" strokeWidth={2.5} />
      },
      DEFAULT: {
         label: 'DEFAULT',
         className: 'border-md-red-500 text-md-red-500 bg-transparent',
         icon: <AlertCircle className="w-3 h-3 shrink-0" strokeWidth={2.5} />
      },
      PENDING: {
         label: 'PENDING',
         className: 'border-[#e65100] text-[#e65100] bg-transparent',
         icon: (
            <span className="w-3 h-3 rounded-full border-[1.5px] border-[#e65100] flex items-center justify-center shrink-0">
               <span className="text-[8px] font-bold leading-none">!</span>
            </span>
         )
      },
      PARTIAL: {
         label: 'PARTIAL',
         className: 'border-md-yellow-700 text-md-yellow-700 bg-md-yellow-700/15',
         icon: null
      }
   };
   const { label, className, icon } = map[status];
   return (
      <span className={`inline-flex items-center gap-1 px-md-1 py-md-0 rounded-[24px] border ${className}`}>
         {icon}
         <span className="text-md-b4 font-semibold">{label}</span>
      </span>
   );
}

interface TransactionRowProps {
   loan: Loan;
   counterpartyName: string;
   counterpartyAvatar?: string;
   variant: 'lender' | 'borrower';
   showOutOf: boolean;
   showBadge: boolean;
   onClick?: () => void;
}

function TransactionRow({
   loan,
   counterpartyName,
   counterpartyAvatar,
   variant,
   showOutOf,
   showBadge,
   onClick
}: TransactionRowProps) {
   const status = getLoanStatus(loan);
   const isBorrower = variant === 'borrower';
   const amountColor =
      isBorrower && showBadge
         ? status === 'DEFAULT'
            ? 'text-md-red-500'
            : 'text-md-green-800'
         : 'text-md-primary-2000';
   const amountPrefix = isBorrower && showBadge ? '+' : '';

   const Content = (
      <div className="flex items-start gap-md-1 py-md-0">
         <UserAvatar src={counterpartyAvatar} alt={counterpartyName} size={48} />

         <div className="flex-1 min-w-0 flex flex-col gap-md-0 justify-center">
            <p className="text-md-b1 font-semibold text-md-primary-2000 line-clamp-2">{loan.reason || 'Loan'}</p>
            <div className="flex items-center gap-1 flex-wrap">
               <span className="text-md-b3 text-md-neutral-1200">
                  {isBorrower ? 'Lent by' : 'Borrowed by'} {counterpartyName}
               </span>
               <span className="w-1 h-1 rounded-full bg-md-neutral-600 shrink-0" />
               <span className="text-md-b3 text-md-neutral-1200 shrink-0">
                  {formatDate(loan.fundedAt ?? loan.updatedAt)}
               </span>
            </div>
         </div>

         <div className="flex flex-col items-end gap-md-0 shrink-0">
            <span className={`text-md-b1 font-semibold ${amountColor}`}>
               {amountPrefix}
               {formatCurrency(loan.loanAmount)}
            </span>
            {showOutOf && (
               <span className="text-md-b3 text-md-neutral-1200">
                  out of {formatCurrency(loan.totalRepaymentAmount)}
               </span>
            )}
            {showBadge && <StatusChip status={status} />}
         </div>
      </div>
   );

   if (onClick) {
      return (
         <button type="button" onClick={onClick} className="w-full text-left">
            {Content}
         </button>
      );
   }
   return Content;
}

interface FilterModalProps {
   isOpen: boolean;
   onClose: () => void;
   filters: FilterState;
   onApply: (filters: FilterState) => void;
   dropdownRef: React.RefObject<HTMLDivElement>;
   openUpward: boolean;
}

function FilterModal({ isOpen, onClose, filters, onApply, dropdownRef, openUpward }: FilterModalProps) {
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

function EmptyState({ variant }: { variant: 'lender' | 'borrower' }) {
   if (variant === 'borrower') {
      return (
         <div className="flex flex-col items-center justify-center gap-md-3 py-16 px-md-5">
            <p className="text-md-h5 font-semibold text-md-heading text-center">No transactions yet</p>
            <p className="text-md-b2 font-medium text-md-neutral-1000 text-center">
               Your loan activity will appear here once you start borrowing.
            </p>
            <Link
               to="/dashboard"
               className="flex items-center justify-center gap-2 bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold px-md-4 py-md-3 rounded-md-lg"
            >
               Request a loan
            </Link>
         </div>
      );
   }
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

export default function TransactionHistory() {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const isBorrower = useIsBorrower();
   const user = useSelector((state: RootState) => state.auth.user);
   const gloans = useSelector((state: RootState) => state.loans.loans.gloans);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const isLoansLoading = useSelector((state: RootState) => state.loans.isLoading);

   const [activeTab, setActiveTab] = useState<Tab>('all');
   const [searchQuery, setSearchQuery] = useState('');
   const [showFilter, setShowFilter] = useState(false);
   const [openUpward, setOpenUpward] = useState(false);
   const [appliedFilters, setAppliedFilters] = useState<FilterState>({ sortBy: '', status: '' });

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

   useEffect(() => {
      if (!user?.id) return;
      const load = async () => {
         const loans = await dispatch(getUserLoans({ userId: user.id })).unwrap();
         const mine = (loans as Loan[]).filter((l) =>
            isBorrower ? l.borrowerUser === user.id : l.lenderUser === user.id
         );
         const counterpartyField = isBorrower ? 'lenderUser' : 'borrowerUser';
         const ids = [...new Set(mine.map((l) => l[counterpartyField]).filter(Boolean))] as string[];
         if (ids.length > 0) await dispatch(fetchUserProfiles(ids)).unwrap();
      };
      load().catch((err: Error) => console.error('Error loading transactions:', err.message));
   }, [dispatch, user?.id, isBorrower]);

   const myLoans = useMemo(
      () =>
         gloans.filter((l) => (isBorrower ? l.borrowerUser === user?.id : l.lenderUser === user?.id)),
      [gloans, user?.id, isBorrower]
   );

   const visibleLoans = useMemo(() => {
      let result = [...myLoans];

      if (activeTab === 'active') result = result.filter((l) => {
         const s = getLoanStatus(l);
         return s === 'ACTIVE' || s === 'PARTIAL' || s === 'PENDING';
      });
      if (activeTab === 'completed') result = result.filter((l) => getLoanStatus(l) === 'REPAID');

      if (searchQuery.trim()) {
         const q = searchQuery.toLowerCase();
         const counterpartyField = isBorrower ? 'lenderUser' : 'borrowerUser';
         result = result.filter(
            (l) =>
               l.reason?.toLowerCase().includes(q) ||
               (userProfiles[l[counterpartyField] ?? '']?.username ?? '').toLowerCase().includes(q)
         );
      }

      const statusMap: Record<string, LoanStatus> = { pending: 'PENDING', active: 'ACTIVE', default: 'DEFAULT' };
      if (appliedFilters.status === 'new-to-old') result.sort((a, b) => fundedTime(b) - fundedTime(a));
      else if (appliedFilters.status === 'old-to-new') result.sort((a, b) => fundedTime(a) - fundedTime(b));
      else if (appliedFilters.status in statusMap) result = result.filter((l) => getLoanStatus(l) === statusMap[appliedFilters.status]);

      if (appliedFilters.sortBy === 'low-to-high') result.sort((a, b) => a.loanAmount - b.loanAmount);
      else if (appliedFilters.sortBy === 'high-to-low') result.sort((a, b) => b.loanAmount - a.loanAmount);

      if (!appliedFilters.sortBy && !appliedFilters.status) result.sort((a, b) => fundedTime(b) - fundedTime(a));

      return result;
   }, [myLoans, activeTab, searchQuery, appliedFilters, userProfiles, isBorrower]);

   const handleApplyFilter = useCallback((filters: FilterState) => setAppliedFilters(filters), []);

   const TABS: { key: Tab; label: string }[] = [
      { key: 'all', label: 'All Transactions' },
      { key: 'active', label: 'Active Loans' },
      { key: 'completed', label: 'Completed' }
   ];

   const firstName = (user?.displayName || user?.username || 'there').split(' ')[0];

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28">
            {/* ── Header ── */}
            {isBorrower ? (
               <div className="flex items-center justify-between px-md-5 py-md-3">
                  <div className="flex items-center gap-md-2">
                     <UserAvatar size={48} />
                     <div className="flex flex-col gap-1">
                        <p className="text-md-h5 font-semibold text-md-primary-2000">Hello, {firstName}</p>
                        <BorrowerVerificationBadge />
                     </div>
                  </div>
                  <button
                     type="button"
                     onClick={() => navigate('/support')}
                     className="shrink-0 w-12 h-12 bg-white rounded-full shadow-md-card flex items-center justify-center"
                     aria-label="Help"
                  >
                     <HelpCircle className="w-6 h-6 text-md-primary-900" strokeWidth={1.5} />
                  </button>
               </div>
            ) : (
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
                     type="button"
                     onClick={() => navigate('/support')}
                     className="shrink-0 w-12 h-12 bg-white rounded-full shadow-md-card flex items-center justify-center"
                     aria-label="Help"
                  >
                     <HelpCircle className="w-6 h-6 text-md-primary-900" strokeWidth={1.5} />
                  </button>
               </div>
            )}

            {/* ── Content ── */}
            <div className="flex flex-col gap-md-3 px-md-4 py-md-3">
               {isBorrower && (
                  <h1 className="text-md-h3 font-semibold text-md-neutral-2000">Transaction History</h1>
               )}

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
                        filters={appliedFilters}
                        onApply={handleApplyFilter}
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
                  <div className="bg-white rounded-md-lg px-md-2 py-md-3 shadow-md-card flex flex-col gap-md-4">
                     {visibleLoans.map((loan, i) => {
                        const counterpartyId = isBorrower ? loan.lenderUser : loan.borrowerUser;
                        const profile = userProfiles[counterpartyId ?? ''];
                        return (
                           <div key={loan.id}>
                              <TransactionRow
                                 loan={loan}
                                 counterpartyName={profile?.username ?? 'Unknown'}
                                 counterpartyAvatar={profile?.avatarUrl}
                                 variant={isBorrower ? 'borrower' : 'lender'}
                                 showOutOf={activeTab === 'all'}
                                 showBadge={isBorrower || activeTab !== 'all'}
                                 onClick={
                                    isBorrower ? () => navigate(`/history/${loan.id}`) : undefined
                                 }
                              />
                              {i < visibleLoans.length - 1 && (
                                 <div className="h-px bg-md-neutral-300 mt-md-4" />
                              )}
                           </div>
                        );
                     })}
                  </div>
               ) : (
                  <EmptyState variant={isBorrower ? 'borrower' : 'lender'} />
               )}
            </div>
         </div>
      </div>
   );
}
