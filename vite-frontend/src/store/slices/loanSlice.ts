import type { PayloadAction } from '@reduxjs/toolkit';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import { type CreateLoanData, type Loan, type LoanState } from '@/types/loanTypes';

const supabaseClient = () => getSupabaseBrowserClient();

type LoanRow = Database['public']['Tables']['loans']['Row'];
type LoanInsert = Database['public']['Tables']['loans']['Insert'];
type LoanUpdate = Database['public']['Tables']['loans']['Update'];

// Helper function to map Supabase loan row to frontend Loan type
const mapSupabaseLoanToLoan = (row: LoanRow): Loan => ({
   id: row.id,
   trackingId: row.tracking_id,
   borrowerWallet: row.borrower_wallet ?? undefined,
   lenderWallet: row.lender_wallet ?? undefined,
   borrowerUser: row.borrower_user ?? undefined,
   lenderUser: row.lender_user ?? undefined,
   loanAmount: row.loan_amount,
   repaidAmount: row.repaid_amount,
   totalRepaymentAmount: row.total_repayment_amount,
   reason: row.reason,
   loanStatus: row.loan_status,
   repaymentStatus: row.repayment_status,
   dueDate: row.due_date,
   coin: row.coin,
   hash: row.hash,
   createdAt: row.created_at,
   updatedAt: row.updated_at
});

const initialState: LoanState = {
   loans: {
      gloans: [],
      floans: []
   },
   isLoading: false,
   error: null
};

