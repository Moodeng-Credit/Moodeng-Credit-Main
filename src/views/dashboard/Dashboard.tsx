

import { type ChangeEvent, type FormEvent, type MouseEvent, type RefObject, useCallback, useEffect, useMemo, useState } from 'react';


import { Link, useLocation } from 'react-router-dom';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useDispatch, useSelector } from 'react-redux';
import { useAccount, useChainId } from 'wagmi';

import FilterSidebar from '@/components/filters/FilterSidebar';
import SearchBar from '@/components/filters/SearchBar';
import SortButtons from '@/components/filters/SortButtons';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import YouTubeVideoLightbox from '@/components/ui/YouTubeVideoLightbox';
import WorldIDVerification from '@/components/worldId/WorldIDVerification';

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
import LoanRequestModal from '@/views/dashboard/components/LoanRequestModal';
import { RequestBoardFilterContextProvider } from '@/views/dashboard/components/RequestBoardFilterContext';
import SuccessModal from '@/views/dashboard/components/SuccessModal';
import UserCard from '@/views/dashboard/components/UserCard';
import LoadMoreButton from '@/views/profile/components/shared/LoadMoreButton';

const CREDIT_LEVELLING_VIDEO_ID = 'gaRjXOd2s2U';

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
   const wagmiChainId = useChainId();
   const { showToastByConfig } = useToast();
   const { isConnected } = useAccount();
   const { openConnectModal } = useConnectModal();
   const [showModal, setShowModal] = useState(false);
   const [isPendingAction, setIsPendingAction] = useState(false);
   const [showPurple, setShowPurple] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const user = useSelector((state: RootState) => state.auth.user);
   const isLoading = useSelector((state: RootState) => state.loans.isLoading);
   const showVerify = user?.isWorldId !== 'ACTIVE';
   const rawFloanRequests = useSelector((state: RootState) => state.loans?.loans?.floans);
   const floanRequests = useMemo(() => rawFloanRequests || [], [rawFloanRequests]);
   const [sortedLoans, setSortedLoans] = useState(floanRequests);
   const today = new Date().toISOString().split('T')[0];
   const borrowerUserId = user?.username || '';
   const lenderUserId = '';
   const [loanAmount, setLoanAmount] = useState('');
   const [totalRepaymentAmount, setTotalRepaymentAmount] = useState('');
   const [reason, setReason] = useState('');
   const [days, setDays] = useState('');
   const [customAmount, setCustomAmount] = useState('');
   const [searchLoan, setSearchLoan] = useState('');

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
         setIsPendingAction(true);
         openConnectModal?.();
         return;
      }

      if ((user.nal || 0) >= (user.mal || 0)) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_LIMIT_REACHED));
         return;
      }
      setShowModal(true);
   };

   // Automatically open modal after connection if it was pending
   useEffect(() => {
      const connectedAddress = account.address?.toLowerCase();
      const storedAddress = user?.walletAddress?.toLowerCase();

      // Only trigger if connected, pending, and the address matches the stored one (Issue 3)
      if (isConnected && isPendingAction && connectedAddress && connectedAddress === storedAddress) {
         setIsPendingAction(false);
         if ((user.nal || 0) < (user.mal || 0)) {
            setShowModal(true);
         } else {
            showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_LIMIT_REACHED));
         }
      }
   }, [isConnected, isPendingAction, user.nal, user.mal, user.walletAddress, account.address, showToastByConfig]);

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

      if (wagmiChainId !== ALLOWED_CHAIN_ID) {
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

      if (parseFloat(loanAmount) > (user.cs || 0)) {
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
         parseFloat(loanAmount) <= (user.cs || 0) &&
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

            // Extract unique borrower usernames and batch fetch their profiles
            const borrowerUsernames = [...new Set(loans.map((loan: Loan) => loan.borrowerUser).filter(Boolean))] as string[];
            if (borrowerUsernames.length > 0) {
               await dispatch(fetchUserProfiles(borrowerUsernames)).unwrap();
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
      return filterLoans(floanRequests, allFilters, customAmount);
   }, [filters, searchLoan, floanRequests, customAmount]);

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
               <h1 className="text-xl md:text-2xl font-semibold text-gray-900 mb-1">Request Board for Microloans</h1>
               <p className="text-xs md:text-sm text-gray-700 mb-6">
                  Browse requests posted on Moodeng, or jump right in and get verified to start borrowing.
               </p>
               <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mb-10">
                  <button
                     onClick={handleApplyLoanClick}
                     className="bg-blue-600 text-white text-xs md:text-sm font-semibold px-5 py-2 rounded-md w-full sm:w-auto hover:bg-blue-700 transition"
                  >
                     APPLY LOAN
                  </button>
                  <YouTubeVideoLightbox videoId={CREDIT_LEVELLING_VIDEO_ID} />
               </div>
               {user.isWorldId !== 'ACTIVE' ? (
                  <div className="bg-blue-100 text-blue-900 text-center py-3 px-4 rounded-md mb-6">
                     <span className="text-sm md:text-base font-medium">
                        Interested in Borrowing?{' '}
                        <WorldIDVerification>
                           {({ open }) => (
                              <button
                                 onClick={open}
                                 className="underline font-semibold hover:text-blue-700 bg-transparent border-none cursor-pointer"
                              >
                                 Click Here
                              </button>
                           )}
                        </WorldIDVerification>{' '}
                        and Verify You're a Real Person via{' '}
                        <a href="https://worldcoin.org/" className="underline font-semibold hover:text-blue-700">
                           World ID!
                        </a>
                     </span>
                  </div>
               ) : null}
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
