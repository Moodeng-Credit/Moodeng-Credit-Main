import { useMemo } from 'react';

import DataTable from '@/components/tables/DataTable';

import { usePagination } from '@/hooks/usePagination';

import type { Loan } from '@/types/loanTypes';
import LoadMoreButton from '@/views/profile/components/shared/LoadMoreButton';
import { getTransactionColumns } from '@/views/profile/config/transactionColumns';
import { UserRole } from '@/views/profile/types';

interface TransactionHistoryTabProps {
   loans: Loan[];
   currentUsername: string;
   userRole: UserRole;
}

export default function TransactionHistoryTab({ loans, currentUsername, userRole }: TransactionHistoryTabProps) {
   const isLender = userRole === UserRole.LENDER;

   const filteredLoans = loans.filter((loan) => (isLender ? loan.lenderUser === currentUsername : loan.borrowerUser === currentUsername));

   const {
      displayedItems: displayedLoans,
      displayedCount,
      totalCount,
      handleLoadMore
   } = usePagination({
      items: filteredLoans,
      resetDependencies: [userRole]
   });

   const columns = useMemo(() => getTransactionColumns(isLender), [isLender]);

   return (
      <>
         <DataTable columns={columns} data={displayedLoans} keyExtractor={(loan) => loan.id} emptyMessage="No transactions found" />
         <LoadMoreButton currentCount={displayedCount} totalCount={totalCount} onLoadMore={handleLoadMore} />
      </>
   );
}
