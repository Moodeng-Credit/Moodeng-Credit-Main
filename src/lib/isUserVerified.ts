import { WorldId } from '@/types/authTypes';
import type { User } from '@/types/authTypes';

/**
 * Whether a user has completed identity verification by any supported method
 * (World ID Orb, World ID Passport/ID, or Didit KYC). Use this for "is this
 * borrower verified" gating so all methods grant the same status.
 */
export const isUserVerified = (
   user: Pick<User, 'isWorldId' | 'isWorldIdPassport' | 'isDidit'> | null | undefined
): boolean =>
   user?.isWorldId === WorldId.ACTIVE || user?.isWorldIdPassport === WorldId.ACTIVE || user?.isDidit === WorldId.ACTIVE;

/**
 * Whether the user has submitted Didit ID documents but hasn't been confirmed yet.
 * Lets UI surfaces show "Verification in progress" instead of "Verify Yourself".
 */
export const isVerificationPending = (
   user: Pick<User, 'isDidit' | 'diditSubmittedAt'> | null | undefined
): boolean => !!(user?.diditSubmittedAt && user?.isDidit !== WorldId.ACTIVE);
