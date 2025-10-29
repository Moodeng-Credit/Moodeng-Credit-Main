/**
 * Auth-related Zod schemas
 * These schemas validate auth API requests and align with IUser type
 */
import { z } from 'zod';

import {
   emailSchema,
   objectIdSchema,
   optionalGoogleId,
   optionalTelegramId,
   optionalTelegramUsername,
   optionalWalletAddress,
   passwordSchema,
   usernameSchema
} from '@/lib/schemas/fields';
import type { IUser } from '@/types/authTypes';
import { WorldId } from '@/types/authTypes';

/**
 * Registration schema
 * Used for /api/auth/register
 * Supports email/password, Google OAuth, and Telegram auth
 */
export const registerSchema = z.object({
   // Traditional registration
   username: usernameSchema.optional(),
   email: emailSchema.optional(),
   password: passwordSchema.optional(),

   // OAuth credentials
   googleCredential: z.string().optional(),
   telegramAuthData: z.string().optional(),

   // Optional metadata
   telegramUsername: optionalTelegramUsername,
   googleId: optionalGoogleId,
   telegramId: optionalTelegramId
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Login schema
 * Used for /api/auth/login
 * Supports username/password, Google OAuth, and Telegram auth
 */
export const loginSchema = z.object({
   // Traditional login
   username: usernameSchema.optional(),
   password: passwordSchema.optional(),

   // OAuth credentials
   googleCredential: z.string().optional(),
   telegramAuthData: z.string().optional(),

   // Optional metadata
   googleId: optionalGoogleId,
   telegramId: optionalTelegramId,
   telegramUsername: optionalTelegramUsername
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Update user profile schema
 * Used for /api/auth/update and /api/users/update
 */
export const updateUserSchema = z.object({
   username: usernameSchema.optional(),
   email: emailSchema.optional(),
   password: passwordSchema.optional(),
   walletAddress: optionalWalletAddress,
   telegramUsername: optionalTelegramUsername,
   isWorldId: z.enum([WorldId.INACTIVE, WorldId.ACTIVE]).optional(),
   googleId: optionalGoogleId,
   telegramId: optionalTelegramId
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * World ID verification schema
 * Used for /api/auth/verify
 */
export const worldIdVerificationSchema = z.object({
   nullifierHash: z.string().min(1, { message: 'Nullifier hash is required' }),
   proof: z.string().min(1, { message: 'Proof is required' }),
   merkleRoot: z.string().min(1, { message: 'Merkle root is required' }),
   verificationLevel: z.string().optional()
});

export type WorldIdVerificationInput = z.infer<typeof worldIdVerificationSchema>;

/**
 * Test unverify schema (for development/testing)
 * Used for /api/auth/test-unverify
 */
export const testUnverifySchema = z.object({
   userId: objectIdSchema
});

export type TestUnverifyInput = z.infer<typeof testUnverifySchema>;

/**
 * Get user profile by username schema
 * Used for /api/users/profile
 */
export const getUserProfileSchema = z.object({
   username: usernameSchema
});

export type GetUserProfileInput = z.infer<typeof getUserProfileSchema>;

/**
 * User response schema (for API responses)
 * Excludes sensitive fields like password
 */
export const userResponseSchema = z.object({
   _id: z.string(),
   username: z.string(),
   email: z.string(),
   walletAddress: z.string().optional(),
   isWorldId: z.string(),
   telegramUsername: z.string().optional(),
   googleId: z.string().optional(),
   telegramId: z.number().optional(),
   chatId: z.string().optional(),
   mal: z.number(),
   nal: z.number(),
   cs: z.number(),
   createdAt: z.date(),
   updatedAt: z.date()
});

export type UserResponse = z.infer<typeof userResponseSchema>;

/**
 * Utility function to transform a User document to response format
 * Automatically excludes sensitive fields like password
 */
export function transformUserToResponse(user: IUser): UserResponse {
   const EXCLUDED_FIELDS = ['password', '__v'];
   const STRING_FIELDS = ['_id', 'chatId'];
   return Object.fromEntries(
      Object.entries(user.toObject ? user.toObject() : user)
         .filter(([key]) => !EXCLUDED_FIELDS.includes(key))
         .map(([key, value]) => [key, STRING_FIELDS.includes(key) ? value?.toString() : value])
   ) as UserResponse;
}
