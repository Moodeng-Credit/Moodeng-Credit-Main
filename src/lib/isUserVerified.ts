import { WorldId } from '@/types/authTypes';
import type { User } from '@/types/authTypes';

/**
 * Whether a user has completed identity verification by any supported method
 * (World ID or Didit KYC). Use this for "is this borrower verified" gating so
 * both methods grant the same status.
 */
export const isUserVerified = (
   user: Pick<User, 'isWorldId' | 'isDidit'> | null | undefined
): boolean => user?.isWorldId === WorldId.ACTIVE || user?.isDidit === WorldId.ACTIVE;
