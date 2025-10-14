/**
 * Auth-related Zod schemas
 * These schemas validate auth API requests and align with IUser type
 */
import { z } from 'zod';

import {
   emailSchema,
   objectIdSchema,
   optionalTelegramUsername,
   passwordSchema,
   usernameSchema,
   walletAddressSchema
} from '@/lib/schemas/fields';
import { WorldId } from '@/types/authTypes';

/**
 * Registration schema
 * Used for /api/auth/register
 */
export const registerSchema = z.object({
   username: usernameSchema,
   email: emailSchema,
   password: passwordSchema,
   walletAddress: walletAddressSchema,
   telegramUsername: optionalTelegramUsername
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Login schema
 * Used for /api/auth/login
 */
export const loginSchema = z.object({
   username: usernameSchema,
   password: passwordSchema
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
   walletAddress: walletAddressSchema.optional(),
   telegramUsername: optionalTelegramUsername,
   isWorldId: z.enum([WorldId.INACTIVE, WorldId.ACTIVE]).optional()
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
