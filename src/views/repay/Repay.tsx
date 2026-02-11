import { useMemo } from 'react';
import { useSelector } from 'react-redux';

import DataTable from '@/components/tables/DataTable';
import { usePagination } from '@/hooks/usePagination';
import type { RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';
import { LoanStatus, RepaymentStatus } from '@/types/loanTypes';

export default function Repay() {
   const user = useSelector((state: RootState) => state.auth.user);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const rawLoans = useSelector((state: RootState) => state.loans?.loans);
   const allLoans = useMemo(() => [...(rawLoans?.gloans || []), ...(rawLoans?.floans || [])], [rawLoans]);

   // Filter loans that need repayment (user is borrower, loan is active, not fully paid)
   const loansToRepay = useMemo(() => {
      return allLoans.filter(
         (loan) =>
            loan.borrowerUser === user?.id &&
            loan.loanStatus === LoanStatus.LENT &&
            loan.repaymentStatus !== RepaymentStatus.PAID
      );
   }, [allLoans, user?.id]);

   const {
      displayedItems: displayedLoans,
      displayedCount,
      totalCount,
      handleLoadMore
   } = usePagination({
      items: loansToRepay
   });

   const columns = useMemo(
      () => [
         {
            header: 'Lender',
            accessor: (loan: Loan) => {
               const lenderProfile = userProfiles.find((p) => p.id === loan.lenderUser);
               return lenderProfile?.username || loan.lenderWallet?.slice(0, 10) + '...' || 'Unknown';
            }
         },
         {
            header: 'Amount',
            accessor: (loan: Loan) => `${loan.loanAmount} ${loan.coin}`
         },
         {
            header: 'To Repay',
            accessor: (loan: Loan) => `${loan.totalRepaymentAmount} ${loan.coin}`
         },
         {
            header: 'Repaid',
            accessor: (loan: Loan) => `${loan.repaidAmount} ${loan.coin}`
         },
         {
            header: 'Remaining',
            accessor: (loan: Loan) => `${loan.totalRepaymentAmount - loan.repaidAmount} ${loan.coin}`
         },
         {
            header: 'Due Date',
            accessor: (loan: Loan) => new Date(loan.dueDate).toLocaleDateString()
         },
         {
            header: 'Status',
            accessor: (loan: Loan) => loan.repaymentStatus
         },
         {
            header: 'Action',
            accessor: (loan: Loan) => (
               <button
                  className="px-4 py-2 bg-[#6d57ff] text-white rounded hover:bg-[#5a47e0] transition-colors"
                  onClick={() => handleRepay(loan)}
               >
                  Repay
               </button>
            )
         }
      ],
      [userProfiles]
   );

   const handleRepay = (loan: Loan) => {
      // TODO: Implement repayment functionality
      console.log('Repay loan:', loan);
   };

   return (
      <div className="w-full min-h-screen bg-gradient-to-b from-[#171420] to-[#2a1f3d] text-white p-4 md:p-8">
         <div className="max-w-7xl mx-auto">
            <div className="mb-8">
               <h1 className="text-3xl md:text-4xl font-bold mb-2">Repay Loans</h1>
               <p className="text-gray-400">Manage and repay your active loans</p>
            </div>

            <div className="bg-[#1f1a2e] rounded-lg p-6">
               {loansToRepay.length === 0 ? (
                  <div className="text-center py-12">
                     <p className="text-gray-400 text-lg">No loans to repay</p>
                     <p className="text-gray-500 text-sm mt-2">You don't have any active loans that need repayment</p>
                  </div>
               ) : (
                  <>
                     <DataTable columns={columns} data={displayedLoans} keyExtractor={(loan) => loan.id} emptyMessage="No loans to repay" />

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
                  </>
               )}
            </div>
         </div>
      </div>
   );
}
