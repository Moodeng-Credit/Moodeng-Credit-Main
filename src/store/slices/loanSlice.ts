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
         const { _id } = action.payload;
         const floanIndex = state.loans.floans.findIndex((loan) => loan._id === _id);
         if (floanIndex !== -1) {
            state.loans.floans[floanIndex] = action.payload;
         }
         const gloanIndex = state.loans.gloans.findIndex((loan) => loan._id === _id);
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

export const editLoan = createAsyncThunk('loans/edit', async (loanData: Loan) => {
   // Map frontend Loan fields to API schema fields
   const { _id, totalRepaymentAmount, repaymentStatus, loanStatus } = loanData;
   return await apiHandler.post(API_ENDPOINTS.LOANS.EDIT, {
      loanId: _id,
      totalRepaymentAmount,
      repaymentStatus,
      loanStatus
   } as unknown as ApiData);
});

export const deleteLoan = createAsyncThunk('loans/delete', async (loanId: string) => {
   return await apiHandler.post(API_ENDPOINTS.LOANS.DELETE, { loanId });
});

export const updateLoanStatus = createAsyncThunk(
   'loans/updateStatus',
   async (loanData: Partial<Loan> & { _id: string; username?: string; wallet?: string }) => {
      // Map _id to loanId for API consistency
      const { _id, username, wallet } = loanData;
      return await apiHandler.post(API_ENDPOINTS.LOANS.UPDATE, { loanId: _id, username, wallet } as unknown as ApiData);
   }
);

export const addHash = createAsyncThunk('loans/addHash', async (hashData: { _id: string; hash: string }) => {
   return await apiHandler.post(API_ENDPOINTS.LOANS.HASH, { loanId: hashData._id, hash: hashData.hash });
});

export const getLoans = getUserLoans;

export default loanSlice.reducer;
