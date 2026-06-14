import { parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

import { STARTING_CREDIT_LIMIT } from '@/config/creditTiers';
import { getEffectiveCreditLimit } from '@/lib/creditLeveling';
import { isUserVerified } from '@/lib/isUserVerified';
import { type User } from '@/types/authTypes';
import { type Loan, LoanStatus, RepaymentStatus } from '@/types/loanTypes';

export type SortOption = 'highest' | 'lowest' | 'newest' | 'oldest';

export interface LoanFilters {
   amount?: string;
   rate?: string;
   date?: Date | null;
   loanTime?: string;
   borrowType?: string[];
   network?: string[];
   search?: string;
   sortBy?: SortOption;
}

/**
 * Sort loans based on the selected option
 */
export const sortLoans = (loans: Loan[], sortBy: SortOption): Loan[] => {
   const sorted = [...loans];

   const sortFunctions = {
      highest: (a: Loan, b: Loan) => toNumber(b.loanAmount) - toNumber(a.loanAmount),
      lowest: (a: Loan, b: Loan) => toNumber(a.loanAmount) - toNumber(b.loanAmount),
      newest: (a: Loan, b: Loan) => parseDateSafely(b.createdAt).getTime() - parseDateSafely(a.createdAt).getTime(),
      oldest: (a: Loan, b: Loan) => parseDateSafely(a.createdAt).getTime() - parseDateSafely(b.createdAt).getTime()
   };

   const sortFn = sortFunctions[sortBy];
   return sortFn ? sorted.sort(sortFn) : sorted;
};

/**
 * Filter loans by borrower credit limit.
 * Falls back to the request amount while borrower profiles are still loading.
 */
const isAmountInRange = (amount: number, range: string, customAmount?: string): boolean => {
   if (customAmount && Number(customAmount) > 0) {
      return amount <= Number(customAmount);
   }
   if (!range || Number(range) === 0) return true;

   if (range.includes('-')) {
      const [min, max] = range.split('-').map(Number);
      return amount >= min && amount <= max;
   }

   if (range.endsWith('+')) {
      const min = Number(range.replace('+', ''));
      return amount >= min;
   }

   return amount === Number(range);
};

export const filterByCreditLimit = (loans: Loan[], amount: string, customAmount?: string, userProfiles?: Record<string, User>): Loan[] => {
   if ((!amount || Number(amount) === 0) && (!customAmount || Number(customAmount) <= 0)) return loans;

   return loans.filter((loan) => {
      const borrowerProfile = loan.borrowerUser ? userProfiles?.[loan.borrowerUser] : undefined;
      const creditLimit = borrowerProfile
         ? getEffectiveCreditLimit(borrowerProfile.cs, isUserVerified(borrowerProfile))
         : toNumber(loan.loanAmount);

      return isAmountInRange(creditLimit, amount, customAmount);
   });
};

/**
 * Filter loans by repayment rate
 */
export const filterByRate = (loans: Loan[], rate: string): Loan[] => {
   if (!rate) return loans;

   return loans.filter((loan) => {
      const loanAmount = toNumber(loan.loanAmount);
      const repaymentAmount = toNumber(loan.totalRepaymentAmount);
      if (loanAmount <= 0 || repaymentAmount <= 0) return false;

      const repayRate = ((repaymentAmount - loanAmount) / loanAmount) * 100;

      if (rate === '2.5') return repayRate >= 0 && repayRate <= 5;
      if (rate === '7.5') return repayRate > 5 && repayRate <= 10;
      if (rate === '15') return repayRate > 10 && repayRate <= 20;
      if (rate === '+') return repayRate >= 20;

      return true;
   });
};

/**
 * Filter loans by repayment due date
 */
export const filterByDate = (loans: Loan[], date: Date | null): Loan[] => {
   if (!date) return loans;

   return loans.filter((loan) => {
      const dueUTC = parseDateSafely(loan.dueDate);

      // Get due date at midnight UTC
      const dueYear = dueUTC.getUTCFullYear();
      const dueMonth = dueUTC.getUTCMonth();
      const dueDay = dueUTC.getUTCDate();
      const dueAtMidnight = new Date(Date.UTC(dueYear, dueMonth, dueDay, 0, 0, 0, 0));

      // Normalize filter date to midnight
      const filterDate = new Date(date);
      filterDate.setHours(0, 0, 0, 0);

      return dueAtMidnight <= filterDate;
   });
};

/**
 * Filter loans by time period (days remaining)
 */
export const filterByTimePeriod = (loans: Loan[], loanTime: string): Loan[] => {
   if (!loanTime) return loans;

   // Get today's date in UTC at midnight
   const todayUTC = new Date();
   const year = todayUTC.getUTCFullYear();
   const month = todayUTC.getUTCMonth();
   const day = todayUTC.getUTCDate();
   const today = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

   return loans.filter((loan) => {
      const dueUTC = parseDateSafely(loan.dueDate);

      // Get due date at midnight UTC
      const dueYear = dueUTC.getUTCFullYear();
      const dueMonth = dueUTC.getUTCMonth();
      const dueDay = dueUTC.getUTCDate();
      const dueAtMidnight = new Date(Date.UTC(dueYear, dueMonth, dueDay, 0, 0, 0, 0));

      const daysRemaining = Math.round((dueAtMidnight.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (loanTime === '7') return daysRemaining > 0 && daysRemaining <= 7;
      if (loanTime === '30') return daysRemaining > 0 && daysRemaining <= 30;
      if (loanTime === '60') return daysRemaining > 0 && daysRemaining <= 60;
      if (loanTime === '90') return daysRemaining > 0 && daysRemaining <= 90;
      if (loanTime === '120') return daysRemaining > 90;

      return true;
   });
};

/**
 * Filter loans by search query (searches reason, borrower display name, and borrower username)
 */
const getSearchableProfileText = (value: unknown): string => (typeof value === 'string' ? value : '');

export const filterBySearch = (loans: Loan[], search: string, userProfiles?: Record<string, User>): Loan[] => {
   if (!search) return loans;

   const searchLower = search.toLowerCase();
   return loans.filter((loan) => {
      const borrowerProfile = loan.borrowerUser ? userProfiles?.[loan.borrowerUser] : undefined;
      const borrowerUsername = getSearchableProfileText(borrowerProfile?.username) || getSearchableProfileText(loan.borrowerUser);
      const borrowerDisplayName = getSearchableProfileText(borrowerProfile?.displayName);
      return (
         loan.reason?.toLowerCase().includes(searchLower) ||
         borrowerDisplayName.toLowerCase().includes(searchLower) ||
         borrowerUsername.toLowerCase().includes(searchLower)
      );
   });
};

export const filterByBorrowType = (
   requestedLoans: Loan[],
   borrowTypes: string[] | undefined,
   allLoans: Loan[],
   userProfiles?: Record<string, User>
): Loan[] => {
   if (!borrowTypes || borrowTypes.length === 0) return requestedLoans;

   const activeFundedLoans = allLoans.filter(
      (loan) => loan.loanStatus === LoanStatus.LENT && loan.repaymentStatus !== RepaymentStatus.PAID
   );
   const borrowersWithActiveFundedLoans = new Set(activeFundedLoans.map((loan) => loan.borrowerUser).filter(Boolean));
   const borrowersWithCompletedFundedLoans = new Set(
      allLoans
         .filter((loan) => loan.loanStatus === LoanStatus.LENT && loan.repaymentStatus === RepaymentStatus.PAID)
         .map((loan) => loan.borrowerUser)
         .filter(Boolean)
   );

   return requestedLoans.filter((loan) => {
      const borrowerProfile = loan.borrowerUser ? userProfiles?.[loan.borrowerUser] : undefined;
      const creditLimit = borrowerProfile
         ? getEffectiveCreditLimit(borrowerProfile.cs, isUserVerified(borrowerProfile))
         : toNumber(loan.loanAmount);

      return borrowTypes.some((borrowType) => {
         if (borrowType === 'beginner') {
            return (
               creditLimit <= STARTING_CREDIT_LIMIT && (!loan.borrowerUser || !borrowersWithCompletedFundedLoans.has(loan.borrowerUser))
            );
         }
         if (borrowType === 'no-active') {
            return !loan.borrowerUser || !borrowersWithActiveFundedLoans.has(loan.borrowerUser);
         }

         return true;
      });
   });
};

/**
 * Apply all filters to a list of loans
 */
export const filterLoans = (loans: Loan[], filters: LoanFilters, customAmount?: string, userProfiles?: Record<string, User>): Loan[] => {
   const allLoans = [...loans];
   let filtered = [...loans];

   // Filter out loans that are already lent
   filtered = filtered.filter((loan) => loan.loanStatus === LoanStatus.REQUESTED);

   if (filters.amount || customAmount) {
      filtered = filterByCreditLimit(filtered, filters.amount || '', customAmount, userProfiles);
   }

   if (filters.rate) {
      filtered = filterByRate(filtered, filters.rate);
   }

   if (filters.date) {
      filtered = filterByDate(filtered, filters.date);
   }

   if (filters.loanTime) {
      filtered = filterByTimePeriod(filtered, filters.loanTime);
   }

   if (filters.search) {
      filtered = filterBySearch(filtered, filters.search, userProfiles);
   }

   if (filters.borrowType?.length) {
      filtered = filterByBorrowType(filtered, filters.borrowType, allLoans, userProfiles);
   }

   if (filters.sortBy) {
      filtered = sortLoans(filtered, filters.sortBy);
   }

   return filtered;
};