export const createLoan = createAsyncThunk('loans/create', async (loanData: CreateLoanData) => {
   const supabase = supabaseClient();

   // Generate a unique tracking ID
   const trackingId = `LOAN-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

   const loanInsert: LoanInsert = {
      tracking_id: trackingId,
      borrower_wallet: loanData.borrowerWallet || null,
      borrower_user: loanData.borrowerUserId || null,
      lender_user: loanData.lenderUserId || null, // Use null instead of empty string to avoid FK violation
      loan_amount: loanData.loanAmount,
      total_repayment_amount: loanData.totalRepaymentAmount,
      reason: loanData.reason,
      due_date: loanData.dueDate,
      coin: 'USDC' // Only USDC transfers supported
   };

   const { data, error } = await supabase.from('loans').insert(loanInsert).select().single();

   if (error) {
      throw new Error(error.message);
   }

   if (!data) {
      throw new Error('Failed to create loan');
   }

   return mapSupabaseLoanToLoan(data);
});

export const fetchLoans = createAsyncThunk('loans/fetch', async () => {
   const supabase = supabaseClient();

   const { data, error } = await supabase.from('loans').select('*').order('created_at', { ascending: false });

   if (error) {
      throw new Error(error.message);
   }

   return (data || []).map(mapSupabaseLoanToLoan);
});

export const getUserLoans = createAsyncThunk('loans/getUserLoans', async (username: string) => {
   const supabase = supabaseClient();

   const { data, error } = await supabase
      .from('loans')
      .select('*')
      .or(`borrower_user.eq.${username},lender_user.eq.${username}`)
      .order('created_at', { ascending: false });

   if (error) {
      throw new Error(error.message);
   }

   return (data || []).map(mapSupabaseLoanToLoan);
});

const loanSlice = createSlice({
   name: 'loans',
   initialState,
   reducers: {
      clearError: (state) => {
         state.error = null;
      },
      addLoan: (state, action: PayloadAction<Loan>) => {
         state.loans.floans.push(action.payload);
      },
      updateLoan: (state, action: PayloadAction<Loan>) => {
         const { id } = action.payload;
         const floanIndex = state.loans.floans.findIndex((loan) => loan.id === id);
         if (floanIndex !== -1) {
            state.loans.floans[floanIndex] = action.payload;
         }
         const gloanIndex = state.loans.gloans.findIndex((loan) => loan.id === id);
         if (gloanIndex !== -1) {
            state.loans.gloans[gloanIndex] = action.payload;
         }
      }
   },
   extraReducers: (builder) => {
      builder
         .addCase(createLoan.pending, (state) => {
            state.isLoading = true;
            state.error = null;
         })
         .addCase(createLoan.fulfilled, (state, action) => {
            state.isLoading = false;
            state.loans.floans.push(action.payload);
         })
         .addCase(createLoan.rejected, (state, action) => {
            state.isLoading = false;
            state.error = (action.error.message as string) || 'Failed to create loan';
         })
         .addCase(fetchLoans.pending, (state) => {
            state.isLoading = true;
            state.error = null;
         })
         .addCase(fetchLoans.fulfilled, (state, action) => {
            state.isLoading = false;
            state.loans.floans = action.payload;
         })
         .addCase(fetchLoans.rejected, (state, action) => {
            state.isLoading = false;
            state.error = (action.error.message as string) || 'Failed to fetch loans';
         })
         .addCase(getUserLoans.fulfilled, (state, action) => {
            state.loans.gloans = action.payload;
         })
         .addCase(getUserLoans.rejected, (state, action) => {
            state.error = (action.error.message as string) || 'Failed to fetch user loans';
         })
         .addCase(updateLoanStatus.fulfilled, (state, action) => {
            const updatedLoan = action.payload;
            const floanIndex = state.loans.floans.findIndex((loan) => loan.id === updatedLoan.id);
            if (floanIndex !== -1) {
               state.loans.floans[floanIndex] = updatedLoan;
            }
            const gloanIndex = state.loans.gloans.findIndex((loan) => loan.id === updatedLoan.id);
            if (gloanIndex !== -1) {
               state.loans.gloans[gloanIndex] = updatedLoan;
            }
         })
         .addCase(updateLoanStatus.rejected, (state, action) => {
            state.error = (action.error.message as string) || 'Failed to update loan';
         })
         .addCase(deleteLoan.fulfilled, (state, action) => {
            const deletedLoanId = action.payload;
            state.loans.floans = state.loans.floans.filter((loan) => loan.id !== deletedLoanId);
            state.loans.gloans = state.loans.gloans.filter((loan) => loan.id !== deletedLoanId);
         })
         .addCase(deleteLoan.rejected, (state, action) => {
            state.error = (action.error.message as string) || 'Failed to delete loan';
         });
   }
});

export const { clearError, addLoan, updateLoan } = loanSlice.actions;

export const updateLoanStatus = createAsyncThunk(
   'loans/updateStatus',
   async (loanData: {
      id: string;
      username?: string | null;
      wallet?: string;
      repaymentStatus?: string;
      loanStatus?: string;
      repaidAmount?: number;
      hash?: string;
   }) => {
      const supabase = supabaseClient();
      const { id, username, wallet, repaymentStatus, loanStatus, repaidAmount, hash } = loanData;

      const updates: LoanUpdate = {};

      if (username) {
         updates.lender_user = username;
      }
      if (wallet) {
         updates.lender_wallet = wallet;
      }
      if (repaymentStatus) {
         updates.repayment_status = repaymentStatus as Database['public']['Enums']['repayment_status'];
      }
      if (loanStatus) {
         updates.loan_status = loanStatus as Database['public']['Enums']['loan_status'];
      }
      if (repaidAmount !== undefined) {
         updates.repaid_amount = repaidAmount;
      }
      if (hash) {
         // Fetch current loan to append the new hash
         const { data: currentLoan } = await supabase.from('loans').select('hash').eq('id', id).single();

         updates.hash = [...(currentLoan?.hash || []), hash];
      }

      const { data, error } = await supabase.from('loans').update(updates).eq('id', id).select().single();

      if (error) {
         throw new Error(error.message);
      }

      if (!data) {
         throw new Error('Failed to update loan');
      }

      return mapSupabaseLoanToLoan(data);
   }
);

export const deleteLoan = createAsyncThunk('loans/delete', async (loanId: string) => {
   const supabase = supabaseClient();

   const { error } = await supabase.from('loans').delete().eq('id', loanId);

   if (error) {
      throw new Error(error.message);
   }

   return loanId;
});

export const getLoans = getUserLoans;

export default loanSlice.reducer;
