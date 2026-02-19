import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';

const supabaseClient = () => getSupabaseBrowserClient();

type TransactionRow = Database['public']['Tables']['transactions']['Row'];

export type TransactionState = {
   transactions: TransactionRow[];
   isLoading: boolean;
   error: string | null;
};

const initialState: TransactionState = {
   transactions: [],
   isLoading: false,
   error: null
};

export const fetchTransactions = createAsyncThunk(
   'transactions/fetch',
   async (userId: string | null) => {
      if (!userId) return [];
      const supabase = supabaseClient();
      const { data, error } = await supabase
         .from('transactions')
         .select('*')
         .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
         .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return (data || []) as TransactionRow[];
   }
);

const transactionSlice = createSlice({
   name: 'transactions',
   initialState,
   reducers: {
      clearError: (state) => {
         state.error = null;
      }
   },
   extraReducers: (builder) => {
      builder
         .addCase(fetchTransactions.pending, (state) => {
            state.isLoading = true;
            state.error = null;
         })
         .addCase(fetchTransactions.fulfilled, (state, action) => {
            state.isLoading = false;
            state.transactions = action.payload;
         })
         .addCase(fetchTransactions.rejected, (state, action) => {
            state.isLoading = false;
            state.error = (action.error.message as string) || 'Failed to fetch transactions';
         });
   }
});

export default transactionSlice.reducer;
