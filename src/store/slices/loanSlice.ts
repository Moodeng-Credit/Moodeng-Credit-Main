import type { PayloadAction } from '@reduxjs/toolkit';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { getLoanRequestCooldownMessage, type LoanRequestRepostStatus } from '@/lib/loanRequestRepostStatus';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import { fetchUser } from '@/store/slices/authSlice';
import { type CreateLoanData, type Loan, type LoanState } from '@/types/loanTypes';

const supabaseClient = () => getSupabaseBrowserClient();

type LoanRow = Database['public']['Tables']['loans']['Row'];
type LoanInsert = Database['public']['Tables']['loans']['Insert'];
type LoanRequestRepostStatusRow = Database['public']['Functions']['get_loan_request_repost_status']['Returns'][number];
export type LoanSideEffectError = {
   type: 'award_points' | 'loan_notification' | 'credit_progression';
   message: string;
};

/** Reported by confirm-loan-payment when a repayment raised the borrower's credit limit. */
export type CreditLevelUp = { fromLimit: number; toLimit: number };

/** Thrown when the payment is confirmed-pending on-chain (HTTP 202) — caller should retry later, NOT treat as failure. */
export class PaymentNotConfirmedError extends Error {
   constructor(message = 'Payment is not confirmed on-chain yet') {
      super(message);
      this.name = 'PaymentNotConfirmedError';
   }
}

// Helper function to map Supabase loan row to frontend Loan type
const mapSupabaseLoanToLoan = (row: LoanRow): Loan => ({
   id: row.id,
   trackingId: row.tracking_id,
   borrowerWallet: row.borrower_wallet ?? undefined,
   lenderWallet: row.lender_wallet ?? undefined,
   borrowerUser: row.borrower_user_id ?? undefined,
   lenderUser: row.lender_user_id ?? undefined,
   loanAmount: row.loan_amount,
   repaidAmount: row.repaid_amount,
   totalRepaymentAmount: row.total_repayment_amount,
   reason: row.reason,
   loanStatus: row.loan_status,
   repaymentStatus: row.repayment_status,
   dueDate: row.due_date,
   dueTimezone: row.due_timezone ?? undefined,
   onHoldSince: row.on_hold_since ?? undefined,
   isTest: Boolean((row as { is_test?: boolean | null }).is_test),
   creditLimitAtRepayment:
      (row as { credit_limit_at_repayment?: number | null }).credit_limit_at_repayment == null
         ? undefined
         : Number((row as { credit_limit_at_repayment?: number | null }).credit_limit_at_repayment),
   onHoldReason: row.on_hold_reason ?? undefined,
   coin: row.coin,
   hash: row.hash,
   createdAt: row.created_at,
   updatedAt: row.updated_at,
   fundedAt: row.funded_at ?? undefined,
   referralCodeId: row.referral_code_id ?? undefined,
   referralCode: row.referral_code ?? undefined,
   referralBoostAmount: row.referral_boost_amount ?? undefined,
   interestReturnedAt: row.interest_returned_at ?? undefined,
   interestReturnHash: row.interest_return_hash ?? undefined,
   repaidAt: row.repaid_at ?? undefined,
   refundedAt: row.refunded_at ?? undefined,
   refundReason: row.refund_reason ?? undefined,
   refundHash: row.refund_hash ?? undefined,
   offplatformSettledAt: row.offplatform_settled_at ?? undefined,
   offplatformSettlementNote: row.offplatform_settlement_note ?? undefined
});

const initialState: LoanState = {
   loans: {
      gloans: [],
      floans: []
   },
   userLoansFetchedFor: null,
   userLoansFetchedAt: null,
   isLoading: false,
   error: null
};

const mapLoanRequestRepostStatus = (row?: LoanRequestRepostStatusRow | null): LoanRequestRepostStatus => ({
   deleteCount24h: row?.delete_count_24h ?? 0,
   cooldownUntil: row?.cooldown_until ?? null,
   canCreate: row?.can_create ?? true
});

