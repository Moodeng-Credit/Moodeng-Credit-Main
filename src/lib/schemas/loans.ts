/**
 * Loan-related Zod schemas
 * These schemas validate loan API requests and align with ILoan type
 */
import { z } from 'zod';

import {
   loanAmountSchema,
   loanDaysSchema,
   objectIdSchema,
   optionalObjectId,
   repaidAmountSchema,
   textFieldSchema
} from '@/lib/schemas/fields';
import { LoanStatus, RepaymentStatus } from '@/types/loanTypes';

/**
 * Create loan schema
 * Used for /api/loans/create
 */
export const createLoanSchema = z.object({
   borrowerUserId: z.string().min(1, { message: 'Borrower user ID is required' }),
   loanAmount: loanAmountSchema,
   totalRepaymentAmount: loanAmountSchema, // Total amount to be repaid (principal + interest) - must be provided
   reason: textFieldSchema(500, 'Reason'),
   days: loanDaysSchema,
   block: z.string().optional().default('0'),
   coin: z.literal('USDC').default('USDC')
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;

/**
 * Update loan schema
 * Used for /api/loans/update and /api/loans/edit
 */
export const updateLoanSchema = z.object({
   loanId: objectIdSchema,
   loanAmount: loanAmountSchema.optional(),
   repaidAmount: repaidAmountSchema.optional(), // Can be 0 (no repayments yet)
   totalRepaymentAmount: loanAmountSchema.optional(),
   reason: textFieldSchema(500, 'Reason').optional(),
   loanStatus: z.enum([LoanStatus.REQUESTED, LoanStatus.LENT]).optional(),
   repaymentStatus: z.enum([RepaymentStatus.UNPAID, RepaymentStatus.PARTIAL, RepaymentStatus.PAID]).optional(),
   days: loanDaysSchema.optional(),
   block: z.string().optional(),
   coin: z.literal('USDC').optional(),
   hash: z.array(z.string()).optional()
});

export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;

/**
 * Delete loan schema
 * Used for /api/loans/delete
 */
export const deleteLoanSchema = z.object({
   loanId: objectIdSchema
});

export type DeleteLoanInput = z.infer<typeof deleteLoanSchema>;

/**
 * Get loan schema
 * Used for /api/loans/get
 */
export const getLoanSchema = z.object({
   loanId: objectIdSchema
});

export type GetLoanInput = z.infer<typeof getLoanSchema>;

/**
 * Fetch loans schema (query params)
 * Used for /api/loans/fetch
 */
export const fetchLoansSchema = z.object({
   userId: optionalObjectId,
   status: z.enum([LoanStatus.REQUESTED, LoanStatus.LENT]).optional(),
   limit: z.coerce.number().int().positive().max(100, { message: 'Limit cannot exceed 100' }).optional().default(50),
   offset: z.coerce.number().int().min(0, { message: 'Offset must be at least 0' }).optional().default(0)
});

export type FetchLoansInput = z.infer<typeof fetchLoansSchema>;

/**
 * Hash loan transaction schema
 * Used for /api/loans/hash
 */
export const hashLoanSchema = z.object({
   loanId: objectIdSchema,
   hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, { message: 'Invalid transaction hash' })
});

export type HashLoanInput = z.infer<typeof hashLoanSchema>;
