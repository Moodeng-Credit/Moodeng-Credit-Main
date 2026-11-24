// Admin → Directory "Loans" filter (George 2026-11-25: "filter active loans, no loans, rejected, etc.").
// Built only from what the directory already loads per person (loan counts + loan_access_status).
import type { AdminDirectoryUser } from '@/app/admin/adminSupabase';

export type LoanFilter =
   'all' | 'active' | 'overdue' | 'requested' | 'repaid' | 'never_borrowed' | 'approved_no_loan' | 'waiting_call' | 'rejected';

type LoanFilterUser = Pick<
   AdminDirectoryUser,
   'activeLoanCount' | 'overdueLoanCount' | 'openRequestCount' | 'paidLoanCount' | 'borrowedLoanCount' | 'loan_access_status'
>;

export const LOAN_FILTERS: Array<{ value: LoanFilter; label: string }> = [
   { value: 'all', label: 'All' },
   { value: 'active', label: 'Active loan' },
   { value: 'overdue', label: 'Overdue' },
   { value: 'requested', label: 'Asked for a loan' },
   { value: 'repaid', label: 'Repaid, no loan now' },
   { value: 'never_borrowed', label: 'No loans yet' },
   { value: 'approved_no_loan', label: 'Approved, no loan yet' },
   { value: 'waiting_call', label: 'Waiting for call' },
   { value: 'rejected', label: 'Rejected' }
];

export function matchesLoanFilter(user: LoanFilterUser, filter: LoanFilter): boolean {
   switch (filter) {
      case 'all':
         return true;
      case 'active':
         return user.activeLoanCount > 0;
      case 'overdue':
         return user.overdueLoanCount > 0;
      case 'requested':
         return user.openRequestCount > 0;
      case 'repaid':
         return user.paidLoanCount > 0 && user.activeLoanCount === 0;
      case 'never_borrowed':
         return user.borrowedLoanCount === 0;
      case 'approved_no_loan':
         return user.loan_access_status === 'approved' && user.borrowedLoanCount === 0;
      case 'waiting_call':
         return user.loan_access_status === 'pending';
      case 'rejected':
         return user.loan_access_status === 'rejected';
   }
}

/** Facebook sign-ups have a placeholder username (user-xxxxxx): show their real name instead. */
export function directoryName(user: Pick<AdminDirectoryUser, 'username' | 'display_name' | 'facebook_name'>): string {
   const real = [user.display_name, user.facebook_name].map((n) => n?.trim()).find((n) => n && !/^user-[0-9a-f]+$/i.test(n));
   return real || user.username;
}
