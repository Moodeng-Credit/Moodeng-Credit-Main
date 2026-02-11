

import { type ChangeEvent, type FormEvent, type MouseEvent, type RefObject, useCallback, useEffect, useMemo, useState } from 'react';


import { Link, useLocation } from 'react-router-dom';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useDispatch, useSelector } from 'react-redux';
import { useAccount } from 'wagmi';

import FilterSidebar from '@/components/filters/FilterSidebar';
import SearchBar from '@/components/filters/SearchBar';
import SortButtons from '@/components/filters/SortButtons';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { getEffectiveCreditLimit } from '@/lib/creditLeveling';
import { useClickOutside } from '@/hooks/useClickOutside';
import { usePagination } from '@/hooks/usePagination';

import { filterLoans, type LoanFilters } from '@/utils/loanFilters';

import { ALLOWED_CHAIN_DISPLAY_NAME, ALLOWED_CHAIN_ID } from '@/config/wagmiConfig';
import { fetchUser, fetchUserProfiles } from '@/store/slices/authSlice';
import { createLoan, fetchLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { ERROR_CODES } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';
import type { Loan } from '@/types/loanTypes';
import LenderBoardHeader from '@/views/dashboard/components/LenderBoardHeader';
import LoanRequestModal from '@/views/dashboard/components/LoanRequestModal';
import { RequestBoardFilterContextProvider } from '@/views/dashboard/components/RequestBoardFilterContext';
import SuccessModal from '@/views/dashboard/components/SuccessModal';
import UserCard from '@/views/dashboard/components/UserCard';
import LoadMoreButton from '@/views/profile/components/shared/LoadMoreButton';

export default function Dashboard() {
   return (
      <RequestBoardFilterContextProvider>
         <Dashboard$ />
      </RequestBoardFilterContextProvider>
   );
}

function Dashboard$() {
   const pathname = useLocation().pathname;
   const dispatch = useDispatch<AppDispatch>();
   const account = useAccount();
   
   useEffect(() => {
      console.log('[Dashboard Debug] Mount Status:', {
         pathname,
         walletStatus: account.status,
         walletAddress: account.address,
         isConnected: account.isConnected
      });
   }, []);

   const { isConnected, status } = account;
   const { showToastByConfig } = useToast();
   const { openConnectModal } = useConnectModal();
   const [showModal, setShowModal] = useState(false);
   const [showPurple, setShowPurple] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const user = useSelector((state: RootState) => state.auth.user);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const isLoading = useSelector((state: RootState) => state.loans.isLoading);
   const showVerify = user?.isWorldId !== 'ACTIVE';
   const rawFloanRequests = useSelector((state: RootState) => state.loans?.loans?.floans);
   const floanRequests = useMemo(() => rawFloanRequests || [], [rawFloanRequests]);
   const [sortedLoans, setSortedLoans] = useState(floanRequests);
   const today = new Date().toISOString().split('T')[0];
   const borrowerUserId = user?.id || '';
   const lenderUserId = '';
   const [loanAmount, setLoanAmount] = useState('');
   const [totalRepaymentAmount, setTotalRepaymentAmount] = useState('');
   const [reason, setReason] = useState('');
   const [days, setDays] = useState('');
   const [customAmount, setCustomAmount] = useState('');
   const [searchLoan, setSearchLoan] = useState('');
   const effectiveCreditLimit = getEffectiveCreditLimit(user.cs, user.isWorldId === 'ACTIVE');

   const loanRequestModalRef = useClickOutside<HTMLDivElement>(() => setShowModal(false), showModal) as RefObject<HTMLDivElement>;
   const successModalRef = useClickOutside<HTMLDivElement>(() => setShowPurple(false), showPurple) as RefObject<HTMLDivElement>;

   const [filters, setFilters] = useState<LoanFilters>({
      amount: '',
      rate: '',
      date: null,
      loanTime: '',
      borrowType: [],
      network: [],
      search: '',
      sortBy: undefined
   });
   // const filters2 = useRequestBoardFilterContext((state) => state);

   const clear = () => {
      setTotalRepaymentAmount('');
      setLoanAmount('');
      setReason('');
      setDays('');
   };

   const handleFiltersChange = (newFilters: Partial<LoanFilters>) => {
      setFilters((prev) => {
         const updated = { ...prev, ...newFilters };

         // When a manual date is selected, clear the loanTime filter
         // This prevents conflicts between date-based and time-period filters
         if ('date' in newFilters && newFilters.date !== null) {
            updated.loanTime = '';
         }

         // When a loanTime filter is selected, clear the manual date
         // Both filters affect the same time-based criteria, so they're mutually exclusive
         if ('loanTime' in newFilters && newFilters.loanTime !== '') {
            updated.date = null;
         }

         return updated;
      });
   };

   const handleApplyLoanClick = (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();

      if (!isConnected) {
         openConnectModal?.();
         return;
      }

      if ((user.nal || 0) >= (user.mal || 0)) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_LIMIT_REACHED));
         return;
      }
      setShowModal(true);
   };

   const handleCloseModal = useCallback(() => {
      setShowModal(false);
   }, []);

   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (isSubmitting) {
         return;
      }

      if (!isConnected) {
         openConnectModal?.();
         e.stopPropagation();
         return;
      }

      if ((user.nal || 0) >= (user.mal || 0)) {
         console.log('Loan limit reached');
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_LIMIT_REACHED));
         return;
      }

      if (user.isWorldId !== 'ACTIVE') {
         console.log('WorldId status not active');
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.WORLDID_REQUIRED));
         return;
      }

      if (!user.walletAddress || user.walletAddress.trim() === '') {
         console.log('Wallet address not connected');
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.WALLET_MISSING));
         return;
      }

      if (account.chain?.id !== ALLOWED_CHAIN_ID) {
         console.log('Network validation failed:', {
            required: ALLOWED_CHAIN_DISPLAY_NAME,
            current: account.chain?.name
         });
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.NETWORK_REQUIRED));
         return;
      }

      if (!loanAmount || parseFloat(loanAmount) <= 0) {
         console.log('Invalid loan amount');
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_INVALID_AMOUNT));
         return;
      }

      if (parseFloat(loanAmount) > effectiveCreditLimit) {
         console.log('Loan amount exceeds credit score');
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_AMOUNT_EXCEEDS_LIMIT));
         return;
      }

      const loanData = {
         borrowerUserId: borrowerUserId || '',
         borrowerWallet: user.walletAddress,
         lenderUserId,
         loanAmount: parseFloat(loanAmount),
         totalRepaymentAmount: parseFloat(totalRepaymentAmount),
         reason,
         dueDate: days
      };

      if (
         user.isWorldId === 'ACTIVE' &&
         (user.nal || 0) < (user.mal || 0) &&
         parseFloat(loanAmount) <= effectiveCreditLimit &&
         parseFloat(loanAmount) > 0
      ) {
         setIsSubmitting(true);
         try {
            await dispatch(createLoan(loanData)).unwrap();
            clear();
            handlePurple();
            try {
               await dispatch(fetchUser()).unwrap();
               console.log('User fetched successfully');
            } catch (error) {
               console.error('Error fetching user:', (error as Error).message || error);
            }
         } catch (error) {
            console.error('Error creating loan:', (error as Error).message || error);
         } finally {
            setIsSubmitting(false);
         }
      }
   };

   const handleDays = (e: ChangeEvent<HTMLInputElement>) => {
      const selectedDate = e.target.value;

      // Convert the selected date to midnight UTC+00
      const date = new Date(selectedDate);
      const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));

      // Store as ISO string for the backend
      setDays(utcDate.toISOString());
   };

   const handlePurple = () => {
      setShowPurple(true);
      setShowModal(false);
   };

   useEffect(() => {
      if (typeof window !== 'undefined' && window.location.hash) {
         const element = document.getElementById(window.location.hash.replace('#', ''));
         if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
         }
      }
   }, [pathname]);

   useEffect(() => {
      const loadLoans = async () => {
         try {
            const loans = await dispatch(fetchLoans()).unwrap();
            console.log('Loans fetched successfully');

            // Extract unique borrower user IDs and batch fetch their profiles
            const borrowerUserIds = [...new Set(loans.map((loan: Loan) => loan.borrowerUser).filter(Boolean))] as string[];
            if (borrowerUserIds.length > 0) {
               await dispatch(fetchUserProfiles(borrowerUserIds)).unwrap();
               console.log('User profiles fetched successfully');
            }
         } catch (error) {
            console.error('Error fetching data:', (error as Error).message || error);
         }
      };
      loadLoans();
   }, [dispatch]);

   const filteredLoans = useMemo(() => {
      const allFilters: LoanFilters = {
         ...filters,
         search: searchLoan,
         sortBy: filters.sortBy
      };
      return filterLoans(floanRequests, allFilters, customAmount, userProfiles);
   }, [filters, searchLoan, floanRequests, customAmount, userProfiles]);

   useEffect(() => {
      setSortedLoans(filteredLoans);
   }, [filteredLoans]);

   const {
      displayedItems: displayedLoans,
      displayedCount,
      totalCount,
      handleLoadMore
   } = usePagination({
      items: sortedLoans,
      resetDependencies: [filters, searchLoan]
   });

   const handleSuccessModalClose = useCallback(() => {
      setShowPurple(false);
   }, []);

   return (
      <>
         <div id="top" className="bg-white text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
            <main className="mx-auto px-6 pt-6 pb-20 md:px-20">
               {/* Lender Board Header with User Info */}
               <LenderBoardHeader />
               
               <h1 className="text-xl md:text-2xl font-semibold text-gray-900 mb-1">Microloan Request Board</h1>
               <p className="text-xs md:text-sm text-gray-700 mb-6">
                  Browse requests posted on Moodeng, or jump right in and get verified to start borrowing in USDC.
               </p>
               
               {/* Need short-term support card */}
               <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-6 mb-6 border border-purple-100">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                     <div className="flex-1">
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">Need short-term support?</h2>
                        <p className="text-sm text-gray-700">
                           Borrow USDC to build trust and unlock higher loan levels.
                        </p>
                     </div>
                     <button
                        onClick={handleApplyLoanClick}
                        className="bg-purple-600 text-white text-sm font-semibold px-6 py-3 rounded-lg hover:bg-purple-700 transition shadow-md whitespace-nowrap"
                     >
                        Apply For A Loan
                     </button>
                  </div>
               </div>
               
               {/* Browse Latest Requests section title */}
               <h2 className="text-lg font-semibold text-gray-900 mb-4">Browse Latest Requests</h2>
               <div className="flex flex-col md:flex-row md:space-x-10">
                  <FilterSidebar
                     filters={filters}
                     onFiltersChange={handleFiltersChange}
                     customAmount={customAmount}
                     onCustomAmountChange={setCustomAmount}
                  />
                  <section className="flex-1 flex flex-col items-start mt-10 md:mt-0">
                     <div className="flex flex-wrap justify-between gap-3 mb-6 w-full">
                        <SortButtons
                           activeSort={filters.sortBy || ''}
                           onSortChange={(sort) => handleFiltersChange({ sortBy: sort || undefined })}
                        />
                        <SearchBar value={searchLoan} onChange={setSearchLoan} placeholder="Search Request..." />
                     </div>
                     <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(350px,1fr))] w-full">
                        {isLoading ? (
                           <div className="col-span-full flex justify-center py-20">
                              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                           </div>
                        ) : displayedLoans && Array.isArray(displayedLoans) && displayedLoans.length > 0 ? (
                           displayedLoans.map((loan) => <UserCard key={loan.id} {...loan} />)
                        ) : (
                           <div className="col-span-full text-center py-20 text-gray-500">No loan requests found.</div>
                        )}
                     </div>
                     {!isLoading && <LoadMoreButton currentCount={displayedCount} totalCount={totalCount} onLoadMore={handleLoadMore} />}
                  </section>
               </div>
               <Link to="/dashboard#top" className="float-right">
                  <img
                     src="https://cdn.builder.io/api/v1/image/assets/c9a8899718394d87a40cf9e7196a9f95/e81253cfc6443f8a9fc2246506d2c6496689513b?placeholderIfAbsent=true"
                     className="w-[46px]"
                     alt="Floating action button"
                     width={100}
                     height={100}
                  />
               </Link>
            </main>
         </div>
         <LoanRequestModal
            isOpen={showModal}
            onClose={handleCloseModal}
            showVerify={showVerify}
            user={user}
            loanAmount={loanAmount}
            setLoanAmount={setLoanAmount}
            totalRepaymentAmount={totalRepaymentAmount}
            setTotalRepaymentAmount={setTotalRepaymentAmount}
            reason={reason}
            setReason={setReason}
            days={days}
            today={today}
            handleDays={handleDays}
            handleSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            clickOutsideRef={loanRequestModalRef}
         />
         <SuccessModal isOpen={showPurple} onClose={handleSuccessModalClose} clickOutsideRef={successModalRef} />
      </>
   );
}
