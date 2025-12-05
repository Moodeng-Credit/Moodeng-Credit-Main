import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import { type Loan } from '@/types/loanTypes';

interface LoanState {
   loans: {
      gloans: Loan[];
      floans: Loan[];
   };
}

const initialState: LoanState = {
   loans: {
      gloans: [],
      floans: []
   }
};

const loanSlice = createSlice({
   name: 'loans',
   initialState,
   reducers: {
      setLoans: (state, action: PayloadAction<Loan[]>) => {
         state.loans.floans = action.payload;
      },
      setUserLoans: (state, action: PayloadAction<Loan[]>) => {
         state.loans.gloans = action.payload;
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
      },
      clearLoans: (state) => {
         state.loans.gloans = [];
         state.loans.floans = [];
      }
   }
});

export const { setLoans, setUserLoans, addLoan, updateLoan, clearLoans } = loanSlice.actions;

export default loanSlice.reducer;
