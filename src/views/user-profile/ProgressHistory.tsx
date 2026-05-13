import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
   AlertTriangle,
   Check,
   ChevronLeft,
   Clock3,
   CreditCard,
   DollarSign,
   Flag,
   HelpCircle,
   History,
   Lightbulb,
   Moon,
   RefreshCcw,
   ShieldCheck,
   Sparkles,
   Star,
   Sun,
   Users
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import Loading from '@/components/Loading';
import { PLACEHOLDER_AVATAR } from '@/components/UserAvatar';

import { formatDate, parseDateSafely } from '@/utils/dateFormatters';
import { formatNumber, toNumber } from '@/utils/decimalHelpers';

import { getCreditTierKey, getNextCreditTier, isExactCreditTier, STARTING_CREDIT_LIMIT } from '@/config/creditTiers';
import { fetchUserProfiles, getUserProfile } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { type User, WorldId } from '@/types/authTypes';
import { type Loan, LoanStatus, RepaymentStatus } from '@/types/loanTypes';
import { DEMO_BORROWER_INSIGHTS_USER } from './demoBorrowerInsights';

type TimelineTone = 'purple' | 'blue' | 'green' | 'red' | 'neutral';

export type BorrowerTimelineEvent = {
   id: string;
   type: string;
   title: string;
   description: string;
   date: string | Date;
   amount?: number;
   badgeLabel?: string;
   badgeTone?: TimelineTone;
   tone: TimelineTone;
};

type LoanClassification = 'trust' | 'credit';
const BORROWER_INSIGHTS_THEME_KEY = 'borrower-insights-theme';

const DEMO_BORROWER = DEMO_BORROWER_INSIGHTS_USER;

const createDemoLoan = (
   id: string,
   amount: number,
   totalRepaymentAmount: number,
   fundedAt: string,
   dueDate: string,
   updatedAt: string,
   lenderUser: string,
   repaymentStatus: string,
   repaidAmount: number
): Loan => ({
   id,
   trackingId: id,
   borrowerUser: DEMO_BORROWER.id,
   lenderUser,
   loanAmount: amount,
   repaidAmount,
   totalRepaymentAmount,
   reason: 'Demo timeline loan',
   loanStatus: LoanStatus.LENT,
   repaymentStatus,
   dueDate,
   coin: 'USDC',
   hash: [],
   createdAt: fundedAt,
   updatedAt,
   fundedAt
});

const DEMO_LOANS: Loan[] = [
   createDemoLoan(
      'demo-loan-1',
      15,
      16,
      '2026-05-03T10:00:00.000Z',
      '2026-05-08T10:00:00.000Z',
      '2026-05-06T11:00:00.000Z',
      'demo-lender-a',
      RepaymentStatus.PAID,
      16
   ),
   createDemoLoan(
      'demo-loan-2',
      10,
      12,
      '2026-05-07T10:00:00.000Z',
      '2026-05-12T10:00:00.000Z',
      '2026-05-10T11:00:00.000Z',
      'demo-lender-b',
      RepaymentStatus.PAID,
      12
   ),
   createDemoLoan(
      'demo-loan-3',
      20,
      22,
      '2026-05-11T10:00:00.000Z',
      '2026-05-16T10:00:00.000Z',
      '2026-05-16T09:00:00.000Z',
      'demo-lender-a',
      RepaymentStatus.PAID,
      22
   ),
   createDemoLoan(
      'demo-loan-4',
      12,
      14,
      '2026-05-15T10:00:00.000Z',
      '2026-05-21T10:00:00.000Z',
      '2026-05-18T11:00:00.000Z',
      'demo-lender-c',
      RepaymentStatus.PAID,
      14
   ),
   createDemoLoan(
      'demo-loan-5',
      40,
      44,
      '2026-05-20T10:00:00.000Z',
      '2026-05-26T10:00:00.000Z',
      '2026-05-25T12:00:00.000Z',
      'demo-lender-d',
      RepaymentStatus.PAID,
      44
   ),
   createDemoLoan(
      'demo-loan-6',
      18,
      20,
      '2026-05-27T10:00:00.000Z',
      '2026-06-02T10:00:00.000Z',
      '2026-05-30T12:00:00.000Z',
      'demo-lender-a',
      RepaymentStatus.PAID,
      20
   ),
   createDemoLoan(
      'demo-loan-7',
      60,
      66,
      '2026-06-03T10:00:00.000Z',
      '2026-06-10T10:00:00.000Z',
      '2026-06-07T12:00:00.000Z',
      'demo-lender-e',
      RepaymentStatus.PAID,
      66
   ),
   createDemoLoan(
      'demo-loan-8',
      14,
      16,
      '2026-06-08T10:00:00.000Z',
      '2026-06-14T10:00:00.000Z',
      '2026-06-11T12:00:00.000Z',
      'demo-lender-b',
      RepaymentStatus.PAID,
      16
   ),
   createDemoLoan(
      'demo-loan-9',
      22,
      24,
      '2026-06-15T10:00:00.000Z',
      '2026-06-21T10:00:00.000Z',
      '2026-06-18T12:00:00.000Z',
      'demo-lender-f',
      RepaymentStatus.PARTIAL,
      8
   )
];

