import type { UserRole } from '@/types/authTypes';

type WorldIdStatus = 'ACTIVE' | 'INACTIVE' | string | null | undefined;

export const getWorldIdVerificationLabel = ({
   isWorldId,
   userRole
}: {
   isWorldId?: WorldIdStatus;
   userRole?: UserRole | null;
}) => {
   if (isWorldId !== 'ACTIVE') return 'Not Verified';
   if (userRole === 'borrower') return 'Verified Borrower';
   if (userRole === 'lender') return 'Verified Lender';
   return 'Verified';
};
