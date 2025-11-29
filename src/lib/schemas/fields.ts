/**
 * Base field schemas for validation and sanitization
 * These schemas provide reusable validation for common fields
 */
import { z } from 'zod';

/**
 * Username validation schema
 * - 3-20 characters
 * - Alphanumeric, underscore, hyphen only
 * - Automatically sanitizes by removing invalid characters
 */
export const usernameSchema = z
   .string({ message: 'Username is required' })
   .min(3, { message: 'Username must be between 3 and 20 characters' })
   .max(20, { message: 'Username must be between 3 and 20 characters' })
   .regex(/^[a-zA-Z0-9_-]+$/, { message: 'Username can only contain letters, numbers, underscores, and hyphens' })
   .transform((val) => val.trim().replace(/[^a-zA-Z0-9_-]/g, ''));

/**
 * Email validation schema
 * - Valid email format (RFC 5322 simplified)
 * - Max 254 characters
 * - Automatically lowercases and trims
 */
export const emailSchema = z
   .email({ message: 'Invalid email format' })
   .max(254, { message: 'Email is too long' })
   .transform((val) => val.toLowerCase().trim());

/**
 * Password validation schema (for login)
 * - 1-128 characters
 * - No transformation (passwords should not be sanitized)
 */
export const passwordSchema = z
   .string({ message: 'Password is required' })
   .min(1, { message: 'Invalid password' })
   .max(128, { message: 'Invalid password' });

/**
 * Strong password validation schema (for registration and password changes)
 * - Minimum 6 characters
 * - Max 128 characters
 * - Only alphanumeric and allowed special characters: !@#$%^&*()+=._-
 */
export const strongPasswordSchema = z
   .string({ message: 'Password is required' })
   .min(6, { message: 'Password must be at least 6 characters' })
   .max(128, { message: 'Password is too long' })
   .regex(/^[a-zA-Z0-9!@#$%^&*()+=._-]+$/, {
      message: 'Password can only contain letters, numbers, and special characters: !@#$%^&*()+=._-'
   });

/**
 * Ethereum wallet address validation schema
 * - 0x followed by 40 hex characters
 * - Automatically lowercases and trims
 */
export const walletAddressSchema = z
   .string({ message: 'Wallet address is required' })
   .regex(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum wallet address format' })
   .transform((val) => val.trim().toLowerCase());

/**
 * MongoDB ObjectId validation schema
 * - 24 hex characters
 */
export const objectIdSchema = z.string({ message: 'ID is required' }).regex(/^[a-f0-9]{24}$/, { message: 'Invalid ID format' });

/**
 * Positive number validation schema
 */
export const positiveNumberSchema = (fieldName = 'Value') =>
   z
      .union([z.number(), z.string()])
      .refine(
         (val) => {
            const num = typeof val === 'string' ? parseFloat(val) : val;
            return !isNaN(num) && num > 0 && num <= Number.MAX_SAFE_INTEGER;
         },
         {
            message: `${fieldName} must be a positive number`
         }
      )
      .transform((val) => (typeof val === 'string' ? parseFloat(val) : val));

/**
 * Loan amount validation schema
 * - Must be positive (greater than 0)
 * - Max 1 billion
 * Use this for loanAmount and totalRepaymentAmount (total to be repaid)
 */
export const loanAmountSchema = z
   .union([z.number(), z.string()])
   .refine(
      (val) => {
         const num = typeof val === 'string' ? parseFloat(val) : val;
         return !isNaN(num) && num > 0 && num <= 1_000_000_000;
      },
      {
         message: 'Loan amount must be positive and not exceed 1 billion'
      }
   )
   .transform((val) => (typeof val === 'string' ? parseFloat(val) : val));

/**
 * Repaid amount validation schema
 * - Can be 0 or positive (for cumulative repayments that have been made)
 * - Max 1 billion
 * Use this for repaidAmount (cumulative amount already repaid)
 */
export const repaidAmountSchema = z
   .union([z.number(), z.string()])
   .refine(
      (val) => {
         const num = typeof val === 'string' ? parseFloat(val) : val;
         return !isNaN(num) && num >= 0 && num <= 1_000_000_000;
      },
      {
         message: 'Repaid amount must be non-negative and not exceed 1 billion'
      }
   )
   .transform((val) => (typeof val === 'string' ? parseFloat(val) : val));

/**
 * Loan days validation schema
 * - Must be positive integer
 * - Max 3650 days (10 years)
 */
export const loanDaysSchema = z
   .union([z.number(), z.string()])
   .refine(
      (val) => {
         const num = typeof val === 'string' ? parseInt(val, 10) : val;
         return !isNaN(num) && num > 0 && num <= 3650;
      },
      {
         message: 'Loan period must be between 1 and 3650 days (10 years)'
      }
   )
   .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val));

/**
 * Text field validation schema with configurable max length
 */
export const textFieldSchema = (maxLength = 1000, fieldName = 'Field') =>
   z
      .string({ message: `${fieldName} is required` })
      .min(1, { message: `${fieldName} cannot be empty` })
      .max(maxLength, { message: `${fieldName} exceeds maximum length of ${maxLength} characters` })
      .transform((val) =>
         val
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/data:text\/html/gi, '') // Remove data: protocol
            .trim()
      );

/**
 * Telegram username validation schema
 * - 5-32 characters
 * - Alphanumeric and underscore only
 */
export const telegramUsernameSchema = z
   .string({ message: 'Telegram username is required' })
   .min(5, { message: 'Telegram username must be between 5 and 32 characters' })
   .max(32, { message: 'Telegram username must be between 5 and 32 characters' })
   .regex(/^[a-zA-Z0-9_]+$/, { message: 'Telegram username can only contain letters, numbers, and underscores' })
   .transform((val) => val.trim());

/**
 * Google ID validation schema
 * - String format
 * - Max 255 characters
 * - Automatically trims
 */
export const googleIdSchema = z
   .string({ message: 'Google ID is required' })
   .max(255, { message: 'Google ID is too long' })
   .transform((val) => val.trim());

/**
 * Telegram ID validation schema
 * - Positive integer
 * - Max 64-bit integer value
 */
export const telegramIdSchema = z
   .union([z.number(), z.string()])
   .refine(
      (val) => {
         const num = typeof val === 'string' ? parseInt(val, 10) : val;
         return !isNaN(num) && Number.isInteger(num) && num > 0 && num <= Number.MAX_SAFE_INTEGER;
      },
      {
         message: 'Telegram ID must be a positive integer'
      }
   )
   .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val));

/**
 * Boolean validation schema
 */
export const booleanSchema = (fieldName = 'Value') =>
   z.boolean({
      message: `${fieldName} must be a boolean`
   });

/**
 * Optional schemas (for fields that may be undefined)
 */
export const optionalUsername = usernameSchema.optional();
export const optionalEmail = emailSchema.optional();
export const optionalWalletAddress = z.union([walletAddressSchema, z.null(), z.undefined()]).optional();
export const optionalTelegramUsername = telegramUsernameSchema.optional();
export const optionalObjectId = objectIdSchema.optional();
export const optionalGoogleId = googleIdSchema.optional();
export const optionalTelegramId = telegramIdSchema.optional();
