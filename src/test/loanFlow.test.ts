import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import loanReducer, { updateLoanStatus } from '@/store/slices/loanSlice';
import authReducer from '@/store/slices/authSlice';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

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
         update: vi.fn().mockReturnThis(),
         select: vi.fn().mockReturnThis(),
         eq: vi.fn().mockReturnThis(),
         single: vi.fn().mockResolvedValue({
            data: { id: 'loan-123', tracking_id: 'TRK-123', loan_status: 'Lent' },
            error: null
         }),
         functions: {
            invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null })
         }
      };

      (getSupabaseBrowserClient as any).mockReturnValue(mockSupabase);
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
      expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
         loan_status: 'Lent',
         lender_wallet: '0x123...'
      }));

      // Assert that the edge function was invoked
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
         'loan-funded-notification',
         expect.objectContaining({
            body: { loanId: 'loan-123' }
         })
      );
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
   });
});
