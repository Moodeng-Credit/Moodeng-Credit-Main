export interface Transaction {
   id: string;
   title: string;
   lender_name: string;
   date: string; // ISO 8601 date string from loan.createdAt
   amount_paid: number;
   total_amount: number;
   status: 'pending' | 'active' | 'partial' | 'paid' | 'default';
   user_role: 'lender' | 'borrower'; // Role of the current user in this transaction
}

export interface TransactionListResponse {
   transactions: Transaction[];
   pagination: {
      page: number;
      total_pages: number;
   };
}

export interface TransactionFilters {
   sort?: 'amount_asc' | 'amount_desc' | 'date_asc' | 'date_desc';
   status?: string[]; // ['pending', 'active', 'default']
   search?: string;
}
