// Auth hooks
export {
   authKeys,
   useCurrentUser,
   useUserProfile,
   useLogin,
   useLoginWithGoogle,
   useLoginWithTelegram,
   useRegister,
   useRegisterWithGoogle,
   useRegisterWithTelegram,
   useUpdateUser,
   useLogout
} from '@/hooks/api/auth';

// Loan hooks
export { loanKeys, useLoans, useUserLoans, useCreateLoan, useUpdateLoanStatus, useDeleteLoan } from '@/hooks/api/loans';
