import type { ReactNode } from 'react';

import type { Column } from '@/components/tables/DataTable';

import { formatDate } from '@/utils/dateFormatters';

import type { Loan } from '@/types/loanTypes';

const renderLoanStatus = (loan: Loan): ReactNode => (
   <span
      className={`font-bold ${
         loan.repaymentStatus === 'Paid' ? 'text-[#166534]' : loan.repaymentStatus === 'Unpaid' ? 'text-[#b91c1c]' : 'text-gray-700'
      }`}
   >
      {loan.loanStatus}, {loan.repaymentStatus}
   </span>
);

export const getTransactionColumns = (isLender: boolean): Column<Loan>[] => [
   {
      header: 'All Transaction',
      accessor: 'reason' as const,
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
      accessor: (loan) => `$${loan.repaidAmount.toString()}.00`,
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
];
