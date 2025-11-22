import type { Loan } from '@/types/loanTypes';
import Card from '@/views/profile/components/Card';
import { UserRole } from '@/views/profile/types';

interface LoanSummaryTabProps {
   loans: Loan[];
   currentUsername: string;
   userRole: UserRole;
}

export default function LoanSummaryTab({ loans, currentUsername, userRole }: LoanSummaryTabProps) {
   const isLender = userRole === UserRole.LENDER;

   const filteredLoans = loans.filter((loan) => (isLender ? loan.lenderUser === currentUsername : loan.borrowerUser === currentUsername));

   return (
      <div className="flex flex-wrap justify-center gap-8 overflow-hidden">
         {filteredLoans.map((loan) => (
            <Card key={loan._id} type={isLender} loan={loan} />
         ))}
      </div>
   );
}
