import { parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

import type { Loan } from '@/types/loanTypes';

export type SortOption = 'highest' | 'lowest' | 'newest' | 'oldest';

export interface LoanFilters {
   amount?: string;
   rate?: string;
   date?: Date | null;
   loanTime?: string;
   network?: string;
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
 * Filter loans by amount
 * Supports both exact amounts and custom maximum amounts
 */
export const filterByAmount = (loans: Loan[], amount: string, customAmount?: string): Loan[] => {
   if (customAmount && Number(customAmount) > 0) {
      return loans.filter((loan) => toNumber(loan.loanAmount) <= Number(customAmount));
   }
   if (!amount || Number(amount) === 0) return loans;
   return loans.filter((loan) => toNumber(loan.loanAmount) === Number(amount));
};

/**
 * Filter loans by repayment rate
 */
export const filterByRate = (loans: Loan[], rate: string): Loan[] => {
   if (!rate) return loans;

   return loans.filter((loan) => {
      const repaidAmount = toNumber(loan.repaidAmount);
      const loanAmount = toNumber(loan.loanAmount);
      const repayRate = ((repaidAmount - loanAmount) / loanAmount) * 100;

      if (rate === '2.5') return repayRate >= 0 && repayRate <= 5;
      if (rate === '7.5') return repayRate > 5 && repayRate <= 10;
      if (rate === '12.5') return repayRate > 10 && repayRate <= 15;
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
      if (loanTime === '90') return daysRemaining > 0 && daysRemaining <= 90;
      if (loanTime === '120') return daysRemaining > 120;

      return true;
   });
};

/**
 * Filter loans by search query (searches reason and borrower username)
 */
export const filterBySearch = (loans: Loan[], search: string): Loan[] => {
   if (!search) return loans;

   const searchLower = search.toLowerCase();
   return loans.filter(
      (loan) => loan.reason?.toLowerCase().includes(searchLower) || loan.borrowerUser?.toLowerCase().includes(searchLower)
   );
};

/**
 * Apply all filters to a list of loans
 */
export const filterLoans = (loans: Loan[], filters: LoanFilters, customAmount?: string): Loan[] => {
   let filtered = [...loans];

   // Filter out loans that are already lent
   filtered = filtered.filter((loan) => loan.loanStatus === 'Requested');

   if (filters.amount || customAmount) {
      filtered = filterByAmount(filtered, filters.amount || '', customAmount);
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
      filtered = filterBySearch(filtered, filters.search);
   }

   if (filters.sortBy) {
      filtered = sortLoans(filtered, filters.sortBy);
   }

   return filtered;
};
