import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import DataTable from '@/components/tables/DataTable';

import { usePagination } from '@/hooks/usePagination';

import type { Loan } from '@/types/loanTypes';
import type { RootState } from '@/store/store';
import LoadMoreButton from '@/views/profile/components/shared/LoadMoreButton';
import { getTransactionColumns } from '@/views/profile/config/transactionColumns';
import { UserRole } from '@/views/profile/types';

interface TransactionHistoryTabProps {
   loans: Loan[];
   currentUserId: string;
   userRole: UserRole;
}

export default function TransactionHistoryTab({ loans, currentUserId, userRole }: TransactionHistoryTabProps) {
   const isLender = userRole === UserRole.LENDER;
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);

   const filteredLoans = loans.filter((loan) => (isLender ? loan.lenderUser === currentUserId : loan.borrowerUser === currentUserId));

   const {
      displayedItems: displayedLoans,
      displayedCount,
      totalCount,
      handleLoadMore
   } = usePagination({
      items: filteredLoans,
      resetDependencies: [userRole]
   });

   const columns = useMemo(() => getTransactionColumns(isLender, userProfiles), [isLender, userProfiles]);

   return (
      <>
         <DataTable columns={columns} data={displayedLoans} keyExtractor={(loan) => loan.id} emptyMessage="No transactions found" />
         <LoadMoreButton currentCount={displayedCount} totalCount={totalCount} onLoadMore={handleLoadMore} />
      </>
   );
}
