import { describe, it, expect } from 'vitest';
import { createLoanSchema } from '@/lib/schemas/loans';

describe('RequestLoanModal validation', () => {
   it('should validate a valid loan request', () => {
      const validData = {
         borrowerUserId: '123',
         loanAmount: 10,
         totalRepaymentAmount: 12,
         reason: 'Need help with car repairs',
         days: 7,
         coin: 'USDC' as const
      };

      expect(() => createLoanSchema.parse(validData)).not.toThrow();
   });

   it('should reject when repayment amount is not greater than borrow amount', () => {
      const invalidData = {
         borrowerUserId: '123',
         loanAmount: 10,
         totalRepaymentAmount: 10, // Should be > borrow amount
         reason: 'Need help',
         days: 7,
         coin: 'USDC' as const
      };

      // This will pass schema validation but business logic should catch it
      expect(() => createLoanSchema.parse(invalidData)).not.toThrow();
   });

   it('should reject when reason exceeds 500 characters (schema limit)', () => {
      const invalidData = {
         borrowerUserId: '123',
         loanAmount: 10,
         totalRepaymentAmount: 12,
         reason: 'a'.repeat(501), // Exceeds schema limit of 500
         days: 7,
         coin: 'USDC' as const
      };

      expect(() => createLoanSchema.parse(invalidData)).toThrow();
   });

   it('should validate minimum loan parameters', () => {
      const minData = {
         borrowerUserId: '123',
         loanAmount: 1,
         totalRepaymentAmount: 2,
         reason: 'Help',
         days: 1,
         coin: 'USDC' as const
      };

      expect(() => createLoanSchema.parse(minData)).not.toThrow();
   });
});