const toneStyles: Record<TimelineTone, { node: string; badge: string; icon: string; amount: string; title: string }> = {
   purple: {
      node: 'bg-md-primary-900 text-white shadow-[0_10px_24px_rgba(126,58,242,0.28)]',
      badge: 'bg-[#f2eaff] text-md-primary-900 border-[#e3d4ff]',
      icon: 'text-md-primary-900',
      amount: 'text-md-primary-900',
      title: 'text-md-primary-2000'
   },
   blue: {
      node: 'bg-md-blue-600 text-white shadow-[0_10px_24px_rgba(0,118,235,0.24)]',
      badge: 'bg-[#eaf3ff] text-md-blue-600 border-[#cfe3ff]',
      icon: 'text-md-blue-600',
      amount: 'text-md-blue-600',
      title: 'text-md-primary-2000'
   },
   green: {
      node: 'bg-md-green-700 text-white shadow-[0_10px_24px_rgba(0,134,36,0.22)]',
      badge: 'bg-md-green-100 text-md-green-900 border-[#bfe8cf]',
      icon: 'text-md-green-900',
      amount: 'text-md-green-900',
      title: 'text-md-primary-2000'
   },
   red: {
      node: 'bg-md-red-500 text-white shadow-[0_10px_24px_rgba(239,68,68,0.2)]',
      badge: 'bg-red-50 text-md-red-500 border-red-100',
      icon: 'text-md-red-500',
      amount: 'text-md-red-500',
      title: 'text-md-primary-2000'
   },
   neutral: {
      node: 'bg-[#b7add0] text-white shadow-[0_10px_24px_rgba(91,77,124,0.18)]',
      badge: 'bg-md-neutral-200 text-md-neutral-1400 border-md-neutral-500',
      icon: 'text-md-neutral-1400',
      amount: 'text-md-primary-2000',
      title: 'text-md-primary-2000'
   }
};

const eventIcons: Partial<Record<string, LucideIcon>> = {
   started_level_0: Flag,
   verified_borrower: Check,
   trust_building_loan_funded: DollarSign,
   credit_building_loan_funded: DollarSign,
   partial_repayment_made: CreditCard,
   loan_repaid: Check,
   loan_repaid_early: Check,
   loan_repaid_late: Clock3,
   defaulted_loan: AlertTriangle,
   credit_limit_unlocked: Star,
   repeat_lender_relationship: Users,
   trust_building_focused_pattern: Lightbulb,
   no_loan_activity: Sparkles
};

const normalizeDate = (date: string | Date | undefined): Date => parseDateSafely(date ?? new Date().toISOString());

const daysBetween = (start: string | Date, end: string | Date): number => {
   const startTime = normalizeDate(start).getTime();
   const endTime = normalizeDate(end).getTime();
   return Math.round((endTime - startTime) / (1000 * 60 * 60 * 24));
};

