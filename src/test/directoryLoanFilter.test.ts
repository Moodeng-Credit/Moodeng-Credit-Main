import { describe, expect, it } from 'vitest';

import { directoryName, matchesLoanFilter } from '@/app/admin/directoryLoanFilter';

const base = {
   activeLoanCount: 0,
   overdueLoanCount: 0,
   openRequestCount: 0,
   paidLoanCount: 0,
   borrowedLoanCount: 0,
   loan_access_status: 'none' as const
};

describe('directory Loans filter', () => {
   it('sorts people into the right buckets', () => {
      const active = { ...base, activeLoanCount: 1, borrowedLoanCount: 1 };
      const repaid = { ...base, paidLoanCount: 2, borrowedLoanCount: 2 };
      const approvedNew = { ...base, loan_access_status: 'approved' as const };
      const rejected = { ...base, loan_access_status: 'rejected' as const };

      expect(matchesLoanFilter(active, 'active')).toBe(true);
      expect(matchesLoanFilter(active, 'repaid')).toBe(false);
      expect(matchesLoanFilter(active, 'never_borrowed')).toBe(false);
      expect(matchesLoanFilter(repaid, 'repaid')).toBe(true);
      expect(matchesLoanFilter(approvedNew, 'approved_no_loan')).toBe(true);
      expect(matchesLoanFilter(approvedNew, 'never_borrowed')).toBe(true);
      expect(matchesLoanFilter(rejected, 'rejected')).toBe(true);
      expect(matchesLoanFilter({ ...base, overdueLoanCount: 1 }, 'overdue')).toBe(true);
      expect(matchesLoanFilter({ ...base, openRequestCount: 1 }, 'requested')).toBe(true);
      expect(matchesLoanFilter({ ...base, loan_access_status: 'pending' }, 'waiting_call')).toBe(true);
      expect(matchesLoanFilter(rejected, 'all')).toBe(true);
   });

   it('shows the real name instead of a placeholder username', () => {
      expect(directoryName({ username: 'user-5038e6', display_name: 'Ana Cruz', facebook_name: null })).toBe('Ana Cruz');
      expect(directoryName({ username: 'user-5038e6', display_name: 'user-5038e6', facebook_name: 'Ana C' })).toBe('Ana C');
      expect(directoryName({ username: 'anacruz', display_name: null, facebook_name: null })).toBe('anacruz');
   });
});
