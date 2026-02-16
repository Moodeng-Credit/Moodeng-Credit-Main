import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { HelpCircle, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';

import FilterModal from '@/components/FilterModal';
import TransactionCard from '@/components/TransactionCard';
import Button from '@/components/ui/Button';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import type { RootState } from '@/store/store';
import type { Transaction, TransactionFilters } from '@/types/transactionTypes';
import { WorldId } from '@/types/authTypes';

import type { Loan } from '@/types/loanTypes';
import type { User } from '@/types/authTypes';

const WALLET_DISPLAY_LENGTH = 10;

// Mock function to convert loans to transactions
// In a real implementation, this would come from an API
function loansToTransactions(loans: Loan[], userId: string, userProfiles: User[]): Transaction[] {
   return loans.map((loan) => {
      const isLender = loan.lenderUser === userId;
      const isBorrower = loan.borrowerUser === userId;
      const otherUserId = isLender ? loan.borrowerUser : loan.lenderUser;
      const otherProfile = userProfiles.find((p) => p.id === otherUserId);
      const otherWallet = isLender ? loan.borrowerWallet : loan.lenderWallet;
      const otherUserName = otherProfile?.username || (otherWallet ? `${otherWallet.slice(0, WALLET_DISPLAY_LENGTH)}...` : 'Unknown');

      // For borrowers: receiving loan is positive (+), repaying is negative (-)
      // For lenders: lending is negative (-), receiving repayment is positive (+)
      let amountPaid: number;
      if (isBorrower) {
         // Borrower view: loan amount received is positive, repaid amount is negative
         amountPaid = loan.loanAmount - loan.repaidAmount;
      } else {
         // Lender view: loan amount lent is negative, repaid amount is positive
         amountPaid = loan.repaidAmount - loan.loanAmount;
      }

      return {
         id: loan.id,
         title: loan.reason || 'Loan transaction',
         lender_name: otherUserName,
         date: loan.createdAt,
         amount_paid: amountPaid,
         total_amount: loan.totalRepaymentAmount,
         status: mapRepaymentStatusToTransactionStatus(loan.repaymentStatus),
         user_role: isLender ? 'lender' : 'borrower'
      };
   });
}

// Map repayment status to transaction status
function mapRepaymentStatusToTransactionStatus(repaymentStatus: string): Transaction['status'] {
   const statusMap: Record<string, Transaction['status']> = {
      Unpaid: 'pending',
      Partial: 'partial',
      Paid: 'paid'
   };
   return statusMap[repaymentStatus] || 'pending';
}

export default function History() {
   const user = useSelector((state: RootState) => state.auth.user);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const rawLoans = useSelector((state: RootState) => state.loans?.loans);
   const allLoans = useMemo(() => [...(rawLoans?.gloans || []), ...(rawLoans?.floans || [])], [rawLoans]);

   // Convert loans to transactions
   const allTransactions = useMemo(() => {
      if (!user?.id) return [];
      return loansToTransactions(allLoans, user.id, Object.values(userProfiles));
   }, [allLoans, user?.id, userProfiles]);

   const [searchQuery, setSearchQuery] = useState('');
   const [filters, setFilters] = useState<TransactionFilters>({});
   const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

   const debouncedSearchQuery = useDebounce(searchQuery, 300);

   // Filter and sort transactions
   const filteredTransactions = useMemo(() => {
      let result = [...allTransactions];

      // Apply search filter
      if (debouncedSearchQuery) {
         const query = debouncedSearchQuery.toLowerCase();
         result = result.filter((t) => {
            // Format date for human-readable search
            const formattedDate = format(new Date(t.date), 'MMM dd, yyyy').toLowerCase();
            return (
               t.title.toLowerCase().includes(query) ||
               t.lender_name.toLowerCase().includes(query) ||
               formattedDate.includes(query)
            );
         });
      }

      // Apply status filter
      if (filters.status && filters.status.length > 0) {
         result = result.filter((t) => filters.status!.includes(t.status));
      }

      // Apply sorting
      if (filters.sort) {
         result.sort((a, b) => {
            switch (filters.sort) {
               case 'amount_asc':
                  return Math.abs(a.amount_paid) - Math.abs(b.amount_paid);
               case 'amount_desc':
                  return Math.abs(b.amount_paid) - Math.abs(a.amount_paid);
               case 'date_asc':
                  return new Date(a.date).getTime() - new Date(b.date).getTime();
               case 'date_desc':
                  return new Date(b.date).getTime() - new Date(a.date).getTime();
               default:
                  return 0;
            }
         });
      }

      return result;
   }, [allTransactions, debouncedSearchQuery, filters]);

   const { displayedItems: displayedTransactions, displayedCount, totalCount, handleLoadMore } = usePagination({
      items: filteredTransactions,
      itemsPerPage: 20,
      resetDependencies: [debouncedSearchQuery, filters]
   });

   const isVerified = user?.isWorldId === WorldId.ACTIVE;
   const hasTransactions = allTransactions.length > 0;

   const handleApplyFilters = (newFilters: TransactionFilters) => {
      setFilters(newFilters);
   };

   return (
      <div className="w-full min-h-screen bg-white">
         <div className="max-w-4xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
               <div className="flex items-center gap-3">
                  {/* Avatar placeholder */}
                  <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                     <span className="text-gray-600 text-lg font-semibold">{user?.username?.charAt(0).toUpperCase() || 'U'}</span>
                  </div>

                  <div>
                     <h1 className="text-base font-semibold text-gray-900">Hello, {user?.username || 'User'}</h1>
                     {isVerified ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                           <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                           Verified Borrower
                        </span>
                     ) : (
                        <Link
                           to="/profile"
                           className="inline-flex items-center gap-1 text-xs text-red-600 font-medium hover:underline"
                        >
                           <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                           Not Verified • Verify World ID &gt;
                        </Link>
                     )}
                  </div>
               </div>

               {/* Help Icon */}
               <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <HelpCircle className="w-6 h-6" />
               </button>
            </div>

            {/* Page Title */}
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Transaction History</h2>

            {/* Search and Filter */}
            <div className="flex gap-2 mb-6">
               {/* Search Bar */}
               <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                     type="text"
                     placeholder="Search transaction history"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
               </div>

               {/* Filter Button */}
               <button
                  onClick={() => setIsFilterModalOpen(true)}
                  className="p-2 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
               >
                  <Filter className="w-5 h-5 text-gray-600" />
               </button>
            </div>

            {/* Content */}
            {!hasTransactions ? (
               // Empty State
               <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="w-24 h-24 mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                     <span className="text-4xl">📋</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No transactions yet</h3>
                  <p className="text-sm text-gray-500 text-center mb-6 max-w-sm">
                     Your loan activity will appear here once you start borrowing.
                  </p>
                  <Link to="/dashboard">
                     <Button variant="primary" size="lg">
                        Request a loan
                     </Button>
                  </Link>
               </div>
            ) : (
               // Filled State
               <>
                  {filteredTransactions.length === 0 ? (
                     <div className="py-12 text-center">
                        <p className="text-gray-500">No transactions match your search or filters.</p>
                     </div>
                  ) : (
                     <>
                        {/* Transaction List */}
                        <div className="space-y-3">
                           {displayedTransactions.map((transaction) => (
                              <TransactionCard key={transaction.id} transaction={transaction} />
                           ))}
                        </div>

                        {/* Load More */}
                        {displayedCount < totalCount && (
                           <div className="mt-6 flex justify-center">
                              <Button variant="outline" onClick={handleLoadMore}>
                                 Load More ({displayedCount} of {totalCount})
                              </Button>
                           </div>
                        )}

                        {/* End Message */}
                        {displayedCount >= totalCount && totalCount > 0 && (
                           <div className="mt-6 text-center text-sm text-gray-500">No more transactions</div>
                        )}
                     </>
                  )}
               </>
            )}
         </div>

         {/* Filter Modal */}
         <FilterModal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            onApply={handleApplyFilters}
            currentFilters={filters}
         />
      </div>
   );
}
