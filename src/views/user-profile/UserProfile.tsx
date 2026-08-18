import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';

import {
   AlertCircle,
   Award,
   BarChart3,
   CalendarDays,
   Check,
   ChevronLeft,
   ChevronRight,
   Clock3,
   DollarSign,
   FileText,
   HelpCircle,
   Moon,
   RefreshCcw,
   ShieldCheck,
   Sparkles,
   Sun,
   TrendingUp,
   Users,
   X
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import GuidedTourPreview from '@/components/GuidedTourPreview';
import Loading from '@/components/Loading';
import { useThemeMode } from '@/components/ThemeModeProvider';
import { PLACEHOLDER_AVATAR } from '@/components/UserAvatar';

import { formatDate, parseDateSafely } from '@/utils/dateFormatters';
import { formatNumber, toNumber } from '@/utils/decimalHelpers';
import { calculateLenderDiversity, getDiversityStatus } from '@/utils/diversityScore';

import { getCreditLevelNumber, getCreditTierKey, isExactCreditTier } from '@/config/creditTiers';
import { getEffectiveCreditLimit } from '@/lib/creditLeveling';
import { recordGuidedTourEvent } from '@/lib/guidedTourEvents';
import { LENDER_GUIDED_TOUR_ID, markGuidedTourCompleted, shouldShowGuidedTour } from '@/lib/guidedTourStorage';
import { isCurrentUserAdmin } from '@/lib/isCurrentUserAdmin';
import { isUserVerified } from '@/lib/isUserVerified';
import { fetchUserProfiles, getUserProfile } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { type User } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';

import {
   DEMO_BORROWER_INSIGHTS_LOANS,
   DEMO_BORROWER_INSIGHTS_USER,
   DEMO_BORROWER_PROFILES,
   DEMO_LENDER_INSIGHTS_LOANS,
   DEMO_LENDER_INSIGHTS_USER,
   DEMO_LENDER_PROFILES
} from './demoBorrowerInsights';

const DIVERSITY_STYLES: Record<string, { border: string; text: string; bg: string }> = {
   Excellent: { border: 'border-md-green-600', text: 'text-md-green-600', bg: 'bg-[rgba(0,134,36,0.05)]' },
   Good: { border: 'border-md-blue-500', text: 'text-md-blue-500', bg: 'bg-[rgba(0,118,235,0.1)]' },
   Fair: { border: 'border-md-yellow-700', text: 'text-md-yellow-700', bg: 'bg-[rgba(211,170,0,0.05)]' },
   Low: { border: 'border-orange-400', text: 'text-orange-500', bg: 'bg-orange-50' },
   Poor: { border: 'border-md-red-500', text: 'text-md-red-500', bg: 'bg-red-50' }
};

const getDiversityBadgeStyle = (status: string) => DIVERSITY_STYLES[status] ?? DIVERSITY_STYLES.Poor;
const LENDER_DIVERSITY_DOCS_URL =
   'https://app.gitbook.com/o/AMHwk2hHdkax8lFhGYOU/s/1QbbZpQ1L3YZPjatm5Lw/the-product/lender-diversity-score/~/gitsync/status';

const UserProfile = () => {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const { username } = useParams();
   const [searchParams] = useSearchParams();
   const [profileUser, setProfileUser] = useState<User | null>(null);
   const [isLoanMixSheetOpen, setIsLoanMixSheetOpen] = useState(false);
   const [isCreditLevelSheetOpen, setIsCreditLevelSheetOpen] = useState(false);
   const [isDefaultHistorySheetOpen, setIsDefaultHistorySheetOpen] = useState(false);
   const [isRepaymentHistorySheetOpen, setIsRepaymentHistorySheetOpen] = useState(false);
   const [isLenderDiversitySheetOpen, setIsLenderDiversitySheetOpen] = useState(false);
   // `null` until the admin check resolves, so a real admin never sees the restricted
   // card flash before their lender figures load.
   const [isAdminViewer, setIsAdminViewer] = useState<boolean | null>(null);
   const hasScrolledToHashRef = useRef(false);
   const { isDarkMode, toggleMode } = useThemeMode();
   const isDemoInsights = searchParams.get('demo') === 'rich';
   // Sample lender so the lender variant of this page can be reviewed without a real
   // lender account that happens to have funded loans.
   const isDemoLenderInsights = searchParams.get('demo') === 'lender';
   const isDemoMode = isDemoInsights || isDemoLenderInsights;
   const forceTourPreview = import.meta.env.DEV && searchParams.has('tourPreview');

   const user = useSelector((state: RootState) => state.auth.user);
   const storedLoans = useSelector((state: RootState) => state.loans.loans.gloans);
   const storedUserProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const loans = isDemoLenderInsights ? DEMO_LENDER_INSIGHTS_LOANS : isDemoInsights ? DEMO_BORROWER_INSIGHTS_LOANS : storedLoans;
   const userProfiles = isDemoLenderInsights ? DEMO_BORROWER_PROFILES : isDemoInsights ? DEMO_LENDER_PROFILES : storedUserProfiles;
   const resolvedUser = isDemoLenderInsights
      ? DEMO_LENDER_INSIGHTS_USER
      : isDemoInsights
        ? DEMO_BORROWER_INSIGHTS_USER
        : (profileUser ?? (username === user.username ? user : null));
   const isRealUserAuthenticated = Boolean(user?.id && user?.username);
   // A guest who follows the lender-tour bridge link from UserCard arrives with
   // ?demo=rich&lenderTourPreview=1&tourPreview=1 but has no real session — the DEV-only
   // `forceTourPreview` gate would hide the tour continuation for them in production.
   const isGuestLenderTourContinuation =
      !isRealUserAuthenticated && isDemoInsights && searchParams.has('lenderTourPreview') && searchParams.has('tourPreview');
   const showLenderTourPreview = forceTourPreview || isGuestLenderTourContinuation;
   // Matches the `LENDER_TOUR_USER.id` RequestBoard uses for guests so the tour's
   // "shown/completed" state in localStorage carries across the borrower-details bridge.
   const lenderTourUserId = isRealUserAuthenticated ? user.id : 'lender-tour-user';
   const showLenderInsightsTour =
      showLenderTourPreview &&
      searchParams.has('lenderTourPreview') &&
      shouldShowGuidedTour(LENDER_GUIDED_TOUR_ID, lenderTourUserId, forceTourPreview);

   useEffect(() => {
      if (hasScrolledToHashRef.current || window.location.hash !== '#loan-summary' || !resolvedUser) return;

      hasScrolledToHashRef.current = true;
      window.requestAnimationFrame(() => {
         document.getElementById('loan-summary')?.scrollIntoView({ block: 'start' });
      });
   }, [resolvedUser]);

   useEffect(() => {
      window.scrollTo(0, 0);
   }, []);

   // This route is public — every in-product link points at a borrower, but a lender's
   // username can still be typed in. Their lending figures are admin-only, so resolve the
   // viewer's admin status before deciding what a lender profile shows.
   useEffect(() => {
      if (isDemoMode) {
         setIsAdminViewer(true);
         return;
      }
      let cancelled = false;
      isCurrentUserAdmin().then((result) => {
         if (!cancelled) setIsAdminViewer(result);
      });
      return () => {
         cancelled = true;
      };
   }, [isDemoMode]);

   useEffect(() => {
      if (!username || isDemoMode) return;
      const loadProfile = async () => {
         try {
            const { user: fetchedUser } = await dispatch(getUserProfile(username)).unwrap();
            setProfileUser(fetchedUser);
            await dispatch(getUserLoans({ userId: fetchedUser.id })).unwrap();
         } catch (error) {
            console.error('Error fetching profile:', (error as Error).message || error);
         }
      };
      loadProfile();
   }, [dispatch, isDemoMode, username]);

   useEffect(() => {
      if (isDemoMode) return;
      // Both sides are needed: the borrower view names the lenders, the lender view names
      // the borrowers they funded.
      const counterpartyIds = [...new Set(loans.flatMap((loan) => [loan.lenderUser, loan.borrowerUser]).filter(Boolean))] as string[];
      if (counterpartyIds.length > 0) {
         dispatch(fetchUserProfiles(counterpartyIds)).catch(() => undefined);
      }
   }, [dispatch, isDemoMode, loans]);

   if (!resolvedUser || !loans) return <Loading />;

   const memberSince = formatDate(parseDateSafely(resolvedUser.createdAt).toISOString());
   const resolveUsername = (userId?: string | null) => (userId ? (userProfiles[userId]?.username ?? userId) : '');

   // --- Computed loan data ---

   // `getUserLoans` returns every loan this person touched on EITHER side (borrower or
   // lender). This page reads them purely as a borrower, so loans they funded have to be
   // dropped first — otherwise money they lent out shows up as "Total Borrowed", and their
   // own id lands in the repeat-lender / diversity maths.
   const borrowedLoans = loans.filter((loan) => loan.borrowerUser === resolvedUser.id);
   const fundedLoans = borrowedLoans.filter((loan) => loan.loanStatus === 'Lent');
   const defaultedLoans = fundedLoans.filter(
      (loan) => loan.repaymentStatus !== 'Paid' && parseDateSafely(loan.dueDate).getTime() < Date.now()
   );
   const defaultCount = defaultedLoans.length;
   const isGoodStanding = defaultCount === 0;

   const uniqueLoans: Loan[] = [];
   const seenAmounts = new Set<number>();
   for (const loan of fundedLoans) {
      const amt = toNumber(loan.loanAmount);
      if (isExactCreditTier(amt) && !seenAmounts.has(amt)) {
         uniqueLoans.push(loan);
         seenAmounts.add(amt);
      }
   }

   const ignoredTier = new Set<number>();
   const trustBuildingLoans = fundedLoans.reduce((acc: Loan[], loan: Loan) => {
      const amt = toNumber(loan.loanAmount);
      const key = getCreditTierKey(amt);
      if (isExactCreditTier(amt)) {
         if (ignoredTier.has(key)) acc.push(loan);
         else ignoredTier.add(key);
      } else {
         acc.push(loan);
      }
      return acc;
   }, []);

   const countMap = fundedLoans.reduce<Record<string, number>>((acc, loan) => {
      const name = resolveUsername(loan.lenderUser) || 'Unknown';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
   }, {});

   const sortedLoans = [...fundedLoans].sort(
      (a, b) => parseDateSafely(a.fundedAt ?? a.createdAt).getTime() - parseDateSafely(b.fundedAt ?? b.createdAt).getTime()
   );
   let totalDaysBetween = 0;
   for (let i = 1; i < sortedLoans.length; i++) {
      totalDaysBetween +=
         (parseDateSafely(sortedLoans[i].fundedAt ?? sortedLoans[i].createdAt).getTime() -
            parseDateSafely(sortedLoans[i - 1].fundedAt ?? sortedLoans[i - 1].createdAt).getTime()) /
         (1000 * 3600 * 24);
   }
   const avgDays = sortedLoans.length > 1 ? Math.round(totalDaysBetween / (sortedLoans.length - 1)) : 0;

   // A refunded loan reads back as 'Paid' with repaidAmount stamped to the full total, but the
   // borrower defaulted (lender refunded, borrower banned). It must not count as a repayment in
   // any of this borrower's public profile stats — payment time, total repaid, or history list.
   const paidLoans = fundedLoans.filter((l) => l.repaymentStatus === 'Paid' && !l.refundedAt);
   const avgPaymentTime =
      paidLoans.length > 0
         ? Math.round(
              paidLoans.reduce((sum, l) => {
                 return (
                    sum +
                    (parseDateSafely(l.updatedAt).getTime() - parseDateSafely(l.fundedAt ?? l.createdAt).getTime()) / (1000 * 3600 * 24)
                 );
              }, 0) / paidLoans.length
           )
         : 0;

   const usualLoanSize =
      fundedLoans.length > 0 ? Math.round(fundedLoans.reduce((sum, l) => sum + toNumber(l.loanAmount), 0) / fundedLoans.length) : 0;

   const avgLoanTerm =
      fundedLoans.length > 0
         ? Math.round(
              fundedLoans.reduce((sum, l) => {
                 return (
                    sum + (parseDateSafely(l.dueDate).getTime() - parseDateSafely(l.fundedAt ?? l.createdAt).getTime()) / (1000 * 3600 * 24)
                 );
              }, 0) / fundedLoans.length
           )
         : 0;

   const totalUniqueLenders = Object.keys(countMap).length;
   const repeatLenderCount = totalUniqueLenders - Object.values(countMap).filter((c) => c === 1).length;

   const lenderDiversity = calculateLenderDiversity(fundedLoans, userProfiles);
   const totalBorrowed = fundedLoans.reduce((sum, l) => sum + toNumber(l.loanAmount), 0);
   const totalRepaid = fundedLoans.filter((l) => !l.refundedAt).reduce((sum, l) => sum + toNumber(l.repaidAmount), 0);
   const repaymentLoans = fundedLoans.filter((loan) => toNumber(loan.repaidAmount) > 0 && !loan.refundedAt);

   // --- Lender-side view ---
   // Admin's "Open profile" and the lender feed both land here, so the page has to cope
   // with a user who only ever funds loans. Every borrower stat above reads as zero for
   // them, which looks broken; the lender variant reads the same loans from the other side.
   const lentLoans = loans.filter((loan) => loan.lenderUser === resolvedUser.id && loan.loanStatus === 'Lent');
   // Role is the signal, but older accounts predate `userRole`, so fall back to behaviour:
   // funded loans and nothing borrowed means they are being read as a lender.
   const isLenderProfile =
      resolvedUser.userRole === 'lender' || (resolvedUser.userRole !== 'borrower' && lentLoans.length > 0 && borrowedLoans.length === 0);
   // A lender's book — how much they have out, and who they backed — is an admin tool, not
   // something any visitor should be able to pull up by guessing a username.
   const canSeeLenderInsights = isLenderProfile && isAdminViewer === true;
   const isLenderInsightsRestricted = isLenderProfile && isAdminViewer === false;

   const totalLent = lentLoans.reduce((sum, l) => sum + toNumber(l.loanAmount), 0);
   const repaidToLender = lentLoans.reduce((sum, l) => sum + toNumber(l.repaidAmount), 0);
   const lenderPaidLoans = lentLoans.filter((l) => l.repaymentStatus === 'Paid');
   const lenderActiveLoans = lentLoans.filter((l) => l.repaymentStatus !== 'Paid');
   const lenderDefaultedLoans = lentLoans.filter((l) => l.repaymentStatus !== 'Paid' && parseDateSafely(l.dueDate).getTime() < Date.now());
   const borrowerCountMap = lentLoans.reduce<Record<string, number>>((acc, loan) => {
      const name = resolveUsername(loan.borrowerUser) || 'Unknown';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
   }, {});
   const uniqueBorrowerCount = Object.keys(borrowerCountMap).length;
   const repeatBorrowerCount = Object.values(borrowerCountMap).filter((c) => c > 1).length;
   const avgTicketSize = lentLoans.length > 0 ? Math.round(totalLent / lentLoans.length) : 0;
   const avgRepaidBackDays =
      lenderPaidLoans.length > 0
         ? Math.round(
              lenderPaidLoans.reduce(
                 (sum, l) =>
                    sum +
                    (parseDateSafely(l.updatedAt).getTime() - parseDateSafely(l.fundedAt ?? l.createdAt).getTime()) / (1000 * 3600 * 24),
                 0
              ) / lenderPaidLoans.length
           )
         : 0;
   const lenderExpectedReturn = lentLoans.reduce((sum, l) => sum + toNumber(l.totalRepaymentAmount), 0);
   const hasLendingHistory = lentLoans.length > 0;
   const lentLoansShouldScroll = lentLoans.length > 5;
   const displayedLentLoans = lentLoansShouldScroll ? lentLoans : lentLoans.slice(0, 5);

   const isVerifiedBorrower = isUserVerified(resolvedUser);
   const displayedCreditLimit = getEffectiveCreditLimit(resolvedUser.cs, isVerifiedBorrower);
   const creditMax = displayedCreditLimit;
   const creditLevel = creditMax > 0 ? getCreditLevelNumber(creditMax) : 0;
   const creditProgress = creditMax > 0 ? 100 : 0;

   const diversityScore = lenderDiversity.score;
   const diversityStatus = getDiversityStatus(diversityScore);
   const badge = getDiversityBadgeStyle(diversityStatus);
   const creditBuildingCount = uniqueLoans.length;
   const trustBuildingCount = trustBuildingLoans.length;
   const hasLoanHistory = fundedLoans.length > 0;
   const hasEnoughLenderDiversityHistory = lenderDiversity.hasEnoughHistory;
   const isEarlyLenderDiversityScore = hasEnoughLenderDiversityHistory && lenderDiversity.confidence < 1;
   const recentLoansShouldScroll = fundedLoans.length > 5;
   const displayedRecentLoans = recentLoansShouldScroll ? fundedLoans : fundedLoans.slice(0, 5);
   const loanMixLabel = !hasLoanHistory
      ? 'No loan mix yet'
      : trustBuildingCount > creditBuildingCount
        ? 'More Trust-Building Loans'
        : creditBuildingCount > trustBuildingCount
          ? 'More Credit-Building Loans'
          : 'Balanced Loan Mix';
   const lenderInsightsTourSteps = [
      {
         target: '[data-tour-target="borrower-identity"]',
         title: 'Start with who they are',
         body: 'Read the borrower context first — whether they are a verified human, how long they have been a member, and how they earn and repay. It frames every number below and tells you whether their reason to borrow fits their situation.',
         durationMs: 7500
      },
      {
         target: '[data-tour-target="borrower-credit-level"]',
         title: 'Check Credit Level',
         body: 'Credit Level is the borrower tier. It helps you understand how much trust they have already unlocked through prior behavior.',
         durationMs: 6500
      },
      {
         target: '[data-tour-target="borrower-loan-summary"]',
         title: 'Read the loan summary',
         body: 'Look at total borrowed, total loans, repayments, defaults, and standing. Good Standing means there are no unresolved defaults.',
         durationMs: 7200
      },
      {
         target: '[data-tour-target="borrower-diversity-score"]',
         title: 'Look at lender diversity',
         body: 'This shows whether the borrower has earned trust from multiple lenders, not just one repeated relationship.',
         durationMs: 6800
      },
      {
         target: '[data-tour-target="borrower-insights"]',
         title: 'Use behavior patterns',
         body: 'These patterns help you judge risk: how often they borrow, how fast they usually repay, typical loan size, loan term, and repeat lenders.',
         durationMs: 8200
      },
      {
         target: '[data-tour-target="borrower-recent-loans"]',
         title: 'Review recent loans',
         body: 'Use the recent loan table to confirm the borrower has a repayment history that matches the request you are thinking about funding.',
         durationMs: 7200
      },
      {
         target: '[data-tour-target="borrower-dark-mode"]',
         title: 'Change reading mode',
         body: 'Optional: switch to dark mode if it makes this profile easier to read. It changes nothing about the borrower data or your lending decision.',
         durationMs: 5000
      }
   ];

   return (
      <div
         className={`borrower-insights-page min-h-screen bg-md-neutral-200 transition-colors duration-200 ${isDarkMode ? 'borrower-insights-dark' : ''}`}
      >
         <style>{`
            .borrower-insights-dark {
               background: #0f1117;
               color: #eef2ff;
            }

            .borrower-insights-dark .bg-white {
               background-color: #171a23 !important;
            }

            .borrower-insights-dark .bg-md-neutral-200,
            .borrower-insights-dark .bg-md-neutral-100,
            .borrower-insights-dark .bg-\\[\\#fbfafc\\],
            .borrower-insights-dark .bg-\\[\\#f9fafb\\],
            .borrower-insights-dark .bg-\\[\\#f3f4f6\\] {
               background-color: #202532 !important;
            }

            .borrower-insights-dark .text-md-heading,
            .borrower-insights-dark .text-md-primary-2000,
            .borrower-insights-dark .text-\\[\\#1f2937\\],
            .borrower-insights-dark .text-\\[\\#2d1b69\\],
            .borrower-insights-dark .text-\\[\\#4b5563\\],
            .borrower-insights-dark .text-md-neutral-1400,
            .borrower-insights-dark .text-md-neutral-1500 {
               color: #eef2ff !important;
            }

            .borrower-insights-dark .text-md-neutral-1200,
            .borrower-insights-dark .text-md-neutral-700,
            .borrower-insights-dark .text-\\[\\#6b7280\\],
            .borrower-insights-dark .text-\\[\\#766985\\],
            .borrower-insights-dark .text-\\[\\#7c6f91\\],
            .borrower-insights-dark .text-\\[\\#a199ad\\],
            .borrower-insights-dark .text-\\[\\#9ca3af\\] {
               color: #a8b0c3 !important;
            }

            .borrower-insights-dark .border-\\[\\#ece7f4\\],
            .borrower-insights-dark .border-\\[\\#f1edf8\\],
            .borrower-insights-dark .border-\\[\\#f3f4f6\\],
            .borrower-insights-dark .border-md-neutral-500 {
               border-color: #2d3546 !important;
            }

            .borrower-insights-dark .divide-\\[\\#f1edf8\\] > :not([hidden]) ~ :not([hidden]) {
               border-color: #2d3546 !important;
            }

            .borrower-insights-dark .shadow-md-card,
            .borrower-insights-dark .shadow-\\[0_4px_16px_rgba\\(48\\,24\\,92\\,0\\.06\\)\\],
            .borrower-insights-dark .shadow-\\[0_4px_16px_rgba\\(131\\,54\\,240\\,0\\.08\\)\\] {
               box-shadow: 0 16px 36px rgba(0, 0, 0, 0.22) !important;
            }

            .borrower-insights-dark tr:hover {
               background-color: #202532 !important;
            }

            .borrower-insights-dark .insight-row:hover,
            .borrower-insights-dark .insight-row:focus-within {
               background-color: #202532 !important;
            }

            .borrower-insights-dark .ring-\\[\\#f1edf8\\] {
               --tw-ring-color: #30384a !important;
            }

            .borrower-insights-dark .diversity-score-card {
               background: radial-gradient(circle at 82% 22%, rgba(139, 92, 246, 0.22), transparent 34%),
                  linear-gradient(135deg, #171a23 0%, #1d2230 100%) !important;
               border-color: #3a2f58 !important;
               box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 18px 42px rgba(0, 0, 0, 0.28) !important;
            }

            .borrower-insights-dark .diversity-score-card::before {
               background: linear-gradient(135deg, rgba(139, 92, 246, 0.35), transparent) !important;
               opacity: 0.75 !important;
            }

            .borrower-insights-dark .diversity-score-hero {
               background: rgba(139, 92, 246, 0.12);
               border-radius: 999px;
               box-shadow: 0 18px 42px rgba(124, 58, 237, 0.18);
            }

            .borrower-insights-dark .diversity-score-value {
               color: #a78bfa !important;
               text-shadow: 0 0 24px rgba(139, 92, 246, 0.24);
            }

            .borrower-insights-dark .borrower-identity-card {
               background: #171a23 !important;
               border-color: #2d3546 !important;
               box-shadow: 0 14px 34px rgba(0, 0, 0, 0.2);
            }

            .borrower-verification-pill {
               border-color: #b9c0cc !important;
               background: #ffffff !important;
               color: #374151 !important;
            }

            .borrower-verification-pill.verified {
               border-color: #bfe8cf !important;
               background: #eefbf3 !important;
               color: #166534 !important;
            }

            .borrower-verification-pill.unverified {
               border-color: #cfd5df !important;
               background: #ffffff !important;
               color: #4b5563 !important;
            }

            .borrower-verification-icon {
               background: #4b5563 !important;
               color: #ffffff !important;
            }

            .borrower-verification-pill.verified .borrower-verification-icon {
               background: #166534 !important;
            }

            .borrower-verification-label {
               color: inherit !important;
            }

            .borrower-insights-dark .summary-wave path:first-of-type {
               opacity: 0.35 !important;
            }

            .borrower-insights-dark .summary-wave path:last-of-type {
               fill: #2d3546 !important;
               opacity: 0.45 !important;
            }

            .borrower-insights-dark .summary-metric-icon {
               box-shadow: 0 12px 28px rgba(124, 58, 237, 0.28) !important;
            }

            .borrower-insights-dark .summary-metric-icon-blue {
               box-shadow: 0 12px 28px rgba(37, 99, 235, 0.3) !important;
            }

            .borrower-insights-dark .insight-bottom-sheet {
               background-color: #171a23 !important;
               border: 1px solid #2d3546;
               color: #eef2ff;
               box-shadow: 0 -20px 48px rgba(0, 0, 0, 0.42) !important;
            }

            .borrower-insights-dark .insight-bottom-sheet-handle {
               background-color: #4a5265 !important;
            }

            .borrower-insights-dark .insight-bottom-sheet .border-b {
               border-color: #2d3546 !important;
            }

            .borrower-insights-dark .insight-bottom-sheet .bg-\\[\\#fbfaff\\],
            .borrower-insights-dark .insight-bottom-sheet .bg-\\[\\#f9fafb\\],
            .borrower-insights-dark .insight-bottom-sheet .bg-\\[\\#f0fdf4\\],
            .borrower-insights-dark .insight-bottom-sheet .bg-\\[\\#fef2f2\\],
            .borrower-insights-dark .insight-bottom-sheet .bg-\\[\\#fff7ed\\],
            .borrower-insights-dark .insight-bottom-sheet .bg-\\[\\#eff6ff\\] {
               background-color: #202532 !important;
            }

            .borrower-insights-dark .insight-bottom-sheet .border-\\[\\#eadfff\\],
            .borrower-insights-dark .insight-bottom-sheet .border-\\[\\#f1edf8\\],
            .borrower-insights-dark .insight-bottom-sheet .border-\\[\\#f3f4f6\\],
            .borrower-insights-dark .insight-bottom-sheet .border-\\[\\#bbf7d0\\],
            .borrower-insights-dark .insight-bottom-sheet .border-\\[\\#fecaca\\],
            .borrower-insights-dark .insight-bottom-sheet .border-\\[\\#fed7aa\\],
            .borrower-insights-dark .insight-bottom-sheet .border-\\[\\#dbeafe\\],
            .borrower-insights-dark .insight-bottom-sheet .border-\\[\\#dcfce7\\] {
               border-color: #344055 !important;
            }

            .borrower-insights-dark .insight-bottom-sheet .shadow-\\[0_4px_16px_rgba\\(239\\,68\\,68\\,0\\.08\\)\\],
            .borrower-insights-dark .insight-bottom-sheet .shadow-\\[0_4px_16px_rgba\\(16\\,185\\,129\\,0\\.08\\)\\],
            .borrower-insights-dark .insight-bottom-sheet .shadow-\\[0_8px_18px_rgba\\(48\\,24\\,92\\,0\\.04\\)\\] {
               box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2) !important;
            }

            .borrower-insights-dark * {
               scrollbar-color: #4a5265 #151922;
            }

            .borrower-insights-dark *::-webkit-scrollbar {
               width: 8px;
            }

            .borrower-insights-dark *::-webkit-scrollbar-track {
               background: #151922;
            }

            .borrower-insights-dark *::-webkit-scrollbar-thumb {
               background: #4a5265;
               border-radius: 999px;
            }
         `}</style>
         <div className="mx-auto max-w-[820px] pb-28">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
               <div className="flex min-w-0 flex-1 items-center gap-3">
                  <button
                     onClick={() => {
                        // A guest reached this page inside the simulated "lender-tour" session.
                        // navigate(-1) would drop them on the lender-preview board with no tour
                        // overlay, looking like they're signed in as the demo user. Exit cleanly
                        // to the public board instead.
                        if (isGuestLenderTourContinuation) {
                           navigate('/request-board');
                           return;
                        }
                        navigate(-1);
                     }}
                     className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-white active:scale-95"
                     aria-label="Back"
                  >
                     <ChevronLeft className="h-6 w-6 text-md-primary-2000" />
                  </button>
                  <h1 className="min-w-0 text-[26px] font-[590] leading-[1.1] tracking-[-0.52px] text-md-primary-2000">
                     {canSeeLenderInsights ? 'Lender Insights' : isLenderProfile ? 'Lender Account' : 'Borrower Insights'}
                  </h1>
               </div>
               <div className="flex shrink-0 items-center gap-2">
                  <button
                     type="button"
                     onClick={toggleMode}
                     aria-label={isDarkMode ? 'Switch borrower insights to light mode' : 'Switch borrower insights to dark mode'}
                     aria-pressed={isDarkMode}
                     data-tour-target="borrower-dark-mode"
                     className="flex h-10 w-10 items-center justify-center rounded-full border border-[#ece5f4] bg-white shadow-md-card transition active:scale-95"
                  >
                     {isDarkMode ? (
                        <Sun className="h-5 w-5 text-[#facc15]" strokeWidth={2.2} />
                     ) : (
                        <Moon className="h-5 w-5 text-md-primary-900" strokeWidth={2.2} />
                     )}
                  </button>
                  <button
                     type="button"
                     onClick={() => navigate('/support')}
                     aria-label="Open help and support center"
                     className="flex h-10 w-10 items-center justify-center rounded-full border border-[#ece5f4] bg-white shadow-md-card transition active:scale-95"
                  >
                     <HelpCircle className="h-5 w-5 text-md-primary-900" strokeWidth={1.8} />
                  </button>
               </div>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-5 px-5 py-3 sm:gap-6 sm:px-6">
               {/* User Profile */}
               <div
                  className="borrower-identity-card rounded-[20px] border border-[#e7d8ff] bg-white p-4 shadow-[0_6px_20px_rgba(48,24,92,0.05)] transition-colors duration-200"
                  data-tour-target="borrower-identity"
               >
                  <div className="flex items-center gap-3">
                     <img
                        src={PLACEHOLDER_AVATAR}
                        alt="Profile"
                        className="h-14 w-14 shrink-0 rounded-full border border-[#e7d8ff] bg-[#f8f4fc] object-cover"
                     />
                     <div className="min-w-0 flex-1">
                        <p className="truncate text-[20px] font-[590] leading-6 tracking-[-0.4px] text-md-primary-2000">
                           {resolvedUser.username || username}
                        </p>
                        {/* Verification is a borrower requirement — lenders never go through it,
                            so an "unverified" pill on a lender reads as a black mark it isn't. */}
                        {isLenderProfile ? null : (
                           <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <span
                                 className={`borrower-verification-pill inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 ${
                                    isVerifiedBorrower ? 'verified' : 'unverified'
                                 }`}
                              >
                                 <span className="borrower-verification-icon flex h-4 w-4 items-center justify-center rounded-full">
                                    {isVerifiedBorrower ? (
                                       <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />
                                    ) : (
                                       <X className="h-2.5 w-2.5 text-white" strokeWidth={4} />
                                    )}
                                 </span>
                                 <span className="borrower-verification-label text-[12px] font-[590] leading-none">
                                    {isVerifiedBorrower ? 'Verified borrower' : 'Not verified'}
                                 </span>
                              </span>
                           </div>
                        )}
                        <p className="mt-2 text-[12px] font-normal leading-[18px] text-md-neutral-1200">Member since {memberSince}</p>
                     </div>
                  </div>
                  {resolvedUser.incomeDescription ? (
                     <div className="mt-4 border-t border-[#eee7f5] pt-4">
                        <p className="text-[11px] font-[590] leading-4 text-md-primary-1200">Borrower context</p>
                        <p className="borrower-identity-context mt-1 text-[13px] font-normal leading-5 text-md-neutral-1400">
                           {resolvedUser.incomeDescription}
                        </p>
                     </div>
                  ) : null}
               </div>

               {/* ── Lender view ──────────────────────────────────────────────────────
                   Credit Level, Lender Diversity and the borrowing patterns below are all
                   borrower concepts. A lender gets the mirror image: what they put out,
                   who they backed, and what came back — but only for an admin. Everyone
                   else gets told this is a lender account and nothing more; the admin
                   check is still resolving while `isLenderProfile` holds and neither
                   branch is true. */}
               {isLenderInsightsRestricted ? (
                  <div className="rounded-[20px] border border-[#ece7f4] bg-white p-6 text-center shadow-[0_4px_16px_rgba(48,24,92,0.06)]">
                     <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f3ff]">
                        <ShieldCheck className="h-6 w-6 text-[#8b5cf6]" strokeWidth={2.2} />
                     </span>
                     <p className="text-[17px] font-bold leading-tight text-md-primary-2000">This account is a lender</p>
                     <p className="mx-auto mt-2 max-w-[280px] text-[14px] leading-5 text-md-neutral-1400">
                        Lenders fund loans rather than borrow, so there is no borrowing history to show here.
                     </p>
                  </div>
               ) : canSeeLenderInsights ? (
                  <>
                     {/* Lending Summary */}
                     <div id="loan-summary" className="scroll-mt-4 flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                           <span className="text-md-h5 font-semibold text-md-heading">Lending Summary</span>
                           {lenderDefaultedLoans.length === 0 ? (
                              <span className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#d4f4e2] to-[#e8f9f0] px-3 py-1.5 shadow-sm">
                                 <span className="text-[11px] font-semibold leading-none text-[#059669]">No Defaults</span>
                              </span>
                           ) : (
                              <span className="inline-flex items-center justify-center rounded-full bg-red-50 px-3 py-1.5 shadow-sm">
                                 <span className="text-[11px] font-semibold leading-none text-[#ef4444]">
                                    {lenderDefaultedLoans.length} Overdue
                                 </span>
                              </span>
                           )}
                        </div>

                        <div className="grid grid-cols-2 gap-[14px]">
                           <SummaryMetricCard
                              icon={<DollarSign className="h-5 w-5 text-white" strokeWidth={2.5} />}
                              iconClassName="from-[#8b5cf6] to-[#7c3aed] shadow-purple-200"
                              waveId="lent-wave"
                              waveStart="#e9d5ff"
                              waveEnd="#ddd6fe"
                              title="Total Lent"
                              value={`$${formatNumber(totalLent)}`}
                           >
                              <div className="relative z-10 space-y-[3px]">
                                 <p className="text-[12px] font-medium text-[#10b981]">${formatNumber(repaidToLender)} Repaid Back</p>
                                 <p className="text-[12px] font-medium text-[#9ca3af]">${formatNumber(lenderExpectedReturn)} Expected</p>
                              </div>
                           </SummaryMetricCard>

                           <SummaryMetricCard
                              icon={<FileText className="h-5 w-5 text-white" strokeWidth={2.5} />}
                              iconClassName="from-[#3b82f6] to-[#2563eb] shadow-blue-200"
                              waveId="loans-wave"
                              waveStart="#ddd6fe"
                              waveEnd="#c4b5fd"
                              title="Loans Funded"
                              value={String(lentLoans.length)}
                           >
                              <div className="relative z-10 space-y-[3px]">
                                 <p className="text-[12px] font-medium text-[#2563eb]">{lenderActiveLoans.length} Active</p>
                                 <p className="text-[12px] font-medium text-[#059669]">{lenderPaidLoans.length} Fully Repaid</p>
                              </div>
                           </SummaryMetricCard>

                           <div className="relative col-span-2 overflow-hidden rounded-[24px] border border-[#e9d5ff] bg-gradient-to-br from-white to-[#faf5ff] p-5 shadow-[0_6px_24px_rgba(131,54,240,0.12)]">
                              <div className="absolute right-0 top-0 h-[120px] w-[120px] rounded-full bg-gradient-to-br from-[#f3e8ff] to-transparent opacity-60 blur-2xl" />
                              <div className="relative z-10 flex items-start justify-between gap-3">
                                 <div className="min-w-0 flex-1">
                                    <p className="mb-3 text-[15px] font-semibold text-[#6b7280]">Borrowers Backed</p>
                                    {hasLendingHistory ? (
                                       <>
                                          <div className="mb-3 flex items-baseline gap-1.5">
                                             <p className="text-[32px] font-bold leading-none tracking-tight text-[#7c3aed]">
                                                {uniqueBorrowerCount}
                                             </p>
                                             <p className="text-[16px] font-medium text-[#4b5563]">
                                                {uniqueBorrowerCount === 1 ? 'borrower' : 'borrowers'}
                                             </p>
                                          </div>
                                          <span className="inline-flex items-center gap-1.5">
                                             <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#dbeafe]">
                                                <Users className="h-3.5 w-3.5 text-[#3b82f6]" strokeWidth={2.5} />
                                             </span>
                                             <span className="text-[13px] font-semibold text-[#3b82f6]">
                                                {repeatBorrowerCount} funded more than once
                                             </span>
                                          </span>
                                       </>
                                    ) : (
                                       <div className="max-w-[210px]">
                                          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#f5f3ff] px-3 py-2">
                                             <Sparkles className="h-4 w-4 text-[#8b5cf6]" strokeWidth={2.5} />
                                             <span className="text-[15px] font-bold leading-none text-[#8b5cf6]">No loans funded yet</span>
                                          </span>
                                          <p className="text-[14px] leading-5 text-[#6b7280]">
                                             This lender has not funded a loan yet, so there is nothing to summarise.
                                          </p>
                                       </div>
                                    )}
                                 </div>
                                 <span className="flex h-[104px] w-[104px] shrink-0 items-center justify-center">
                                    <img
                                       src="/hippos/borrower-insights-trophy.png"
                                       alt="Moodeng with trophy"
                                       className="h-[96px] w-[96px] object-contain drop-shadow-lg"
                                    />
                                 </span>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Lending Patterns */}
                     {hasLendingHistory ? (
                        <div className="flex flex-col gap-4">
                           <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] shadow-md shadow-purple-200">
                                 <BarChart3 className="h-[18px] w-[18px] text-white" strokeWidth={2.5} />
                              </span>
                              <p className="text-[20px] font-bold leading-none tracking-[-0.01em] text-[#2d1b69]">Lending Patterns</p>
                           </div>
                           <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_4px_16px_rgba(131,54,240,0.08)] divide-y divide-[#f3f4f6]">
                              <InsightRow
                                 icon={<DollarSign className="h-4 w-4 text-[#8b5cf6]" strokeWidth={2.5} />}
                                 iconClassName="bg-[#ede9fe]"
                                 label="Usual amount funded"
                                 value={`$${avgTicketSize}`}
                                 valueColor="text-[#8b5cf6]"
                              />
                              <InsightRow
                                 icon={<Clock3 className="h-4 w-4 text-[#3b82f6]" strokeWidth={2.5} />}
                                 iconClassName="bg-[#dbeafe]"
                                 label="Typical time to be repaid"
                                 value={
                                    lenderPaidLoans.length > 0
                                       ? `${avgRepaidBackDays} ${avgRepaidBackDays === 1 ? 'day' : 'days'}`
                                       : 'No repayments yet'
                                 }
                                 valueColor="text-[#3b82f6]"
                              />
                              <InsightRow
                                 icon={<RefreshCcw className="h-4 w-4 text-[#8b5cf6]" strokeWidth={2.5} />}
                                 iconClassName="bg-[#ede9fe]"
                                 label="Repeat borrowers"
                                 value={`${repeatBorrowerCount} of ${uniqueBorrowerCount}`}
                                 valueColor="text-[#8b5cf6]"
                              />
                              <InsightRow
                                 icon={<AlertCircle className="h-4 w-4 text-[#ef4444]" strokeWidth={2.5} />}
                                 iconClassName="bg-[#fee2e2]"
                                 label="Overdue against them"
                                 value={`${lenderDefaultedLoans.length} of ${lentLoans.length}`}
                                 valueColor={lenderDefaultedLoans.length > 0 ? 'text-[#ef4444]' : 'text-[#1f2937]'}
                              />
                           </div>
                        </div>
                     ) : null}

                     {/* Loans Funded */}
                     <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-2">
                           <span className="text-md-h5 font-semibold text-md-heading">Loans Funded</span>
                           <p className="text-md-b3 font-normal text-md-neutral-1500">
                              Who this lender has backed and the status of each loan.
                           </p>
                        </div>
                        <div className="overflow-hidden rounded-[18px] border border-[#ece7f4] bg-white shadow-[0_4px_16px_rgba(48,24,92,0.06)]">
                           <div className="hidden border-b border-[#ece7f4] bg-[#fbfafc] px-4 py-3 sm:block">
                              <div className="grid grid-cols-[minmax(0,1.45fr)_72px_86px] items-center gap-3 text-[11px] font-bold uppercase tracking-[0.04em] text-[#7c6f91]">
                                 <span>Loan / borrower</span>
                                 <span className="text-right">Amount</span>
                                 <span className="text-right">Status</span>
                              </div>
                           </div>
                           <div className={lentLoansShouldScroll ? 'max-h-[360px] overflow-y-auto' : ''}>
                              {hasLendingHistory ? (
                                 <>
                                    <table className="hidden w-full border-collapse sm:table">
                                       <tbody className="divide-y divide-[#f1edf8]">
                                          {displayedLentLoans.map((loan: Loan) => (
                                             <RecentLoanItem
                                                key={loan.id}
                                                counterparty="borrower"
                                                loan={loan}
                                                resolveUsername={resolveUsername}
                                             />
                                          ))}
                                       </tbody>
                                    </table>
                                    <div className="divide-y divide-[#f1edf8] sm:hidden">
                                       {displayedLentLoans.map((loan: Loan) => (
                                          <RecentLoanMobileItem
                                             key={loan.id}
                                             counterparty="borrower"
                                             loan={loan}
                                             resolveUsername={resolveUsername}
                                          />
                                       ))}
                                    </div>
                                 </>
                              ) : (
                                 <p className="text-md-b2 text-md-neutral-1200 text-center py-6">No loans funded yet</p>
                              )}
                           </div>
                        </div>
                     </div>
                  </>
               ) : isLenderProfile ? null : (
                  <>
                     {/* Credit Level */}
                     <div
                        className="flex flex-col gap-4 rounded-[20px] border border-[#e7d8ff] bg-white p-4 shadow-[0_6px_20px_rgba(48,24,92,0.05)]"
                        data-tour-target="borrower-credit-level"
                     >
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <span className="text-[18px] font-[590] leading-[22px] tracking-[-0.36px] text-md-heading">Credit Level</span>
                              <button
                                 type="button"
                                 onClick={() => setIsCreditLevelSheetOpen(true)}
                                 aria-label="How Credit Level works"
                                 className="flex h-7 w-7 items-center justify-center rounded-full active:scale-95"
                              >
                                 <HelpCircle className="w-5 h-5 text-md-primary-900" strokeWidth={1.5} />
                              </button>
                           </div>
                           <button
                              type="button"
                              onClick={() =>
                                 navigate(
                                    `/user/${encodeURIComponent(resolvedUser.username || username || '')}/progress-history${
                                       isDemoInsights ? '?demo=rich' : ''
                                    }`
                                 )
                              }
                              className="text-[12px] font-[590] leading-[18px] text-md-blue-600 underline underline-offset-2"
                           >
                              View Progress History
                           </button>
                        </div>
                        <div className="flex flex-col gap-3">
                           <div className="flex items-center gap-2">
                              {/* LVL Badge */}
                              <div className="flex items-center">
                                 <div className="w-[28px] h-[28px] rounded-full bg-md-neutral-500 flex items-center justify-center z-10">
                                    <div className="w-4 h-4 rounded-full bg-md-neutral-1400" />
                                 </div>
                                 <div className="bg-md-neutral-500 rounded-md-sm flex items-center justify-end px-md-1 h-[22px] w-[58px] -ml-2">
                                    <span className="font-knewave text-md-b2 text-md-neutral-1400 text-center">LVL {creditLevel}</span>
                                 </div>
                              </div>
                              <div className="flex-1 flex items-center justify-end gap-1 text-md-b2">
                                 <span className="font-semibold text-md-primary-800">${formatNumber(creditMax)}</span>
                                 <span className="font-normal text-md-neutral-700">/ ${formatNumber(creditMax)}</span>
                              </div>
                           </div>
                           {/* Progress Bar */}
                           <div className="h-2.5 overflow-hidden rounded-md-pill bg-[#eee8f4]">
                              <div
                                 className="h-full bg-md-primary-900 rounded-md-pill transition-all duration-500"
                                 style={{ width: creditProgress > 0 ? `${Math.max(creditProgress, 8)}%` : '0%' }}
                              />
                           </div>
                        </div>
                     </div>

                     {/* Loan Summary */}
                     <div id="loan-summary" className="scroll-mt-4 flex flex-col gap-4" data-tour-target="borrower-loan-summary">
                        <div className="flex items-center justify-between gap-3">
                           <span className="text-[18px] font-[590] leading-[22px] tracking-[-0.36px] text-md-heading">Loan Summary</span>
                           {isGoodStanding ? (
                              <span className="inline-flex items-center justify-center rounded-full border border-[#bfe8cf] bg-[#eefbf3] px-2.5 py-1.5">
                                 <span className="text-[11px] font-[590] leading-none text-[#166534]">Good standing</span>
                              </span>
                           ) : (
                              <button
                                 type="button"
                                 onClick={() => setIsDefaultHistorySheetOpen(true)}
                                 className="inline-flex items-center justify-center rounded-full border border-[#fecaca] bg-red-50 px-2.5 py-1.5 transition-opacity active:opacity-70"
                              >
                                 <span className="text-[11px] font-semibold leading-none text-[#ef4444]">
                                    {defaultCount} {defaultCount === 1 ? 'Default' : 'Defaults'}
                                 </span>
                              </button>
                           )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                           <SummaryMetricCard
                              icon={<DollarSign className="h-5 w-5 text-white" strokeWidth={2.5} />}
                              iconClassName="from-[#8b5cf6] to-[#7c3aed] shadow-purple-200"
                              waveId="borrowed-wave"
                              waveStart="#e9d5ff"
                              waveEnd="#ddd6fe"
                              title="Total Borrowed"
                              value={`$${formatNumber(totalBorrowed)}`}
                           >
                              <div className="relative z-10 flex flex-col items-start gap-1">
                                 {totalRepaid > 0 ? (
                                    <button
                                       type="button"
                                       onClick={() => setIsRepaymentHistorySheetOpen(true)}
                                       className="text-[12px] font-medium text-[#10b981] underline-offset-2 transition-opacity hover:underline active:opacity-70"
                                    >
                                       ${formatNumber(totalRepaid)} Repaid
                                    </button>
                                 ) : null}
                                 {defaultCount > 0 ? (
                                    <button
                                       type="button"
                                       onClick={() => setIsDefaultHistorySheetOpen(true)}
                                       className="text-[12px] font-medium text-[#ef4444] underline-offset-2 transition-opacity hover:underline active:opacity-70"
                                    >
                                       {defaultCount} {defaultCount === 1 ? 'Default' : 'Defaults'}
                                    </button>
                                 ) : (
                                    <p className="text-[12px] font-medium text-[#9ca3af]">0 Defaults</p>
                                 )}
                              </div>
                           </SummaryMetricCard>

                           <SummaryMetricCard
                              icon={<FileText className="h-5 w-5 text-white" strokeWidth={2.5} />}
                              iconClassName="from-[#3b82f6] to-[#2563eb] shadow-blue-200"
                              waveId="loans-wave"
                              waveStart="#ddd6fe"
                              waveEnd="#c4b5fd"
                              title="Total Loans"
                              value={String(fundedLoans.length)}
                           >
                              <div className="relative z-10 flex flex-col items-start gap-2">
                                 <button
                                    type="button"
                                    onClick={() => setIsLoanMixSheetOpen(true)}
                                    className="group inline-flex max-w-full items-center gap-1 rounded-full bg-[#f5f3ff] px-2 py-1 transition-colors hover:bg-[#ede9fe] active:scale-[0.98]"
                                 >
                                    <span className="text-[11px] font-[590] text-md-primary-1200">View loan mix</span>
                                    <ChevronRight className="h-2.5 w-2.5 shrink-0 text-[#8b5cf6]" strokeWidth={2.5} />
                                 </button>
                                 {hasLoanHistory ? (
                                    <div className="max-w-full space-y-0.5 text-[10px] font-semibold leading-[1.15]">
                                       <div className="flex min-w-0 items-center gap-1 text-[#2563eb]">
                                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563eb]" />
                                          <span className="whitespace-nowrap">{trustBuildingCount} Trust Building</span>
                                       </div>
                                       <div className="flex min-w-0 items-center gap-1 text-[#059669]">
                                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#059669]" />
                                          <span className="whitespace-nowrap">{creditBuildingCount} Credit Building</span>
                                       </div>
                                    </div>
                                 ) : null}
                              </div>
                           </SummaryMetricCard>

                           <div
                              className="diversity-score-card relative col-span-2 overflow-hidden rounded-[20px] border border-[#e7d8ff] bg-white p-4 shadow-[0_6px_20px_rgba(48,24,92,0.05)]"
                              data-tour-target="borrower-diversity-score"
                           >
                              <div className="relative z-10 flex items-start justify-between gap-3">
                                 <div className="min-w-0 flex-1">
                                    <div className="mb-3 flex items-center gap-1.5">
                                       <p className="text-[13px] font-[590] leading-5 text-md-neutral-1200">Lender diversity</p>
                                       <button
                                          type="button"
                                          onClick={() => setIsLenderDiversitySheetOpen(true)}
                                          aria-label="How Lender Diversity Score works"
                                          className="flex h-6 w-6 items-center justify-center rounded-full text-[#8b5cf6] transition active:scale-95"
                                       >
                                          <HelpCircle className="h-4 w-4" strokeWidth={2.2} />
                                       </button>
                                    </div>
                                    {hasEnoughLenderDiversityHistory ? (
                                       <>
                                          <div className="mb-3 flex flex-wrap items-center gap-2">
                                             <div className="flex items-baseline gap-1.5">
                                                <p className="diversity-score-value text-[30px] font-[590] leading-none tracking-[-0.6px] text-md-primary-1200">
                                                   {diversityScore}
                                                </p>
                                                <p className="text-[13px] font-normal text-md-neutral-1200">points</p>
                                             </div>
                                             <span
                                                className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 ${badge.border} ${badge.bg}`}
                                             >
                                                <span className={`text-[11px] font-semibold leading-none ${badge.text}`}>
                                                   {isEarlyLenderDiversityScore ? 'Early Score' : `${diversityStatus} Diversity`}
                                                </span>
                                             </span>
                                          </div>
                                          {isEarlyLenderDiversityScore ? (
                                             <p className="mb-3 max-w-[210px] text-[12px] leading-[18px] text-md-neutral-1200">
                                                Early estimate: needs 8 funded loans before the score is fully weighted.
                                             </p>
                                          ) : null}
                                          <button
                                             type="button"
                                             onClick={() =>
                                                navigate(
                                                   `/user/${encodeURIComponent(resolvedUser.username)}/lender-diversity${isDemoInsights ? '?demo=rich' : ''}`
                                                )
                                             }
                                             className="flex items-center gap-1.5 transition-opacity hover:opacity-80 active:scale-[0.98]"
                                          >
                                             <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#dbeafe]">
                                                <Users className="h-3.5 w-3.5 text-[#3b82f6]" strokeWidth={2.5} />
                                             </span>
                                             <span className="text-[13px] font-semibold text-[#3b82f6]">
                                                {lenderDiversity.uniqueLenders} Unique{' '}
                                                {lenderDiversity.uniqueLenders === 1 ? 'Lender' : 'Lenders'}
                                             </span>
                                          </button>
                                       </>
                                    ) : (
                                       <div className="max-w-[210px]">
                                          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#f5f3ff] px-3 py-2">
                                             <Sparkles className="h-4 w-4 text-[#8b5cf6]" strokeWidth={2.5} />
                                             <span className="text-[15px] font-bold leading-none text-[#8b5cf6]">Not enough history</span>
                                          </span>
                                          <p className="mb-2 text-[16px] font-semibold leading-[1.25] text-[#4b5563]">Not enough history</p>
                                          <p className="text-[14px] leading-5 text-[#6b7280]">
                                             This score appears after at least 2 funded loans.
                                          </p>
                                       </div>
                                    )}
                                 </div>
                                 <span className="diversity-score-hero flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full bg-[#f8f4fc]">
                                    <img
                                       src="/hippos/borrower-insights-trophy.png"
                                       alt="Moodeng with trophy"
                                       className="h-[68px] w-[68px] object-contain"
                                    />
                                 </span>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Borrower Insights */}
                     <div className="flex flex-col gap-4" data-tour-target="borrower-insights">
                        <div className="flex items-center gap-2">
                           <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#ede2ff]">
                              <BarChart3 className="h-[18px] w-[18px] text-md-primary-1200" strokeWidth={2.2} />
                           </span>
                           <p className="text-[18px] font-[590] leading-[22px] tracking-[-0.36px] text-md-heading">Borrower patterns</p>
                        </div>
                        {hasLoanHistory ? (
                           <div className="divide-y divide-[#eee7f5] overflow-hidden rounded-[20px] border border-[#e7d8ff] bg-white shadow-[0_6px_20px_rgba(48,24,92,0.05)]">
                              <InsightRow
                                 icon={<CalendarDays className="h-4 w-4 text-[#8b5cf6]" strokeWidth={2.5} />}
                                 iconClassName="bg-[#ede9fe]"
                                 label="Avg days between loans"
                                 value={`${avgDays} days`}
                                 valueColor="text-[#8b5cf6]"
                              />
                              <InsightRow
                                 icon={<Clock3 className="h-4 w-4 text-[#3b82f6]" strokeWidth={2.5} />}
                                 iconClassName="bg-[#dbeafe]"
                                 label="Typical payment time"
                                 value={`${avgPaymentTime} ${avgPaymentTime === 1 ? 'day' : 'days'}`}
                                 valueColor="text-[#3b82f6]"
                              />
                              <InsightRow
                                 icon={<DollarSign className="h-4 w-4 text-[#8b5cf6]" strokeWidth={2.5} />}
                                 iconClassName="bg-[#ede9fe]"
                                 label="Usual loan size"
                                 value={`$${usualLoanSize}`}
                                 valueColor="text-[#8b5cf6]"
                              />
                              <InsightRow
                                 icon={<FileText className="h-4 w-4 text-[#6b7280]" strokeWidth={2.5} />}
                                 iconClassName="bg-[#f3f4f6]"
                                 label="Typical loan term"
                                 value={`${avgLoanTerm} days`}
                                 valueColor="text-[#1f2937]"
                              />
                              <InsightRow
                                 icon={<RefreshCcw className="h-4 w-4 text-[#ef4444]" strokeWidth={2.5} />}
                                 iconClassName="bg-[#fee2e2]"
                                 label="Repeat lenders"
                                 value={`${repeatLenderCount} of ${totalUniqueLenders}`}
                                 valueColor="text-[#ef4444]"
                              />
                           </div>
                        ) : (
                           <NewBorrowerInsightsCard />
                        )}
                     </div>

                     {/* Recent Loans */}
                     <div className="flex flex-col gap-2" data-tour-target="borrower-recent-loans">
                        <div className="flex flex-col gap-2">
                           <div className="flex items-center justify-between">
                              <span className="text-md-h5 font-semibold text-md-heading">Recent Loans</span>
                           </div>
                           <p className="text-md-b3 font-normal text-md-neutral-1500">
                              View who has funded this borrower and the status of each loan.
                           </p>
                        </div>
                        <div className="overflow-hidden rounded-[18px] border border-[#ece7f4] bg-white shadow-[0_4px_16px_rgba(48,24,92,0.06)]">
                           <div className="hidden border-b border-[#ece7f4] bg-[#fbfafc] px-4 py-3 sm:block">
                              <div className="grid grid-cols-[minmax(0,1.45fr)_72px_86px] items-center gap-3 text-[11px] font-bold uppercase tracking-[0.04em] text-[#7c6f91]">
                                 <span>Loan / lender</span>
                                 <span className="text-right">Amount</span>
                                 <span className="text-right">Status</span>
                              </div>
                           </div>
                           <div className={recentLoansShouldScroll ? 'max-h-[360px] overflow-y-auto' : ''}>
                              {fundedLoans.length > 0 ? (
                                 <>
                                    <table className="hidden w-full border-collapse sm:table">
                                       <tbody className="divide-y divide-[#f1edf8]">
                                          {displayedRecentLoans.map((loan: Loan) => (
                                             <RecentLoanItem key={loan.id} loan={loan} resolveUsername={resolveUsername} />
                                          ))}
                                       </tbody>
                                    </table>
                                    <div className="divide-y divide-[#f1edf8] sm:hidden">
                                       {displayedRecentLoans.map((loan: Loan) => (
                                          <RecentLoanMobileItem key={loan.id} loan={loan} resolveUsername={resolveUsername} />
                                       ))}
                                    </div>
                                 </>
                              ) : (
                                 <p className="text-md-b2 text-md-neutral-1200 text-center py-6">No funded loans yet</p>
                              )}
                           </div>
                        </div>
                     </div>
                  </>
               )}
            </div>
         </div>
         <LoanMixBottomSheet
            isOpen={isLoanMixSheetOpen}
            onClose={() => setIsLoanMixSheetOpen(false)}
            label={loanMixLabel}
            trustBuildingCount={trustBuildingCount}
            creditBuildingCount={creditBuildingCount}
         />
         <CreditLevelBottomSheet isOpen={isCreditLevelSheetOpen} onClose={() => setIsCreditLevelSheetOpen(false)} />
         <DefaultHistoryBottomSheet
            isOpen={isDefaultHistorySheetOpen}
            onClose={() => setIsDefaultHistorySheetOpen(false)}
            defaultedLoans={defaultedLoans}
         />
         <RepaymentHistoryBottomSheet
            isOpen={isRepaymentHistorySheetOpen}
            onClose={() => setIsRepaymentHistorySheetOpen(false)}
            repaymentLoans={repaymentLoans}
            totalRepaid={totalRepaid}
         />
         <LenderDiversityBottomSheet
            isOpen={isLenderDiversitySheetOpen}
            onClose={() => setIsLenderDiversitySheetOpen(false)}
            onOpenDocs={() => window.open(LENDER_DIVERSITY_DOCS_URL, '_blank', 'noopener,noreferrer')}
         />
         {showLenderInsightsTour && (
            <GuidedTourPreview
               // The visitor already opted in on the request board — re-showing the
               // "Want a quick tour?" intro card here would feel like the tour reset
               // rather than continued, so jump straight into step 4.
               startImmediately
               stepOffset={5}
               totalSteps={11}
               steps={lenderInsightsTourSteps}
               // Back on the first step here (global step 6) returns to the request board and
               // resumes the lender tour at its last step (step 5, "Check Borrower Insights")
               // with the overlay still active.
               onStepBack={(index) => {
                  if (index !== 0) return false;
                  navigate(
                     isGuestLenderTourContinuation
                        ? '/request-board?tour=1&tourRole=lender&startTour=1&tourStep=4'
                        : '/request-board?lenderTourPreview=1&startTour=1&tourStep=4'
                  );
                  return true;
               }}
               onFinish={(reason) => {
                  if (!forceTourPreview) {
                     markGuidedTourCompleted(LENDER_GUIDED_TOUR_ID, lenderTourUserId);
                     void recordGuidedTourEvent({
                        eventType: reason === 'skip' ? 'skipped' : 'completed',
                        metadata: { path: '/user/:username', role: 'lender' },
                        tourId: LENDER_GUIDED_TOUR_ID,
                        userId: lenderTourUserId
                     });
                  }
                  // Guests finish/skip in a simulated session, so return them to the public
                  // board rather than the lender-preview URL that looks like a fake login.
                  navigate(isGuestLenderTourContinuation ? '/request-board' : '/request-board?lenderTourPreview=1');
               }}
            />
         )}
      </div>
   );
};

const SummaryMetricCard = ({
   icon,
   title,
   value,
   children
}: {
   icon: ReactNode;
   iconClassName: string;
   waveId: string;
   waveStart: string;
   waveEnd: string;
   title: string;
   value: string;
   children: ReactNode;
}) => (
   <div className="relative min-h-[166px] overflow-hidden rounded-[20px] border border-[#e7d8ff] bg-white p-4 shadow-[0_6px_20px_rgba(48,24,92,0.05)]">
      <div className="summary-metric-icon mb-4 flex h-9 w-9 items-center justify-center rounded-[12px] bg-md-primary-1200">{icon}</div>
      <p className="mb-1.5 text-[12px] font-[590] leading-[18px] text-md-neutral-1200">{title}</p>
      <p className="mb-3 text-[28px] font-[590] leading-none tracking-[-0.56px] text-md-heading">{value}</p>
      {children}
   </div>
);

const InsightRow = ({
   icon,
   iconClassName,
   label,
   value,
   valueColor
}: {
   icon: ReactNode;
   iconClassName: string;
   label: string;
   value: string;
   valueColor: string;
}) => (
   <div className="insight-row flex min-h-[58px] items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[#fbf9fd]">
      <div className="flex min-w-0 items-center gap-3">
         <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${iconClassName}`}>{icon}</span>
         <span className="min-w-0 text-[13px] font-[510] leading-5 text-md-neutral-1400">{label}</span>
      </div>
      <span className={`shrink-0 text-[14px] font-[590] leading-5 ${valueColor}`}>{value}</span>
   </div>
);

const NewBorrowerInsightsCard = () => (
   <div className="flex items-start gap-3 rounded-[20px] border border-[#e7d8ff] bg-white p-4 shadow-[0_6px_20px_rgba(48,24,92,0.05)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#ede2ff]">
         <FileText className="h-5 w-5 text-md-primary-1200" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
         <p className="text-[15px] font-[590] leading-5 text-md-heading">Not enough loan history yet</p>
         <p className="mt-1 text-[13px] leading-5 text-md-neutral-1200">
            Once this borrower completes more loans, you'll see repayment timing, usual loan size, repeat lenders, and borrowing patterns
            here.
         </p>
      </div>
   </div>
);

const DefaultHistoryBottomSheet = ({
   isOpen,
   onClose,
   defaultedLoans
}: {
   isOpen: boolean;
   onClose: () => void;
   defaultedLoans: Loan[];
}) => {
   const dragStartY = useRef<number | null>(null);
   const dragOffsetRef = useRef(0);
   const [dragOffset, setDragOffset] = useState(0);

   if (!isOpen) return null;

   const handleDragStart = (event: PointerEvent<HTMLDivElement>) => {
      dragStartY.current = event.clientY;
      dragOffsetRef.current = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const handleDragMove = (event: PointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return;
      const nextOffset = Math.max(0, event.clientY - dragStartY.current);
      dragOffsetRef.current = nextOffset;
      setDragOffset(nextOffset);
   };

   const handleDragEnd = (event: PointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (dragOffsetRef.current > 96) {
         onClose();
      }
      dragStartY.current = null;
      dragOffsetRef.current = 0;
      setDragOffset(0);
   };

   return (
      <div className="fixed inset-0 z-[80] flex items-end">
         <button
            type="button"
            aria-label="Close default history"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
         />
         <div
            className="insight-bottom-sheet relative mx-auto flex max-h-[84dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.15)] transition-transform duration-150 ease-out"
            style={{ transform: `translateY(${dragOffset}px)` }}
         >
            <div
               className="shrink-0 touch-none cursor-grab select-none pb-2 pt-3 active:cursor-grabbing"
               onPointerDown={handleDragStart}
               onPointerMove={handleDragMove}
               onPointerUp={handleDragEnd}
               onPointerCancel={handleDragEnd}
            >
               <div className="insight-bottom-sheet-handle mx-auto h-1 w-12 rounded-full bg-[#e5e7eb]" />
            </div>
            <div className="shrink-0 border-b border-[#f1edf8] px-6 pb-4 pt-2">
               <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                     <h3 className="text-[26px] font-bold leading-tight tracking-[-0.01em] text-[#1f2937]">Default History</h3>
                     <p className="mt-2 text-[15px] leading-5 text-[#6b7280]">Missed repayments on this borrower’s past loans.</p>
                  </div>
                  <button
                     type="button"
                     onClick={onClose}
                     className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#6b7280] active:scale-95"
                     aria-label="Close"
                  >
                     <X className="h-7 w-7" strokeWidth={2} />
                  </button>
               </div>
            </div>
            <div className="max-h-[calc(84dvh-112px)] overflow-y-auto px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-5">
               <div className="grid grid-cols-[auto_1fr] items-center gap-4">
                  <div className="rounded-[18px] bg-[#fee2e2] px-4 py-3 text-[20px] font-bold leading-none text-[#ef4444]">
                     {defaultedLoans.length} {defaultedLoans.length === 1 ? 'Default' : 'Defaults'}
                  </div>
                  <p className="text-[15px] leading-5 text-[#6b7280]">
                     A default happens when a repayment deadline passes without full repayment.
                  </p>
               </div>

               <div className="mt-5 space-y-3">
                  {defaultedLoans.map((loan) => (
                     <div
                        key={loan.id}
                        className="flex items-center gap-3 rounded-[18px] border border-[#f3f4f6] bg-white p-4 shadow-[0_4px_16px_rgba(239,68,68,0.08)]"
                     >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fee2e2]">
                           <AlertCircle className="h-6 w-6 text-[#ef4444]" strokeWidth={2.5} />
                        </span>
                        <div className="min-w-0 flex-1">
                           <p className="text-[16px] font-bold leading-tight text-[#1f2937]">Loan defaulted</p>
                           <p className="mt-1 text-[14px] leading-tight text-[#6b7280]">Borrowed: ${formatNumber(loan.loanAmount)}</p>
                           <p className="mt-1 text-[14px] leading-tight text-[#6b7280]">Due: {formatDate(loan.dueDate)}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#fee2e2] px-3 py-1 text-[12px] font-bold leading-none text-[#ef4444]">
                           Unresolved
                        </span>
                     </div>
                  ))}
               </div>

               <div className="mt-5 flex gap-3 rounded-[18px] border border-[#fecaca] bg-[#fef2f2] p-4">
                  <AlertCircle className="mt-1 h-5 w-5 shrink-0 text-[#ef4444]" strokeWidth={2.5} />
                  <div>
                     <p className="text-[16px] font-bold leading-tight text-[#1f2937]">Why it matters</p>
                     <p className="mt-2 text-[15px] leading-5 text-[#4b5563]">
                        Defaults may signal repayment risk. Lenders should review the borrower’s full history, not just credit level.
                     </p>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};

const RepaymentHistoryBottomSheet = ({
   isOpen,
   onClose,
   repaymentLoans,
   totalRepaid
}: {
   isOpen: boolean;
   onClose: () => void;
   repaymentLoans: Loan[];
   totalRepaid: number;
}) => {
   const dragStartY = useRef<number | null>(null);
   const dragOffsetRef = useRef(0);
   const [dragOffset, setDragOffset] = useState(0);

   if (!isOpen) return null;

   const paidLoans = repaymentLoans.filter((loan) => loan.repaymentStatus === 'Paid');
   const partialLoans = repaymentLoans.filter((loan) => loan.repaymentStatus !== 'Paid');
   const partialRepaymentLabel = partialLoans.length === 1 ? 'partial repayment' : 'partial repayments';

   const handleDragStart = (event: PointerEvent<HTMLDivElement>) => {
      dragStartY.current = event.clientY;
      dragOffsetRef.current = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const handleDragMove = (event: PointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return;
      const nextOffset = Math.max(0, event.clientY - dragStartY.current);
      dragOffsetRef.current = nextOffset;
      setDragOffset(nextOffset);
   };

   const handleDragEnd = (event: PointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (dragOffsetRef.current > 96) {
         onClose();
      }
      dragStartY.current = null;
      dragOffsetRef.current = 0;
      setDragOffset(0);
   };

   return (
      <div className="fixed inset-0 z-[80] flex items-end">
         <button
            type="button"
            aria-label="Close repayment history"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
         />
         <div
            className="insight-bottom-sheet relative mx-auto flex max-h-[84dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.15)] transition-transform duration-150 ease-out"
            style={{ transform: `translateY(${dragOffset}px)` }}
         >
            <div
               className="shrink-0 touch-none cursor-grab select-none pb-2 pt-3 active:cursor-grabbing"
               onPointerDown={handleDragStart}
               onPointerMove={handleDragMove}
               onPointerUp={handleDragEnd}
               onPointerCancel={handleDragEnd}
            >
               <div className="insight-bottom-sheet-handle mx-auto h-1 w-12 rounded-full bg-[#e5e7eb]" />
            </div>
            <div className="shrink-0 border-b border-[#f1edf8] px-6 pb-4 pt-2">
               <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                     <h3 className="text-[26px] font-bold leading-tight tracking-[-0.01em] text-[#1f2937]">Repayment History</h3>
                     <p className="mt-2 text-[15px] leading-5 text-[#6b7280]">
                        Money this borrower has already paid back across funded loans.
                     </p>
                  </div>
                  <button
                     type="button"
                     onClick={onClose}
                     className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#6b7280] active:scale-95"
                     aria-label="Close"
                  >
                     <X className="h-7 w-7" strokeWidth={2} />
                  </button>
               </div>
            </div>
            <div className="max-h-[calc(84dvh-112px)] overflow-y-auto px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-5">
               <div className="grid grid-cols-[auto_1fr] items-center gap-4">
                  <div className="rounded-[18px] bg-[#dcfce7] px-4 py-3 text-[20px] font-bold leading-none text-[#059669]">
                     ${formatNumber(totalRepaid)}
                  </div>
                  <p className="text-[15px] leading-5 text-[#6b7280]">
                     {paidLoans.length} fully repaid {paidLoans.length === 1 ? 'loan' : 'loans'}
                     {partialLoans.length > 0 ? ` and ${partialLoans.length} ${partialRepaymentLabel}` : ''}.
                  </p>
               </div>

               <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-[16px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3">
                     <p className="text-[24px] font-bold leading-none text-[#059669]">{paidLoans.length}</p>
                     <p className="mt-1 text-[12px] font-semibold leading-tight text-[#047857]">Fully repaid</p>
                  </div>
                  <div className="rounded-[16px] border border-[#fed7aa] bg-[#fff7ed] px-4 py-3">
                     <p className="text-[24px] font-bold leading-none text-[#ea580c]">{partialLoans.length}</p>
                     <p className="mt-1 text-[12px] font-semibold leading-tight text-[#c2410c]">
                        {partialLoans.length === 1 ? 'Partial repayment' : 'Partial repayments'}
                     </p>
                  </div>
               </div>

               <div className="mt-5 space-y-3">
                  {repaymentLoans.map((loan) => {
                     const isPaid = loan.repaymentStatus === 'Paid';
                     return (
                        <div
                           key={loan.id}
                           className="flex items-center gap-3 rounded-[18px] border border-[#f3f4f6] bg-white p-4 shadow-[0_4px_16px_rgba(16,185,129,0.08)]"
                        >
                           <span
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isPaid ? 'bg-[#dcfce7]' : 'bg-[#ffedd5]'}`}
                           >
                              {isPaid ? (
                                 <Check className="h-6 w-6 text-[#059669]" strokeWidth={2.5} />
                              ) : (
                                 <Clock3 className="h-6 w-6 text-[#ea580c]" strokeWidth={2.5} />
                              )}
                           </span>
                           <div className="min-w-0 flex-1">
                              <p className="text-[16px] font-bold leading-tight text-[#1f2937]">
                                 {isPaid ? 'Loan fully repaid' : 'Partial repayment made'}
                              </p>
                              <p className="mt-1 text-[14px] leading-tight text-[#6b7280]">Borrowed: ${formatNumber(loan.loanAmount)}</p>
                              <p className="mt-1 text-[14px] leading-tight text-[#6b7280]">
                                 Repaid: ${formatNumber(loan.repaidAmount)} of ${formatNumber(loan.totalRepaymentAmount)}
                              </p>
                           </div>
                           <span
                              className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-bold leading-none ${
                                 isPaid ? 'bg-[#dcfce7] text-[#059669]' : 'bg-[#ffedd5] text-[#ea580c]'
                              }`}
                           >
                              {isPaid ? 'Paid' : 'Partial'}
                           </span>
                        </div>
                     );
                  })}
               </div>

               <div className="mt-5 flex gap-3 rounded-[18px] border border-[#bbf7d0] bg-[#f0fdf4] p-4">
                  <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#059669]" strokeWidth={2.5} />
                  <div>
                     <p className="text-[16px] font-bold leading-tight text-[#1f2937]">Why it matters</p>
                     <p className="mt-2 text-[15px] leading-5 text-[#4b5563]">
                        Completed repayments show this borrower has returned funds before. Partial repayments can still be useful context,
                        but lenders should compare them with due dates and remaining balances.
                     </p>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};

const CreditLevelBottomSheet = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
   const dragStartY = useRef<number | null>(null);
   const dragOffsetRef = useRef(0);
   const [dragOffset, setDragOffset] = useState(0);

   if (!isOpen) return null;

   const creditLevels = [
      { level: 1, amount: 15, stars: '⭐', className: 'from-[#c4b5fd] to-[#b9a2fb] text-white' },
      { level: 2, amount: 20, stars: '⭐⭐', className: 'from-[#a78bfa] to-[#9977f2] text-white' },
      { level: 3, amount: 40, stars: '⭐⭐⭐', className: 'from-[#8b5cf6] to-[#7c4df1] text-white' },
      { level: 4, amount: 60, stars: '⭐⭐⭐⭐', className: 'from-[#7c3aed] to-[#6d28d9] text-white' }
   ];

   const handleDragStart = (event: PointerEvent<HTMLDivElement>) => {
      dragStartY.current = event.clientY;
      dragOffsetRef.current = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const handleDragMove = (event: PointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return;
      const nextOffset = Math.max(0, event.clientY - dragStartY.current);
      dragOffsetRef.current = nextOffset;
      setDragOffset(nextOffset);
   };

   const handleDragEnd = (event: PointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (dragOffsetRef.current > 96) {
         onClose();
      }
      dragStartY.current = null;
      dragOffsetRef.current = 0;
      setDragOffset(0);
   };

   return (
      <div className="fixed inset-0 z-[80] flex items-end">
         <button
            type="button"
            aria-label="Close credit level explanation"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
         />
         <div
            className="insight-bottom-sheet relative mx-auto max-h-[88dvh] w-full max-w-[440px] overflow-hidden rounded-t-[28px] bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.15)] transition-transform duration-150 ease-out"
            style={{ transform: `translateY(${dragOffset}px)` }}
         >
            <div
               className="touch-none cursor-grab select-none pb-2 pt-3 active:cursor-grabbing"
               onPointerDown={handleDragStart}
               onPointerMove={handleDragMove}
               onPointerUp={handleDragEnd}
               onPointerCancel={handleDragEnd}
            >
               <div className="insight-bottom-sheet-handle mx-auto h-1 w-12 rounded-full bg-[#b7add0]" />
            </div>
            <div className="border-b border-[#f1edf8] px-6 pb-5 pt-2">
               <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                     <span className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full bg-[#ede9fe] text-md-primary-900">
                        <Award className="h-8 w-8" strokeWidth={2.2} />
                     </span>
                     <h3 className="text-[26px] font-bold leading-tight tracking-[-0.01em] text-[#1f2937]">How Credit Level Works</h3>
                  </div>
                  <button
                     type="button"
                     onClick={onClose}
                     className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#6b7280] active:scale-95"
                     aria-label="Close"
                  >
                     <X className="h-7 w-7" strokeWidth={2} />
                  </button>
               </div>
            </div>
            <div className="max-h-[calc(88dvh-112px)] overflow-y-auto px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6">
               <div className="space-y-4 text-[20px] leading-[1.45] text-[#4b5563]">
                  <p>Credit Level shows the borrower’s current borrowing tier.</p>
                  <p>Borrowers level up by taking a Credit Building loan at their current limit and repaying it successfully.</p>
               </div>
               <p className="mt-7 text-[18px] font-bold uppercase tracking-[0.02em] text-[#6b7280]">Credit Levels</p>
               <div className="mt-4 space-y-3">
                  {creditLevels.map((level) => (
                     <div
                        key={level.level}
                        className="flex items-center justify-between gap-4 rounded-[18px] border-2 border-[#eadfff] bg-[#fbfaff] px-4 py-4 shadow-[0_8px_18px_rgba(48,24,92,0.04)]"
                     >
                        <div className="flex min-w-0 items-center gap-4">
                           <span
                              className={`flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br text-[28px] font-bold ${level.className}`}
                           >
                              {level.level}
                           </span>
                           <span className="min-w-0">
                              <span className="block text-[19px] font-bold leading-tight text-[#1f2937]">Level {level.level}</span>
                              <span className="mt-1 block text-[16px] font-medium leading-tight text-[#6b7280]">Credit limit</span>
                           </span>
                        </div>
                        <div className="shrink-0 text-right">
                           <p className="text-[24px] font-bold leading-tight text-md-primary-900">${level.amount}</p>
                           <p className="mt-1 text-[15px] leading-none">{level.stars}</p>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </div>
   );
};

const LenderDiversityBottomSheet = ({ isOpen, onClose, onOpenDocs }: { isOpen: boolean; onClose: () => void; onOpenDocs: () => void }) => {
   const dragStartY = useRef<number | null>(null);
   const dragOffsetRef = useRef(0);
   const [dragOffset, setDragOffset] = useState(0);

   if (!isOpen) return null;

   const handleDragStart = (event: PointerEvent<HTMLDivElement>) => {
      dragStartY.current = event.clientY;
      dragOffsetRef.current = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const handleDragMove = (event: PointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return;
      const nextOffset = Math.max(0, event.clientY - dragStartY.current);
      dragOffsetRef.current = nextOffset;
      setDragOffset(nextOffset);
   };

   const handleDragEnd = (event: PointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (dragOffsetRef.current > 96) {
         onClose();
      }
      dragStartY.current = null;
      dragOffsetRef.current = 0;
      setDragOffset(0);
   };

   return (
      <div className="fixed inset-0 z-[80] flex items-end">
         <button
            type="button"
            aria-label="Close lender diversity explanation"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
         />
         <div
            className="insight-bottom-sheet relative mx-auto flex max-h-[86dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.15)] transition-transform duration-150 ease-out"
            style={{ transform: `translateY(${dragOffset}px)` }}
         >
            <div
               className="shrink-0 touch-none cursor-grab select-none pb-2 pt-3 active:cursor-grabbing"
               onPointerDown={handleDragStart}
               onPointerMove={handleDragMove}
               onPointerUp={handleDragEnd}
               onPointerCancel={handleDragEnd}
            >
               <div className="insight-bottom-sheet-handle mx-auto h-1 w-12 rounded-full bg-[#e5e7eb]" />
            </div>
            <div className="shrink-0 border-b border-[#f1edf8] px-6 pb-4 pt-2">
               <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                     <h3 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-[#1f2937]">How Lender Diversity Works</h3>
                     <p className="mt-2 text-[15px] leading-6 text-[#4b5563]">
                        This score belongs to the borrower. It measures the quality of the people who have lent to them.
                     </p>
                  </div>
                  <button
                     type="button"
                     onClick={onClose}
                     className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-[#4b5563] active:scale-95"
                     aria-label="Close"
                  >
                     <X className="h-6 w-6" strokeWidth={2} />
                  </button>
               </div>
            </div>
            <div className="overflow-y-auto px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-5">
               <div className="rounded-[18px] border border-[#eadfff] bg-[#fbfaff] p-4">
                  <p className="text-[14px] font-bold uppercase tracking-[0.02em] text-[#8b5cf6]">What a high score means</p>
                  <p className="mt-2 text-[15px] leading-6 text-[#4b5563]">
                     Lenders look independent, established, and natural. They are not all new accounts, not all funding at once, and not
                     overly concentrated in one lender.
                  </p>
               </div>

               <div className="mt-4 rounded-[18px] border border-[#fee2e2] bg-[#fef2f2] p-4">
                  <p className="text-[14px] font-bold uppercase tracking-[0.02em] text-[#ef4444]">What it is trying to catch</p>
                  <p className="mt-2 text-[15px] leading-6 text-[#4b5563]">
                     A borrower could look trustworthy by using fake lender accounts to fund small loans, then ask for a larger real loan.
                     This score looks for that kind of coordinated lender history.
                  </p>
               </div>

               <div className="mt-5 space-y-3">
                  <LenderDiversitySignal
                     title="Amount concentration"
                     description="Checks whether one lender funded most of the borrower's history."
                  />
                  <LenderDiversitySignal
                     title="Lender newness"
                     description="New or inactive wallets count as riskier than established wallets with real on-chain activity."
                  />
                  <LenderDiversitySignal
                     title="Timing patterns"
                     description="Looks for loans arriving in suspicious clusters instead of normal lending intervals."
                  />
                  <LenderDiversitySignal
                     title="Recent activity"
                     description="Recent suspicious patterns matter more. Older clean history fades over time."
                  />
                  <LenderDiversitySignal
                     title="Group coordination"
                     description="Checks whether many lenders appeared around the same time, which can suggest a recruited group."
                  />
               </div>

               <div className="mt-5 rounded-[18px] border border-[#f1edf8] bg-white p-4 shadow-[0_8px_18px_rgba(48,24,92,0.04)]">
                  <p className="mb-3 text-[15px] font-bold leading-tight text-[#1f2937]">Score bands</p>
                  <div className="space-y-2">
                     <LenderDiversityBand label="Excellent" range="80–100" className="bg-[#dcfce7] text-[#047857]" />
                     <LenderDiversityBand label="Good" range="60–79" className="bg-[#dbeafe] text-[#2563eb]" />
                     <LenderDiversityBand label="Fair" range="40–59" className="bg-[#fef3c7] text-[#92400e]" />
                     <LenderDiversityBand label="Low" range="20–39" className="bg-[#ffedd5] text-[#ea580c]" />
                     <LenderDiversityBand label="Very Low" range="0–19" className="bg-[#fee2e2] text-[#ef4444]" />
                  </div>
               </div>

               <div className="mt-5 flex gap-3 rounded-[18px] border border-[#dbeafe] bg-[#eff6ff] p-4">
                  <Users className="mt-1 h-5 w-5 shrink-0 text-[#2563eb]" strokeWidth={2.5} />
                  <p className="text-[14px] leading-6 text-[#4b5563]">
                     This does not judge the borrower directly. It tells lenders whether the borrower's lender network looks organic or
                     suspicious.
                  </p>
               </div>

               <button
                  type="button"
                  onClick={onOpenDocs}
                  className="mt-5 flex w-full items-center justify-between gap-3 rounded-[18px] bg-[#8b5cf6] px-4 py-4 text-left text-white shadow-[0_14px_28px_rgba(139,92,246,0.22)] active:scale-[0.99]"
               >
                  <span className="flex min-w-0 items-center gap-3">
                     <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
                        <FileText className="h-5 w-5" strokeWidth={2.4} />
                     </span>
                     <span className="min-w-0">
                        <span className="block text-[15px] font-bold leading-tight">Read the full docs</span>
                        <span className="mt-1 block text-[12px] font-medium leading-tight text-white/75">
                           Lender Diversity Score documentation
                        </span>
                     </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0" strokeWidth={2.4} />
               </button>
            </div>
         </div>
      </div>
   );
};

const LenderDiversitySignal = ({ title, description }: { title: string; description: string }) => (
   <div className="rounded-[16px] border border-[#f1edf8] bg-white p-4 shadow-[0_8px_18px_rgba(48,24,92,0.04)]">
      <p className="text-[15px] font-bold leading-tight text-[#1f2937]">{title}</p>
      <p className="mt-2 text-[14px] leading-5 text-[#6b7280]">{description}</p>
   </div>
);

const LenderDiversityBand = ({ label, range, className }: { label: string; range: string; className: string }) => (
   <div className="flex items-center justify-between gap-3 rounded-[12px] bg-[#f9fafb] px-3 py-2">
      <span className="text-[13px] font-semibold text-[#4b5563]">{range}</span>
      <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold leading-none ${className}`}>{label}</span>
   </div>
);

const LoanMixBottomSheet = ({
   isOpen,
   onClose,
   label,
   trustBuildingCount,
   creditBuildingCount
}: {
   isOpen: boolean;
   onClose: () => void;
   label: string;
   trustBuildingCount: number;
   creditBuildingCount: number;
}) => {
   const dragStartY = useRef<number | null>(null);
   const dragOffsetRef = useRef(0);
   const [dragOffset, setDragOffset] = useState(0);

   if (!isOpen) return null;

   const handleDragStart = (event: PointerEvent<HTMLDivElement>) => {
      dragStartY.current = event.clientY;
      dragOffsetRef.current = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const handleDragMove = (event: PointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return;
      const nextOffset = Math.max(0, event.clientY - dragStartY.current);
      dragOffsetRef.current = nextOffset;
      setDragOffset(nextOffset);
   };

   const handleDragEnd = (event: PointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (dragOffsetRef.current > 96) {
         onClose();
      }
      dragStartY.current = null;
      dragOffsetRef.current = 0;
      setDragOffset(0);
   };

   return (
      <div className="fixed inset-0 z-[80] flex items-end">
         <button
            type="button"
            aria-label="Close loan mix explanation"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
         />
         <div
            className="insight-bottom-sheet relative mx-auto flex max-h-[84dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.15)] transition-transform duration-150 ease-out"
            style={{ transform: `translateY(${dragOffset}px)` }}
         >
            <div
               className="shrink-0 touch-none cursor-grab select-none pb-2 pt-3 active:cursor-grabbing"
               onPointerDown={handleDragStart}
               onPointerMove={handleDragMove}
               onPointerUp={handleDragEnd}
               onPointerCancel={handleDragEnd}
            >
               <div className="insight-bottom-sheet-handle mx-auto h-1 w-12 rounded-full bg-[#e5e7eb]" />
            </div>
            <div className="shrink-0 border-b border-[#f1edf8] px-6 pb-4 pt-2">
               <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                     <h3 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-[#1f2937]">{label}</h3>
                     <p className="mt-2 text-[15px] leading-6 text-[#4b5563]">
                        {trustBuildingCount + creditBuildingCount === 0
                           ? 'This borrower does not have enough loan history for a loan mix yet.'
                           : `This borrower has ${trustBuildingCount} smaller trust-building ${trustBuildingCount === 1 ? 'loan' : 'loans'} and ${creditBuildingCount} full-limit credit-building ${creditBuildingCount === 1 ? 'loan' : 'loans'}.`}
                     </p>
                  </div>
                  <button
                     type="button"
                     onClick={onClose}
                     className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-[#4b5563] active:scale-95"
                     aria-label="Close"
                  >
                     <X className="h-6 w-6" strokeWidth={2} />
                  </button>
               </div>
            </div>
            <div className="overflow-y-auto px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-5">
               <div className="grid grid-cols-2 gap-3">
                  <LoanMixStat label="Trust loans" value={trustBuildingCount} className="border-[#dbeafe] bg-[#eff6ff] text-[#2563eb]" />
                  <LoanMixStat label="Credit loans" value={creditBuildingCount} className="border-[#dcfce7] bg-[#f0fdf4] text-[#059669]" />
               </div>

               <div className="mt-5 rounded-[18px] bg-[#f9fafb] p-4">
                  <p className="mb-2 text-[14px] font-bold text-[#8b5cf6]">Why lenders care</p>
                  <p className="text-[14px] leading-6 text-[#6b7280]">
                     Loan mix shows whether this borrower is mostly building repayment history with smaller loans, or raising their credit
                     level with full-limit repayments.
                  </p>
               </div>

               <div className="mt-5 space-y-4">
                  <LoanMixType
                     icon={<ShieldCheck className="h-4 w-4 text-[#3b82f6]" strokeWidth={2.5} />}
                     iconClassName="bg-[#eff6ff]"
                     title="Trust Building"
                     label="Repayment-history signal"
                     description="Smaller loans below the current limit. They help show the borrower can repay, but they do not raise credit level."
                     example="Example: $8 or $10 when the borrower can already request $20."
                  />
                  <LoanMixType
                     icon={<TrendingUp className="h-4 w-4 text-[#10b981]" strokeWidth={2.5} />}
                     iconClassName="bg-[#f0fdf4]"
                     title="Credit Building"
                     label="Credit-level signal"
                     description="A full-limit loan. If it is repaid successfully, it can unlock the borrower’s next credit level."
                     example="Example: borrowing the full $20 limit to unlock the $40 level."
                  />
               </div>

               <div className="mt-5 flex items-center gap-3 rounded-[18px] border border-[#eadfff] bg-[#fbfaff] p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ede9fe]">
                     <Sparkles className="h-5 w-5 text-[#8b5cf6]" strokeWidth={2.2} />
                  </span>
                  <p className="text-[13px] leading-5 text-[#6b7280]">
                     A healthy borrower can have both: smaller loans for repayment history and full-limit loans for higher future limits.
                  </p>
               </div>
            </div>
         </div>
      </div>
   );
};

const LoanMixStat = ({ label, value, className }: { label: string; value: number; className: string }) => (
   <div className={`rounded-[16px] border px-4 py-3 ${className}`}>
      <p className="text-[26px] font-bold leading-none">{value}</p>
      <p className="mt-1 text-[12px] font-semibold leading-tight">{label}</p>
   </div>
);

const LoanMixType = ({
   icon,
   iconClassName,
   title,
   label,
   description,
   example
}: {
   icon: ReactNode;
   iconClassName: string;
   title: string;
   label: string;
   description: string;
   example: string;
}) => (
   <div className="rounded-[18px] border border-[#f1edf8] bg-white p-4 shadow-[0_8px_18px_rgba(48,24,92,0.04)]">
      <div className="flex gap-3">
         <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>{icon}</span>
         <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-tight text-[#1f2937]">{title}</p>
            <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.02em] text-[#8b5cf6]">{label}</p>
            <p className="mt-2 text-[14px] leading-5 text-[#6b7280]">{description}</p>
            <p className="mt-3 rounded-[12px] bg-[#f9fafb] px-3 py-2 text-[12px] leading-4 text-[#6b7280]">{example}</p>
         </div>
      </div>
   </div>
);

/** Whose name the row shows: the borrower reads their lenders, the lender reads their borrowers. */
type LoanCounterparty = 'lender' | 'borrower';

const getRecentLoanDisplay = (loan: Loan, resolveUsername: (id?: string | null) => string, counterparty: LoanCounterparty) => {
   const isPaid = loan.repaymentStatus === 'Paid';
   const isDefaulted = !isPaid && parseDateSafely(loan.dueDate).getTime() < Date.now();
   const counterpartyName = resolveUsername(counterparty === 'lender' ? loan.lenderUser : loan.borrowerUser) || 'Unknown';
   const fundedDate = formatDate(loan.fundedAt ?? loan.createdAt);
   const statusClassName = isPaid
      ? 'border-[#c4b5fd] bg-[#f5f3ff] text-md-primary-900'
      : isDefaulted
        ? 'border-[#fecaca] bg-[#fef2f2] text-md-red-500'
        : 'border-[#bbf7d0] bg-[#f0fdf4] text-md-green-700';
   const statusLabel = isPaid ? 'Repaid' : isDefaulted ? 'Default' : 'Active';

   return {
      fundedDate,
      isPaid,
      counterpartyName,
      statusClassName,
      statusLabel
   };
};

const RecentLoanItem = ({
   loan,
   resolveUsername,
   counterparty = 'lender'
}: {
   loan: Loan;
   resolveUsername: (id?: string | null) => string;
   counterparty?: LoanCounterparty;
}) => {
   const { counterpartyName, fundedDate, isPaid, statusClassName, statusLabel } = getRecentLoanDisplay(loan, resolveUsername, counterparty);

   return (
      <tr className="align-top transition-colors hover:bg-[#fbfafc]">
         <td className="min-w-0 px-4 py-3">
            <div className="flex min-w-0 items-start gap-3">
               <img src={PLACEHOLDER_AVATAR} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-[#f1edf8]" />
               <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold leading-tight text-md-primary-2000">{loan.reason || 'Loan request'}</p>
                  <p className="mt-1 truncate text-[12px] font-medium leading-tight text-[#766985]">{counterpartyName}</p>
                  <p className="mt-1 text-[11px] font-medium leading-none text-[#a199ad]">{fundedDate}</p>
               </div>
            </div>
         </td>
         <td className="px-2 py-3 text-right">
            <p className="font-mono text-[15px] font-bold tabular-nums leading-tight text-md-primary-2000">
               ${formatNumber(loan.loanAmount)}
            </p>
            <p className="mt-1 font-mono text-[11px] font-semibold tabular-nums leading-none text-[#9ca3af]">
               / ${formatNumber(loan.totalRepaymentAmount)}
            </p>
         </td>
         <td className="px-4 py-3 text-right">
            <span
               className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[10px] font-bold leading-none ${statusClassName}`}
            >
               {isPaid ? (
                  <Check className="mr-1 h-2.5 w-2.5" strokeWidth={3} />
               ) : (
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />
               )}
               {statusLabel}
            </span>
         </td>
      </tr>
   );
};

const RecentLoanMobileItem = ({
   loan,
   resolveUsername,
   counterparty = 'lender'
}: {
   loan: Loan;
   resolveUsername: (id?: string | null) => string;
   counterparty?: LoanCounterparty;
}) => {
   const { counterpartyName, fundedDate, isPaid, statusClassName, statusLabel } = getRecentLoanDisplay(loan, resolveUsername, counterparty);

   return (
      <div className="px-3 py-3">
         <div className="flex min-w-0 items-start gap-3">
            <img src={PLACEHOLDER_AVATAR} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-[#f1edf8]" />
            <div className="min-w-0 flex-1">
               <div className="flex min-w-0 items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-[14px] font-bold leading-[1.2] text-md-primary-2000">{loan.reason || 'Loan request'}</p>
                  <span
                     className={`inline-flex shrink-0 items-center justify-center rounded-full border px-2.5 py-1 text-[10px] font-bold leading-none ${statusClassName}`}
                  >
                     {isPaid ? (
                        <Check className="mr-1 h-2.5 w-2.5" strokeWidth={3} />
                     ) : (
                        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />
                     )}
                     {statusLabel}
                  </span>
               </div>
               <p className="mt-1 text-[12px] font-semibold leading-tight text-[#766985]">{counterpartyName}</p>
               <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="text-[11px] font-semibold leading-none text-[#a199ad]">{fundedDate}</p>
                  <div className="text-right">
                     <p className="font-mono text-[16px] font-bold tabular-nums leading-none text-md-primary-2000">
                        ${formatNumber(loan.loanAmount)}
                     </p>
                     <p className="mt-1 font-mono text-[11px] font-semibold tabular-nums leading-none text-[#9ca3af]">
                        repays ${formatNumber(loan.totalRepaymentAmount)}
                     </p>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};

export default UserProfile;
