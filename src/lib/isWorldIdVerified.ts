import type { User } from '@/types/authTypes';

/**
 * A user is World ID verified if they completed EITHER the Orb (Proof of Human) flow
 * or the Passport/ID flow. The two are tracked in separate DB columns but are treated
 * as equivalent for everything that gates on verification (borrowing, credit limit,
 * verified badge, etc.).
 */
export const isWorldIdVerified = (user?: Pick<User, 'isWorldId' | 'isWorldIdPassport'> | null): boolean =>
   user?.isWorldId === 'ACTIVE' || user?.isWorldIdPassport === 'ACTIVE';