const classifyLoan = (loan: Loan, seenCreditTiers: Set<number>): LoanClassification => {
   const amount = toNumber(loan.loanAmount);
   const tier = getCreditTierKey(amount);
   if (isExactCreditTier(amount) && !seenCreditTiers.has(tier)) {
      seenCreditTiers.add(tier);
      return 'credit';
   }
   return 'trust';
};

export function buildBorrowerTimelineEvents(borrower: User, loans: Loan[]): BorrowerTimelineEvent[] {
   const events: BorrowerTimelineEvent[] = [
      {
         id: `${borrower.id}-started`,
         type: 'started_level_0',
         title: 'Started at Level 0',
         description: 'Borrower account created and credit journey started.',
         date: borrower.createdAt,
         badgeLabel: 'Milestone',
         badgeTone: 'purple',
         tone: 'purple'
      }
   ];

   if (borrower.isWorldId === WorldId.ACTIVE) {
      events.push({
         id: `${borrower.id}-verified`,
         type: 'verified_borrower',
         title: 'Verified Borrower',
         description: 'Identity verification completed.',
         date: borrower.updatedAt || borrower.createdAt,
         badgeLabel: 'Completed',
         badgeTone: 'green',
         tone: 'green'
      });
   }

   const fundedLoans = loans
      .filter((loan) => loan.loanStatus === LoanStatus.LENT)
      .sort((a, b) => normalizeDate(a.fundedAt ?? a.createdAt).getTime() - normalizeDate(b.fundedAt ?? b.createdAt).getTime());

   if (fundedLoans.length === 0) {
      events.push({
         id: `${borrower.id}-no-loans`,
         type: 'no_loan_activity',
         title: 'No loan activity yet',
         description: 'No funded loans have been recorded for this borrower yet.',
         date: borrower.updatedAt || borrower.createdAt,
         badgeLabel: 'New borrower',
         badgeTone: 'purple',
         tone: 'neutral'
      });
      return events.sort((a, b) => normalizeDate(a.date).getTime() - normalizeDate(b.date).getTime());
   }

   const seenCreditTiers = new Set<number>();
   const lenderBorrowCount = new Map<string, number>();
   let currentCreditLimit = STARTING_CREDIT_LIMIT;
   let creditBuildingCount = 0;
   let trustBuildingCount = 0;

   fundedLoans.forEach((loan) => {
      const loanAmount = toNumber(loan.loanAmount);
      const repaymentAmount = toNumber(loan.totalRepaymentAmount || loan.loanAmount);
      const repaidAmount = toNumber(loan.repaidAmount);
      const fundedDate = loan.fundedAt ?? loan.createdAt;
      const classification = classifyLoan(loan, seenCreditTiers);
      const lenderKey = loan.lenderUser || loan.lenderWallet || 'unknown-lender';
      const previousLenderCount = lenderBorrowCount.get(lenderKey) ?? 0;

      lenderBorrowCount.set(lenderKey, previousLenderCount + 1);
      if (classification === 'credit') {
         creditBuildingCount += 1;
      } else {
         trustBuildingCount += 1;
      }

      events.push({
         id: `${loan.id}-funded`,
         type: classification === 'credit' ? 'credit_building_loan_funded' : 'trust_building_loan_funded',
         title: classification === 'credit' ? 'Credit Building Loan Funded' : 'Trust Building Loan Funded',
         description: `Loan received: $${formatNumber(loanAmount)}${loan.lenderUser ? ' from lender.' : '.'}`,
         date: fundedDate,
         amount: loanAmount,
         tone: 'blue'
      });

      if (previousLenderCount > 0) {
         events.push({
            id: `${loan.id}-repeat-lender`,
            type: 'repeat_lender_relationship',
            title: 'Repeat Lender Relationship',
            description: 'Borrowed again from an existing lender.',
            date: fundedDate,
            badgeLabel: 'Activity',
            badgeTone: 'blue',
            tone: 'blue'
         });
      }

      if (repaidAmount > 0 && repaidAmount < repaymentAmount) {
         events.push({
            id: `${loan.id}-partial-repayment`,
            type: 'partial_repayment_made',
            title: 'Partial Repayment Made',
            description: `Paid back $${formatNumber(repaidAmount)} of $${formatNumber(repaymentAmount)} due.`,
            date: loan.updatedAt,
            amount: repaidAmount,
            badgeLabel: 'Update',
            badgeTone: 'neutral',
            tone: 'neutral'
         });
      }

      if (loan.repaymentStatus === RepaymentStatus.PAID) {
         const paidDate = normalizeDate(loan.updatedAt);
         const dueDate = normalizeDate(loan.dueDate);
         const isEarly = paidDate.getTime() < dueDate.getTime();
         const isLate = paidDate.getTime() > dueDate.getTime();

         events.push({
            id: `${loan.id}-repaid`,
            type: isEarly ? 'loan_repaid_early' : isLate ? 'loan_repaid_late' : 'loan_repaid',
            title: isEarly
               ? 'Loan Repaid Early'
               : isLate
                 ? 'Loan Repaid Late'
                 : `${classification === 'credit' ? 'Credit Building' : 'Trust Building'} Loan Repaid`,
            description: isEarly
               ? `${classification === 'credit' ? 'Credit Building' : 'Trust Building'} loan closed before due date.`
               : isLate
                 ? `Loan repaid ${Math.max(1, daysBetween(dueDate, paidDate))} day${daysBetween(dueDate, paidDate) === 1 ? '' : 's'} after the due date.`
                 : 'Remaining balance repaid on time.',
            date: loan.updatedAt,
            amount: repaymentAmount,
            badgeLabel: isEarly ? 'Early Repayment' : isLate ? 'Late' : 'Repaid',
            badgeTone: isLate ? 'red' : 'green',
            tone: isLate ? 'red' : 'green'
         });

         if (classification === 'credit' && !isLate && loanAmount >= currentCreditLimit) {
            const nextLimit = getNextCreditTier(currentCreditLimit);
            if (nextLimit > currentCreditLimit) {
               events.push({
                  id: `${loan.id}-credit-unlocked-${nextLimit}`,
                  type: 'credit_limit_unlocked',
                  title: 'Credit Limit Unlocked',
                  description: `Unlocked Level ${Math.max(1, seenCreditTiers.size + 1)} with full level credit available.`,
                  date: loan.updatedAt,
                  amount: nextLimit,
                  badgeLabel: 'Level Up',
                  badgeTone: 'purple',
                  tone: 'purple'
               });
               currentCreditLimit = nextLimit;
            }
         }
      } else if (normalizeDate(loan.dueDate).getTime() < Date.now()) {
         events.push({
            id: `${loan.id}-defaulted`,
            type: 'defaulted_loan',
            title: 'Defaulted Loan',
            description: `Loan remains unpaid past the due date.`,
            date: loan.dueDate,
            amount: Math.max(0, repaymentAmount - repaidAmount),
            badgeLabel: 'Default',
            badgeTone: 'red',
            tone: 'red'
         });
      }
   });

   if (fundedLoans.length >= 3 && trustBuildingCount > creditBuildingCount) {
      const latestLoan = fundedLoans[fundedLoans.length - 1];
      events.push({
         id: `${borrower.id}-trust-pattern`,
         type: 'trust_building_focused_pattern',
         title: 'More Trust-Building Loans',
         description:
            'This borrower has more smaller trust-building loans than full-limit credit-building loans. These help show repayment history, but they do not raise credit level.',
         date: latestLoan.updatedAt || latestLoan.fundedAt || latestLoan.createdAt,
         badgeLabel: 'Insight',
         badgeTone: 'purple',
         tone: 'purple'
      });
   }

   return events.sort((a, b) => normalizeDate(a.date).getTime() - normalizeDate(b.date).getTime());
}

