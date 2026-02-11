import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import DataTable from '@/components/tables/DataTable';
import { usePagination } from '@/hooks/usePagination';
import type { RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';

enum UserRole {
   BORROWER = 'borrower',
   LENDER = 'lender'
}

export default function History() {
   const user = useSelector((state: RootState) => state.auth.user);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const rawLoans = useSelector((state: RootState) => state.loans?.loans);
   const allLoans = useMemo(() => [...(rawLoans?.gloans || []), ...(rawLoans?.floans || [])], [rawLoans]);
   const [userRole, setUserRole] = useState<UserRole>(UserRole.BORROWER);

   const isLender = userRole === UserRole.LENDER;

   // Filter loans based on role
   const filteredLoans = useMemo(() => {
      return allLoans.filter((loan) => (isLender ? loan.lenderUser === user?.id : loan.borrowerUser === user?.id));
   }, [allLoans, user?.id, isLender]);

   const {
      displayedItems: displayedLoans,
      displayedCount,
      totalCount,
      handleLoadMore
   } = usePagination({
      items: filteredLoans,
      resetDependencies: [userRole]
   });

   const columns = useMemo(
      () => [
         {
            header: isLender ? 'Borrower' : 'Lender',
            accessor: (loan: Loan) => {
               const otherUserId = isLender ? loan.borrowerUser : loan.lenderUser;
               const otherProfile = userProfiles.find((p) => p.id === otherUserId);
               const otherWallet = isLender ? loan.borrowerWallet : loan.lenderWallet;
               return otherProfile?.username || otherWallet?.slice(0, 10) + '...' || 'Unknown';
            }
         },
         {
            header: 'Amount',
            accessor: (loan: Loan) => `${loan.loanAmount} ${loan.coin}`
         },
         {
            header: 'Total Repayment',
            accessor: (loan: Loan) => `${loan.totalRepaymentAmount} ${loan.coin}`
         },
         {
            header: 'Repaid',
            accessor: (loan: Loan) => `${loan.repaidAmount} ${loan.coin}`
         },
         {
            header: 'Loan Status',
            accessor: (loan: Loan) => loan.loanStatus
         },
         {
            header: 'Repayment Status',
            accessor: (loan: Loan) => loan.repaymentStatus
         },
         {
            header: 'Due Date',
            accessor: (loan: Loan) => new Date(loan.dueDate).toLocaleDateString()
         },
         {
            header: 'Created',
            accessor: (loan: Loan) => new Date(loan.createdAt).toLocaleDateString()
         }
      ],
      [isLender, userProfiles]
   );

   return (
      <div className="w-full min-h-screen bg-gradient-to-b from-[#171420] to-[#2a1f3d] text-white p-4 md:p-8">
         <div className="max-w-7xl mx-auto">
            <div className="mb-8">
               <span className="text-xs font-medium text-[#6d57ff] bg-[#6d57ff]/20 px-2 py-1 rounded mb-2 inline-block">Draft (v2)</span>
               <h1 className="text-3xl md:text-4xl font-bold mb-2">Transaction History</h1>
               <p className="text-gray-400">View all your lending and borrowing activity</p>
            </div>

            <div className="mb-6 flex gap-4">
               <button
                  onClick={() => setUserRole(UserRole.BORROWER)}
                  className={`px-6 py-3 rounded transition-colors ${
                     userRole === UserRole.BORROWER
                        ? 'bg-[#6d57ff] text-white'
                        : 'bg-[#1f1a2e] text-gray-400 hover:bg-[#2a1f3d]'
                  }`}
               >
                  Borrowed
               </button>
               <button
                  onClick={() => setUserRole(UserRole.LENDER)}
                  className={`px-6 py-3 rounded transition-colors ${
                     userRole === UserRole.LENDER
                        ? 'bg-[#6d57ff] text-white'
                        : 'bg-[#1f1a2e] text-gray-400 hover:bg-[#2a1f3d]'
                  }`}
               >
                  Lent
               </button>
            </div>

            <div className="bg-[#1f1a2e] rounded-lg p-6">
               <DataTable columns={columns} data={displayedLoans} keyExtractor={(loan) => loan.id} emptyMessage="No transactions found" />

               {displayedCount < totalCount && (
                  <div className="mt-6 text-center">
                     <button
                        onClick={handleLoadMore}
                        className="px-6 py-3 bg-[#6d57ff] text-white rounded hover:bg-[#5a47e0] transition-colors"
                     >
                        Load More ({displayedCount} of {totalCount})
                     </button>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}
