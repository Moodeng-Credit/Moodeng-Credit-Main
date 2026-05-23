import { toNumber } from '@/utils/decimalHelpers';

import type { User } from '@/types/authTypes';
import { type Loan, LoanStatus as LoanStatusValue, RepaymentStatus } from '@/types/loanTypes';

export type TransactionHistoryTab = 'all' | 'active' | 'completed';
export type TransactionHistorySortBy = 'low-to-high' | 'high-to-low' | 'new-to-old' | 'old-to-new' | '';
export type TransactionHistoryStatusFilter = 'pending' | 'active' | 'repaid' | 'default' | '';

export interface TransactionHistoryFilterState {
   sortBy: TransactionHistorySortBy;
   status: TransactionHistoryStatusFilter;
}

export type TransactionLoanStatus = 'REPAID' | 'ACTIVE' | 'DEFAULT' | 'PENDING' | 'PARTIAL';

export const DEFAULT_TRANSACTION_HISTORY_FILTERS: TransactionHistoryFilterState = { sortBy: '', status: '' };

export function getTransactionLoanStatus(loan: Loan, now = new Date()): TransactionLoanStatus {
   if (loan.repaymentStatus === RepaymentStatus.PAID) return 'REPAID';
   if (loan.loanStatus === LoanStatusValue.REQUESTED) return 'PENDING';

   const dueTime = new Date(loan.dueDate).getTime();
   const isPastDue = Number.isFinite(dueTime) && dueTime < now.getTime();
   if (loan.loanStatus === LoanStatusValue.LENT && isPastDue) return 'DEFAULT';

   if (loan.repaymentStatus === RepaymentStatus.PARTIAL) return 'PARTIAL';
   return 'ACTIVE';
}

export function getTransactionTime(loan: Loan): number {
   const timestamp = new Date(loan.fundedAt ?? loan.updatedAt ?? loan.createdAt).getTime();
   return Number.isFinite(timestamp) ? timestamp : 0;
}

function matchesStatusFilter(status: TransactionLoanStatus, statusFilter: TransactionHistoryStatusFilter): boolean {
   if (!statusFilter) return true;
   if (statusFilter === 'active') return status === 'ACTIVE' || status === 'PARTIAL';
   if (statusFilter === 'pending') return status === 'PENDING';
   if (statusFilter === 'repaid') return status === 'REPAID';
   if (statusFilter === 'default') return status === 'DEFAULT';
   return true;
}

function sortTransactions(loans: Loan[], sortBy: TransactionHistorySortBy): Loan[] {
   const sorted = [...loans];
   const newestFirst = (a: Loan, b: Loan) => getTransactionTime(b) - getTransactionTime(a);

   switch (sortBy || 'new-to-old') {
      case 'low-to-high':
         return sorted.sort((a, b) => toNumber(a.loanAmount) - toNumber(b.loanAmount) || newestFirst(a, b));
      case 'high-to-low':
         return sorted.sort((a, b) => toNumber(b.loanAmount) - toNumber(a.loanAmount) || newestFirst(a, b));
      case 'old-to-new':
         return sorted.sort((a, b) => getTransactionTime(a) - getTransactionTime(b));
      case 'new-to-old':
      default:
         return sorted.sort(newestFirst);
   }
}

export function filterTransactionHistoryLoans({
   loans,
   activeTab,
   searchQuery,
   filters,
   isBorrower,
   userProfiles,
   now = new Date()
}: {
   loans: Loan[];
   activeTab: TransactionHistoryTab;
   searchQuery: string;
   filters: TransactionHistoryFilterState;
   isBorrower: boolean;
   userProfiles: Record<string, User>;
   now?: Date;
}): Loan[] {
   const counterpartyField = isBorrower ? 'lenderUser' : 'borrowerUser';
   const normalizedSearch = searchQuery.trim().toLowerCase();

   let result = loans.filter((loan) => {
      const status = getTransactionLoanStatus(loan, now);
      if (activeTab === 'active' && status === 'REPAID') return false;
      if (activeTab === 'completed' && status !== 'REPAID') return false;
      if (!matchesStatusFilter(status, filters.status)) return false;

      if (!normalizedSearch) return true;

      const counterpartyId = loan[counterpartyField] ?? '';
      const counterparty = userProfiles[counterpartyId];
      const counterpartyName = `${counterparty?.username ?? ''} ${counterparty?.displayName ?? ''}`.toLowerCase();

      return loan.reason?.toLowerCase().includes(normalizedSearch) || counterpartyName.includes(normalizedSearch);
   });

   result = sortTransactions(result, filters.sortBy);
   return result;
}
