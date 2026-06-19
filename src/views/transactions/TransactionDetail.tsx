import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AlertCircle, ChevronLeft, Clock3, Gift, X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import UserAvatar from '@/components/UserAvatar';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { TOAST_TYPES } from '@/components/ToastSystem/types';

import useWallet from '@/hooks/useWallet';

import { fetchUserProfiles } from '@/store/slices/authSlice';
import { getUserLoans, recordInterestReturn } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';
import { LoanStatus as LoanStatusValue, RepaymentStatus } from '@/types/loanTypes';
import { getTransactionLoanStatus, type TransactionLoanStatus } from '@/views/transactions/transactionHistoryFilters';

function buildPreviewLoan(): Loan {
   return {
      id: 'preview-active-loan',
      trackingId: 'preview-active-loan',
      borrowerUser: 'preview-borrower',
      lenderUser: '',
      borrowerWallet: '0x71c...9d42',
      lenderWallet: '0x8a4...19b0',
      loanAmount: 12,
      repaidAmount: 0,
      totalRepaymentAmount: 13.5,
      reason: 'Test loan: phone repair and daily expenses',
      loanStatus: LoanStatusValue.LENT,
      repaymentStatus: RepaymentStatus.UNPAID,
      dueDate: '2026-06-18T00:00:00.000Z',
      coin: 'USDC',
      hash: [],
      createdAt: '2026-05-05T00:00:00.000Z',
      updatedAt: '2026-05-05T00:00:00.000Z',
      fundedAt: '2026-05-05T00:00:00.000Z'
   };
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

function StatusChip({ status }: { status: TransactionLoanStatus }) {
   const map: Record<TransactionLoanStatus, { label: string; className: string; icon: React.ReactNode }> = {
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

type StepState = 'done' | 'active' | 'due' | 'pending';

interface TimelineStep {
   key: 'requested' | 'funded' | 'partial_repayment' | 'repaid' | 'interest_returned';
   label: string;
   description?: string;
   state: StepState;
}

function getActiveStepKey(loan: Loan): TimelineStep['key'] | null {
   if (loan.loanStatus === 'Requested') return 'funded';
   if (loan.repaymentStatus === 'Paid' && loan.interestReturnedAt) return null;
   if (loan.repaymentStatus === 'Paid') return null;
   return 'repaid';
}

function buildTimeline(loan: Loan): TimelineStep[] {
   const activeKey = getActiveStepKey(loan);
   const showPartial = activeKey === 'partial_repayment' || (activeKey === 'repaid' && loan.repaymentStatus === 'Partial');
   const interestAmount = loan.totalRepaymentAmount - loan.loanAmount;
   const showInterestReturned = loan.repaymentStatus === 'Paid' && interestAmount > 0.005 && !!loan.interestReturnedAt;

   const order: TimelineStep['key'][] = [
      'requested',
      'funded',
      ...(showPartial ? (['partial_repayment'] as TimelineStep['key'][]) : []),
      'repaid',
      ...(showInterestReturned ? (['interest_returned'] as TimelineStep['key'][]) : [])
   ];
   const activeIdx = activeKey ? order.indexOf(activeKey) : order.length;

   const stateFor = (key: TimelineStep['key'], idx: number): StepState => {
      if (idx < activeIdx) return 'done';
      if (idx === activeIdx) return key === 'repaid' ? 'due' : 'active';
      return 'pending';
   };

   const descriptionFor = (key: TimelineStep['key'], state: StepState): string | undefined => {
      if (key === 'requested') return formatDate(loan.createdAt);
      if (key === 'funded') {
         if (state === 'done') return formatDate(loan.fundedAt ?? loan.updatedAt);
         if (state === 'active') return 'Not funded yet';
         return undefined;
      }
      if (key === 'partial_repayment') {
         if (state === 'done') return formatDate(loan.updatedAt);
         return 'If applicable';
      }
      if (key === 'repaid') {
         if (state === 'done') return formatDate(loan.repaidAt ?? loan.updatedAt);
         if (loan.loanStatus === 'Requested') return 'Available after funding';
         return `Due ${formatDate(loan.dueDate)}`;
      }
      if (key === 'interest_returned') {
         return formatDate(loan.interestReturnedAt);
      }
      return undefined;
   };

   const labelFor = (key: TimelineStep['key'], state: StepState): string => {
      if (key === 'funded' && state === 'active') return 'Waiting for lender';
      if (key === 'repaid' && loan.loanStatus === 'Requested') return 'Repayment schedule';
      if (key === 'repaid' && state !== 'done') return 'Repayment due';
      const labels: Record<TimelineStep['key'], string> = {
         requested: 'Requested',
         funded: 'Funded',
         partial_repayment: 'Partial repayment',
         repaid: 'Repaid',
         interest_returned: 'Interest returned'
      };
      return labels[key];
   };

   return order.map((key, idx) => {
      const state = stateFor(key, idx);
      return {
         key,
         label: labelFor(key, state),
         description: descriptionFor(key, state),
         state
      };
   });
}

function StepDot({ state }: { state: StepState }) {
   if (state === 'done') {
      return (
         <span className="w-6 h-6 rounded-full bg-md-timeline-active flex items-center justify-center shrink-0">
            <span className="text-white text-[12px] font-bold leading-none">&#10003;</span>
         </span>
      );
   }
   if (state === 'active') {
      return (
         <span className="relative w-7 h-7 shrink-0 flex items-center justify-center" aria-hidden="true">
            <span className="absolute inset-[-3px] rounded-full border border-[#e65100]/20 bg-[#fff5ec]" />
            <span className="absolute inset-[1px] rounded-full border border-dashed border-md-timeline-border" />
            <span className="relative w-6 h-6 rounded-full bg-white border-2 border-[#e65100] flex items-center justify-center">
               <span className="w-[7px] h-[7px] rounded-full bg-[#e65100]" />
            </span>
         </span>
      );
   }
   if (state === 'due') {
      return (
         <span className="relative w-7 h-7 shrink-0 flex items-center justify-center" aria-hidden="true">
            <span className="absolute inset-[-5px] rounded-full border border-md-primary-300 bg-md-primary-100/40 motion-safe:animate-pulse" />
            <span className="relative w-7 h-7 rounded-full bg-white border-2 border-md-primary-900 shadow-[0_0_0_4px_rgba(131,54,240,0.14)] flex items-center justify-center">
               <span className="w-3 h-3 rounded-full bg-md-primary-900" />
            </span>
         </span>
      );
   }
   return <span className="w-6 h-6 rounded-full bg-md-timeline-bg border-2 border-md-timeline-border shrink-0" />;
}

function StepConnector({ nextState }: { nextState: StepState }) {
   if (nextState === 'done') {
      return <span className="w-0.5 flex-1 min-h-10 bg-md-timeline-active" />;
   }
   return <span className="flex-1 min-h-10 border-l-2 border-dashed border-md-timeline-border" />;
}

function Timeline({ loan }: { loan: Loan }) {
   const steps = buildTimeline(loan);
   const isPendingFunding = loan.loanStatus === 'Requested';
   return (
      <div className="flex flex-col">
         {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            const nextStep = steps[i + 1];
            const labelColor =
               step.state === 'active'
                  ? 'text-[#a24a00]'
                  : step.state === 'pending' || (isPendingFunding && step.key === 'repaid')
                    ? 'text-md-timeline-text'
                    : 'text-md-primary-2000';
            return (
               <div key={step.key} className="flex gap-md-3">
                  <div className="flex flex-col items-center">
                     <StepDot state={step.state} />
                     {!isLast && nextStep ? <StepConnector nextState={nextStep.state} /> : null}
                  </div>
                  <div className={`flex-1 flex flex-col gap-1 ${isLast ? '' : 'pb-md-3'}`}>
                     <span className="flex items-center gap-2">
                        <span className={`text-md-b1 font-semibold ${labelColor}`}>{step.label}</span>
                        {step.state === 'due' ? (
                           <span className="rounded-full bg-md-primary-100 px-2.5 py-1 text-md-b4 font-semibold text-md-primary-900 border border-md-primary-300">
                              Due
                           </span>
                        ) : null}
                        {step.state === 'active' ? (
                           <span className="rounded-full bg-[#fff5ec] px-2.5 py-1 text-md-b4 font-semibold text-[#a24a00] border border-[#ffd7b8]">
                              Pending
                           </span>
                        ) : null}
                     </span>
                     {step.description ? <span className="text-md-b3 text-md-timeline-text">{step.description}</span> : null}
                  </div>
               </div>
            );
         })}
      </div>
   );
}

interface ReturnInterestCardProps {
   name: string;
   avatarUrl?: string;
   amount: number;
   coin: string;
   onOpen: () => void;
}

function ReturnInterestCard({ name, avatarUrl, amount, coin, onOpen }: ReturnInterestCardProps) {
   return (
      <div className="overflow-hidden rounded-md-xl shadow-md-card">
         <div className="bg-md-green-900 px-md-4 py-3 flex items-center gap-2">
            <Gift className="h-4 w-4 text-white/70" aria-hidden="true" />
            <span className="text-md-b4 font-semibold tracking-widest text-white/90 uppercase">Optional Gift</span>
         </div>
         <div className="bg-white px-md-4 py-md-4 flex flex-col gap-md-4">
            <div className="flex items-center gap-md-3">
               <UserAvatar src={avatarUrl} alt={name} size={40} />
               <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-md-b1 font-semibold text-md-primary-2000 truncate">{name} paid back in full</p>
                  <p className="text-md-b3 text-md-neutral-1000">Would you like to return the interest as a gift?</p>
               </div>
            </div>
            <div className="rounded-[12px] bg-md-green-100 px-md-4 py-md-3 flex items-center justify-between">
               <span className="text-md-b3 text-md-green-900/80">Interest to return</span>
               <span className="text-md-b1 font-semibold text-md-green-900">{amount.toFixed(2)} {coin}</span>
            </div>
            <button
               type="button"
               onClick={onOpen}
               className="w-full inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[16px] bg-md-green-900 px-md-4 py-md-3 text-md-b1 font-semibold text-white active:scale-[0.99]"
            >
               <Gift className="h-4 w-4" aria-hidden="true" />
               Return {amount.toFixed(2)} {coin}
            </button>
         </div>
      </div>
   );
}

interface ReturnInterestSheetProps {
   open: boolean;
   name: string;
   amount: number;
   coin: string;
   onConfirm: () => Promise<boolean>;
   onClose: () => void;
}

function ReturnInterestSheet({ open, name, amount, coin, onConfirm, onClose }: ReturnInterestSheetProps) {
   const [step, setStep] = useState<'confirm' | 'sending' | 'success'>('confirm');

   useEffect(() => {
      if (open) setStep('confirm');
   }, [open]);

   const handleSend = async () => {
      setStep('sending');
      const ok = await onConfirm();
      if (ok) {
         setStep('success');
      } else {
         setStep('confirm');
      }
   };

   if (!open) return null;

   return (
      <>
         <style>{`@keyframes returnSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
         <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={step !== 'sending' ? onClose : undefined}
            aria-hidden="true"
         />
         <div
            className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
            style={{ animation: 'returnSheetUp 0.28s cubic-bezier(0.32,0.72,0,1) both' }}
         >
            <div className="w-full max-w-[440px] bg-white rounded-t-[24px] pt-3 pb-10">
               <div className="flex justify-center mb-2">
                  <div className="h-1 w-10 rounded-full bg-md-neutral-300" />
               </div>

               {step === 'confirm' && (
                  <div className="flex flex-col gap-md-4">
                     <div className="flex items-center justify-between px-md-4">
                        <h3 className="text-md-h5 font-semibold text-md-primary-2000">Return interest?</h3>
                        <button
                           type="button"
                           onClick={onClose}
                           aria-label="Close"
                           className="flex h-8 w-8 items-center justify-center rounded-full text-md-neutral-1000 hover:bg-md-neutral-200 active:bg-md-neutral-300"
                        >
                           <X className="h-4 w-4" />
                        </button>
                     </div>
                     <div className="mx-md-4 rounded-[16px] bg-md-green-100 px-md-4 py-5 flex flex-col items-center gap-1">
                        <span className="text-md-b3 text-md-green-900/70">Returning to {name}</span>
                        <span className="text-[32px] font-semibold leading-tight tracking-tight text-md-green-900">
                           {amount.toFixed(2)} {coin}
                        </span>
                     </div>
                     <p className="px-md-4 text-md-b3 text-md-neutral-1000 text-center">
                        This is a voluntary gift — once sent, it can't be reversed.
                     </p>
                     <div className="px-md-4 flex flex-col gap-md-2">
                        <button
                           type="button"
                           onClick={() => { void handleSend(); }}
                           className="w-full inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[16px] bg-md-green-900 px-md-4 py-md-3 text-md-b1 font-semibold text-white active:scale-[0.99]"
                        >
                           <Gift className="h-4 w-4" aria-hidden="true" />
                           Send {amount.toFixed(2)} {coin}
                        </button>
                        <button
                           type="button"
                           onClick={onClose}
                           className="w-full py-md-3 text-md-b1 font-semibold text-md-neutral-1200"
                        >
                           Cancel
                        </button>
                     </div>
                  </div>
               )}

               {step === 'sending' && (
                  <div className="flex flex-col items-center gap-md-4 px-md-4 py-12">
                     <div className="h-16 w-16 animate-spin rounded-full border-[3px] border-md-green-100 border-t-md-green-900" />
                     <div className="flex flex-col gap-1 items-center">
                        <p className="text-md-b1 font-semibold text-md-primary-2000">Sending…</p>
                        <p className="text-md-b3 text-md-neutral-1000 text-center">
                           Your wallet is processing the transaction.
                        </p>
                     </div>
                  </div>
               )}

               {step === 'success' && (
                  <div className="flex flex-col items-center gap-md-5 px-md-4 py-8">
                     <div className="flex h-20 w-20 items-center justify-center rounded-full bg-md-green-100">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-md-green-900">
                           <span className="text-white text-[22px] font-bold leading-none">&#10003;</span>
                        </div>
                     </div>
                     <div className="flex flex-col gap-2 items-center text-center">
                        <h3 className="text-md-h4 font-semibold text-md-primary-2000">Sent successfully!</h3>
                        <p className="text-md-b2 text-md-neutral-1000">
                           You returned {amount.toFixed(2)} {coin} to {name}. That was kind of you.
                        </p>
                     </div>
                     <button
                        type="button"
                        onClick={onClose}
                        className="w-full inline-flex min-h-[56px] items-center justify-center rounded-[16px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 active:scale-[0.99]"
                     >
                        Done
                     </button>
                  </div>
               )}
            </div>
         </div>
      </>
   );
}

interface InterestBannerProps {
   amount: number;
   coin: string;
   name: string;
   date: string;
   variant: 'lender' | 'borrower';
}

function InterestBanner({ amount, coin, name, date, variant }: InterestBannerProps) {
   const header = variant === 'lender' ? 'Interest returned' : 'Gift from your lender';
   const title = variant === 'lender' ? 'You returned the interest' : 'Interest returned!';
   const body =
      variant === 'lender'
         ? `${amount.toFixed(2)} ${coin} was sent back to ${name}${date !== '—' ? ` on ${date}` : ''}.`
         : `${name} sent back ${amount.toFixed(2)} ${coin}${date !== '—' ? ` on ${date}` : ''}.`;

   return (
      <div className="overflow-hidden rounded-md-xl shadow-md-card">
         <div className="bg-md-green-900 px-md-4 py-3 flex items-center gap-2">
            <Gift className="h-4 w-4 text-white/70" aria-hidden="true" />
            <span className="text-md-b4 font-semibold tracking-widest text-white/90 uppercase">{header}</span>
         </div>
         <div className="bg-md-green-100/40 px-md-4 py-md-4 flex items-start gap-md-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-md-green-900/10 text-md-green-900">
               <Gift className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
               <p className="text-md-b1 font-semibold text-md-green-900">{title}</p>
               <p className="text-md-b3 text-md-green-900/80">{body}</p>
            </div>
         </div>
      </div>
   );
}

export default function TransactionDetail() {
   const { loanId } = useParams<{ loanId: string }>();
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const gloans = useSelector((state: RootState) => state.loans.loans.gloans);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const isLoansLoading = useSelector((state: RootState) => state.loans.isLoading);
   const isPreview = import.meta.env.DEV && searchParams.get('mockData') === 'rich';
   const [modalOpen, setModalOpen] = useState(false);
   const [returnedTxHash, setReturnedTxHash] = useState<string | null>(null);
   const returnInFlightRef = useRef(false);
   const { Transfer } = useWallet();
   const { showToast } = useToast();

   const loan = useMemo(() => {
      const foundLoan = gloans.find((l) => l.id === loanId);
      if (foundLoan) return foundLoan;
      return isPreview ? buildPreviewLoan() : undefined;
   }, [gloans, isPreview, loanId]);

   useEffect(() => {
      if (!user?.id || isPreview) return;
      // Always refetch on mount — not only when the loan is missing from the
      // store. A cached loan can be stale (e.g. a lender funded it since the
      // last fetch), and without this the detail view would keep showing the
      // old "Pending" status until a full page reload.
      dispatch(getUserLoans({ userId: user.id }))
         .unwrap()
         .catch((err: Error) => console.error('Error loading loan:', err.message));
   }, [dispatch, user?.id, isPreview]);

   useEffect(() => {
      if (!loan || !user?.id) return;
      const cpId = loan.lenderUser === user.id ? loan.borrowerUser : loan.lenderUser;
      if (cpId && !userProfiles[cpId]) {
         dispatch(fetchUserProfiles([cpId])).catch((err: Error) => console.error('Error fetching counterparty profile:', err.message));
      }
   }, [dispatch, loan, user?.id, userProfiles]);

   const handleReturnInterest = useCallback(async (): Promise<boolean> => {
      if (!loan || returnInFlightRef.current) return false;

      if (!loan.borrowerWallet) {
         showToast(TOAST_TYPES.ERROR, 'Cannot return interest', 'Borrower wallet address is unavailable.', undefined, undefined);
         return false;
      }

      returnInFlightRef.current = true;

      try {
         const interest = Math.round((loan.totalRepaymentAmount - loan.loanAmount) * 100) / 100;
         const transferCoin = loan.coin?.trim() || 'USDC';
         const hash = await Transfer(loan.borrowerWallet, interest.toString(), loan.id, transferCoin);

         if (!hash) return false;

         // Hide the card the moment money is on its way — before the DB write —
         // so a failed DB write can't leave the button visible and trigger a double-send.
         setReturnedTxHash(hash);

         await dispatch(recordInterestReturn({ loanId: loan.id, hash })).unwrap();
         return true;
      } catch {
         return false;
      } finally {
         returnInFlightRef.current = false;
      }
   }, [loan, Transfer, dispatch, showToast]);

   if (isLoansLoading && !loan) {
      return (
         <div className="min-h-screen bg-md-neutral-200 flex justify-center items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-md-primary-900" />
         </div>
      );
   }

   if (!loan) {
      return <Navigate to="/history" replace />;
   }

   const status = getTransactionLoanStatus(loan, new Date());
   const isPendingFunding = status === 'PENDING';
   const isLender = !!user?.id && loan.lenderUser === user.id;
   const counterpartyId = isLender ? loan.borrowerUser : loan.lenderUser;
   const counterpartyProfile = counterpartyId ? userProfiles[counterpartyId] : undefined;
   const counterpartyName = counterpartyProfile?.username ?? 'Unknown';
   const outstanding = Math.max(0, loan.totalRepaymentAmount - loan.repaidAmount);
   const interestAmount = Math.round((loan.totalRepaymentAmount - loan.loanAmount) * 100) / 100;
   const canReturnInterest =
      isLender &&
      status === 'REPAID' &&
      interestAmount > 0.005 &&
      !loan.interestReturnedAt &&
      !returnedTxHash;
   const didReturnInterest =
      isLender &&
      status === 'REPAID' &&
      interestAmount > 0.005 &&
      (!!loan.interestReturnedAt || !!returnedTxHash);

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-md-5 py-md-3">
               <div className="flex items-center gap-4">
                  <button onClick={() => navigate(-1)} className="shrink-0 w-6 h-6 flex items-center justify-center" aria-label="Go back">
                     <ChevronLeft className="w-6 h-6 text-md-primary-2000" strokeWidth={2} />
                  </button>
                  <h1 className="text-md-h3 font-semibold text-md-primary-2000">Loan Details</h1>
               </div>
               <StatusChip status={status} />
            </div>

            <div className="flex flex-col gap-md-4 p-md-4">
               {/* Summary card */}
               <div className="bg-white rounded-md-lg shadow-md-card p-md-4 flex flex-col gap-md-3">
                  <div className="flex items-start gap-md-3">
                     <UserAvatar src={counterpartyProfile?.avatarUrl} alt={counterpartyName} size={48} />
                     <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <p className="text-md-b1 font-semibold text-md-primary-2000 line-clamp-2">{loan.reason || 'Loan'}</p>
                        <span className="text-md-b3 text-md-neutral-1200">
                           {isLender
                              ? `Borrowed by ${counterpartyName}`
                              : isPendingFunding
                                ? 'Lender has not accepted yet'
                                : `Lent by ${counterpartyName}`}
                        </span>
                     </div>
                  </div>

                  <div className="h-px bg-md-neutral-300" />

                  {isPendingFunding ? (
                     <div className="rounded-md-md border border-md-yellow-700/40 bg-md-yellow-700/10 px-md-3 py-md-2 flex gap-md-2">
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-md-yellow-700" strokeWidth={2.3} />
                        <div className="flex flex-col gap-1">
                           <span className="text-md-b3 font-semibold text-md-yellow-700">Waiting for lender acceptance</span>
                           <span className="text-md-b4 text-md-neutral-1000">
                              This loan is not funded yet. Repayment starts only after a lender accepts.
                           </span>
                        </div>
                     </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-md-3">
                     <div className="flex flex-col gap-1">
                        <span className="text-md-b3 text-md-neutral-1000">Loan Amount</span>
                        <span className="text-md-b1 font-semibold text-md-primary-2000">{formatCurrency(loan.loanAmount)}</span>
                     </div>
                     <div className="flex flex-col gap-1">
                        <span className="text-md-b3 text-md-neutral-1000">Payback Amount</span>
                        <span className="text-md-b1 font-semibold text-md-primary-2000">{formatCurrency(loan.totalRepaymentAmount)}</span>
                     </div>
                     <div className="flex flex-col gap-1">
                        <span className="text-md-b3 text-md-neutral-1000">Repaid</span>
                        <span className={`text-md-b1 font-semibold ${loan.repaidAmount > 0 ? 'text-md-green-800' : 'text-md-neutral-600'}`}>
                           {formatCurrency(loan.repaidAmount)}
                        </span>
                     </div>
                     <div className="flex flex-col gap-1">
                        <span className="text-md-b3 text-md-neutral-1000">Outstanding</span>
                        <span className={`text-md-b1 font-semibold ${isPendingFunding ? 'text-md-neutral-600' : 'text-md-red-500'}`}>
                           {isPendingFunding ? 'Not active' : formatCurrency(outstanding)}
                        </span>
                     </div>
                     <div className="flex flex-col gap-1 col-span-2">
                        <span className="text-md-b3 text-md-neutral-1000">{isPendingFunding ? 'Requested on' : 'Due Date'}</span>
                        <span className="text-md-b1 font-semibold text-md-primary-2000">
                           {isPendingFunding ? formatDate(loan.createdAt) : formatDate(loan.dueDate)}
                        </span>
                     </div>
                  </div>
               </div>

               {/* Timeline card */}
               <div className="bg-white rounded-md-lg shadow-md-card p-md-4 flex flex-col gap-md-3">
                  <h2 className="text-md-h5 font-semibold text-md-heading">Timeline</h2>
                  <Timeline loan={loan} />
               </div>

               {/* Repay CTA for borrower on active/partial/default */}
               {!isLender && (status === 'ACTIVE' || status === 'PARTIAL' || status === 'DEFAULT') ? (
                  <button
                     type="button"
                     onClick={() => navigate('/repay')}
                     className="w-full bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold py-md-3 rounded-md-lg"
                  >
                     Repay Loan
                  </button>
               ) : null}

               {/* Return interest card — lender prompt after full repayment */}
               {canReturnInterest ? (
                  <ReturnInterestCard
                     name={counterpartyName}
                     avatarUrl={counterpartyProfile?.avatarUrl}
                     amount={interestAmount}
                     coin={loan.coin || 'USDC'}
                     onOpen={() => setModalOpen(true)}
                  />
               ) : null}

               {/* Lender banner after interest is returned */}
               {didReturnInterest ? (
                  <InterestBanner
                     variant="lender"
                     amount={interestAmount}
                     coin={loan.coin || 'USDC'}
                     name={counterpartyName}
                     date={formatDate(loan.interestReturnedAt)}
                  />
               ) : null}

               {/* Borrower banner when lender has returned their interest */}
               {!isLender && loan.interestReturnedAt && interestAmount > 0.005 ? (
                  <InterestBanner
                     variant="borrower"
                     amount={interestAmount}
                     coin={loan.coin || 'USDC'}
                     name={counterpartyName}
                     date={formatDate(loan.interestReturnedAt)}
                  />
               ) : null}
            </div>
         </div>

         <ReturnInterestSheet
            open={modalOpen}
            name={counterpartyName}
            amount={interestAmount}
            coin={loan.coin || 'USDC'}
            onConfirm={handleReturnInterest}
            onClose={() => setModalOpen(false)}
         />
      </div>
   );
}
