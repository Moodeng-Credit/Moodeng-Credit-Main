import type { ToastConfigKey } from '@/components/ToastSystem/types';

import { SUCCESS_CODES, type SuccessCode } from '@/types/successCodes';

export const SUCCESS_CODE_TO_TOAST: Record<SuccessCode, ToastConfigKey | null> = {
   // Auth Success
   [SUCCESS_CODES.AUTH_LOGIN_SUCCESS]: null, // Handled by authSlice, no toast needed
   [SUCCESS_CODES.AUTH_LOGOUT_SUCCESS]: null, // Silent logout
   [SUCCESS_CODES.AUTH_REGISTER_SUCCESS]: null, // Handled by authSlice, no toast needed
   [SUCCESS_CODES.AUTH_UPDATE_SUCCESS]: 'user_update_success',
   [SUCCESS_CODES.AUTH_VERIFY_SUCCESS]: 'verification_success',
   [SUCCESS_CODES.PASSWORD_RESET_EMAIL_SENT]: null, // Message returned in response
   [SUCCESS_CODES.PASSWORD_RESET_SUCCESS]: null, // Message returned in response

   // User Success
   [SUCCESS_CODES.USER_FETCHED]: null, // Silent fetch, no toast
   [SUCCESS_CODES.USER_UPDATED]: 'user_update_success',
   [SUCCESS_CODES.USER_PROFILE_FETCHED]: null, // Silent fetch, no toast

   // Loan Success
   [SUCCESS_CODES.LOAN_CREATED]: 'loan_created',
   [SUCCESS_CODES.LOAN_UPDATED]: 'loan_update_success',
   [SUCCESS_CODES.LOAN_DELETED]: 'loan_delete_success',
   [SUCCESS_CODES.LOAN_FETCHED]: null, // Silent fetch, no toast
   [SUCCESS_CODES.LOANS_FETCHED]: null, // Silent fetch, no toast

   // Other Success
   [SUCCESS_CODES.WEBHOOK_PROCESSED]: null, // Backend operation, no toast

   // Generic Success
   [SUCCESS_CODES.SUCCESS]: null // Generic, use specific codes instead
};

export function getToastKeyFromSuccessCode(successCode: SuccessCode): ToastConfigKey | null {
   return SUCCESS_CODE_TO_TOAST[successCode] || null;
}
