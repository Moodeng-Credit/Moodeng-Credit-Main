import DataTable from '@/components/tables/DataTable';

import { formatDate } from '@/utils/dateFormatters';

import type { Loan } from '@/types/loanTypes';
import { UserRole } from '@/views/profile/types';

interface TransactionHistoryTabProps {
   loans: Loan[];
   currentUsername: string;
   userRole: UserRole;
}

const renderLoanStatus = (loan: Loan) => (
   <span
      className={`font-bold ${
         loan.repaymentStatus === 'Paid' ? 'text-[#166534]' : loan.repaymentStatus === 'Unpaid' ? 'text-[#b91c1c]' : 'text-gray-700'
      }`}
   >
      {loan.loanStatus}, {loan.repaymentStatus}
   </span>
);

export default function TransactionHistoryTab({ loans, currentUsername, userRole }: TransactionHistoryTabProps) {
   const isLender = userRole === UserRole.LENDER;

   const filteredLoans = loans.filter((loan) => (isLender ? loan.lenderUser === currentUsername : loan.borrowerUser === currentUsername));

   return (
      <DataTable
         columns={[
            {
               header: 'All Transaction',
               accessor: 'reason',
               className: 'font-bold text-[#2a56f4]',
               mobileLabel: 'Transaction'
            },
            {
               header: `${isLender ? 'Funded' : 'Borrowed'} Amount`,
               accessor: (loan) => `$${loan.loanAmount}.00`,
               className: 'font-bold text-[#166534]',
               mobileLabel: 'Amount'
            },
            {
               header: `Date ${isLender ? 'Funded' : 'Borrowed'}`,
               accessor: (loan) => formatDate(loan.createdAt),
               className: 'font-bold text-[#2a56f4]',
               mobileLabel: 'Date'
            },
            {
               header: 'Returned Amount',
               accessor: (loan) => `$${loan.repaymentAmount}.00`,
               className: 'font-bold text-[#b91c1c]',
               mobileLabel: 'Returned'
            },
            {
               header: 'Date Returned',
               accessor: (loan) => formatDate(loan.updatedAt),
               className: 'font-bold text-[#2a56f4]',
               mobileLabel: 'Date Returned'
            },
            {
               header: `${isLender ? "Borrower's" : "Lender's"} Name`,
               accessor: (loan) => (isLender ? loan.borrowerUser : loan.lenderUser),
               className: 'font-bold text-[#2a56f4]',
               mobileLabel: 'Name'
            },
            {
               header: 'Status',
               accessor: renderLoanStatus,
               mobileLabel: 'Status'
            }
         ]}
         data={filteredLoans}
         keyExtractor={(loan) => loan._id}
         emptyMessage="No transactions found"
      />
   );
}
