import type { PayloadAction } from '@reduxjs/toolkit';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { API_ENDPOINTS } from '@/config/apiEndpoints';
import { apiHandler } from '@/lib/apiHandler';
import { type ApiData } from '@/types/apiTypes';
import { type CreateLoanData, type Loan, type LoanState } from '@/types/loanTypes';

const initialState: LoanState = {
   loans: {
      gloans: [],
      floans: []
   },
   isLoading: false,
   error: null
};

export const createLoan = createAsyncThunk('loans/create', async (loanData: CreateLoanData) => {
   return await apiHandler.post(API_ENDPOINTS.LOANS.CREATE, loanData as unknown as ApiData);
});

export const fetchLoans = createAsyncThunk('loans/fetch', async () => {
   return await apiHandler.get(API_ENDPOINTS.LOANS.FETCH);
});

export const getUserLoans = createAsyncThunk('loans/getUserLoans', async (username: string) => {
   return await apiHandler.post(API_ENDPOINTS.LOANS.GET, { username });
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
            state.error = action.payload as string;
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
            state.error = action.payload as string;
         })
         .addCase(getUserLoans.fulfilled, (state, action) => {
            state.loans.gloans = action.payload;
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
      // Map id to loanId and extract all updatable fields for API consistency
      const { id, username, wallet, repaymentStatus, loanStatus, repaidAmount, hash } = loanData;
      return await apiHandler.post(API_ENDPOINTS.LOANS.UPDATE, {
         loanId: id,
         username,
         wallet,
         repaymentStatus,
         loanStatus,
         repaidAmount,
         hash
      } as unknown as ApiData);
   }
);

export const deleteLoan = createAsyncThunk('loans/delete', async (loanId: string) => {
   return await apiHandler.post(API_ENDPOINTS.LOANS.DELETE, { loanId });
});

export const getLoans = getUserLoans;

export default loanSlice.reducer;
