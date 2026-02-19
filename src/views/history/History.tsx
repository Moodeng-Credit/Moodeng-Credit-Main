import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { format } from 'date-fns';

import FilterModal from '@v2/components/FilterModal';
import TransactionCard from '@v2/components/TransactionCard';
import { Card, CardContent } from '@/components/shadcn/card';
import { Input } from '@/components/shadcn/input';
import { Button } from '@/components/shadcn/button';
import { useDebounce } from '@v2/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { fetchUserProfiles } from '@/store/slices/authSlice';
import { fetchTransactions } from '@/store/slices/transactionSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { Transaction, TransactionFilters } from '@v2/types/transactionTypes';

import type { User } from '@/types/authTypes';
import LenderBoardHeader from '@v2/views/lenderBoard/components/LenderBoardHeader';
import LoadMoreButton from '@/views/profile/components/shared/LoadMoreButton';

type TransactionType = 'loan_requested' | 'loan_funded' | 'repayment';

function transactionTypeToTitle(type: TransactionType): string {
   const titles: Record<TransactionType, string> = {
      loan_requested: 'Loan requested',
      loan_funded: 'Loan funded',
      repayment: 'Repayment'
   };
   return titles[type] || type;
}

function transactionTypeToStatus(type: TransactionType): Transaction['status'] {
   const statusMap: Record<TransactionType, Transaction['status']> = {
      loan_requested: 'pending',
      loan_funded: 'active',
      repayment: 'paid'
   };
   return statusMap[type] || 'pending';
}

function mapTransactionRowsToTransactions(
   rows: { id: string; loan_id: string; from_user_id: string | null; to_user_id: string | null; type: TransactionType; amount: number; currency: string; created_at: string }[],
   currentUserId: string,
   userProfiles: User[]
): Transaction[] {
   return rows.map((row) => {
      const isFrom = row.from_user_id === currentUserId;
      const otherUserId = isFrom ? row.to_user_id : row.from_user_id;
      const otherProfile = userProfiles.find((p) => p.id === otherUserId);
      const otherUsername = otherProfile?.username || (otherUserId ? `${otherUserId.slice(0, 8)}…` : 'Unknown');

      let user_role: 'lender' | 'borrower';
      let amount_paid: number;
      if (row.type === 'loan_funded') {
         user_role = isFrom ? 'lender' : 'borrower';
         amount_paid = isFrom ? -row.amount : row.amount;
      } else {
         user_role = isFrom ? 'borrower' : 'lender';
         amount_paid = isFrom ? -row.amount : row.amount;
      }

      return {
         id: row.id,
         title: transactionTypeToTitle(row.type),
         lender_name: otherUsername,
         date: row.created_at,
         amount_paid,
         total_amount: row.amount,
         status: transactionTypeToStatus(row.type),
         user_role,
         currency: row.currency
      };
   });
}

export default function History() {
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const { transactions: transactionRows, isLoading } = useSelector((state: RootState) => state.transactions);

   useEffect(() => {
      const load = async () => {
         if (!user?.id) return;
         try {
            const rows = await dispatch(fetchTransactions(user.id)).unwrap();
            const userIds = [...new Set(rows.flatMap((r) => [r.from_user_id, r.to_user_id].filter(Boolean)))] as string[];
            if (userIds.length > 0) {
               await dispatch(fetchUserProfiles(userIds)).unwrap();
            }
         } catch (e) {
            console.error('Error fetching transactions:', e);
         }
      };
      load();
   }, [dispatch, user?.id]);

   const allTransactions = useMemo(() => {
      if (!user?.id) return [];
      return mapTransactionRowsToTransactions(transactionRows, user.id, Object.values(userProfiles));
   }, [transactionRows, user?.id, userProfiles]);

   const [searchQuery, setSearchQuery] = useState('');
   const [filters, setFilters] = useState<TransactionFilters>({});
   const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

   const debouncedSearchQuery = useDebounce(searchQuery, 300);

   const filteredTransactions = useMemo(() => {
      let result = [...allTransactions];

      if (debouncedSearchQuery) {
         const query = debouncedSearchQuery.toLowerCase();
         result = result.filter((t) => {
            const formattedDate = format(new Date(t.date), 'MMM dd, yyyy').toLowerCase();
            return (
               t.title.toLowerCase().includes(query) ||
               t.lender_name.toLowerCase().includes(query) ||
               formattedDate.includes(query)
            );
         });
      }

      if (filters.status && filters.status.length > 0) {
         result = result.filter((t) => filters.status!.includes(t.status));
      }

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

   const hasTransactions = allTransactions.length > 0;

   return (
      <>
         <div className="min-h-screen bg-background">
            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-24">
               <LenderBoardHeader />
               <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                  Transaction History
               </h1>
               <p className="text-sm text-muted-foreground mb-6">
                  View your loans and repayments. Search and filter below.
               </p>

               <div className="mb-6">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Browse transactions</h2>
                  <div className="flex items-center gap-3">
                     <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 text-muted-foreground pointer-events-none">
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                              <circle cx="11" cy="11" r="8" />
                              <path d="m21 21-4.35-4.35" />
                           </svg>
                        </span>
                        <Input
                           type="text"
                           value={searchQuery}
                           onChange={(e) => setSearchQuery(e.target.value)}
                           placeholder="Search transactions"
                           className="pl-9 h-11 rounded-lg border-input"
                        />
                     </div>
                     <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 rounded-lg shrink-0 text-[#6d57ff] border-input hover:bg-muted/50"
                        onClick={() => setIsFilterModalOpen(true)}
                        aria-label="Filter transactions"
                     >
                        <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                     </Button>
                  </div>
               </div>

               <div className="flex-1 min-w-0">
                  {isLoading ? (
                     <Card className="rounded-2xl">
                        <CardContent className="flex flex-col items-center justify-center py-20">
                           <div className="w-8 h-8 animate-spin rounded-full border-2 border-[#6d57ff] border-t-transparent" aria-hidden />
                           <p className="mt-4 text-sm text-muted-foreground">Loading transactions…</p>
                        </CardContent>
                     </Card>
                  ) : displayedTransactions.length > 0 ? (
                     <>
                        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                           {displayedTransactions.map((transaction) => (
                              <TransactionCard key={transaction.id} transaction={transaction} />
                           ))}
                        </div>
                        <LoadMoreButton
                           currentCount={displayedCount}
                           totalCount={totalCount}
                           onLoadMore={handleLoadMore}
                        />
                     </>
                  ) : (
                     <Card className="rounded-2xl">
                        <CardContent className="flex flex-col items-center justify-center py-20">
                           <div className="rounded-full bg-muted p-4 mb-4" aria-hidden>
                              <svg className="size-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                           </div>
                           <p className="text-muted-foreground font-medium mb-2">
                              {hasTransactions ? 'No transactions match your search or filters.' : 'No transactions yet.'}
                           </p>
                           {!hasTransactions && (
                              <Link to="/lender-board">
                                 <Button variant="default" size="sm">Go to lender board</Button>
                              </Link>
                           )}
                        </CardContent>
                     </Card>
                  )}
               </div>
            </main>
         </div>

         <FilterModal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            onApply={(newFilters) => setFilters(newFilters)}
            currentFilters={filters}
         />
      </>
   );
}