export default function ProgressHistory() {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const { username } = useParams();
   const [searchParams] = useSearchParams();
   const [profileUser, setProfileUser] = useState<User | null>(null);
   const [isDarkMode, setIsDarkMode] = useState(() => {
      if (typeof window === 'undefined') return false;
      return window.localStorage.getItem(BORROWER_INSIGHTS_THEME_KEY) === 'dark';
   });

   const user = useSelector((state: RootState) => state.auth.user);
   const loans = useSelector((state: RootState) => state.loans.loans.gloans);
   const isDemoTimeline = searchParams.get('demo') === 'rich';
   const borrower = isDemoTimeline ? DEMO_BORROWER : (profileUser ?? user);
   const timelineLoans = isDemoTimeline ? DEMO_LOANS : loans;

   useEffect(() => {
      window.scrollTo(0, 0);
   }, []);

   useEffect(() => {
      window.localStorage.setItem(BORROWER_INSIGHTS_THEME_KEY, isDarkMode ? 'dark' : 'light');
   }, [isDarkMode]);

   useEffect(() => {
      if (!username) return;
      if (isDemoTimeline) return;
      const loadProfile = async () => {
         try {
            const { user: fetchedUser } = await dispatch(getUserProfile(username)).unwrap();
            setProfileUser(fetchedUser);
            const borrowerLoans = await dispatch(getUserLoans({ userId: fetchedUser.id })).unwrap();
            const lenderUserIds = [...new Set(borrowerLoans.map((loan) => loan.lenderUser).filter(Boolean))] as string[];
            if (lenderUserIds.length > 0) {
               dispatch(fetchUserProfiles(lenderUserIds)).catch(() => undefined);
            }
         } catch (error) {
            console.error('Error fetching progress history:', (error as Error).message || error);
         }
      };
      loadProfile();
   }, [dispatch, isDemoTimeline, username]);

   const events = useMemo(() => (borrower ? buildBorrowerTimelineEvents(borrower, timelineLoans) : []), [borrower, timelineLoans]);

   if (!borrower) return <Loading />;

   const borrowerName = borrower.displayName || borrower.username || username || 'Borrower';
   const memberSince = formatDate(normalizeDate(borrower.createdAt).toISOString());
   const isVerified = borrower.isWorldId === WorldId.ACTIVE;
   const defaultCount = timelineLoans.filter(
      (loan) =>
         loan.loanStatus === LoanStatus.LENT &&
         loan.repaymentStatus !== RepaymentStatus.PAID &&
         normalizeDate(loan.dueDate).getTime() < Date.now()
   ).length;
   const isGoodStanding = defaultCount === 0;

   return (
      <div className={`progress-history-page min-h-screen bg-[#fbf8ff] transition-colors duration-200 ${isDarkMode ? 'progress-history-dark' : ''}`}>
         <style>{`
            .progress-history-dark {
               background: #0f1117;
               color: #eef2ff;
            }

            .progress-history-dark .bg-white {
               background-color: #171a23 !important;
            }

            .progress-history-dark .bg-\\[\\#fbf8ff\\],
            .progress-history-dark .bg-\\[\\#fbfaff\\],
            .progress-history-dark .bg-md-neutral-200 {
               background-color: #202532 !important;
            }

            .progress-history-dark .text-md-primary-2000,
            .progress-history-dark .text-\\[\\#1f2937\\] {
               color: #eef2ff !important;
            }

            .progress-history-dark .text-md-neutral-1400,
            .progress-history-dark .text-md-neutral-1200,
            .progress-history-dark .text-\\[\\#6b7280\\],
            .progress-history-dark .text-\\[\\#4b5563\\] {
               color: #a8b0c3 !important;
            }

            .progress-history-dark .border-\\[\\#eadfff\\],
            .progress-history-dark .border-md-neutral-500 {
               border-color: #2d3546 !important;
            }

            .progress-history-dark .shadow-md-card,
            .progress-history-dark .shadow-\\[0_14px_34px_rgba\\(48\\,24\\,92\\,0\\.08\\)\\],
            .progress-history-dark .shadow-\\[0_12px_26px_rgba\\(48\\,24\\,92\\,0\\.07\\)\\] {
               box-shadow: 0 16px 36px rgba(0, 0, 0, 0.24) !important;
            }

            .progress-history-dark .timeline-line {
               background-color: #3a2f58 !important;
            }

            .progress-history-dark .timeline-card {
               background-color: #171a23 !important;
               border-color: #2d3546 !important;
            }

            .progress-history-dark .timeline-card::before {
               background-color: #171a23 !important;
               border-color: #2d3546 !important;
            }

            .progress-history-dark .timeline-node-ring {
               border-color: #0f1117 !important;
            }

            .progress-history-dark .progress-identity-card {
               background: #eef1f6 !important;
               border-color: #d7deea !important;
               box-shadow: 0 18px 36px rgba(0, 0, 0, 0.2) !important;
            }

            .progress-history-dark .progress-identity-card .text-md-primary-2000 {
               color: #141827 !important;
            }

            .progress-history-dark .progress-identity-card .text-md-neutral-1400 {
               color: #5f6878 !important;
            }

            .progress-history-dark * {
               scrollbar-color: #4a5265 #151922;
            }

            .progress-history-dark *::-webkit-scrollbar {
               width: 8px;
            }

            .progress-history-dark *::-webkit-scrollbar-track {
               background: #151922;
            }

            .progress-history-dark *::-webkit-scrollbar-thumb {
               background: #4a5265;
               border-radius: 999px;
            }

            @media (max-width: 380px) {
               .progress-history-title {
                  font-size: 20px;
               }
            }
         `}</style>
         <div className="mx-auto flex min-h-screen max-w-[440px] flex-col px-4 pb-10 pt-5">
            <div className="grid grid-cols-[48px_minmax(0,1fr)_104px] items-center gap-2 py-3">
               <button
                  type="button"
                  onClick={() => navigate(-1)}
                  aria-label="Go back"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-[#eadfff] bg-white text-md-primary-900 shadow-md-card active:scale-95"
               >
                  <ChevronLeft className="h-6 w-6" strokeWidth={2.4} />
               </button>
               <h1 className="progress-history-title truncate text-center text-[24px] font-semibold leading-tight text-md-primary-2000">
                  Progress History
               </h1>
               <div className="flex items-center justify-end gap-2">
                  <button
                     type="button"
                     onClick={() => setIsDarkMode((current) => !current)}
                     aria-label={isDarkMode ? 'Switch progress history to light mode' : 'Switch progress history to dark mode'}
                     aria-pressed={isDarkMode}
                     className="flex h-12 w-12 items-center justify-center rounded-full border border-[#eadfff] bg-white text-md-primary-900 shadow-md-card active:scale-95"
                  >
                     {isDarkMode ? <Sun className="h-5 w-5 text-[#facc15]" strokeWidth={2.2} /> : <Moon className="h-5 w-5" strokeWidth={2.2} />}
                  </button>
                  <button
                     type="button"
                     onClick={() => navigate('/support')}
                     aria-label="Open help and support center"
                     className="flex h-12 w-12 items-center justify-center rounded-full border border-[#eadfff] bg-white text-md-primary-900 shadow-md-card active:scale-95"
                  >
                     <HelpCircle className="h-6 w-6" strokeWidth={2} />
                  </button>
               </div>
            </div>

            <section className="progress-identity-card mt-5 rounded-[20px] border border-[#eadfff] bg-white px-4 py-4 shadow-[0_14px_34px_rgba(48,24,92,0.08)]">
               <div className="flex items-center gap-4">
                  <img src={PLACEHOLDER_AVATAR} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
                  <div className="min-w-0 flex-1 py-1">
                     <h2 className="truncate text-[22px] font-semibold leading-tight text-md-primary-2000">{borrowerName}</h2>
                     <div className="mt-2 flex flex-wrap gap-2">
                        {isVerified && (
                           <StatusPill tone="green" icon={<Check className="h-3.5 w-3.5" strokeWidth={3} />}>
                              Verified Borrower
                           </StatusPill>
                        )}
                        <StatusPill tone={isGoodStanding ? 'green' : 'red'} icon={<ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.4} />}>
                           {isGoodStanding ? 'Good Standing' : 'Defaults Present'}
                        </StatusPill>
                     </div>
                     <p className="mt-3 text-md-b2 text-md-neutral-1400">Member since {memberSince}</p>
                  </div>
               </div>
            </section>

            <section className="mt-7">
               <div className="mb-6 flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-md-primary-900 text-white shadow-[0_10px_24px_rgba(126,58,242,0.26)]">
                     <History className="h-6 w-6" strokeWidth={2.2} />
                  </div>
                  <div>
                     <h2 className="text-[22px] font-semibold leading-tight text-md-primary-2000">Borrower Timeline</h2>
                     <p className="mt-1 text-md-b2 text-md-neutral-1400">Complete history of milestones and loan activity</p>
                  </div>
               </div>

               <div className="relative">
                  <div className="timeline-line absolute bottom-8 left-6 top-2 w-0.5 bg-[#d9c9fb]" />
                  <div className="flex flex-col gap-3">
                     {events.map((event) => (
                        <TimelineEventCard key={event.id} event={event} />
                     ))}
                  </div>
               </div>
            </section>
         </div>
      </div>
   );
}

