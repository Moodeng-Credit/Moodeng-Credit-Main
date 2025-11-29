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
      highest: (a: Loan, b: Loan) => b.loanAmount - a.loanAmount,
      lowest: (a: Loan, b: Loan) => a.loanAmount - b.loanAmount,
      newest: (a: Loan, b: Loan) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      oldest: (a: Loan, b: Loan) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
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
      return loans.filter((loan) => loan.loanAmount <= Number(customAmount));
   }
   if (!amount || Number(amount) === 0) return loans;
   return loans.filter((loan) => loan.loanAmount === Number(amount));
};

/**
 * Filter loans by repayment rate
 */
export const filterByRate = (loans: Loan[], rate: string): Loan[] => {
   if (!rate) return loans;

   return loans.filter((loan) => {
      const repayRate = ((loan.repayedAmount - loan.loanAmount) / loan.loanAmount) * 100;

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
      const createdDate = new Date(loan.createdAt);
      const dueDate = new Date(createdDate);
      dueDate.setDate(createdDate.getDate() + loan.days);
      return dueDate <= date;
   });
};

/**
 * Filter loans by time period (days remaining)
 */
export const filterByTimePeriod = (loans: Loan[], loanTime: string): Loan[] => {
   if (!loanTime) return loans;

   const today = new Date();
   today.setHours(0, 0, 0, 0);

   return loans.filter((loan) => {
      const created = new Date(loan.createdAt);
      created.setHours(0, 0, 0, 0);
      const dueDate = new Date(created);
      dueDate.setDate(created.getDate() + loan.days);

      const daysRemaining = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

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
