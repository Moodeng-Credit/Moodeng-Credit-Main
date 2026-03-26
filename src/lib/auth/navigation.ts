import type { User } from '@/types/authTypes';

/** After sign-in / session restore: onboarding until `user_role` is set in DB. */
export function getPostAuthEntryPath(user: Pick<User, 'userRole'>): '/dashboard' | '/onboarding/role' {
   return user.userRole ? '/dashboard' : '/onboarding/role';
}
