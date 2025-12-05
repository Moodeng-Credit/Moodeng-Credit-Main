'use client';

import { type MouseEvent, type RefObject, useCallback, useEffect, useMemo, useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useSelector } from 'react-redux';

import FilterSidebar from '@/components/filters/FilterSidebar';
import SearchBar from '@/components/filters/SearchBar';
import SortButtons from '@/components/filters/SortButtons';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import YouTubeVideoLightbox from '@/components/ui/YouTubeVideoLightbox';
import WorldIDVerification from '@/components/worldId/WorldIDVerification';

import { useLoans } from '@/hooks/api';
import { useClickOutside } from '@/hooks/useClickOutside';
import { usePagination } from '@/hooks/usePagination';

import { filterLoans, type LoanFilters } from '@/utils/loanFilters';

import type { RootState } from '@/store/store';
import { ERROR_CODES } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';
import LoanRequestModal from '@/views/dashboard/components/LoanRequestModal';
import SuccessModal from '@/views/dashboard/components/SuccessModal';
import UserCard from '@/views/dashboard/components/UserCard';
import LoadMoreButton from '@/views/profile/components/shared/LoadMoreButton';

const CREDIT_LEVELLING_VIDEO_ID = 'gaRjXOd2s2U';

export default function Dashboard() {
   const pathname = usePathname();
   const { showToastByConfig } = useToast();
   const [showModal, setShowModal] = useState(false);
   const [showSuccessModal, setShowSuccessModal] = useState(false);
   const user = useSelector((state: RootState) => state.auth.user);

   const { data: loans = [] } = useLoans();

   const [sortedLoans, setSortedLoans] = useState(loans);
   const [customAmount, setCustomAmount] = useState('');
   const [searchLoan, setSearchLoan] = useState('');

   const successModalRef = useClickOutside<HTMLDivElement>(() => setShowSuccessModal(false), showSuccessModal) as RefObject<HTMLDivElement>;

   const [filters, setFilters] = useState<LoanFilters>({
      amount: '',
      rate: '',
      date: null,
      loanTime: '',
      network: '',
      search: '',
      sortBy: undefined
   });

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

      if ((user.nal || 0) >= (user.mal || 0)) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_LIMIT_REACHED));
         return;
      }
      setShowModal(true);
   };

   const handleCloseModal = useCallback(() => {
      setShowModal(false);
   }, []);

   const handleLoanSuccess = useCallback(() => {
      setShowSuccessModal(true);
      setShowModal(false);
   }, []);

   useEffect(() => {
      if (typeof window !== 'undefined' && window.location.hash) {
         const element = document.getElementById(window.location.hash.replace('#', ''));
         if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
         }
      }
   }, [pathname]);

   const filteredLoans = useMemo(() => {
      const allFilters: LoanFilters = {
         ...filters,
         search: searchLoan,
         sortBy: filters.sortBy
      };
      return filterLoans(loans, allFilters, customAmount);
   }, [filters, searchLoan, loans, customAmount]);

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
      setShowSuccessModal(false);
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
                  <section className="flex-1 flex flex-col items-center mt-10 md:mt-0">
                     <div className="flex flex-wrap justify-start md:justify-end gap-3 mb-6 w-full max-w-xl">
                        <SortButtons
                           activeSort={filters.sortBy || ''}
                           onSortChange={(sort) => handleFiltersChange({ sortBy: sort || undefined })}
                        />
                        <SearchBar value={searchLoan} onChange={setSearchLoan} placeholder="Search Request..." />
                     </div>
                     <div className="flex flex-wrap justify-center gap-6">
                        {displayedLoans && Array.isArray(displayedLoans)
                           ? displayedLoans.map((loan) => <UserCard key={loan.id} {...loan} />)
                           : null}
                     </div>
                     <LoadMoreButton currentCount={displayedCount} totalCount={totalCount} onLoadMore={handleLoadMore} />
                  </section>
               </div>
               <Link href="/dashboard#top" className="float-right">
                  <Image
                     src="https://cdn.builder.io/api/v1/image/assets/c9a8899718394d87a40cf9e7196a9f95/e81253cfc6443f8a9fc2246506d2c6496689513b?placeholderIfAbsent=true"
                     className="w-[46px]"
                     alt="Floating action button"
                     width={100}
                     height={100}
                  />
               </Link>
            </main>
         </div>
         <LoanRequestModal isOpen={showModal} onClose={handleCloseModal} onSuccess={handleLoanSuccess} />
         <SuccessModal isOpen={showSuccessModal} onClose={handleSuccessModalClose} clickOutsideRef={successModalRef} />
      </>
   );
}
