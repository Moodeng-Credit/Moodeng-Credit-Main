import { usePagination } from '@/hooks/usePagination';

import type { Loan } from '@/types/loanTypes';
import Card from '@/views/profile/components/Card';
import LoadMoreButton from '@/views/profile/components/shared/LoadMoreButton';
import { UserRole } from '@/views/profile/types';

interface LoanSummaryTabProps {
   loans: Loan[];
   currentUserId: string;
   userRole: UserRole;
}

export default function LoanSummaryTab({ loans, currentUserId, userRole }: LoanSummaryTabProps) {
   const isLender = userRole === UserRole.LENDER;

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

   return (
      <>
         <div className="flex flex-wrap justify-center gap-8 overflow-hidden">
            {displayedLoans.map((loan) => (
               <Card key={loan.id} type={isLender} loan={loan} />
            ))}
         </div>
         <LoadMoreButton currentCount={displayedCount} totalCount={totalCount} onLoadMore={handleLoadMore} />
      </>
   );
}
