import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import authReducer from '@/store/slices/authSlice';
import loanReducer, { confirmLoanPayment, deleteLoan, getUserLoans, PaymentNotConfirmedError } from '@/store/slices/loanSlice';

// Mock the Supabase client
vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: vi.fn()
}));

describe('Loan Flow Trigger Integration', () => {
   let store: any;
   let mockSupabase: any;

   beforeEach(() => {
      vi.clearAllMocks();

      // Setup fresh store for each test
      store = configureStore({
         reducer: {
            auth: authReducer,
            loans: loanReducer
         }
      });

      // Setup mock Supabase client
      mockSupabase = {
         from: vi.fn().mockReturnThis(),
         delete: vi.fn().mockReturnThis(),
         update: vi.fn().mockReturnThis(),
         select: vi.fn().mockReturnThis(),
         eq: vi.fn().mockReturnThis(),
         or: vi.fn().mockReturnThis(),
         order: vi.fn().mockResolvedValue({ data: [], error: null }),
         maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'loan-123' },
            error: null
         }),
         single: vi.fn().mockResolvedValue({
            data: {
               id: 'loan-123',
               tracking_id: 'TRK-123',
               loan_status: 'Lent',
               loan_amount: 10,
               borrower_user_id: 'borrower-123',
               lender_user_id: 'user-123',
               funded_at: '2024-01-01T00:00:00Z'
            },
            error: null
         }),
         neq: vi.fn().mockResolvedValue({
            count: 0,
            error: null
         }),
         rpc: vi.fn().mockResolvedValue({
            data: [{ applied: true, event_id: 1, points_total: 35000000 }],
            error: null
         }),
         functions: {
            invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null })
         }
      };

      (getSupabaseBrowserClient as any).mockReturnValue(mockSupabase);
   });

   it('marks user loans as loading while the repay loan fetch is pending', async () => {
      let resolveLoans: (value: { data: any[]; error: null }) => void = () => undefined;
      const loansPromise = new Promise<{ data: any[]; error: null }>((resolve) => {
         resolveLoans = resolve;
      });
      mockSupabase.order.mockReturnValueOnce(loansPromise);

      const pendingFetch = store.dispatch(getUserLoans({ userId: 'borrower-123' }));

      expect(store.getState().loans.isLoading).toBe(true);

      resolveLoans({ data: [], error: null });
      await pendingFetch;

      expect(store.getState().loans.isLoading).toBe(false);
   });

   it('confirmLoanPayment routes funding through the confirm-loan-payment edge function (no direct loans.update)', async () => {
      mockSupabase.functions.invoke.mockResolvedValueOnce({
         data: {
            loan: {
               id: 'loan-123',
               tracking_id: 'TRK-123',
               loan_status: 'Lent',
               loan_amount: 10,
               borrower_user_id: 'borrower-123',
               lender_user_id: 'user-123',
               funded_at: '2024-01-01T00:00:00Z'
            },
            sideEffectErrors: []
         },
         error: null
      });

      const result = await store.dispatch(
         confirmLoanPayment({ loanId: 'loan-123', hash: '0xabc', method: 'base', action: 'fund' })
      );

      expect(confirmLoanPayment.fulfilled.match(result)).toBe(true);
      // The verified server path is used — NOT a client-side loans.update.
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
         'confirm-loan-payment',
         expect.objectContaining({ body: { loanId: 'loan-123', hash: '0xabc', method: 'base', action: 'fund' } })
      );
      expect(mockSupabase.update).not.toHaveBeenCalled();
   });

   it('interest return routes through the confirm-loan-payment edge function (no direct loans.update)', async () => {
      mockSupabase.functions.invoke.mockResolvedValueOnce({
         data: {
            loan: {
               id: 'loan-123',
               tracking_id: 'TRK-123',
               loan_status: 'Lent',
               repayment_status: 'Paid',
               loan_amount: 10,
               total_repayment_amount: 11,
               borrower_user_id: 'borrower-123',
               lender_user_id: 'user-123',
               interest_returned_at: '2024-02-01T00:00:00Z',
               interest_return_hash: '0xint'
            },
            sideEffectErrors: []
         },
         error: null
      });

      const result = await store.dispatch(
         confirmLoanPayment({ loanId: 'loan-123', hash: '0xint', method: 'base', action: 'return-interest' })
      );

      expect(confirmLoanPayment.fulfilled.match(result)).toBe(true);
      // Interest return is now server-verified — the lender can no longer mark it returned via a
      // direct client write; it must clear the on-chain gate in the edge function.
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
         'confirm-loan-payment',
         expect.objectContaining({ body: { loanId: 'loan-123', hash: '0xint', method: 'base', action: 'return-interest' } })
      );
      expect(mockSupabase.update).not.toHaveBeenCalled();
   });

   it('confirmLoanPayment surfaces a 202 (unconfirmed) as PaymentNotConfirmedError, not a hard failure', async () => {
      mockSupabase.functions.invoke.mockResolvedValueOnce({
         data: { retry: true, error: 'Payment is not confirmed on-chain yet' },
         error: null
      });

      const result = await store.dispatch(
         confirmLoanPayment({ loanId: 'loan-123', hash: '0xpending', method: 'base', action: 'repay' })
      );

      expect(confirmLoanPayment.rejected.match(result)).toBe(true);
      expect(result.error.name).toBe(new PaymentNotConfirmedError().name);
      expect(mockSupabase.update).not.toHaveBeenCalled();
   });

   it('only fulfills loan deletion after Supabase returns the deleted row', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
         data: { id: 'loan-123' },
         error: null
      });

      const result = await store.dispatch(deleteLoan('loan-123'));

      expect(deleteLoan.fulfilled.match(result)).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('loans');
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'loan-123');
      expect(mockSupabase.select).toHaveBeenCalledWith('id');
   });

   it('rejects loan deletion when row-level security returns no deleted row', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
         data: null,
         error: null
      });

      const result = await store.dispatch(deleteLoan('loan-123'));

      expect(deleteLoan.rejected.match(result)).toBe(true);
      expect(result.error.message).toBe('Loan request was not deleted');
   });
});