function TimelineEventCard({ event }: { event: BorrowerTimelineEvent }) {
   const Icon = eventIcons[event.type] ?? RefreshCcw;
   const styles = toneStyles[event.tone];
   const badgeStyles = toneStyles[event.badgeTone ?? event.tone];

   return (
      <div className="relative grid grid-cols-[48px_1fr] gap-4">
         <div className="relative z-10 flex justify-center pt-3">
            <div className={`timeline-node-ring flex h-12 w-12 items-center justify-center rounded-full border-[5px] border-[#f7f0ff] ${styles.node}`}>
               <Icon className="h-5.5 w-5.5" strokeWidth={2.5} />
            </div>
         </div>

         <article className="timeline-card relative rounded-[18px] border border-[#eadfff] bg-white px-4 py-4 shadow-[0_12px_26px_rgba(48,24,92,0.07)] before:absolute before:left-[-8px] before:top-7 before:h-4 before:w-4 before:rotate-45 before:border-b before:border-l before:border-[#eadfff] before:bg-white">
            <div className="flex items-start justify-between gap-3">
               <div className="min-w-0">
                  <h3 className={`text-[18px] font-semibold leading-snug ${styles.title}`}>{event.title}</h3>
                  <p className="mt-1 text-[15px] leading-6 text-md-neutral-1400">{event.description}</p>
               </div>
               <time className="shrink-0 pt-0.5 text-right text-[14px] leading-5 text-md-neutral-1400">
                  {formatDate(normalizeDate(event.date).toISOString())}
               </time>
            </div>

            {(event.badgeLabel || event.amount !== undefined) && (
               <div className="mt-3 flex items-center justify-end gap-3">
                  {event.badgeLabel && (
                     <span className={`rounded-full border px-3 py-1 text-[13px] font-semibold leading-none ${badgeStyles.badge}`}>
                        {event.badgeLabel}
                     </span>
                  )}
                  {event.amount !== undefined && (
                     <span className={`text-[16px] font-semibold leading-none ${styles.amount}`}>${formatNumber(event.amount)}</span>
                  )}
               </div>
            )}
         </article>
      </div>
   );
}

function StatusPill({ children, icon, tone }: { children: ReactNode; icon: ReactNode; tone: 'green' | 'purple' | 'red' }) {
   const className =
      tone === 'green'
         ? 'border-[#bfe8cf] bg-md-green-100 text-md-green-900'
         : tone === 'red'
           ? 'border-red-100 bg-red-50 text-md-red-500'
           : 'border-[#e3d4ff] bg-[#f2eaff] text-md-primary-900';

   return (
      <span
         className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold leading-none ${className}`}
      >
         {icon}
         {children}
      </span>
   );
}