const fetchLoanRequestRepostStatusFromSupabase = async (supabase: ReturnType<typeof supabaseClient>) => {
   const { data, error } = await supabase.rpc('get_loan_request_repost_status');

   if (error) {
      throw new Error(error.message);
   }

   return mapLoanRequestRepostStatus(Array.isArray(data) ? data[0] : data);
};

export const fetchLoanRequestRepostStatus = createAsyncThunk('loans/fetchLoanRequestRepostStatus', async () => {
   const supabase = supabaseClient();

   return fetchLoanRequestRepostStatusFromSupabase(supabase);
});

export const createLoan = createAsyncThunk('loans/create', async (loanData: CreateLoanData) => {
   const supabase = supabaseClient();
   const repostStatus = await fetchLoanRequestRepostStatusFromSupabase(supabase);

   if (!repostStatus.canCreate) {
      throw new Error(getLoanRequestCooldownMessage(repostStatus));
   }

   // Generate a unique tracking ID
   const trackingId = `LOAN-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

   const loanInsert: LoanInsert = {
      tracking_id: trackingId,
      borrower_wallet: loanData.borrowerWallet || null,
      borrower_user_id: loanData.borrowerUserId || null,
      lender_user_id: loanData.lenderUserId || null, // Use null instead of empty string to avoid FK violation
      loan_amount: loanData.loanAmount,
      total_repayment_amount: loanData.totalRepaymentAmount,
      reason: loanData.reason,
      due_date: loanData.dueDate,
      referral_code_id: loanData.referralCodeId || null,
      referral_code: loanData.referralCode || null,
      referral_boost_amount: loanData.referralBoostAmount ?? null,
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

export const getLenderRepaidCount = createAsyncThunk('loans/getLenderRepaidCount', async (lenderUserId: string) => {
   const supabase = supabaseClient();

   const { count, error } = await supabase
      .from('loans')
      .select('*', { count: 'exact', head: true })
      .eq('lender_user_id', lenderUserId)
      .eq('repayment_status', 'Paid')
      .is('refunded_at', null); // a refund returns the lender's principal but isn't a successful repayment — don't count it

   if (error) {
      throw new Error(error.message);
   }

   return count ?? 0;
});

export const getUserLoans = createAsyncThunk(
   'loans/getUserLoans',
   async ({ userId, username }: { userId?: string | null; username?: string | null }) => {
      const supabase = supabaseClient();

      let resolvedUserId = userId?.trim();
      //TODO: Check if we can remove the deprecated username lookup later
      if (!resolvedUserId && username) {
         const { data: resolvedId, error: profileError } = await supabase.rpc('get_user_id_by_username', {
            p_username: username
         });

         if (profileError) {
            throw new Error(profileError.message);
         }

         resolvedUserId = resolvedId ?? undefined;
      }

      if (!resolvedUserId) {
         return [];
      }

      const { data, error } = await supabase
         .from('loans')
         .select('*')
         .or(`borrower_user_id.eq.${resolvedUserId},lender_user_id.eq.${resolvedUserId}`)
         .order('created_at', { ascending: false });

      if (error) {
         throw new Error(error.message);
      }

      return (data || []).map(mapSupabaseLoanToLoan);
   }
);

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
         state.userLoansFetchedAt = null;
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
            state.loans.floans = [action.payload, ...state.loans.floans.filter((loan) => loan.id !== action.payload.id)];
            state.userLoansFetchedAt = null;
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
         .addCase(getUserLoans.pending, (state) => {
            state.isLoading = true;
            state.error = null;
         })
         .addCase(getUserLoans.fulfilled, (state, action) => {
            state.isLoading = false;
            state.loans.gloans = action.payload;
            state.userLoansFetchedFor = action.meta.arg.userId?.trim() || null;
            state.userLoansFetchedAt = Date.now();
         })
         .addCase(getUserLoans.rejected, (state, action) => {
            state.isLoading = false;
            state.error = (action.error.message as string) || 'Failed to fetch user loans';
         })
         .addCase(confirmLoanPayment.fulfilled, (state, action) => {
            const updatedLoan = action.payload;
            const floanIndex = state.loans.floans.findIndex((loan) => loan.id === updatedLoan.id);
            if (floanIndex !== -1) {
               state.loans.floans[floanIndex] = updatedLoan;
            }
            const gloanIndex = state.loans.gloans.findIndex((loan) => loan.id === updatedLoan.id);
            if (gloanIndex !== -1) {
               state.loans.gloans[gloanIndex] = updatedLoan;
            }
            state.userLoansFetchedAt = null;
         })
         .addCase(confirmLoanPayment.rejected, (state, action) => {
            state.error = (action.error.message as string) || 'Failed to confirm loan payment';
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

/**
 * Server-verified funding/repayment. The client can no longer set loan_status/repayment_status/repaid_amount/hash directly (a DB
 * trigger rejects it) — this invokes the `confirm-loan-payment` Edge Function, which verifies the
 * real on-chain USDC transfer before writing status and running the points/credit/notification
 * side effects server-side. See [[security-lockdown-john-disclosure]].
 *
 * Throws {@link PaymentNotConfirmedError} on a 202 (payment not yet confirmed on-chain) so callers
 * can reconcile-later instead of surfacing a failure — mirrors the Base Pay timeout contract.
 */
export const confirmLoanPayment = createAsyncThunk<
   Loan,
   { loanId: string; hash: string; method: 'wallet' | 'base'; action: 'fund' | 'repay' | 'return-interest' },
   { fulfilledMeta: { sideEffectErrors: LoanSideEffectError[]; creditLevelUp: CreditLevelUp | null } }
>('loans/confirmPayment', async ({ loanId, hash, method, action }, { dispatch, fulfillWithValue }) => {
   const supabase = supabaseClient();

   const { data, error } = await supabase.functions.invoke('confirm-loan-payment', {
      body: { loanId, hash, method, action }
   });

   // A 202 (payment not confirmed yet) comes back as a body with `retry: true` rather than an
   // invoke error; treat it as reconcile-later, not a hard failure.
   if (data?.retry) {
      throw new PaymentNotConfirmedError(data?.error);
   }
   if (error) {
      // supabase-js wraps non-2xx as FunctionsHttpError whose `context` is the raw Response: read the
      // server's message from its JSON body (the app and the reconciler key off it, e.g. "Contact
      // support for a refund" or "already been used").
      const context = (error as { context?: unknown }).context;
      let serverMessage: string | undefined;
      if (context instanceof Response) {
         const body = (await context
            .clone()
            .json()
            .catch(() => null)) as { error?: string; retry?: boolean } | null;
         if (body?.retry) throw new PaymentNotConfirmedError(body.error);
         serverMessage = body?.error;
      } else if (context && typeof context === 'object' && 'error' in context) {
         serverMessage = String((context as { error?: unknown }).error ?? '') || undefined;
      }
      throw new Error(serverMessage || error.message);
   }
   if (data?.error || !data?.loan) {
      throw new Error(data?.error || 'Failed to confirm loan payment');
   }

   const loan = mapSupabaseLoanToLoan(data.loan as LoanRow);

   // A fully-repaid loan may have raised the borrower's credit limit server-side; refresh the
   // signed-in user so the UI reflects it.
   if (action === 'repay' && loan.repaymentStatus === 'Paid') {
      await dispatch(fetchUser());
   }

   return fulfillWithValue(loan, {
      sideEffectErrors: (data.sideEffectErrors as LoanSideEffectError[]) ?? [],
      // Set by the server only when this repayment actually raised the limit (exact, unlike comparing
      // before/after limits in the app, which a referral or admin edit in between could fake).
      creditLevelUp: (data.creditLevelUp as CreditLevelUp | null | undefined) ?? null
   });
});

export const deleteLoan = createAsyncThunk('loans/delete', async (loanId: string) => {
   const supabase = supabaseClient();

   const { data, error } = await supabase.from('loans').delete().eq('id', loanId).select('id').maybeSingle();

   if (error) {
      throw new Error(error.message);
   }

   if (!data?.id) {
      throw new Error('Loan request was not deleted');
   }

   return data.id;
});

export const getLoans = getUserLoans;

export default loanSlice.reducer;
