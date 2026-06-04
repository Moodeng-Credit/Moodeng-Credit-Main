import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import authReducer from '@/store/slices/authSlice';
import loanReducer, { deleteLoan, getUserLoans, updateLoanStatus } from '@/store/slices/loanSlice';

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

   it('should trigger the "loan-funded-notification" edge function when a loan status is updated to "Lent"', async () => {
      const loanUpdatePayload = {
         id: 'loan-123',
         loanStatus: 'Lent',
         wallet: '0x123...'
      };

      // Dispatch the thunk
      await store.dispatch(updateLoanStatus(loanUpdatePayload));

      // Assert that the database update was called
      expect(mockSupabase.from).toHaveBeenCalledWith('loans');
      expect(mockSupabase.update).toHaveBeenCalledWith(
         expect.objectContaining({
            loan_status: 'Lent',
            lender_wallet: '0x123...'
         })
      );

      // Assert that the edge function was invoked
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
         'loan-funded-notification',
         expect.objectContaining({
            body: { loanId: 'loan-123' }
         })
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
         'award_points',
         expect.objectContaining({
            user_id_input: 'user-123',
            source_type_input: 'loan',
            source_id_input: 'loan-123',
            event_type_input: 'funded',
            delta_input: '35000000',
            metadata_input: expect.objectContaining({
               reward_year: 1,
               base_points_per_usdc: 1,
               borrower_prior_funded_loan_count: 0,
               borrower_loan_number: 1,
               borrower_bonus_points: 25
            })
         })
      );
   });

   it('should trigger the repayment received edge function when a loan is fully paid', async () => {
      await store.dispatch(
         updateLoanStatus({
            id: 'loan-123',
            repaymentStatus: 'Paid',
            repaidAmount: 275
         })
      );

      expect(mockSupabase.update).toHaveBeenCalledWith(
         expect.objectContaining({
            repayment_status: 'Paid',
            repaid_amount: 275
         })
      );
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
         'loan-repayment-received-notification',
         expect.objectContaining({
            body: { loanId: 'loan-123' }
         })
      );
   });

   it('blocks funding when a request is older than the 7-day expiration window', async () => {
      mockSupabase.single.mockResolvedValueOnce({
         data: {
            loan_status: 'Requested',
            created_at: '2026-04-01T00:00:00.000Z',
            hash: []
         },
         error: null
      });

      const result = await store.dispatch(
         updateLoanStatus({
            id: 'loan-123',
            loanStatus: 'Lent',
            wallet: '0x123...'
         })
      );

      expect(updateLoanStatus.rejected.match(result)).toBe(true);
      expect(result.error.message).toBe('This loan request has expired. Ask the borrower to post a new request.');
      expect(mockSupabase.update).not.toHaveBeenCalled();
      expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
   });

   it('should NOT trigger the notification if the status is not "Lent"', async () => {
      const loanUpdatePayload = {
         id: 'loan-123',
         loanStatus: 'Pending',
         wallet: '0x123...'
      };

      // Dispatch the thunk
      await store.dispatch(updateLoanStatus(loanUpdatePayload));

      // Assert that the edge function was NOT invoked
      expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
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
