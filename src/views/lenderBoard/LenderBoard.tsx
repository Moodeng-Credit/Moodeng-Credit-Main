import { type FormEvent, type MouseEvent, type RefObject, useCallback, useEffect, useMemo, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useDispatch, useSelector } from 'react-redux';
import { useAccount } from 'wagmi';

import FilterSidebar from '@/components/filters/FilterSidebar';
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
import LoanRequestModal from '@/views/dashboard/components/LoanRequestModal';
import SuccessModal from '@/views/dashboard/components/SuccessModal';
import LoadMoreButton from '@/views/profile/components/shared/LoadMoreButton';

import { Card, CardContent } from '@/components/shadcn/card';

import BorrowerRequestCard from '@v2/views/lenderBoard/components/BorrowerRequestCard';
import BrowseRequestsHeader from '@v2/views/lenderBoard/components/BrowseRequestsHeader';
import LenderBoardHeader from '@v2/views/lenderBoard/components/LenderBoardHeader';
import LoanApplicationBanner from '@v2/views/lenderBoard/components/LoanApplicationBanner';

export default function LenderBoard() {
   const dispatch = useDispatch<AppDispatch>();
   const account = useAccount();
   const { isConnected } = account;
   const { showToastByConfig } = useToast();
   const { openConnectModal } = useConnectModal();
   
   const [showModal, setShowModal] = useState(false);
   const [showPurple, setShowPurple] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [showFilterSidebar, setShowFilterSidebar] = useState(false);
   const [searchQuery, setSearchQuery] = useState('');
   const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
   
   const user = useSelector((state: RootState) => state.auth.user);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const isLoading = useSelector((state: RootState) => state.loans.isLoading);
   const rawFloanRequests = useSelector((state: RootState) => state.loans?.loans?.floans);
   const floanRequests = useMemo(() => rawFloanRequests || [], [rawFloanRequests]);
   
   const today = new Date().toISOString().split('T')[0];
   const borrowerUserId = user?.id || '';
   const lenderUserId = '';
   const effectiveCreditLimit = getEffectiveCreditLimit(user?.cs || 0, user?.isWorldId === 'ACTIVE');
   
   const [loanAmount, setLoanAmount] = useState('');
   const [totalRepaymentAmount, setTotalRepaymentAmount] = useState('');
   const [reason, setReason] = useState('');
   const [days, setDays] = useState('');
   const [customAmount, setCustomAmount] = useState('');
   
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

   const clear = () => {
      setTotalRepaymentAmount('');
      setLoanAmount('');
      setReason('');
      setDays('');
   };

   const handleFiltersChange = (newFilters: Partial<LoanFilters>) => {
      setFilters((prev) => {
         const updated = { ...prev, ...newFilters };

         if ('date' in newFilters && newFilters.date !== null) {
            updated.loanTime = '';
         }

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
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_LIMIT_REACHED));
         return;
      }

      if (user.isWorldId !== 'ACTIVE') {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.WORLDID_REQUIRED));
         return;
      }

      if (!user.walletAddress || user.walletAddress.trim() === '') {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.WALLET_MISSING));
         return;
      }

      if (account.chain?.id !== ALLOWED_CHAIN_ID) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.NETWORK_REQUIRED));
         return;
      }

      if (!loanAmount || parseFloat(loanAmount) <= 0) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_INVALID_AMOUNT));
         return;
      }

      if (parseFloat(loanAmount) > effectiveCreditLimit) {
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

   const handleDays = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedDate = e.target.value;
      const date = new Date(selectedDate);
      const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
      setDays(utcDate.toISOString());
   };

   const handlePurple = () => {
      setShowPurple(true);
      setShowModal(false);
   };

   useEffect(() => {
      const loadLoans = async () => {
         try {
            const loans = await dispatch(fetchLoans()).unwrap();
            const borrowerUserIds = [...new Set(loans.map((loan: Loan) => loan.borrowerUser).filter(Boolean))] as string[];
            if (borrowerUserIds.length > 0) {
               await dispatch(fetchUserProfiles(borrowerUserIds)).unwrap();
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
         search: searchQuery,
         sortBy: filters.sortBy
      };
      return filterLoans(floanRequests, allFilters, customAmount, userProfiles);
   }, [filters, searchQuery, floanRequests, customAmount, userProfiles]);

   const {
      displayedItems: displayedLoans,
      displayedCount,
      totalCount,
      handleLoadMore
   } = usePagination({
      items: filteredLoans,
      resetDependencies: [filters, searchQuery]
   });

   const handleSuccessModalClose = useCallback(() => {
      setShowPurple(false);
   }, []);

   const handleViewRequest = (loan: Loan) => {
      setSelectedLoan(loan);
      // Could open a modal or navigate to a detail page
      console.log('View request:', loan);
   };

   return (
      <>
         <div className="min-h-screen bg-background">
            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-24">
               <LenderBoardHeader />

               <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                  Microloan Request Board
               </h1>
               <p className="text-sm text-muted-foreground mb-6">
                  Browse requests posted on Moodeng, or jump right in and get verified to start
                  borrowing in USDC.
               </p>

               <LoanApplicationBanner onApplyClick={handleApplyLoanClick} />

               <BrowseRequestsHeader
                  searchValue={searchQuery}
                  onSearchChange={setSearchQuery}
                  onFilterClick={() => setShowFilterSidebar(!showFilterSidebar)}
               />

               <div className="flex flex-col md:flex-row gap-6">
                  {showFilterSidebar && (
                     <div className="md:w-64 shrink-0">
                        <FilterSidebar
                           filters={filters}
                           onFiltersChange={handleFiltersChange}
                           customAmount={customAmount}
                           onCustomAmountChange={setCustomAmount}
                        />
                     </div>
                  )}

                  <div className="flex-1 min-w-0">
                     {isLoading ? (
                        <Card className="rounded-2xl">
                           <CardContent className="flex flex-col items-center justify-center py-20">
                              <div
                                 className="w-8 h-8 animate-spin rounded-full border-2 border-[#6d57ff] border-t-transparent"
                                 aria-hidden
                              />
                              <p className="mt-4 text-sm text-muted-foreground">
                                 Loading requests…
                              </p>
                            </CardContent>
                        </Card>
                     ) : displayedLoans && Array.isArray(displayedLoans) && displayedLoans.length > 0 ? (
                        <>
                           <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                              {displayedLoans.map((loan) => (
                                 <BorrowerRequestCard
                                    key={loan.id}
                                    loan={loan}
                                    onViewRequest={() => handleViewRequest(loan)}
                                 />
                              ))}
                           </div>
                           <LoadMoreButton
                              currentCount={displayedCount}
                              totalCount={totalCount}
                              onLoadMore={handleLoadMore}
                           />
                        </>
                     ) : (
                        <Card className="rounded-2xl">
                           <CardContent className="flex flex-col items-center justify-center py-20">
                              <div
                                 className="rounded-full bg-muted p-4 mb-4"
                                 aria-hidden
                              >
                                 <svg
                                    className="size-10 text-muted-foreground"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                 >
                                    <path
                                       strokeLinecap="round"
                                       strokeLinejoin="round"
                                       strokeWidth={1.5}
                                       d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                                    />
                                 </svg>
                              </div>
                              <p className="text-muted-foreground font-medium">No loan requests found.</p>
                           </CardContent>
                        </Card>
                     )}
                  </div>
               </div>
            </main>
         </div>
         
         {/* Modals */}
         <LoanRequestModal
            isOpen={showModal}
            onClose={handleCloseModal}
            showVerify={user?.isWorldId !== 'ACTIVE'}
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
