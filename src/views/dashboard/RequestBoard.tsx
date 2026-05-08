import { type ChangeEvent, type FormEvent, type MouseEvent, type RefObject, useCallback, useEffect, useMemo, useState } from 'react';

import { AlertTriangle, HelpCircle, Search, Wallet, X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import GuidedTourPreview from '@/components/GuidedTourPreview';
import FilterSidebar from '@/components/filters/FilterSidebar';
import { useIsBorrower } from '@/hooks/useIsBorrower';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import WorldIDVerification from '@/components/worldId/WorldIDVerification';

import { useClickOutside } from '@/hooks/useClickOutside';
import { usePagination } from '@/hooks/usePagination';

import { filterLoans, type LoanFilters } from '@/utils/loanFilters';

import { logoImageSrc } from '@/config/navigationConfig';
import { getEffectiveCreditLimit } from '@/lib/creditLeveling';
import { fetchUser, fetchUserProfiles } from '@/store/slices/authSlice';
import { createLoan, fetchLoans, getLenderRepaidCount } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { User } from '@/types/authTypes';
import { ERROR_CODES } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';
import type { Loan } from '@/types/loanTypes';
import LoanRequestModal, { type AppliedReferralCode } from '@/views/dashboard/components/LoanRequestModal';
import { RequestBoardFilterContextProvider } from '@/views/dashboard/components/RequestBoardFilterContext';
import SuccessModal from '@/views/dashboard/components/SuccessModal';
import UserCard from '@/views/dashboard/components/UserCard';
import LoadMoreButton from '@/views/profile/components/shared/LoadMoreButton';

import UserAvatar from '@/components/UserAvatar';

const LENDER_NOTE_STORAGE_KEY = 'moodeng_lender_note_dismissed';
const VERIFIED_REQUEST_BOARD_TOUR_STEP_COUNT = 5;
const UNVERIFIED_REQUEST_BOARD_TOUR_STEP_COUNT = 4;
const DASHBOARD_TOUR_STEP_COUNT = 3;
const REFERRAL_TEST_USER: User = {
   id: 'referral-test-user',
   username: 'referral-test',
   email: 'referral-test@moodeng.local',
   walletAddress: '0x0000000000000000000000000000000000000000',
   isWorldId: 'ACTIVE',
   mal: 3,
   nal: 0,
   cs: 100,
   userRole: 'borrower',
   createdAt: new Date(0).toISOString(),
   updatedAt: new Date(0).toISOString()
};
const LENDER_TOUR_USER: User = {
   id: 'lender-tour-user',
   username: 'lender-tour',
   email: 'lender-tour@moodeng.local',
   walletAddress: '0x1111111111111111111111111111111111111111',
   isWorldId: 'ACTIVE',
   mal: 0,
   nal: 0,
   cs: 320,
   userRole: 'lender',
   createdAt: new Date(0).toISOString(),
   updatedAt: new Date(0).toISOString()
};
const LENDER_TOUR_LOANS: Loan[] = [
   {
      id: 'lender-tour-loan-1',
      trackingId: 'LENDER-TOUR-001',
      borrowerWallet: '0x71c4000000000000000000000000000000009d42',
      lenderWallet: '',
      borrowerUser: 'lender-tour-borrower',
      lenderUser: '',
      loanAmount: 15,
      repaidAmount: 0,
      totalRepaymentAmount: 17,
      reason: 'Emergency groceries',
      loanStatus: 'Requested',
      repaymentStatus: 'Unpaid',
      dueDate: '2026-05-16T00:00:00.000Z',
      coin: 'USDC',
      hash: [],
      createdAt: '2026-05-08T00:00:00.000Z',
      updatedAt: '2026-05-08T00:00:00.000Z'
   }
];

export default function RequestBoard() {
   return (
      <RequestBoardFilterContextProvider>
         <RequestBoard$ />
      </RequestBoardFilterContextProvider>
   );
}

function RequestBoard$() {
   const location = useLocation();
   const pathname = location.pathname;
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();

   const { showToastByConfig } = useToast();

   const [showModal, setShowModal] = useState(false);
   const [showPurple, setShowPurple] = useState(false);
   const [showBaseWalletGate, setShowBaseWalletGate] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [showFilters, setShowFilters] = useState(false);
   const [showLenderNote, setShowLenderNote] = useState(false);

   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const isLoading = useSelector((state: RootState) => state.loans.isLoading);
   const requestBoardSearchParams = new URLSearchParams(location.search);
   const isReferralTestMode = import.meta.env.DEV && requestBoardSearchParams.has('referralTest');
   const showTourPreview = import.meta.env.DEV && requestBoardSearchParams.has('tourPreview');
   const isLenderTourPreview = import.meta.env.DEV && requestBoardSearchParams.has('lenderTourPreview');
   const shouldForceReferralTestUser = isReferralTestMode && showTourPreview;
   const effectiveUser = isLenderTourPreview
      ? LENDER_TOUR_USER
      : isReferralTestMode && (shouldForceReferralTestUser || !(user?.id && username))
        ? REFERRAL_TEST_USER
        : user;
   const isAuthenticated = !!(effectiveUser?.id && (username || isReferralTestMode || isLenderTourPreview));
   const showVerify = effectiveUser?.isWorldId !== 'ACTIVE';
   const storeIsBorrower = useIsBorrower();
   const isBorrower = isLenderTourPreview ? false : isReferralTestMode || storeIsBorrower;
   const shouldShowBorrowerTour = showTourPreview && (!isAuthenticated || isBorrower);
   const shouldShowLenderTour = showTourPreview && isLenderTourPreview && isAuthenticated && !isBorrower;
   const rawFloanRequests = useSelector((state: RootState) => state.loans?.loans?.floans);
   const floanRequests = useMemo(() => rawFloanRequests || [], [rawFloanRequests]);
   const [sortedLoans, setSortedLoans] = useState(floanRequests);

   const today = new Date().toISOString().split('T')[0];
   const borrowerUserId = effectiveUser?.id || '';
   const lenderUserId = '';
   const [loanAmount, setLoanAmount] = useState('');
   const [totalRepaymentAmount, setTotalRepaymentAmount] = useState('');
   const [reason, setReason] = useState('');
   const [days, setDays] = useState('');
   const [customAmount, setCustomAmount] = useState('');
   const [searchLoan, setSearchLoan] = useState('');
   const [appliedReferral, setAppliedReferral] = useState<AppliedReferralCode | null>(null);
   const effectiveCreditLimit = isAuthenticated ? getEffectiveCreditLimit(effectiveUser.cs, effectiveUser.isWorldId === 'ACTIVE') : 0;
   const hasBorrowerBaseWallet = Boolean(effectiveUser?.walletAddress?.trim());
   const shouldOpenLoanRequest =
      (location.state as { openLoanRequest?: boolean } | null)?.openLoanRequest === true ||
      new URLSearchParams(location.search).get('applyLoan') === '1';

   const loanRequestModalRef = useClickOutside<HTMLDivElement>(() => setShowModal(false), showModal) as RefObject<HTMLDivElement>;
   const successModalRef = useClickOutside<HTMLDivElement>(() => setShowPurple(false), showPurple) as RefObject<HTMLDivElement>;
   const baseWalletGateRef = useClickOutside<HTMLDivElement>(() => setShowBaseWalletGate(false), showBaseWalletGate) as RefObject<HTMLDivElement>;

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
      setAppliedReferral(null);
   };

   const handleFiltersChange = (newFilters: Partial<LoanFilters>) => {
      setFilters((prev) => {
         const updated = { ...prev, ...newFilters };
         if ('date' in newFilters && newFilters.date !== null) updated.loanTime = '';
         if ('loanTime' in newFilters && newFilters.loanTime !== '') updated.date = null;
         return updated;
      });
   };

   const handleApplyLoanClick = (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if ((effectiveUser.nal || 0) >= (effectiveUser.mal || 0)) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_LIMIT_REACHED));
         return;
      }
      if (!hasBorrowerBaseWallet) {
         setShowModal(false);
         setShowBaseWalletGate(true);
         return;
      }
      setShowModal(true);
   };

   const handleCloseModal = useCallback(() => setShowModal(false), []);
   const handleAddBaseWallet = useCallback(() => {
      setShowBaseWalletGate(false);
      navigate('/onboarding/wallet', { state: { returnTo: 'loan-request' } });
   }, [navigate]);
   const handleRequestBoardTourStepChange = useCallback((index: number) => {
      if (index >= 2) setShowModal(true);
   }, []);
   const handleRequestBoardTourFinish = useCallback(() => {
      setShowModal(false);
      navigate('/dashboard?mockData=rich&tourPreview=1');
   }, [navigate]);
   const handleLenderTourFinish = useCallback(() => {
      navigate('/user/maya-demo?demo=rich&lenderTourPreview=1&tourPreview=1');
   }, [navigate]);
   const requestBoardTourSteps = showVerify
      ? [
           {
              target: '[data-tour-target="request-latest-list"]',
              title: 'Request Board',
              body: 'This list is the marketplace. Once a request is live, lenders can review the amount, repayment, and borrower profile before funding.',
              durationMs: 6000
           },
           {
              target: '[data-tour-target="request-apply-card"]',
              title: 'Apply for a loan',
              body: 'When you are ready to borrow, this card opens the loan request form.',
              durationMs: 6000
           },
           {
              target: '[data-tour-target="loan-verification-card"]',
              title: 'Verify first',
              body: 'Before an unverified borrower can request a loan, Moodeng asks for one quick verification step so lenders know they are funding a real person.',
              durationMs: 6500
           },
           {
              target: '[data-tour-target="loan-borrow-amount"]',
              title: 'Loan terms preview',
              body: 'After verification, this is where the borrower sets the amount, repayment, date, and reason for the request.',
              durationMs: 6000
           }
        ]
      : [
           {
              target: '[data-tour-target="request-latest-list"]',
              title: 'Request Board',
              body: 'This list is the marketplace. Once a request is live, lenders can review the amount, repayment, and borrower profile before funding.',
              durationMs: 6000
           },
           {
              target: '[data-tour-target="request-apply-card"]',
              title: 'Apply for a loan',
              body: 'When you are ready to borrow, this card opens the loan request form.',
              durationMs: 6000
           },
           {
              target: '[data-tour-target="loan-borrow-amount"]',
              title: 'Trust-building vs credit-building',
              body: 'Borrowing below your limit can build trust history. Borrowing your full limit and repaying on time is what raises your Credit Level.',
              durationMs: 7800
           },
           {
              target: '[data-tour-target="loan-repayment-amount"]',
              title: 'Set a clear repayment',
              body: 'Your repayment must be at least $1 more than what you borrow. Lenders use this to decide if the request is worth funding.',
              durationMs: 6400
           },
           {
              target: '[data-tour-target="loan-reason"]',
              title: 'Explain the reason',
              body: 'A short, specific reason helps lenders understand the request and builds trust before they fund it.',
              durationMs: 6000
           }
        ];
   const requestBoardTourStepCount = showVerify ? UNVERIFIED_REQUEST_BOARD_TOUR_STEP_COUNT : VERIFIED_REQUEST_BOARD_TOUR_STEP_COUNT;
   const lenderTourSteps = [
      {
         target: '[data-tour-target="request-latest-list"]',
         title: 'Find open requests',
         body: 'As a lender, this board shows people asking for short-term USDC support. Start by comparing the amount, repayment, due date, and reason.',
         durationMs: 6500
      },
      {
         target: '[data-tour-target="lender-request-card"]',
         title: 'Review the request',
         body: 'Each card shows what the borrower needs, what they plan to repay, and whether their account is in good standing.',
         durationMs: 6200
      },
      {
         target: '[data-tour-target="lender-borrower-details-link"]',
         title: 'Check Borrower Insights',
         body: 'Before funding, open Borrower Details to review repayment behavior, credit level, and trust signals. The tour continues there next.',
         durationMs: 6500
      }
   ];
   const handleReferralRedeemed = useCallback(async () => {
      try {
         await dispatch(fetchUser()).unwrap();
      } catch (error) {
         console.error('Error refreshing user after referral redemption:', (error as Error).message || error);
      }
   }, [dispatch]);

   useEffect(() => {
      if (!shouldOpenLoanRequest || !isAuthenticated || !isBorrower || !effectiveUser?.id) return;
      if ((effectiveUser.nal || 0) >= (effectiveUser.mal || 0)) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_LIMIT_REACHED));
         navigate(pathname, { replace: true, state: null });
         return;
      }
      if (!hasBorrowerBaseWallet) {
         setShowModal(false);
         setShowBaseWalletGate(true);
         navigate(pathname, { replace: true, state: null });
         return;
      }
      setShowModal(true);
      navigate(pathname, { replace: true, state: null });
   }, [
      isAuthenticated,
      isBorrower,
      navigate,
      pathname,
      shouldOpenLoanRequest,
      showToastByConfig,
      hasBorrowerBaseWallet,
      effectiveUser?.id,
      effectiveUser?.mal,
      effectiveUser?.nal
   ]);

   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (isSubmitting) return;

      const borrowerWallet = effectiveUser.walletAddress?.trim();
      const parsedLoanAmount = Number.parseFloat(loanAmount);
      const parsedRepaymentAmount = Number.parseFloat(totalRepaymentAmount);

      if ((effectiveUser.nal || 0) >= (effectiveUser.mal || 0)) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_LIMIT_REACHED));
         return;
      }
      if (effectiveUser.isWorldId !== 'ACTIVE') {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.WORLDID_REQUIRED));
         return;
      }
      if (!borrowerWallet) {
         setShowModal(false);
         setShowBaseWalletGate(true);
         return;
      }
      if (!loanAmount || Number.isNaN(parsedLoanAmount) || parsedLoanAmount <= 0) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_INVALID_AMOUNT));
         return;
      }
      if (parsedLoanAmount > effectiveCreditLimit) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_AMOUNT_EXCEEDS_LIMIT));
         return;
      }
      if (!totalRepaymentAmount || Number.isNaN(parsedRepaymentAmount) || parsedRepaymentAmount < parsedLoanAmount + 1) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_REPAYMENT_TOO_LOW));
         return;
      }

      const loanData = {
         borrowerUserId: borrowerUserId || '',
         borrowerWallet,
         lenderUserId,
         loanAmount: parsedLoanAmount,
         totalRepaymentAmount: parsedRepaymentAmount,
         reason,
         dueDate: days,
         referralCodeId: appliedReferral?.id,
         referralCode: appliedReferral?.code,
         referralBoostAmount: appliedReferral?.boostAmount
      };

      if (
         effectiveUser.isWorldId === 'ACTIVE' &&
         Boolean(borrowerWallet) &&
         (effectiveUser.nal || 0) < (effectiveUser.mal || 0) &&
         parsedLoanAmount <= effectiveCreditLimit &&
         parsedLoanAmount > 0 &&
         parsedRepaymentAmount >= parsedLoanAmount + 1
      ) {
         setIsSubmitting(true);
         try {
            await dispatch(createLoan(loanData)).unwrap();
            clear();
            setShowPurple(true);
            setShowModal(false);
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

   const handleDays = (e: ChangeEvent<HTMLInputElement>) => {
      if (!e.target.value) {
         setDays('');
         return;
      }
      const date = new Date(e.target.value);
      const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
      setDays(utcDate.toISOString());
   };

   const dismissLenderNote = () => {
      setShowLenderNote(false);
      localStorage.setItem(LENDER_NOTE_STORAGE_KEY, 'true');
   };

   useEffect(() => {
      if (isBorrower || !user?.id) return;
      if (localStorage.getItem(LENDER_NOTE_STORAGE_KEY) === 'true') return;

      dispatch(getLenderRepaidCount(user.id))
         .unwrap()
         .then((count) => {
            if (count >= 2) setShowLenderNote(true);
         })
         .catch(() => undefined);
   }, [isBorrower, user?.id, dispatch]);

   useEffect(() => {
      if (typeof window !== 'undefined' && window.location.hash) {
         const element = document.getElementById(window.location.hash.replace('#', ''));
         if (element) element.scrollIntoView({ behavior: 'smooth' });
      }
   }, [pathname]);

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
      const allFilters: LoanFilters = { ...filters, search: searchLoan, sortBy: filters.sortBy };
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

   const handleSuccessModalClose = useCallback(() => setShowPurple(false), []);

   const firstName = user?.username?.split(' ')[0] || user?.username || 'there';
   const displayFirstName = effectiveUser?.username?.split(' ')[0] || effectiveUser?.username || firstName;
   const visibleLoans = shouldShowLenderTour && displayedLoans.length === 0 ? LENDER_TOUR_LOANS : displayedLoans;
   const isListLoading = isLoading && !shouldShowLenderTour;

   return (
      <>
         <div id="top" className="min-h-screen bg-md-neutral-200">
            <div className="max-w-[440px] mx-auto pb-28">
               {/* Header — authenticated vs public */}
               {isAuthenticated ? (
                  <div className="flex items-center justify-between px-md-5 py-md-3">
                     <div className="flex items-center gap-3">
                        <UserAvatar size={48} />
                        <div className="flex flex-col gap-1">
                           <p className="text-md-h5 font-semibold text-md-primary-2000">Hello, {displayFirstName}</p>
                           {isBorrower ? (
                              <div className="flex items-center gap-2">
                                 {showVerify ? (
                                    <>
                                       <span className="inline-flex items-center gap-1 px-md-1 py-md-0 bg-md-red-100 rounded-md-sm">
                                          <span className="w-3 h-3 rounded-full bg-md-red-800 flex items-center justify-center">
                                             <span className="text-white text-[8px] font-bold">!</span>
                                          </span>
                                          <span className="text-md-b3 font-semibold text-md-red-800">Not Verified</span>
                                       </span>
                                       <WorldIDVerification>
                                          {({ open }) => (
                                             <button onClick={open} className="text-md-b3 font-semibold text-md-primary-900 underline">
                                                {'Verify World ID >'}
                                             </button>
                                          )}
                                       </WorldIDVerification>
                                    </>
                                 ) : (
                                    <span className="inline-flex items-center gap-1 px-md-1 py-md-0 bg-md-green-100 rounded-md-sm">
                                       <span className="w-3 h-3 rounded-full bg-md-green-900 flex items-center justify-center">
                                          <span className="text-white text-[8px] font-bold">&#10003;</span>
                                       </span>
                                       <span className="text-md-b3 font-semibold text-md-green-900">Verified</span>
                                    </span>
                                 )}
                              </div>
                           ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-md-primary-900 rounded-md-sm w-fit">
                                 <span className="text-md-b3 font-semibold text-md-neutral-100 capitalize whitespace-nowrap">
                                    IOU {effectiveUser?.cs?.toLocaleString() ?? '0'}
                                 </span>
                              </span>
                           )}
                        </div>
                     </div>
                     <button
                        type="button"
                        onClick={() => navigate('/support')}
                        aria-label="Open help and support center"
                        className="shrink-0 w-12 h-12 bg-white rounded-full shadow-md-card flex items-center justify-center"
                     >
                        <HelpCircle className="w-6 h-6 text-md-primary-900" strokeWidth={1.5} />
                     </button>
                  </div>
               ) : (
                  /* Public header — logo + wordmark only */
                  <div className="flex items-center gap-2 px-md-5 py-md-3">
                     <div className="w-10 h-10 rounded-full bg-md-primary-1200 flex items-center justify-center overflow-hidden">
                        <img src={logoImageSrc} alt="Moodeng" className="w-8 h-8 object-contain" />
                     </div>
                     <span className="text-md-h5 font-semibold text-md-heading">Moodeng</span>
                  </div>
               )}

               {/* Content */}
               <div className="flex flex-col gap-5 px-md-4 py-md-3">
                  {/* Title */}
                  <div className="flex flex-col gap-1" data-tour-target="request-board-title">
                     <h1 className="text-md-h3 font-semibold text-md-heading">Microloan Request Board</h1>
                     <p className="text-md-b2 font-medium text-md-neutral-700">
                        {isAuthenticated
                           ? 'Browse requests posted on Moodeng, or jump right in and get verified to start borrowing in USDC.'
                           : 'Browse requests publicly.'}
                     </p>
                  </div>

                  {/* Apply Loan Card — visible for authenticated borrowers, or as CTA for public */}
                  {isAuthenticated && isBorrower ? (
                     <div
                        className="bg-md-primary-100 border border-[#f0f0f0] rounded-md-lg p-4 relative overflow-hidden max-[374px]:p-3"
                        data-tour-target="request-apply-card"
                     >
                        <div className="flex flex-col gap-4 relative z-10">
                           <div className="flex flex-col gap-1 max-w-[232px] max-[374px]:max-w-[184px]">
                              <p className="text-md-h5 font-semibold text-md-heading max-[374px]:text-[22px]">Need short-term support?</p>
                              <p className="text-md-b2 font-medium text-md-neutral-700">
                                 <span className="max-[374px]:hidden">
                                    Borrow USDC to build trust and
                                    <br />
                                    unlock higher loan levels.
                                 </span>
                                 <span className="hidden max-[374px]:inline">Borrow USDC to build trust. Unlock higher levels.</span>
                              </p>
                           </div>
                           <button
                              onClick={handleApplyLoanClick}
                              data-tour-target="request-apply-button"
                              className="bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold px-md-4 py-md-3 rounded-md-lg w-fit max-[374px]:px-5 max-[374px]:py-3 max-[374px]:text-[15px]"
                           >
                              Apply For A Loan
                           </button>
                        </div>
                        <img
                           src="/hippos/thumb-up-right.png"
                           alt=""
                           className="absolute right-0 top-0 h-full object-contain pointer-events-none max-[374px]:bottom-0 max-[374px]:right-[-42px] max-[374px]:top-auto max-[374px]:h-[76%]"
                        />
                     </div>
                  ) : !isAuthenticated ? (
                     <div className="bg-md-primary-100 border border-[#f0f0f0] rounded-md-lg p-4 relative overflow-hidden max-[374px]:p-3">
                        <div className="flex flex-col gap-4 relative z-10">
                           <div className="flex flex-col gap-1 max-w-[232px] max-[374px]:max-w-[184px]">
                              <p className="text-md-h5 font-semibold text-md-heading max-[374px]:text-[22px]">Need short-term support?</p>
                              <p className="text-md-b2 font-medium text-md-neutral-700">
                                 <span className="max-[374px]:hidden">
                                    Borrow USDC to build trust and
                                    <br />
                                    unlock higher loan levels.
                                 </span>
                                 <span className="hidden max-[374px]:inline">Borrow USDC to build trust. Unlock higher levels.</span>
                              </p>
                           </div>
                           <Link
                              to="/sign-up"
                              className="border border-md-primary-1200 text-md-primary-1200 text-md-b1 font-semibold px-md-4 py-md-3 rounded-md-lg w-fit max-[374px]:px-5 max-[374px]:py-3 max-[374px]:text-[15px]"
                           >
                              Apply For A Loan
                           </Link>
                        </div>
                        <img
                           src="/hippos/thumb-up-right.png"
                           alt=""
                           className="absolute right-0 top-0 h-full object-contain pointer-events-none max-[374px]:bottom-0 max-[374px]:right-[-42px] max-[374px]:top-auto max-[374px]:h-[76%]"
                        />
                     </div>
                  ) : null}

                  {/* Browse Section */}
                  <div className="flex flex-col gap-5" data-tour-target="request-latest-list">
                     <div className="flex flex-col gap-4">
                        <p className="text-md-h5 font-semibold text-md-heading">Browse Latest Requests</p>
                        <div className="flex items-center gap-4">
                           {/* Search Bar */}
                           <div className="flex-1 bg-md-neutral-100 border border-md-neutral-600 rounded-[12px] shadow-md-card flex items-center gap-2.5 p-3">
                              <Search className="w-6 h-6 text-md-neutral-800" strokeWidth={1.5} />
                              <input
                                 value={searchLoan}
                                 onChange={(e) => setSearchLoan(e.target.value)}
                                 className="flex-1 bg-transparent text-md-b2 font-normal text-md-neutral-2000 placeholder:text-md-neutral-800 outline-none"
                                 placeholder="Search requests"
                                 type="search"
                              />
                           </div>
                           {/* Filter Button */}
                           <button
                              onClick={() => setShowFilters(!showFilters)}
                              className="shrink-0 border border-md-primary-1200 rounded-[12px] p-3 flex items-center justify-center"
                           >
                              <img src="/icons/filter.png" alt="Filter" className="w-6 h-6" />
                           </button>
                        </div>
                     </div>

                     {/* Important Note — lender only */}
                     {isAuthenticated && !isBorrower && showLenderNote && (
                        <div className="bg-[rgba(255,237,161,0.2)] rounded-md-lg flex items-start gap-4 px-4 py-[15px]">
                           <AlertTriangle className="w-5 h-5 shrink-0 text-md-yellow-700 mt-0.5" strokeWidth={2} />
                           <div className="flex-1 flex flex-col gap-1">
                              <p className="text-md-b3 font-semibold text-[#ae8c00]">IMPORTANT NOTE</p>
                              <p className="text-md-b3 font-normal text-black leading-[1.3]">
                                 Once lenders have issued three loans, a fee will be charged to their accounts. This fee helps maintain the
                                 platform's operational costs and ensures continued support for all users.
                              </p>
                           </div>
                           <button onClick={dismissLenderNote} className="shrink-0 mt-0.5">
                              <X className="w-6 h-6 text-md-neutral-1400" strokeWidth={2} />
                           </button>
                        </div>
                     )}

                     {/* Filters Sidebar (toggled) */}
                     {showFilters && (
                        <FilterSidebar
                           filters={filters}
                           onFiltersChange={handleFiltersChange}
                           customAmount={customAmount}
                           onCustomAmountChange={setCustomAmount}
                           onClose={() => setShowFilters(false)}
                        />
                     )}

                     {/* Request Cards */}
                     <div className="flex flex-col gap-5">
                        {isListLoading ? (
                           <div className="flex justify-center py-20">
                              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-md-primary-900" />
                           </div>
                        ) : visibleLoans && visibleLoans.length > 0 ? (
                           visibleLoans.map((loan) => (
                              <UserCard
                                 key={loan.id}
                                 {...loan}
                                 isBorrower={isBorrower}
                                 isAuthenticated={isAuthenticated}
                                 tourBorrowerUsername={loan.id.startsWith('lender-tour') ? 'maya-demo' : undefined}
                              />
                           ))
                        ) : (
                           <div className="text-center py-20 text-md-neutral-1200 text-md-b2">No loan requests found.</div>
                        )}
                     </div>

                     {!isListLoading && !shouldShowLenderTour && <LoadMoreButton currentCount={displayedCount} totalCount={totalCount} onLoadMore={handleLoadMore} />}
                  </div>
               </div>
            </div>
         </div>

         {/* Bottom auth bar for logged-out users */}
         {!isAuthenticated && (
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-md-neutral-400 py-4 px-5">
               <div className="max-w-[440px] mx-auto flex items-center gap-3">
                  <Link
                     to="/sign-in"
                     className="flex-1 text-center py-3 rounded-md-lg border border-md-primary-1200 text-md-primary-1200 text-md-b1 font-semibold"
                  >
                     Sign In
                  </Link>
                  <Link
                     to="/sign-up"
                     className="flex-1 text-center py-3 rounded-md-lg bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold"
                  >
                     Sign Up
                  </Link>
               </div>
            </div>
         )}

         {isAuthenticated && isBorrower && (
            <>
               <BaseWalletRequiredModal
                  isOpen={showBaseWalletGate}
                  clickOutsideRef={baseWalletGateRef}
                  onClose={() => setShowBaseWalletGate(false)}
                  onAddBaseWallet={handleAddBaseWallet}
               />
               <LoanRequestModal
                  isOpen={showModal}
                  onClose={handleCloseModal}
                  showVerify={showVerify}
                  user={effectiveUser}
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
                  onReferralApplied={setAppliedReferral}
                  onReferralRedeemed={handleReferralRedeemed}
                  isSubmitting={isSubmitting}
                  startOnReferralStep={!shouldShowBorrowerTour}
                  clickOutsideRef={loanRequestModalRef}
               />
               <SuccessModal isOpen={showPurple} onClose={handleSuccessModalClose} clickOutsideRef={successModalRef} />
            </>
         )}
         {shouldShowBorrowerTour && (
            <GuidedTourPreview
               onFinish={handleRequestBoardTourFinish}
               onStepChange={handleRequestBoardTourStepChange}
               totalSteps={requestBoardTourStepCount + DASHBOARD_TOUR_STEP_COUNT}
               steps={requestBoardTourSteps}
            />
         )}
         {shouldShowLenderTour && <GuidedTourPreview onFinish={handleLenderTourFinish} totalSteps={9} steps={lenderTourSteps} />}
      </>
   );
}

function BaseWalletRequiredModal({
   isOpen,
   clickOutsideRef,
   onClose,
   onAddBaseWallet
}: {
   isOpen: boolean;
   clickOutsideRef: RefObject<HTMLDivElement>;
   onClose: () => void;
   onAddBaseWallet: () => void;
}) {
   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-[100] bg-black/40 flex items-end sm:items-center justify-center px-md-3 py-md-4">
         <div
            ref={clickOutsideRef}
            className="w-full max-w-[408px] rounded-t-[32px] sm:rounded-[32px] bg-white shadow-md-overlay overflow-hidden"
         >
            <div className="flex items-center justify-between border-b border-md-neutral-400 px-md-4 py-md-3">
               <div className="flex items-center gap-md-2">
                  <div className="size-11 rounded-md-lg bg-md-blue-700 inline-flex items-center justify-center">
                     <img src="/icons/base-wallet.png" alt="" className="size-7" />
                  </div>
                  <h2 className="text-md-h4 font-semibold text-md-heading">Add Base Wallet</h2>
               </div>
               <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close add Base wallet"
                  className="size-11 rounded-full inline-flex items-center justify-center text-md-heading active:bg-md-neutral-300"
               >
                  <X className="size-7" strokeWidth={2.25} />
               </button>
            </div>

            <div className="flex flex-col gap-md-4 px-md-4 py-md-5">
               <div className="rounded-md-lg border border-md-primary-300 bg-md-primary-100 px-md-4 py-md-4">
                  <div className="flex items-start gap-md-3">
                     <div className="mt-0.5 size-10 rounded-full bg-md-primary-900/10 inline-flex items-center justify-center shrink-0">
                        <Wallet className="size-5 text-md-primary-900" strokeWidth={1.8} />
                     </div>
                     <p className="text-md-b1 font-medium leading-[1.45] text-md-neutral-900">
                        Moodeng sends funded loans to your Base wallet. Add it once before requesting a loan. Borrowing on Moodeng
                        uses USDC on Base, so transfers are free and required.
                     </p>
                  </div>
               </div>

               <button
                  type="button"
                  onClick={onAddBaseWallet}
                  className="w-full rounded-md-lg bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 active:scale-[0.99]"
               >
                  Add Base Wallet
               </button>
               <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-md-lg border border-md-neutral-500 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-1200 active:bg-md-neutral-200"
               >
                  Not now
               </button>
            </div>
         </div>
      </div>
   );
}
