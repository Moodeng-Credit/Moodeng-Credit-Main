import { useEffect, useMemo } from 'react';

import { AlertCircle, ChevronLeft } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import UserAvatar from '@/components/UserAvatar';

import { fetchUserProfiles } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';
import { LoanStatus as LoanStatusValue, RepaymentStatus } from '@/types/loanTypes';

type LoanStatus = 'REPAID' | 'ACTIVE' | 'DEFAULT' | 'PENDING' | 'PARTIAL';

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

type StepState = 'done' | 'active' | 'due' | 'pending';

interface TimelineStep {
   key: 'requested' | 'funded' | 'partial_repayment' | 'repaid';
   label: string;
   description?: string;
   state: StepState;
}

function getActiveStepKey(loan: Loan): TimelineStep['key'] | null {
   if (loan.loanStatus === 'Requested') return 'funded';
   if (loan.repaymentStatus === 'Paid') return null;
   return 'repaid';
}

function buildTimeline(loan: Loan): TimelineStep[] {
   const activeKey = getActiveStepKey(loan);
   const showPartial = activeKey === 'partial_repayment' || (activeKey === 'repaid' && loan.repaymentStatus === 'Partial');
   const order: TimelineStep['key'][] = showPartial
      ? ['requested', 'funded', 'partial_repayment', 'repaid']
      : ['requested', 'funded', 'repaid'];
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
         if (state === 'active') return 'Pending lender acceptance';
         return undefined;
      }
      if (key === 'partial_repayment') {
         if (state === 'done') return formatDate(loan.updatedAt);
         return 'If applicable';
      }
      if (key === 'repaid') {
         if (state === 'done') return formatDate(loan.updatedAt);
         return `Due ${formatDate(loan.dueDate)}`;
      }
      return undefined;
   };

   const labelFor = (key: TimelineStep['key'], state: StepState): string => {
      if (key === 'repaid' && state !== 'done') return 'Repayment due';
      const labels: Record<TimelineStep['key'], string> = {
         requested: 'Requested',
         funded: 'Funded',
         partial_repayment: 'Partial repayment',
         repaid: 'Repaid'
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
         <span className="w-6 h-6 rounded-full bg-white border-2 border-md-timeline-border flex items-center justify-center shrink-0">
            <span className="w-[10px] h-[10px] rounded-full bg-md-timeline-active" />
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
   return (
      <div className="flex flex-col">
         {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            const nextStep = steps[i + 1];
            const labelColor = step.state === 'pending' ? 'text-md-timeline-text' : 'text-md-primary-2000';
            return (
               <div key={step.key} className="flex gap-md-3">
                  <div className="flex flex-col items-center">
                     <StepDot state={step.state} />
                     {!isLast && <StepConnector nextState={nextStep.state} />}
                  </div>
                  <div className={`flex-1 flex flex-col gap-1 ${isLast ? '' : 'pb-md-3'}`}>
                     <span className="flex items-center gap-2">
                        <span className={`text-md-b1 font-semibold ${labelColor}`}>{step.label}</span>
                        {step.state === 'due' && (
                           <span className="rounded-full bg-md-primary-100 px-2.5 py-1 text-md-b4 font-semibold text-md-primary-900 border border-md-primary-300">
                              Due
                           </span>
                        )}
                     </span>
                     {step.description && <span className="text-md-b3 text-md-timeline-text">{step.description}</span>}
                  </div>
               </div>
            );
         })}
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

   const loan = useMemo(() => {
      const foundLoan = gloans.find((l) => l.id === loanId);
      if (foundLoan) return foundLoan;
      return isPreview ? buildPreviewLoan() : undefined;
   }, [gloans, isPreview, loanId]);

   useEffect(() => {
      if (!user?.id) return;
      const load = async () => {
         if (!loan && !isPreview) {
            await dispatch(getUserLoans({ userId: user.id })).unwrap();
         }
      };
      load().catch((err: Error) => console.error('Error loading loan:', err.message));
   }, [dispatch, user?.id, loan, isPreview]);

   useEffect(() => {
      if (loan?.lenderUser && !userProfiles[loan.lenderUser]) {
         dispatch(fetchUserProfiles([loan.lenderUser])).catch((err: Error) => console.error('Error fetching lender profile:', err.message));
      }
   }, [dispatch, loan?.lenderUser, userProfiles]);

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

   const status = getLoanStatus(loan);
   const lenderProfile = loan.lenderUser ? userProfiles[loan.lenderUser] : undefined;
   const lenderName = lenderProfile?.username ?? 'Unknown';
   const outstanding = Math.max(0, loan.totalRepaymentAmount - loan.repaidAmount);

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
                     <UserAvatar src={lenderProfile?.avatarUrl} alt={lenderName} size={48} />
                     <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <p className="text-md-b1 font-semibold text-md-primary-2000 line-clamp-2">{loan.reason || 'Loan'}</p>
                        <span className="text-md-b3 text-md-neutral-1200">Lent by {lenderName}</span>
                     </div>
                  </div>

                  <div className="h-px bg-md-neutral-300" />

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
                        <span className="text-md-b1 font-semibold text-md-red-500">{formatCurrency(outstanding)}</span>
                     </div>
                     <div className="flex flex-col gap-1 col-span-2">
                        <span className="text-md-b3 text-md-neutral-1000">Due Date</span>
                        <span className="text-md-b1 font-semibold text-md-primary-2000">{formatDate(loan.dueDate)}</span>
                     </div>
                  </div>
               </div>

               {/* Timeline card */}
               <div className="bg-white rounded-md-lg shadow-md-card p-md-4 flex flex-col gap-md-3">
                  <h2 className="text-md-h5 font-semibold text-md-heading">Timeline</h2>
                  <Timeline loan={loan} />
               </div>

               {/* Repay CTA for borrower on active/partial/default */}
               {(status === 'ACTIVE' || status === 'PARTIAL' || status === 'DEFAULT') && (
                  <button
                     type="button"
                     onClick={() => navigate('/repay')}
                     className="w-full bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold py-md-3 rounded-md-lg"
                  >
                     Repay Loan
                  </button>
               )}
            </div>
         </div>
      </div>
   );
}
